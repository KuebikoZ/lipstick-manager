import { createHash } from "node:crypto";
import type { Draft, InventoryListResult, LipstickItem } from "@/lib/domain/item";
import { colorFamilySchema } from "@/lib/domain/inventory";
import {
  createItemWriteSchema,
  draftPayloadSchema,
  type DraftPayload,
  type ItemWriteInput,
} from "@/lib/domain/item-schema";
import { localToday } from "@/lib/domain/local-date";
import { z } from "zod";
import {
  IdempotencyConflictError,
  RevisionConflictError,
  type InventoryStore,
} from "@/lib/db/inventory-repository";

export class InventoryValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Inventory input is invalid");
    this.name = "InventoryValidationError";
  }
}

export class InventoryNotFoundError extends Error {
  constructor() {
    super("Inventory resource was not found");
    this.name = "InventoryNotFoundError";
  }
}

export { IdempotencyConflictError };
export { RevisionConflictError };

function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  return Object.fromEntries(
    issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export class InventoryService {
  constructor(private readonly repository: InventoryStore) {}

  getOrCreateNewDraft(): Promise<Draft> {
    return this.repository.getOrCreateNewDraft();
  }

  getCurrentNewDraft(): Promise<Draft | null> {
    return this.repository.getCurrentNewDraft();
  }

  async saveNewDraft(id: string, rawPayload: unknown): Promise<Draft> {
    const parsed = draftPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      throw new InventoryValidationError(fieldErrorsFromIssues(parsed.error.issues));
    }
    const draft = await this.repository.saveNewDraft(id, parsed.data);
    if (!draft) throw new InventoryNotFoundError();
    return draft;
  }

  async deleteNewDraft(id: string): Promise<void> {
    if (!(await this.repository.deleteNewDraft(id))) throw new InventoryNotFoundError();
  }

  async createItem(rawInput: unknown, idempotencyKey: string): Promise<LipstickItem> {
    const parsed = createItemWriteSchema(localToday()).safeParse(rawInput);
    if (!parsed.success) {
      throw new InventoryValidationError(fieldErrorsFromIssues(parsed.error.issues));
    }
    if (parsed.data.image_ids.length > 0 || parsed.data.accepted_ai_task_id) {
      throw new InventoryValidationError({ image_ids: "图片与 AI 建议将在后续阶段开放" });
    }
    const requestHash = createHash("sha256")
      .update(canonicalJson(parsed.data))
      .digest("hex");
    return this.repository.createItem(parsed.data, idempotencyKey, requestHash);
  }

  async getItem(id: string): Promise<LipstickItem> {
    if (!z.uuid().safeParse(id).success) throw new InventoryNotFoundError();
    const item = await this.repository.getItem(id);
    if (!item) throw new InventoryNotFoundError();
    return item;
  }

  async listItems(rawQuery: Record<string, string | undefined>): Promise<InventoryListResult> {
    const querySchema = z.object({
      life: z.enum(["opened", "unopened", "unknown"]).optional(),
      time: z.enum(["over_180", "days_91_180", "days_31_90", "days_0_30", "expired", "unknown"]).optional(),
      color: z.union([colorFamilySchema, z.literal("pending")]).optional(),
      brand: z.string().trim().max(100).optional(),
      sort: z.enum(["expiry", "new", "brand", "color"]).default("expiry"),
    }).safeParse(rawQuery);
    if (!querySchema.success) throw new InventoryValidationError({ query: "筛选或排序参数无效" });
    const all = await this.repository.listCurrentItems();
    const { life, time, color, brand, sort } = querySchema.data;
    const items = all.filter((item) =>
      (!life || item.lifecycle === life) &&
      (!time || (time === "days_0_30" ? item.deadline_status === "days_1_30" || item.deadline_status === "due_today" : item.deadline_status === time)) &&
      (!color || (color === "pending" ? item.color_family === null : item.color_family === color)) &&
      (!brand || item.brand === brand));
    const colorOrder = ["nude", "rose", "orange", "red", "plum", "brown", null];
    items.sort((left, right) => {
      if (sort === "new") return right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id);
      if (sort === "brand") return (left.brand === null ? 1 : right.brand === null ? -1 : left.brand.localeCompare(right.brand, "zh-CN")) || right.created_at.localeCompare(left.created_at);
      if (sort === "color") return colorOrder.indexOf(left.color_family) - colorOrder.indexOf(right.color_family) || right.created_at.localeCompare(left.created_at);
      if (left.deadline === null) return right.deadline === null ? right.created_at.localeCompare(left.created_at) : 1;
      if (right.deadline === null) return -1;
      return left.deadline.localeCompare(right.deadline) || right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id);
    });
    return {
      items,
      summary: {
        current: all.length,
        opened: all.filter((item) => item.lifecycle === "opened").length,
        due_0_30: all.filter((item) => item.days_left !== null && item.days_left >= 0 && item.days_left <= 30).length,
      },
      brands: [...new Set(all.flatMap((item) => item.brand ? [item.brand] : []))].sort((a, b) => a.localeCompare(b, "zh-CN")),
      next_cursor: null,
    };
  }

  async updateItem(id: string, revision: number, rawInput: unknown): Promise<LipstickItem> {
    if (!z.uuid().safeParse(id).success || !Number.isInteger(revision) || revision < 1) throw new InventoryNotFoundError();
    const parsed = createItemWriteSchema(localToday()).safeParse(rawInput);
    if (!parsed.success) throw new InventoryValidationError(fieldErrorsFromIssues(parsed.error.issues));
    const current = await this.getItem(id);
    if (current.revision !== revision) throw new RevisionConflictError();
    const updated = await this.repository.updateItem(id, revision, parsed.data);
    if (!updated) throw new RevisionConflictError();
    return updated;
  }

  async discardItem(id: string, revision: number): Promise<LipstickItem> {
    const current = await this.getItem(id);
    if (current.revision !== revision) throw new RevisionConflictError();
    const updated = await this.repository.discardItem(id, revision);
    if (!updated) throw new RevisionConflictError();
    return updated;
  }

  async deleteItem(id: string, revision: number): Promise<void> {
    const current = await this.getItem(id);
    if (current.revision !== revision || !(await this.repository.deleteItem(id, revision))) throw new RevisionConflictError();
  }
}

export type { DraftPayload, ItemWriteInput };
