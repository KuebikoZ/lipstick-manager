import { z } from "zod";
import type { AIModelResult } from "@/lib/domain/ai-intake";

export const evaluationCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  image_paths: z.array(z.string().min(1)).min(1).max(3),
  expected: z.object({
    brand: z.string().nullable(), series: z.string().nullable(), shade_code: z.string().nullable(),
    color_family: z.enum(["nude", "rose", "orange", "red", "plum", "brown"]).nullable(),
  }),
});
export const evaluationManifestSchema = z.object({ version: z.literal("1"), cases: z.array(evaluationCaseSchema).min(5) });
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;

function equal(expected: string | null, actual: string | null) {
  if (expected === null) return actual === null;
  return expected.trim().toLocaleLowerCase() === actual?.trim().toLocaleLowerCase();
}
export function scoreEvaluationCase(sample: EvaluationCase, result: AIModelResult) {
  const fields = {
    brand: equal(sample.expected.brand, result.identity.brand),
    series: equal(sample.expected.series, result.identity.series),
    shade_code: equal(sample.expected.shade_code, result.identity.shade_code),
    color_family: sample.expected.color_family === result.suggestions.color_family,
  };
  return { id: sample.id, fields, correct: Object.values(fields).filter(Boolean).length, total: 4 };
}
export function summarizeEvaluation(scores: Array<ReturnType<typeof scoreEvaluationCase>>) {
  const correct = scores.reduce((sum, score) => sum + score.correct, 0);
  const total = scores.reduce((sum, score) => sum + score.total, 0);
  return { sample_count: scores.length, field_accuracy: total ? correct / total : 0, failures: scores.filter((score) => score.correct < score.total) };
}

export function estimateUsageCostCny(usage: unknown, exchangeRate: number, searchCount: number, fetchCount: number) {
  let inputTokens = 0; let outputTokens = 0;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.input_tokens === "number") inputTokens += record.input_tokens;
    if (typeof record.output_tokens === "number") outputTokens += record.output_tokens;
    for (const [key, child] of Object.entries(record)) if (key !== "input_tokens" && key !== "output_tokens") visit(child);
  };
  visit(usage);
  const modelUsd = (inputTokens * 0.3 + outputTokens * 1.2) / 1_000_000;
  const toolsUsd = (searchCount + fetchCount) * 0.75 / 1_000;
  return { input_tokens: inputTokens, output_tokens: outputTokens, estimated_cost_cny: (modelUsd + toolsUsd) * exchangeRate };
}
