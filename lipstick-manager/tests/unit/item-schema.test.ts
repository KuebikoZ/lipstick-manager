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

  it("accepts only the confirmed texture options", () => {
    expect(createItemWriteSchema("2026-11-04").safeParse({ ...validInput, texture: "镜面" }).success).toBe(true);
    expect(createItemWriteSchema("2026-11-04").safeParse({ ...validInput, texture: "奶油" }).success).toBe(false);
  });

  it("limits the series to the form contract", () => {
    expect(createItemWriteSchema("2026-11-04").safeParse({ ...validInput, series: "x".repeat(50) }).success).toBe(true);
    expect(createItemWriteSchema("2026-11-04").safeParse({ ...validInput, series: "x".repeat(51) }).success).toBe(false);
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

  it("requires the first image to be the cover", () => {
    const first = "4cf43d3d-f005-49cc-b03a-32f05dcaa735";
    const second = "7bb11a3e-a2a0-4f71-8294-2c2472604579";
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      image_ids: [first, second],
      cover_image_id: second,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.cover_image_id).toContain("第一张图片必须作为封面");
  });

  it("allows a future expiry date when its source is explicit", () => {
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      expires_on: "2027-11-04",
      expiry_source: "explicit",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a future manufacture date", () => {
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      manufactured_on: "2026-11-05",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.manufactured_on).toBeDefined();
    }
  });

  it("rejects a manufacture date later than the explicit expiry date", () => {
    const result = createItemWriteSchema("2026-11-04").safeParse({
      ...validInput,
      manufactured_on: "2026-10-02",
      expires_on: "2026-10-01",
      expiry_source: "explicit",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.manufactured_on).toContain(
        "生产日期不能晚于实物到期日",
      );
    }
  });

  it("accepts incomplete but bounded draft content", () => {
    expect(
      draftPayloadSchema.safeParse({ display_name: "", color_family_confirmed: false }).success,
    ).toBe(true);
    expect(draftPayloadSchema.safeParse({ note: "x".repeat(501) }).success).toBe(false);
  });
});
