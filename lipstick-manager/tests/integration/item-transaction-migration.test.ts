import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20261104130000_create_item_transaction.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("item transaction migration", () => {
  it("serializes retries and checks request hashes", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("existing_key.request_hash <> p_request_hash");
    expect(migration).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("creates the item, idempotency record and clears the new draft atomically", () => {
    expect(migration).toContain("insert into public.lipstick_items");
    expect(migration).toContain("insert into public.item_idempotency_keys");
    expect(migration).toContain("delete from public.drafts where kind = 'new'");
  });

  it("exposes the function only to the server role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
