import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIEnv } from "@/lib/config/env";
import { aiConsentVersion, aiIdentitySchema, aiSchemaVersion, aiWorkflowVersion } from "@/lib/domain/ai-intake";
import { DeepSeekProvider, AIProviderError } from "@/lib/ai/providers/deepseek";
import { InventoryDependencyError } from "@/lib/db/inventory-repository";
import { InventoryNotFoundError, InventoryValidationError } from "@/lib/services/inventory-service";

const createTaskSchema = z.object({
  draft_id: z.uuid(), image_ids: z.array(z.uuid()).min(1).max(3),
  consent_version: z.literal(aiConsentVersion), confirmed_identity: aiIdentitySchema,
}).strict();

export class AITaskService {
  constructor(private client: SupabaseClient, private bucket: string, private env: AIEnv) {}
  async create(raw: unknown) {
    const parsed = createTaskSchema.safeParse(raw);
    if (!parsed.success) throw new InventoryValidationError({ ai: "请先选择图片并确认图片外传说明" });
    const provider = new DeepSeekProvider(this.env);
    const estimate = provider.estimateMaximumCostCny();
    if (estimate > this.env.AI_MAX_COST_CNY) throw new InventoryValidationError({ ai: "预计费用超过单次预算上限" });
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await this.client.from("ai_tasks").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (recent.error) throw new InventoryDependencyError();
    if ((recent.count ?? 0) >= 10) throw new InventoryValidationError({ ai: "识别请求过于频繁，请稍后再试" });
    const { data: images, error } = await this.client.from("lipstick_images").select("id").eq("draft_id", parsed.data.draft_id).in("id", parsed.data.image_ids).not("width", "is", null);
    if (error) throw new InventoryDependencyError();
    if ((images ?? []).length !== parsed.data.image_ids.length) throw new InventoryValidationError({ image_ids: "图片不存在、未完成或不属于当前草稿" });
    const inserted = await this.client.from("ai_tasks").insert({
      draft_id: parsed.data.draft_id, status: "queued", workflow_version: aiWorkflowVersion,
      schema_version: aiSchemaVersion, provider: this.env.AI_PROVIDER, model: this.env.AI_MODEL,
      input_image_ids: parsed.data.image_ids, estimated_cost_cny: estimate,
      result: { consent_version: parsed.data.consent_version, confirmed_identity: parsed.data.confirmed_identity },
    }).select("id,status").single();
    if (inserted.error || !inserted.data) throw new InventoryDependencyError();
    return { task_id: inserted.data.id, status: inserted.data.status };
  }

  async run(id: string) {
    const started = Date.now();
    const taskResult = await this.client.from("ai_tasks").select("*").eq("id", id).eq("status", "queued").maybeSingle();
    if (taskResult.error || !taskResult.data) return;
    await this.client.from("ai_tasks").update({ status: "recognizing", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "queued");
    try {
      const imageRows = await this.client.from("lipstick_images").select("id,storage_path,mime_type").in("id", taskResult.data.input_image_ids).order("position");
      if (imageRows.error || !imageRows.data) throw new InventoryDependencyError();
      const images = await Promise.all(imageRows.data.map(async (image) => {
        const file = await this.client.storage.from(this.bucket).download(image.storage_path);
        if (file.error || !file.data) throw new InventoryDependencyError();
        return { id: image.id, mimeType: image.mime_type, bytes: new Uint8Array(await file.data.arrayBuffer()) };
      }));
      const providerResult = await new DeepSeekProvider(this.env).run(images);
      const current = await this.client.from("ai_tasks").select("status").eq("id", id).single();
      if (current.data?.status === "cancelled") return;
      const evidence = providerResult.result.image_evidence.map((entry) => ({
        ai_task_id: id, field_name: entry.field, kind: "image", image_id: images[entry.image_index]?.id, excerpt: entry.excerpt,
      })).filter((entry) => entry.image_id);
      evidence.push(...providerResult.webEvidence.slice(0, 3).map((entry) => ({ ai_task_id: id, field_name: "identity", kind: "official", image_id: null, excerpt: entry.snippet?.slice(0, 500) ?? null, url: entry.url, retrieved_at: new Date().toISOString() })) as never[]);
      if (evidence.length) await this.client.from("evidence").insert(evidence);
      const evidenceRows = await this.client.from("evidence").select("id,field_name,kind,url,image_id,excerpt,retrieved_at").eq("ai_task_id", id);
      await this.client.from("ai_tasks").update({
        status: providerResult.result.unresolved_fields.length ? "partial" : "complete",
        result: { ...providerResult.result, evidence: evidenceRows.data ?? [] }, usage_json: providerResult.usage,
        duration_ms: Date.now() - started, updated_at: new Date().toISOString(),
      }).eq("id", id).neq("status", "cancelled");
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : "DEPENDENCY_UNAVAILABLE";
      await this.client.from("ai_tasks").update({ status: code === "TIMED_OUT" ? "timed_out" : "failed", error_code: code, duration_ms: Date.now() - started, updated_at: new Date().toISOString() }).eq("id", id).neq("status", "cancelled");
    }
  }

  async get(id: string) {
    const result = await this.client.from("ai_tasks").select("id,status,schema_version,result,error_code,duration_ms,estimated_cost_cny").eq("id", id).maybeSingle();
    if (result.error) throw new InventoryDependencyError(); if (!result.data) throw new InventoryNotFoundError();
    return { task_id: result.data.id, status: result.data.status, schema_version: result.data.schema_version, ...(result.data.result ?? {}), error_code: result.data.error_code, duration_ms: result.data.duration_ms, estimated_cost_cny: result.data.estimated_cost_cny };
  }
  async cancel(id: string) {
    const result = await this.client.from("ai_tasks").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).in("status", ["queued", "recognizing", "needs_confirmation", "researching"]).select("id").maybeSingle();
    if (result.error) throw new InventoryDependencyError(); if (!result.data) throw new InventoryNotFoundError();
  }
}
