import { describe, expect, it } from "vitest";
import { estimateUsageCostCny, evaluationManifestSchema, scoreEvaluationCase, summarizeEvaluation } from "@/lib/ai/evaluation";
import type { AIModelResult } from "@/lib/domain/ai-intake";
const expected = { brand: "Brand", series: "Line", shade_code: "01", color_family: "red" as const };
const sample = { id: "sample-01", image_paths: ["/private/1.jpg"], expected };
const result = { identity: { brand: "brand", series: "Line", shade_code: "02" }, candidates: [], suggestions: { color_family: "red", color_description: null, texture: null, pao_months: null, manufactured_on: null, shelf_life_months: null, expires_on: null }, image_evidence: [], unresolved_fields: [], warnings: [] } satisfies AIModelResult;
describe("AI evaluation", () => {
  it("requires at least five labelled samples", () => {
    expect(evaluationManifestSchema.safeParse({ version: "1", cases: Array.from({ length: 4 }, (_, index) => ({ ...sample, id: `sample-${index}` })) }).success).toBe(false);
    expect(evaluationManifestSchema.safeParse({ version: "1", cases: Array.from({ length: 5 }, (_, index) => ({ ...sample, id: `sample-${index}` })) }).success).toBe(true);
  });
  it("reports field accuracy and failures without hiding mismatches", () => {
    const score = scoreEvaluationCase(sample, result); const summary = summarizeEvaluation([score]);
    expect(score.correct).toBe(3); expect(summary.field_accuracy).toBe(0.75); expect(summary.failures).toHaveLength(1);
  });
  it("calculates token and tool cost without counting nested token details twice", () => {
    const cost = estimateUsageCostCny({ first: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 50 } } }, 7.2, 1, 1);
    expect(cost.input_tokens).toBe(1000); expect(cost.output_tokens).toBe(100); expect(cost.estimated_cost_cny).toBeGreaterThan(0);
  });
});
