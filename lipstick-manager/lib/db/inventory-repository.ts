import type { SupabaseClient } from "@supabase/supabase-js";
import type { Draft, ItemImage, LipstickItem } from "@/lib/domain/item";
import type { DraftPayload, ItemWriteInput } from "@/lib/domain/item-schema";
import { calculateDeadline } from "@/lib/domain/deadline";
import { localToday } from "@/lib/domain/local-date";

type ItemRow = Omit<
  LipstickItem,
  | "pao_deadline"
  | "calculated_expiry"
  | "effective_expiry"
  | "deadline"
  | "deadline_basis"
  | "days_left"
  | "deadline_status"
  | "images"
>;

export class InventoryDependencyError extends Error {
  constructor() {
    super("Inventory persistence is unavailable");
    this.name = "InventoryDependencyError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was reused with different input");
    this.name = "IdempotencyConflictError";
  }
}

function withDeadline(row: ItemRow): LipstickItem {
  return {
    ...row,
    images: [],
    ...calculateDeadline(
      {
        lifecycle: row.lifecycle,
        opened_on: row.opened_on,
        opening_precision: row.opening_precision,
        pao_months: row.pao_months,
        manufactured_on: row.manufactured_on,
        shelf_life_months: row.shelf_life_months,
        expires_on: row.expires_on,
      },
      localToday(),
    ),
  };
}

export class InventoryRepository {
  constructor(private readonly client: SupabaseClient, private readonly bucket: string) {}

  private async signedImages(itemId: string): Promise<ItemImage[]> {
    const { data, error } = await this.client
      .from("lipstick_images")
      .select("id,storage_path,position")
      .eq("item_id", itemId)
      .eq("status", "attached")
      .order("position");
    if (error) throw new InventoryDependencyError();
    return Promise.all((data ?? []).map(async (image) => {
      const signed = await this.client.storage.from(this.bucket).createSignedUrl(image.storage_path, 300);
      if (signed.error || !signed.data?.signedUrl) throw new InventoryDependencyError();
      return { id: image.id, url: signed.data.signedUrl, position: image.position };
    }));
  }

  async getOrCreateNewDraft(): Promise<Draft> {
    const existing = await this.getCurrentNewDraft();
    if (existing) return existing;

    const { data, error } = await this.client
      .from("drafts")
      .insert({ kind: "new", payload: {} })
      .select("*")
      .single<Draft>();
    if (!error && data) return data;
    if (error?.code === "23505") {
      const racedDraft = await this.getCurrentNewDraft();
      if (racedDraft) return racedDraft;
    }
    throw new InventoryDependencyError();
  }

  async getCurrentNewDraft(): Promise<Draft | null> {
    const { data, error } = await this.client
      .from("drafts")
      .select("*")
      .eq("kind", "new")
      .maybeSingle<Draft>();
    if (error) throw new InventoryDependencyError();
    return data;
  }

  async saveNewDraft(id: string, payload: DraftPayload): Promise<Draft | null> {
    const { data, error } = await this.client
      .from("drafts")
      .update({
        payload,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000).toISOString(),
      })
      .eq("id", id)
      .eq("kind", "new")
      .select("*")
      .maybeSingle<Draft>();
    if (error) throw new InventoryDependencyError();
    return data;
  }

  async deleteNewDraft(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("drafts")
      .delete()
      .eq("id", id)
      .eq("kind", "new")
      .select("id");
    if (error) throw new InventoryDependencyError();
    return Boolean(data?.length);
  }

  async createItem(
    input: ItemWriteInput,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<LipstickItem> {
    const item = {
      display_name: input.display_name,
      brand: input.brand,
      series: input.series,
      shade_code: input.shade_code,
      color_family: input.color_family,
      color_description: input.color_description,
      texture: input.texture,
      lifecycle: input.lifecycle,
      opened_on: input.opened_on,
      opening_precision: input.opening_precision,
      pao_months: input.pao_months,
      manufactured_on: input.manufactured_on,
      shelf_life_months: input.shelf_life_months,
      expires_on: input.expires_on,
      expiry_source: input.expiry_source,
      note: input.note,
    };
    const { data, error } = await this.client
      .rpc("create_lipstick_item", {
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_item: item,
      })
      .single<ItemRow>();
    if (error?.message.includes("IDEMPOTENCY_CONFLICT")) {
      throw new IdempotencyConflictError();
    }
    if (error || !data) throw new InventoryDependencyError();
    return withDeadline(data);
  }

  async getItem(id: string): Promise<LipstickItem | null> {
    const { data, error } = await this.client
      .from("lipstick_items")
      .select("*")
      .eq("id", id)
      .neq("lifecycle", "discarded")
      .maybeSingle<ItemRow>();
    if (error) throw new InventoryDependencyError();
    if (!data) return null;
    return { ...withDeadline(data), images: await this.signedImages(id) };
  }

  async listCurrentItems(): Promise<LipstickItem[]> {
    const { data, error } = await this.client
      .from("lipstick_items")
      .select("*")
      .neq("lifecycle", "discarded");
    if (error) throw new InventoryDependencyError();
    return Promise.all((data ?? []).map(async (row) => ({
      ...withDeadline(row as ItemRow),
      images: await this.signedImages((row as ItemRow).id),
    })));
  }
}

export type InventoryStore = Pick<
  InventoryRepository,
  | "getOrCreateNewDraft"
  | "getCurrentNewDraft"
  | "saveNewDraft"
  | "deleteNewDraft"
  | "createItem"
  | "getItem"
  | "listCurrentItems"
>;
