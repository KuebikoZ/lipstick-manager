import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsEventSchema } from "@/lib/domain/analytics";
import { InventoryValidationError } from "@/lib/services/inventory-service";

export type AnalyticsEnvironment = "development" | "preview" | "production";
export function analyticsEnvironment(env: Readonly<Record<string, string | undefined>>): AnalyticsEnvironment {
  if (env.ANALYTICS_ENVIRONMENT === "production") return "production";
  if (env.ANALYTICS_ENVIRONMENT === "preview") return "preview";
  if (env.ANALYTICS_ENVIRONMENT === "development") return "development";
  if (env.VERCEL_ENV === "production") return "production";
  if (env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

export class AnalyticsService {
  constructor(private readonly client: SupabaseClient, private readonly environment: AnalyticsEnvironment) {}
  async record(raw: unknown): Promise<void> {
    const parsed = analyticsEventSchema.safeParse(raw);
    if (!parsed.success) throw new InventoryValidationError({ event: "事件不符合白名单 schema" });
    const event = parsed.data;
    const { error } = await this.client.from("analytics_events").upsert({
      event_id: event.event_id, event_name: event.event_name, environment: this.environment,
      session_id: event.session_id, page_id: event.page_id, intake_id: event.intake_id ?? null,
      task_id: event.task_id ?? null, properties: event.properties,
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
