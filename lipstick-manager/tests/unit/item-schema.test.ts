import { describe, expect, it } from "vitest";
import { createItemWriteSchema, draftPayloadSchema } from "@/lib/domain/item-schema";

const validInput = {
  display_name: "03号口红",
  brand: null,
  series: null,
  shade_code: "03",
  color_family: null,
  color_family_confirmed: true,
  color_description: null,
  texture: null,
  lifecycle: "unknown" as const,
  opened_on: null,
  opening_precision: "unknown" as const,
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

describe("item write schema", () => {
  it("allows the minimum manual pending-classification record", () => {
    expect(createItemWriteSchema("2026-11-04").safeParse(validInput).success).toBe(true);
  });

  it("requires an explicit color decision and rejects future dates", () => {
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      color_family_confirmed: false,
      lifecycle: "opened",
      opened_on: "2026-11-05",
      opening_precision: "exact",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.color_family_confirmed).toBeDefined();
      expect(result.error.flatten().fieldErrors.opened_on).toBeDefined();
    }
  });

  it("requires matching expiry source and rejects a foreign cover image", () => {
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      expires_on: "2026-12-01",
      image_ids: [],
      cover_image_id: "4cf43d3d-f005-49cc-b03a-32f05dcaa735",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.expiry_source).toBeDefined();
      expect(result.error.flatten().fieldErrors.cover_image_id).toBeDefined();
    }
  });

  it("accepts incomplete but bounded draft content", () => {
    expect(
      draftPayloadSchema.safeParse({ display_name: "", color_family_confirmed: false }).success,
    ).toBe(true);
    expect(draftPayloadSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
  });
});
