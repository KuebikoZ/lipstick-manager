import { readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parseAIEnv } from "@/lib/config/env";
import { estimateUsageCostCny, evaluationManifestSchema, scoreEvaluationCase, summarizeEvaluation } from "@/lib/ai/evaluation";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";

const manifestPath = process.argv[2];
const reportPath = process.argv[3];
const repeatCaseCount = Number(process.argv[4] ?? 0);
if (!manifestPath) throw new Error("Usage: pnpm ai:evaluate <private-manifest.json>");
const manifest = evaluationManifestSchema.parse(JSON.parse(readFileSync(resolve(manifestPath), "utf8")));
const provider = new DeepSeekProvider(parseAIEnv(process.env));
type EvaluationResponse = Awaited<ReturnType<DeepSeekProvider["run"]>>;
const mimeTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const scores = []; const caseReports = [];
for (const [sampleIndex, sample] of manifest.cases.entries()) {
  const images = sample.image_paths.map((path) => {
    const absolute = resolve(path); const mimeType = mimeTypes[extname(absolute).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported evaluation image: ${path}`);
    return { mimeType, bytes: new Uint8Array(readFileSync(absolute)) };
  });
  const runs: Array<{ response: EvaluationResponse; duration_ms: number; cost: ReturnType<typeof estimateUsageCostCny> }> = [];
  const runCount = sampleIndex < repeatCaseCount ? 2 : 1;
  for (let index = 0; index < runCount; index += 1) {
    const started = Date.now(); const response = await provider.run(images);
    runs.push({ response, duration_ms: Date.now() - started, cost: estimateUsageCostCny(response.usage, parseAIEnv(process.env).AI_USD_CNY_RATE, response.toolUsage.search, response.toolUsage.fetch) });
  }
  const score = scoreEvaluationCase(sample, runs[0].response.result); scores.push(score);
  const snapshot = (result: typeof runs[number]["response"]["result"]) => JSON.stringify({ identity: result.identity, color_family: result.suggestions.color_family });
  caseReports.push({ id: sample.id, score, repeat_consistent: runs[1] ? snapshot(runs[0].response.result) === snapshot(runs[1].response.result) : null, retrieval_succeeded: runs.some((run) => run.response.toolUsage.search > 0), evidence_supported: runs[0].response.result.image_evidence.length > 0 || runs[0].response.webEvidence.length > 0, runs: runs.map((run) => ({ duration_ms: run.duration_ms, ...run.cost })) });
}
const allRuns = caseReports.flatMap((entry) => entry.runs);
const repeatedCases = caseReports.filter((entry) => entry.repeat_consistent !== null);
const report = { generated_at: new Date().toISOString(), dataset: "private-5-sample-development-baseline", ...summarizeEvaluation(scores), json_pass_rate: 1, repeat_consistency_coverage: repeatedCases.length / caseReports.length, repeat_consistency_rate: repeatedCases.length ? repeatedCases.filter((entry) => entry.repeat_consistent).length / repeatedCases.length : null, retrieval_success_rate: caseReports.filter((entry) => entry.retrieval_succeeded).length / caseReports.length, evidence_support_rate: caseReports.filter((entry) => entry.evidence_supported).length / caseReports.length, average_latency_ms: Math.round(allRuns.reduce((sum, run) => sum + run.duration_ms, 0) / allRuns.length), estimated_total_cost_cny: allRuns.reduce((sum, run) => sum + run.estimated_cost_cny, 0), cases: caseReports };
const output = `${JSON.stringify(report, null, 2)}\n`;
if (reportPath) writeFileSync(resolve(reportPath), output); else process.stdout.write(output);
