import { describe, expect, it } from "vitest";
import {
  createPrivateImagePath,
  detectImageMimeType,
  maxImageByteSize,
  validateImageFileHeader,
} from "@/lib/storage/private-images";

describe("private image validation", () => {
  it("detects supported file signatures", () => {
    expect(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(
      detectImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(detectImageMimeType(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
  });

  it("rejects MIME spoofing and oversized files", () => {
    expect(() =>
      validateImageFileHeader(Uint8Array.from([0xff, 0xd8, 0xff]), "image/png"),
    ).toThrow(TypeError);
    expect(() =>
      validateImageFileHeader(new Uint8Array(maxImageByteSize + 1), "image/jpeg"),
    ).toThrow(RangeError);
  });

  it("creates only server-owned draft paths", () => {
    const path = createPrivateImagePath("c085b980-b24d-4d85-884d-42acf1bf7652", ".jpeg");
    expect(path).toMatch(/^drafts\/c085b980-b24d-4d85-884d-42acf1bf7652\/[0-9a-f-]+\.jpg$/);
    expect(() => createPrivateImagePath("../escape", "jpg")).toThrow(TypeError);
    expect(() =>
      createPrivateImagePath("c085b980-b24d-4d85-884d-42acf1bf7652", "svg"),
    ).toThrow(TypeError);
  });
});
