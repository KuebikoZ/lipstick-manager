import type { AIEnv } from "@/lib/config/env";
import { aiModelResultSchema, type AIModelResult } from "@/lib/domain/ai-intake";

export class AIProviderError extends Error {
  constructor(public code: "DEPENDENCY_UNAVAILABLE" | "AI_OUTPUT_INVALID" | "TIMED_OUT") { super(code); }
}

type ImageInput = { mimeType: string; bytes: Uint8Array };
type SearchResult = { title: string; url: string; snippet: string; summary: string };

function withTimeout(ms: number): AbortSignal { return AbortSignal.timeout(ms); }
function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => typeof item === "object" && item && Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [])
    .map((part) => typeof part === "object" && part && "text" in part ? String((part as { text: unknown }).text) : "").join("");
}

export class DeepSeekProvider {
  private deadline = 0;
  constructor(private env: AIEnv) {}
  estimateMaximumCostCny(): number {
    const modelUsd = (30_000 * 0.3 + 4_000 * 1.2) / 1_000_000;
    const toolsUsd = 5 * 0.75 / 1_000;
    return (modelUsd + toolsUsd) * this.env.AI_USD_CNY_RATE;
  }

  private async request(path: string, body: unknown, timeout = 15_000) {
    const operationDeadline = Date.now() + Math.min(timeout, Math.max(1, this.deadline - Date.now()));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const remaining = operationDeadline - Date.now();
        if (remaining <= 0) throw new AIProviderError("TIMED_OUT");
        const response = await fetch(`https://api.deepseek.com${path}`, {
          method: "POST", signal: withTimeout(remaining),
          headers: { Authorization: `Bearer ${this.env.AI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          if (attempt === 0 && [408, 429, 500, 502, 503, 504].includes(response.status)) continue;
          throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
        }
        return await response.json() as Record<string, unknown>;
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (error instanceof DOMException && error.name === "TimeoutError") throw new AIProviderError("TIMED_OUT");
        if (attempt === 0) continue;
        throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
      }
    }
    throw new AIProviderError("DEPENDENCY_UNAVAILABLE");
  }

  private async recognize(images: ImageInput[], context = ""): Promise<{ result: AIModelResult; usage: unknown }> {
    const prompt = `你是口红包装识别助手。只依据图片和提供的网页证据提取信息；不确定就返回 null，禁止猜测生产批号日期。颜色族只能是 nude/rose/orange/red/plum/brown/null。返回 JSON。${context}`;
    const response = await this.request("/v1/responses", {
      model: this.env.AI_MODEL, reasoning: { effort: "none" }, max_output_tokens: 2000,
      input: [{ role: "user", content: [
        { type: "input_text", text: prompt },
        ...images.map((image) => ({ type: "input_image", detail: "original", image_url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}` })),
      ] }],
      text: { format: { type: "json_object" } },
    });
    try { return { result: aiModelResultSchema.parse(JSON.parse(outputText(response))), usage: response.usage ?? null }; }
    catch { throw new AIProviderError("AI_OUTPUT_INVALID"); }
  }

  async run(images: ImageInput[]) {
    this.deadline = Date.now() + 45_000;
    const first = await this.recognize(images);
    const identity = first.result.identity;
    const query = [identity.brand, identity.series, identity.shade_code].filter(Boolean).join(" ");
    if (!query) return { ...first, webEvidence: [] as SearchResult[] };
    const search = await this.request("/v1/tools/search", { query, count: 3, need_content: false });
    const results = (Array.isArray(search.results) ? search.results : []).slice(0, 3) as SearchResult[];
    const fetched: Array<SearchResult & { content: string }> = [];
    const result = results[0];
    if (result) try { const page = await this.request("/v1/tools/fetch", { url: result.url }); fetched.push({ ...result, content: String(page.content ?? "").slice(0, 6000) }); } catch { /* partial search result remains useful */ }
    if (!fetched.length) return { ...first, webEvidence: results };
    const second = await this.recognize(images, `\n候选网页证据：\n${fetched.map((page) => `${page.title}\n${page.url}\n${page.content}`).join("\n---\n")}`);
    return { result: second.result, usage: { first: first.usage, second: second.usage }, webEvidence: fetched };
  }
}
