import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMimeType = (typeof allowedImageMimeTypes)[number];
export const maxImageByteSize = 10 * 1024 * 1024;
export const maxImagesPerResource = 3;
export const signedImageUrlTtlSeconds = 300;

export class PrivateImageStorageError extends Error {
  constructor(message = "Private image storage is unavailable") {
    super(message);
    this.name = "PrivateImageStorageError";
  }
}

export function detectImageMimeType(bytes: Uint8Array): AllowedImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateImageFileHeader(
  bytes: Uint8Array,
  declaredMimeType: string,
): AllowedImageMimeType {
  if (bytes.byteLength < 1 || bytes.byteLength > maxImageByteSize) {
    throw new RangeError("Image byte size is outside the allowed range");
  }
  const detected = detectImageMimeType(bytes);
  if (!detected || detected !== declaredMimeType) {
    throw new TypeError("Image MIME type does not match its file header");
  }
  return detected;
}

export function createPrivateImagePath(draftId: string, extension: string): string {
  const normalizedExtension = extension.toLowerCase().replace(/^\./, "");
  if (!/^(jpe?g|png|webp)$/.test(normalizedExtension)) {
    throw new TypeError("Unsupported image extension");
  }
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) {
    throw new TypeError("Invalid draft id");
  }
  return `drafts/${draftId}/${randomUUID()}.${normalizedExtension === "jpeg" ? "jpg" : normalizedExtension}`;
}

export type ImageMetadata = {
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
  width: number;
  height: number;
  sha256: string;
};

function dimensions(bytes: Uint8Array, mimeType: AllowedImageMimeType): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === "image/png" && bytes.length >= 24) {
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const kind = new TextDecoder().decode(bytes.slice(12, 16));
    if (kind === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return [width, height];
    }
    if (kind === "VP8 " && bytes.length >= 30) {
      return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    }
    if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return [1 + bytes[21] + ((bytes[22] & 0x3f) << 8), 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)];
    }
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const size = view.getUint16(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      }
      if (size < 2) break;
      offset += size + 2;
    }
  }
  throw new TypeError("Image dimensions could not be read");
}

function join(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0; for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
}

function stripJpegExif(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.slice(0, 2)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { parts.push(bytes.slice(offset)); break; }
    const marker = bytes[offset + 1];
    if (marker === 0xda) { parts.push(bytes.slice(offset)); break; }
    const size = view.getUint16(offset + 2);
    const end = offset + 2 + size;
    if (end > bytes.length || size < 2) throw new TypeError("Invalid JPEG segment");
    if (marker !== 0xe1 && marker !== 0xed) parts.push(bytes.slice(offset, end));
    offset = end;
  }
  return join(parts);
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const parts = [bytes.slice(0, 8)]; const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset); const end = offset + 12 + length;
    if (end > bytes.length) throw new TypeError("Invalid PNG chunk");
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (!["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) parts.push(bytes.slice(offset, end));
    offset = end; if (type === "IEND") break;
  }
  return join(parts);
}

function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []; const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = new TextDecoder().decode(bytes.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, true); const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) throw new TypeError("Invalid WebP chunk");
    if (type !== "EXIF" && type !== "XMP ") parts.push(bytes.slice(offset, end));
    offset = end;
  }
  const body = join(parts); const result = new Uint8Array(12 + body.length);
  result.set(bytes.slice(0, 12)); result.set(body, 12);
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  return result;
}

export function sanitizeAndInspectImage(
  input: Uint8Array,
  declaredMimeType: string,
): ImageMetadata {
  const mimeType = validateImageFileHeader(input, declaredMimeType);
  const bytes = mimeType === "image/jpeg" ? stripJpegExif(input) : mimeType === "image/png" ? stripPngMetadata(input) : stripWebpMetadata(input);
  const [width, height] = dimensions(bytes, mimeType);
  if (width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new RangeError("Image dimensions are outside the allowed range");
  }
  return {
    bytes,
    mimeType,
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function createSignedImageUrl(
  client: SupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(storagePath, signedImageUrlTtlSeconds);
  if (error || !data?.signedUrl) throw new PrivateImageStorageError();
  return data.signedUrl;
}
