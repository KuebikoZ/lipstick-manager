import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261105193000_persist_image_order.sql", import.meta.url),
  "utf8",
);

describe("image order migration", () => {
  it("persists draft and item order atomically with deferred uniqueness", () => {
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("function public.save_lipstick_draft");
    expect(migration).toContain("function public.update_lipstick_item");
    expect(migration).toContain("cover_image_id = requested_image_ids[1]");
    expect(migration).toContain("from unnest(requested_image_ids) with ordinality");
  });

  it("keeps both RPCs private to the service role", () => {
    expect(migration).toContain("revoke all on function public.save_lipstick_draft");
    expect(migration).toContain("grant execute on function public.save_lipstick_draft(uuid, jsonb) to service_role");
    expect(migration).toContain("grant execute on function public.update_lipstick_item(uuid, integer, jsonb) to service_role");
  });
});
