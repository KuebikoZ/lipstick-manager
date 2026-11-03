import { randomUUID } from "node:crypto";
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
