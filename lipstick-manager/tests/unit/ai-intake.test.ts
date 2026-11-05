import { afterEach, describe, expect, it, vi } from "vitest";
import { aiConsentVersion, aiModelResultSchema } from "@/lib/domain/ai-intake";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";

describe("AI intake contract", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses the confirmed consent version and rejects invented color families", () => {
    expect(aiConsentVersion).toBe("2026-11-03-v1");
    const base = { identity: { brand: null, series: null, shade_code: null }, candidates: [], suggestions: { color_family: "blue", color_description: null, texture: null, pao_months: null, manufactured_on: null, shelf_life_months: null, expires_on: null }, image_evidence: [], unresolved_fields: [], warnings: [] };
    expect(aiModelResultSchema.safeParse(base).success).toBe(false);
  });

  it("requires one of six color families and a supported texture", () => {
    const base = { identity: { brand: "Dior", series: null, shade_code: "999" }, candidates: [], suggestions: { color_family: "red", color_description: null, texture: "镜面", pao_months: null, manufactured_on: null, shelf_life_months: null, expires_on: null }, image_evidence: [], unresolved_fields: [], warnings: [] };
    expect(aiModelResultSchema.safeParse(base).success).toBe(true);
    expect(aiModelResultSchema.safeParse({ ...base, suggestions: { ...base.suggestions, color_family: null } }).success).toBe(false);
    expect(aiModelResultSchema.safeParse({ ...base, suggestions: { ...base.suggestions, texture: "奶油" } }).success).toBe(false);
  });

  it("blocks a task when the conservative estimate exceeds its configured cap", () => {
    const provider = new DeepSeekProvider({ AI_PROVIDER: "deepseek", AI_MODEL: "deepseek-flash", AI_API_KEY: "test", AI_MAX_COST_CNY: 2, AI_USD_CNY_RATE: 7.2, LOG_LEVEL: "info" });
    expect(provider.estimateMaximumCostCny()).toBeGreaterThan(0);
    expect(provider.estimateMaximumCostCny()).toBeLessThan(2);
  });

  it("keeps a non-empty first-pass identity when web enrichment is less stable", async () => {
    const modelResult = (brand: string) => ({ identity: { brand, series: "烈艳蓝金", shade_code: "999" }, candidates: [], suggestions: { color_family: "red", color_description: null, texture: "缎光", pao_months: null, manufactured_on: null, shelf_life_months: null, expires_on: null }, image_evidence: [], unresolved_fields: [], warnings: [] });
    const payloads = [
      { output_text: JSON.stringify(modelResult("Dior")), usage: {} },
      { results: [{ title: "资料", url: "https://example.com/item", snippet: "Dior 999" }] },
      { content: "商品资料" },
      { output_text: JSON.stringify(modelResult("错误品牌")), usage: {} },
    ];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ({ ok: true, json: async () => payloads.shift() })));
    const provider = new DeepSeekProvider({ AI_PROVIDER: "deepseek", AI_MODEL: "deepseek-flash", AI_API_KEY: "test", AI_MAX_COST_CNY: 2, AI_USD_CNY_RATE: 7.2, LOG_LEVEL: "info" });
    const result = await provider.run([{ mimeType: "image/jpeg", bytes: Uint8Array.from([0xff, 0xd8, 0xff]) }]);
    expect(result.result.identity.brand).toBe("Dior");
    expect(result.result.suggestions.color_family).toBe("red");
  });
});
