import type { AIEnv } from "@/lib/config/env";
import { aiModelResultSchema, type AIModelResult } from "@/lib/domain/ai-intake";

export class AIProviderError extends Error {
  constructor(public code: "DEPENDENCY_UNAVAILABLE" | "AI_OUTPUT_INVALID" | "TIMED_OUT", public diagnostic?: unknown) { super(code); }
}

type ImageInput = { mimeType: string; bytes: Uint8Array };
type SearchResult = { title: string; url: string; snippet: string; summary: string };

const nullableString = { type: ["string", "null"] };
const nullableDate = { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] };
const identityProperties = { brand: nullableString, series: nullableString, shade_code: nullableString };
const resultJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["identity", "candidates", "suggestions", "image_evidence", "unresolved_fields", "warnings"],
  properties: {
    identity: { type: "object", additionalProperties: false, required: ["brand", "series", "shade_code"], properties: identityProperties },
    candidates: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["brand", "series", "shade_code", "label", "confidence"], properties: { ...identityProperties, label: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } } } },
    suggestions: { type: "object", additionalProperties: false, required: ["color_family", "color_description", "texture", "pao_months", "manufactured_on", "shelf_life_months", "expires_on"], properties: { color_family: { enum: ["nude", "rose", "orange", "red", "plum", "brown", null] }, color_description: nullableString, texture: nullableString, pao_months: { type: ["integer", "null"], minimum: 1, maximum: 120 }, manufactured_on: nullableDate, shelf_life_months: { type: ["integer", "null"], minimum: 1, maximum: 240 }, expires_on: nullableDate } },
    image_evidence: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, required: ["field", "image_index", "excerpt"], properties: { field: { type: "string" }, image_index: { type: "integer", minimum: 0, maximum: 2 }, excerpt: nullableString } } },
    unresolved_fields: { type: "array", maxItems: 20, items: { type: "string" } },
    warnings: { type: "array", maxItems: 20, items: { type: "string" } },
  },
};

function withTimeout(ms: number): AbortSignal { return AbortSignal.timeout(ms); }
function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => typeof item === "object" && item && Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [])
    .map((part) => typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "").join("");
}

export class DeepSeekProvider {
  private deadline = 0;
  constructor(private env: AIEnv) {}
  estimateMaximumCostCny(): number {
    const modelUsd = (30_000 * 0.3 + 4_000 * 1.2) / 1_000_000;
    const toolsUsd = 5 * 0.75 / 1_000;
    return (modelUsd + toolsUsd) * this.env.AI_USD_CNY_RATE;
  }

  private async request(path: string, body: unknown, timeout = 15_000) {
    const operationDeadline = Date.now() + Math.min(timeout, Math.max(1, this.deadline - Date.now()));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const remaining = operationDeadline - Date.now();
        if (remaining <= 0) throw new AIProviderError("TIMED_OUT");
        const response = await fetch(`https://api.deepseek.com${path}`, {
          method: "POST", signal: withTimeout(remaining),
          headers: { Authorization: `Bearer ${this.env.AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          if (attempt === 0 && [408, 429, 500, 502, 503, 504].includes(response.status)) continue;
          throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
        }
        return await response.json() as Record<string, unknown>;
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (error instanceof DOMException && error.name === "TimeoutError") throw new AIProviderError("TIMED_OUT");
        if (attempt === 0) continue;
        throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
      }
    }
    throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
  }

  private async recognize(images: ImageInput[], context = ""): Promise<{ result: AIModelResult; usage: unknown }> {
    const prompt = `你是口红包装识别助手。只依据图片和提供的网页证据提取信息；不确定就返回 null，禁止猜测生产批号日期。颜色族只能是 nude/rose/orange/red/plum/brown/null，其中桃色归入 nude。日期只有在图片明确给出完整年月日时才返回 YYYY-MM-DD，否则返回 null。必须按指定 JSON Schema 返回全部字段。${context}`;
    const response = await this.request("/v1/responses", {
      model: this.env.AI_MODEL, reasoning: { effort: "none" }, max_output_tokens: 2000,
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        ...images.map((image) => ({ type: "input_image", detail: "original", image_url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}` })),
      ] }],
      text: { format: { type: "json_schema", name: "lipstick_intake_result", schema: resultJsonSchema } },
    });
    const text = outputText(response);
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { throw new AIProviderError("AI_OUTPUT_INVALID", { output_length: text.length, reason: "invalid_json" }); }
    if (parsed && typeof parsed === "object" && "suggestions" in parsed) {
      const record = parsed as { suggestions?: Record<string, unknown>; warnings?: unknown };
      for (const field of ["manufactured_on", "expires_on"]) {
        const value = record.suggestions?.[field];
        if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          record.suggestions![field] = null;
          const warnings = Array.isArray(record.warnings) ? record.warnings : [];
          warnings.push(`${field} 仅识别到不完整日期，已按契约忽略`);
          record.warnings = warnings;
        }
      }
    }
    const validated = aiModelResultSchema.safeParse(parsed);
    if (!validated.success) throw new AIProviderError("AI_OUTPUT_INVALID", { output_length: text.length, issues: validated.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
    return { result: validated.data, usage: response.usage ?? null };
  }

  async run(images: ImageInput[], confirmedIdentity?: { brand: string | null; series: string | null; shade_code: string | null }) {
    this.deadline = Date.now() + 45_000;
    const identityContext = confirmedIdentity && Object.values(confirmedIdentity).some(Boolean)
      ? `\n用户已经手工确认的身份字段如下，必须原样保留，不得提出冲突覆盖：${JSON.stringify(confirmedIdentity)}` : "";
    const first = await this.recognize(images, identityContext);
    const identity = first.result.identity;
    const query = [identity.brand, identity.series, identity.shade_code].filter(Boolean).join(" ");
    if (!query) return { ...first, webEvidence: [] as SearchResult[], toolUsage: { search: 0, fetch: 0 } };
    const search = await this.request("/v1/tools/search", { query, count: 3, need_content: false });
    const results = (Array.isArray(search.results) ? search.results : []).slice(0, 3) as SearchResult[];
    const fetched: Array<SearchResult & { content: string }> = [];
    const result = results[0];
    if (result) try { const page = await this.request("/v1/tools/fetch", { url: result.url }); fetched.push({ ...result, content: String(page.content ?? "").slice(0, 6000) }); } catch { /* partial search result remains useful */ }
    if (!fetched.length) return { ...first, webEvidence: results, toolUsage: { search: results.length ? 1 : 0, fetch: 0 } };
    const second = await this.recognize(images, `${identityContext}\n候选网页证据：\n${fetched.map((page) => `${page.title}\n${page.url}\n${page.content}`).join("\n---\n")}`);
    return { result: second.result, usage: { first: first.usage, second: second.usage }, webEvidence: fetched, toolUsage: { search: results.length ? 1 : 0, fetch: fetched.length } };
  }
}
