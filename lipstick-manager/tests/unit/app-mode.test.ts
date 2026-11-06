import { describe, expect, it } from "vitest";
import { appMode, isPublicDemoMode } from "@/lib/config/app-mode";

describe("application mode", () => {
  it("keeps authenticated admin mode as the safe default", () => {
    expect(appMode({})).toBe("admin");
    expect(appMode({ APP_MODE: "unexpected" })).toBe("admin");
  });

  it("enables the explicit public demo mode", () => {
    expect(appMode({ APP_MODE: "public-demo" })).toBe("public-demo");
    expect(isPublicDemoMode({ APP_MODE: "public-demo" })).toBe(true);
  });
});
