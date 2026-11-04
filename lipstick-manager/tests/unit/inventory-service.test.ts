import { describe, expect, it, vi } from "vitest";
import type { InventoryStore } from "@/lib/db/inventory-repository";
import type { Draft, LipstickItem } from "@/lib/domain/item";
import { InventoryService, InventoryValidationError, RevisionConflictError } from "@/lib/services/inventory-service";

const draft: Draft = {
  id: "c085b980-b24d-4d85-884d-42acf1bf7652",
  kind: "new",
  item_id: null,
  base_revision: null,
  payload: {},
  suggestion_version: 0,
  updated_at: "2026-11-04T00:00:00.000Z",
  expires_at: "2027-02-02T00:00:00.000Z",
};

const item = { id: "4cf43d3d-f005-49cc-b03a-32f05dcaa735", revision: 1 } as LipstickItem;

function createStore(): InventoryStore {
  return {
    getOrCreateNewDraft: vi.fn().mockResolvedValue(draft),
    getCurrentNewDraft: vi.fn().mockResolvedValue(draft),
    saveNewDraft: vi.fn().mockResolvedValue(draft),
    deleteNewDraft: vi.fn().mockResolvedValue(true),
    createItem: vi.fn().mockResolvedValue(item),
    getItem: vi.fn().mockResolvedValue(item),
    listCurrentItems: vi.fn().mockResolvedValue([]),
    updateItem: vi.fn().mockResolvedValue(item),
    discardItem: vi.fn().mockResolvedValue(item),
    deleteItem: vi.fn().mockResolvedValue(true),
  };
}

const validInput = {
  display_name: "手填口红",
  brand: null,
  series: null,
  shade_code: null,
  color_family: null,
  color_family_confirmed: true,
  color_description: null,
  texture: null,
  lifecycle: "unknown",
  opened_on: null,
  opening_precision: "unknown",
  pao_months: null,
  manufactured_on: null,
  shelf_life_months: null,
  expires_on: null,
  expiry_source: null,
  note: null,
  image_ids: [],
  cover_image_id: null,
  accepted_ai_task_id: null,
};

describe("inventory service", () => {
  it("saves incomplete drafts without creating inventory", async () => {
    const store = createStore();
    const service = new InventoryService(store);
    await expect(service.saveNewDraft(draft.id, { display_name: "" })).resolves.toEqual(draft);
    expect(store.saveNewDraft).toHaveBeenCalledWith(draft.id, { display_name: "" });
    expect(store.createItem).not.toHaveBeenCalled();
  });

  it("creates a no-image item with a stable request hash", async () => {
    const store = createStore();
    const service = new InventoryService(store);
    const key = "ca29a3a8-8c79-4439-a8a4-e002a8a2434c";
    await service.createItem(validInput, key);
    await service.createItem(validInput, key);
    const firstHash = vi.mocked(store.createItem).mock.calls[0]?.[2];
    const secondHash = vi.mocked(store.createItem).mock.calls[1]?.[2];
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toBe(firstHash);
  });

  it("rejects images and AI bindings before their stages", async () => {
    const service = new InventoryService(createStore());
    await expect(
      service.createItem(
        { ...validInput, image_ids: ["7bb11a3e-a2a0-4f71-8294-2c2472604579"] },
        "ca29a3a8-8c79-4439-a8a4-e002a8a2434c",
      ),
    ).rejects.toBeInstanceOf(InventoryValidationError);
  });

  it("treats invalid item ids as not found without querying storage", async () => {
    const store = createStore();
    const service = new InventoryService(store);
    await expect(service.getItem("not-a-uuid")).rejects.toMatchObject({
      name: "InventoryNotFoundError",
    });
    expect(store.getItem).not.toHaveBeenCalled();
  });

  it("combines inventory filters while keeping the unfiltered summary", async () => {
    const store = createStore();
    const rose = { ...item, lifecycle: "opened", color_family: "rose", brand: "甲", deadline_status: "days_1_30", days_left: 10, deadline: "2026-11-14", created_at: "2026-11-01" } as LipstickItem;
    const nude = { ...item, id: "5cf43d3d-f005-49cc-b03a-32f05dcaa735", lifecycle: "unopened", color_family: "nude", brand: "乙", deadline_status: "unknown", days_left: null, deadline: null, created_at: "2026-11-02" } as LipstickItem;
    vi.mocked(store.listCurrentItems).mockResolvedValue([nude, rose]);
    const result = await new InventoryService(store).listItems({ life: "opened", color: "rose", time: "days_0_30" });
    expect(result.items.map((entry) => entry.id)).toEqual([rose.id]);
    expect(result.summary).toEqual({ current: 2, opened: 1, due_0_30: 1 });
    expect(result.brands).toEqual(["甲", "乙"]);
  });

  it("rejects an edit made from a stale revision", async () => {
    const store = createStore();
    const service = new InventoryService(store);
    await expect(service.updateItem(item.id, 2, validInput)).rejects.toBeInstanceOf(RevisionConflictError);
    expect(store.updateItem).not.toHaveBeenCalled();
  });
});
