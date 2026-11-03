import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20261104090000_create_inventory_domain.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8");

describe("inventory migration contract", () => {
  it.each([
    "lipstick_items",
    "drafts",
    "lipstick_images",
    "ai_tasks",
    "evidence",
    "item_idempotency_keys",
    "storage_cleanup_jobs",
  ])("creates and protects %s", (table) => {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  });

  it("creates a private, type- and size-limited bucket without public policies", () => {
    expect(migration).toContain("insert into storage.buckets");
    expect(migration).toMatch(/'lipstick-images',[\s\S]*false,[\s\S]*10485760/);
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(migration).not.toMatch(/create policy/i);
  });

  it("denies browser roles and grants only service_role", () => {
    expect(migration).toContain("from anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
