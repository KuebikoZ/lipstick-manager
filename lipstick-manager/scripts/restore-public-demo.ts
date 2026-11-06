import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DemoEnvironment = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
};

type ItemRow = {
  id: string;
  cover_image_id: string | null;
  lifecycle: "unopened" | "opened" | "unknown" | "discarded";
  [key: string]: unknown;
};

type ImageRow = {
  id: string;
  item_id: string;
  storage_path: string;
  mime_type: string;
  [key: string]: unknown;
};

function requireValue(
  environment: Record<string, string | undefined>,
  key: keyof DemoEnvironment,
): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

async function loadEnvironment(path: string): Promise<DemoEnvironment> {
  const environment = parseEnv(await readFile(path, "utf8"));
  return {
    SUPABASE_URL: requireValue(environment, "SUPABASE_URL"),
    SUPABASE_SECRET_KEY: requireValue(environment, "SUPABASE_SECRET_KEY"),
    SUPABASE_STORAGE_BUCKET: requireValue(environment, "SUPABASE_STORAGE_BUCKET"),
  };
}

async function clearTargetInventory(client: SupabaseClient, bucket: string): Promise<void> {
  const { data: images, error: imageError } = await client
    .from("lipstick_images")
    .select("storage_path");
  if (imageError) throw imageError;

  const paths = (images ?? []).map((image) => image.storage_path as string);
  if (paths.length > 0) {
    const { error } = await client.storage.from(bucket).remove(paths);
    if (error) throw error;
  }

  for (const table of ["ai_tasks", "drafts", "lipstick_items"]) {
    const { error } = await client.from(table).delete().not("id", "is", null);
    if (error) throw error;
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes("--apply")) {
    throw new Error("Refusing to replace public demo data without --apply");
  }

  const sourceEnvironment = await loadEnvironment(".env.local");
  const targetEnvironment = await loadEnvironment(".env.public-demo.local");
  if (sourceEnvironment.SUPABASE_URL === targetEnvironment.SUPABASE_URL) {
    throw new Error("Source and target Supabase projects must be different");
  }

  const source = createClient(
    sourceEnvironment.SUPABASE_URL,
    sourceEnvironment.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const target = createClient(
    targetEnvironment.SUPABASE_URL,
    targetEnvironment.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: sourceItems, error: itemError } = await source
    .from("lipstick_items")
    .select("*")
    .neq("lifecycle", "discarded")
    .order("created_at");
  if (itemError) throw itemError;
  const items = (sourceItems ?? []) as ItemRow[];
  const itemIds = items.map((item) => item.id);

  const { data: sourceImages, error: imageError } = itemIds.length
    ? await source
        .from("lipstick_images")
        .select("*")
        .in("item_id", itemIds)
        .eq("status", "attached")
        .order("position")
    : { data: [], error: null };
  if (imageError) throw imageError;
  const images = (sourceImages ?? []) as ImageRow[];

  await clearTargetInventory(target, targetEnvironment.SUPABASE_STORAGE_BUCKET);

  const itemsWithoutCovers = items.map((item) => ({
    ...item,
    cover_image_id: null,
  }));
  if (itemsWithoutCovers.length > 0) {
    const { error } = await target.from("lipstick_items").insert(itemsWithoutCovers);
    if (error) throw error;
  }

  for (const image of images) {
    const downloaded = await source.storage
      .from(sourceEnvironment.SUPABASE_STORAGE_BUCKET)
      .download(image.storage_path);
    if (downloaded.error || !downloaded.data) {
      throw downloaded.error ?? new Error("Image download failed");
    }

    const uploaded = await target.storage
      .from(targetEnvironment.SUPABASE_STORAGE_BUCKET)
      .upload(image.storage_path, downloaded.data, {
        contentType: image.mime_type,
        upsert: true,
      });
    if (uploaded.error) throw uploaded.error;

    const { error } = await target.from("lipstick_images").insert(image);
    if (error) throw error;
  }

  for (const item of items) {
    if (!item.cover_image_id) continue;
    const { error } = await target
      .from("lipstick_items")
      .update({ cover_image_id: item.cover_image_id })
      .eq("id", item.id);
    if (error) throw error;
  }

  console.log(`Public demo restored: ${items.length} items, ${images.length} images.`);
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : "Restore failed";
  console.error(`${name}: ${message}`);
  process.exitCode = 1;
});
