import { describe, expect, it } from "vitest";
import { buildDisplayName } from "@/lib/domain/display-name";

describe("display name", () => {
  it("joins the non-empty identity fields in a stable order", () => {
    expect(buildDisplayName({ brand: "Dior", series: "烈艳蓝金", shade_code: "999" }))
      .toBe("Dior-烈艳蓝金-999");
    expect(buildDisplayName({ brand: "Dior", series: null, shade_code: "999" }))
      .toBe("Dior-999");
  });

  it("uses a neutral fallback when identity is still unknown", () => {
    expect(buildDisplayName({ brand: " ", series: null, shade_code: null }))
      .toBe("信息待补充");
  });
});
