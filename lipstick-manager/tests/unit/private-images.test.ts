import { describe, expect, it } from "vitest";
import {
  createPrivateImagePath,
  detectImageMimeType,
  maxImageByteSize,
  sanitizeAndInspectImage,
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

  it("reads PNG dimensions and strips textual metadata", () => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const chunk = (type: string, data: number[]) => {
      const result = new Uint8Array(12 + data.length);
      new DataView(result.buffer).setUint32(0, data.length);
      result.set(new TextEncoder().encode(type), 4); result.set(data, 8);
      return [...result];
    };
    const ihdr = new Uint8Array(13); const view = new DataView(ihdr.buffer);
    view.setUint32(0, 2); view.setUint32(4, 3);
    const png = Uint8Array.from([...signature, ...chunk("IHDR", [...ihdr]), ...chunk("tEXt", [...new TextEncoder().encode("GPS=secret")]), ...chunk("IEND", [])]);
    const inspected = sanitizeAndInspectImage(png, "image/png");
    expect([inspected.width, inspected.height]).toEqual([2, 3]);
    expect(new TextDecoder().decode(inspected.bytes)).not.toContain("GPS=secret");
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
