import { describe, expect, it } from "vitest";
import { buildDisplayName, normalizeSeries } from "@/lib/domain/display-name";

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

  it("removes a repeated brand prefix and limits the stored series", () => {
    expect(buildDisplayName({ brand: "Dior", series: "Dior Addict", shade_code: "521" }))
      .toBe("Dior-Addict-521");
    expect(normalizeSeries("Dior", `Dior-${"x".repeat(60)}`)).toBe("x".repeat(50));
    expect(normalizeSeries("Dior", "Dior")).toBeNull();
  });
});
