import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20261105230000_add_product_measurement.sql", import.meta.url)), "utf8");
describe("product measurement migration", () => {
  it("provides idempotency, environment isolation, linking and service-only access", () => {
    expect(sql).toContain("event_id uuid primary key");
    expect(sql).toContain("environment text not null");
    expect(sql).toContain("intake_id uuid");
    expect(sql).toContain("task_id uuid");
    expect(sql).toContain("revoke all on public.analytics_events from anon, authenticated");
  });
});
