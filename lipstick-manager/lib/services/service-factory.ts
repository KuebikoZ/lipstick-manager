import { parseSupabaseEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { InventoryRepository } from "@/lib/db/inventory-repository";
import { InventoryService } from "@/lib/services/inventory-service";
import { AnalyticsService, analyticsEnvironment } from "@/lib/services/analytics-service";

export function createInventoryService(): InventoryService {
  const env = parseSupabaseEnv(process.env);
  const client = createSupabaseAdminClient(env);
  return new InventoryService(new InventoryRepository(client, env.SUPABASE_STORAGE_BUCKET));
}

export function createAnalyticsService(): AnalyticsService {
  const env = parseSupabaseEnv(process.env);
  return new AnalyticsService(createSupabaseAdminClient(env), analyticsEnvironment(process.env));
}
