import { describe, expect, it } from "vitest";
import { canTransitionLifecycle, isCurrentInventory } from "@/lib/domain/inventory";

describe("inventory lifecycle", () => {
  it("counts only current inventory states", () => {
    expect(isCurrentInventory("opened")).toBe(true);
    expect(isCurrentInventory("unopened")).toBe(true);
    expect(isCurrentInventory("unknown")).toBe(true);
    expect(isCurrentInventory("discarded")).toBe(false);
  });

  it("allows contract transitions but never restores discarded records", () => {
    expect(canTransitionLifecycle("unknown", "opened")).toBe(true);
    expect(canTransitionLifecycle("opened", "unopened")).toBe(true);
    expect(canTransitionLifecycle("unopened", "discarded")).toBe(true);
    expect(canTransitionLifecycle("discarded", "opened")).toBe(false);
    expect(canTransitionLifecycle("discarded", "discarded")).toBe(true);
  });
});
