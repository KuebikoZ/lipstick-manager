import { describe, expect, it } from "vitest";
import { analyticsEventSchema } from "@/lib/domain/analytics";
import { analyticsEnvironment } from "@/lib/services/analytics-service";

const base = { event_id: crypto.randomUUID(), session_id: crypto.randomUUID(), page_id: "inventory" };
describe("product measurement", () => {
  it("accepts only the six event names and action whitelist", () => {
    expect(analyticsEventSchema.safeParse({ ...base, event_name: "page_view", properties: {} }).success).toBe(true);
    expect(analyticsEventSchema.safeParse({ ...base, event_name: "action", properties: { action: "scroll" } }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ ...base, event_name: "heartbeat", properties: {} }).success).toBe(false);
  });
  it("rejects sensitive or unknown properties", () => {
    expect(analyticsEventSchema.safeParse({ ...base, event_name: "page_view", properties: { url: "secret" } }).success).toBe(false);
    expect(analyticsEventSchema.safeParse({ ...base, event_name: "save_result", properties: { outcome: "success", mode: "create", note: "secret" } }).success).toBe(false);
  });
  it("isolates deployment environments server-side", () => {
    expect(analyticsEnvironment({ ANALYTICS_ENVIRONMENT: "production" })).toBe("production");
    expect(analyticsEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    expect(analyticsEnvironment({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(analyticsEnvironment({ NODE_ENV: "test" })).toBe("development");
  });
});
