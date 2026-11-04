import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allowedImageMimeTypes,
  createPrivateImagePath,
  maxImageByteSize,
  maxImagesPerResource,
  sanitizeAndInspectImage,
} from "@/lib/storage/private-images";
import { InventoryDependencyError } from "@/lib/db/inventory-repository";
import { InventoryNotFoundError, InventoryValidationError } from "@/lib/services/inventory-service";

const createUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(allowedImageMimeTypes),
  byte_size: z.number().int().min(1).max(maxImageByteSize),
  draft_id: z.uuid(),
}).strict();

export class ImageUploadError extends Error {
  constructor(
    public status: 413 | 415 | 422,
    public code: "FILE_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "IMAGE_VALIDATION_FAILED",
    message: string,
  ) { super(message); }
}

export class UploadService {
  constructor(private client: SupabaseClient, private bucket: string) {}

  async create(raw: unknown) {
    const parsed = createUploadSchema.safeParse(raw);
    if (!parsed.success) throw new InventoryValidationError({ image: "请选择 10 MiB 以内的 JPG、PNG 或 WebP 图片" });
    const { draft_id: draftId, mime_type: mimeType } = parsed.data;
    const { data: draft, error: draftError } = await this.client.from("drafts").select("id").eq("id", draftId).eq("kind", "new").maybeSingle();
    if (draftError) throw new InventoryDependencyError();
    if (!draft) throw new InventoryNotFoundError();
    const { count, error: countError } = await this.client.from("lipstick_images").select("id", { count: "exact", head: true }).eq("draft_id", draftId);
    if (countError) throw new InventoryDependencyError();
    if ((count ?? 0) >= maxImagesPerResource) throw new InventoryValidationError({ image: "最多上传 3 张图片" });
    const imageId = randomUUID();
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
    const path = createPrivateImagePath(draftId, extension).replace(/\/[^/]+$/, `/${imageId}.${extension}`);
    const position = count ?? 0;
    const { error: insertError } = await this.client.from("lipstick_images").insert({
      id: imageId, draft_id: draftId, storage_path: path, mime_type: mimeType,
      byte_size: parsed.data.byte_size, width: null, height: null, sha256: null, position, status: "temp",
    });
    if (insertError) throw new InventoryDependencyError();
    const signed = await this.client.storage.from(this.bucket).createSignedUploadUrl(path);
    if (signed.error || !signed.data) {
      await this.client.from("lipstick_images").delete().eq("id", imageId);
      throw new InventoryDependencyError();
    }
    return { image_id: imageId, upload_url: signed.data.signedUrl, expires_in: 7200 };
  }

  async complete(id: string) {
    const { data: image, error } = await this.client.from("lipstick_images").select("*").eq("id", id).eq("status", "temp").maybeSingle();
    if (error) throw new InventoryDependencyError();
    if (!image) throw new InventoryNotFoundError();
    const downloaded = await this.client.storage.from(this.bucket).download(image.storage_path);
    if (downloaded.error || !downloaded.data) throw new InventoryValidationError({ image: "图片上传未完成，请重试" });
    try {
      const inspected = sanitizeAndInspectImage(new Uint8Array(await downloaded.data.arrayBuffer()), image.mime_type);
      const replaced = await this.client.storage.from(this.bucket).update(image.storage_path, inspected.bytes, { contentType: inspected.mimeType, upsert: true });
      if (replaced.error) throw new InventoryDependencyError();
      const updated = await this.client.from("lipstick_images").update({
        byte_size: inspected.bytes.byteLength, width: inspected.width, height: inspected.height, sha256: inspected.sha256,
      }).eq("id", id).select("id,mime_type,byte_size,width,height,position").single();
      if (updated.error || !updated.data) throw new InventoryDependencyError();
      return updated.data;
    } catch (cause) {
      await this.client.storage.from(this.bucket).remove([image.storage_path]);
      await this.client.from("lipstick_images").delete().eq("id", id);
      if (cause instanceof RangeError) throw new ImageUploadError(413, "FILE_TOO_LARGE", "图片大小或尺寸超出限制");
      if (cause instanceof TypeError) throw new ImageUploadError(415, "UNSUPPORTED_MEDIA_TYPE", "图片格式或文件内容无效");
      throw cause;
    }
  }

  async remove(id: string) {
    const { data, error } = await this.client.from("lipstick_images").delete().eq("id", id).eq("status", "temp").select("storage_path").maybeSingle();
    if (error) throw new InventoryDependencyError();
    if (!data) throw new InventoryNotFoundError();
    await this.client.storage.from(this.bucket).remove([data.storage_path]);
  }
}
