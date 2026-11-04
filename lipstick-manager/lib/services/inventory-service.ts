import { createHash } from "node:crypto";
import type { Draft, LipstickItem } from "@/lib/domain/item";
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
}

export type { DraftPayload, ItemWriteInput };
