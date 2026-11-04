import { describe, expect, it } from "vitest";
import { aiConsentVersion, aiModelResultSchema } from "@/lib/domain/ai-intake";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";

describe("AI intake contract", () => {
  it("uses the confirmed consent version and rejects invented color families", () => {
    expect(aiConsentVersion).toBe("2026-11-03-v1");
    const base = { identity: { brand: null, series: null, shade_code: null }, candidates: [], suggestions: { color_family: "blue", color_description: null, texture: null, pao_months: null, manufactured_on: null, shelf_life_months: null, expires_on: null }, image_evidence: [], unresolved_fields: [], warnings: [] };
    expect(aiModelResultSchema.safeParse(base).success).toBe(false);
  });

  it("blocks a task when the conservative estimate exceeds its configured cap", () => {
    const provider = new DeepSeekProvider({ AI_PROVIDER: "deepseek", AI_MODEL: "deepseek-flash", AI_API_KEY: "test", AI_MAX_COST_CNY: 2, AI_USD_CNY_RATE: 7.2, LOG_LEVEL: "info" });
    expect(provider.estimateMaximumCostCny()).toBeGreaterThan(0);
    expect(provider.estimateMaximumCostCny()).toBeLessThan(2);
  });
});
