import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const migration = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20261104190000_add_ai_intake_workflow.sql", import.meta.url)), "utf8");
describe("AI intake migration", () => {
  it("permits incomplete temporary metadata but requires complete attached images", () => {
    expect(migration).toContain("status = 'temp'");
    expect(migration).toContain("width > 0 and height > 0");
  });
  it("attaches only complete images from the current draft in the item transaction", () => {
    expect(migration).toContain("status = 'temp' and width is not null");
    expect(migration).toContain("set item_id = created_item.id, draft_id = null, status = 'attached'");
    expect(migration).toContain("accepted_task_id");
  });
});
