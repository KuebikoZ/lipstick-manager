import { z } from "zod";

export const analyticsActionSchema = z.enum([
  "filter_apply", "sort_change", "compare_color_select",
  "ai_suggestion_adopt", "ai_suggestion_ignore", "ai_suggestion_correct",
]);
export const analyticsFieldSchema = z.enum([
  "brand", "series", "shade_code", "color_family", "color_description", "texture",
  "pao_months", "manufactured_on", "shelf_life_months", "expires_on",
]);

const common = {
  event_id: z.uuid(),
  session_id: z.uuid(),
  page_id: z.enum(["inventory", "compare", "detail", "intake_new", "intake_edit"]),
  intake_id: z.uuid().nullable().optional(),
  task_id: z.uuid().nullable().optional(),
};
const outcome = z.enum(["success", "failure", "cancelled"]);

export const analyticsEventSchema = z.discriminatedUnion("event_name", [
  z.strictObject({ ...common, event_name: z.literal("page_view"), properties: z.strictObject({}) }),
  z.strictObject({ ...common, event_name: z.literal("action"), properties: z.strictObject({ action: analyticsActionSchema, field: analyticsFieldSchema.optional(), selection: z.enum(["nude", "rose", "orange", "red", "plum", "brown", "pending"]).optional() }) }),
  z.strictObject({ ...common, event_name: z.literal("intake_start"), properties: z.strictObject({ mode: z.enum(["manual", "ai_assisted"]) }) }),
  z.strictObject({ ...common, event_name: z.literal("ai_result"), properties: z.strictObject({ outcome: z.enum(["complete", "partial", "failed", "cancelled", "timed_out"]), suggestion_count: z.number().int().min(0).max(20), duration_bucket: z.enum(["lt_10s", "10_30s", "30_60s", "gte_60s", "unknown"]) }) }),
  z.strictObject({ ...common, event_name: z.literal("save_result"), properties: z.strictObject({ outcome: z.enum(["success", "failure"]), mode: z.enum(["create", "edit", "discard"]) }) }),
  z.strictObject({ ...common, event_name: z.literal("intake_end"), properties: z.strictObject({ outcome, mode: z.enum(["manual", "ai_assisted"]), adopted_count: z.number().int().min(0).max(20), ignored_count: z.number().int().min(0).max(20), corrected_count: z.number().int().min(0).max(20) }) }),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsAction = z.infer<typeof analyticsActionSchema>;
