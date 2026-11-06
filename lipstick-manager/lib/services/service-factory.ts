import { parseBackendEnv } from "@/lib/config/env";
import { createBackendAdminClient } from "@/lib/db/supabase-admin";
import { InventoryRepository } from "@/lib/db/inventory-repository";
import { InventoryService } from "@/lib/services/inventory-service";
import { AnalyticsService, analyticsEnvironment } from "@/lib/services/analytics-service";

export function createInventoryService(): InventoryService {
  const env = parseBackendEnv(process.env);
  const client = createBackendAdminClient(env);
  return new InventoryService(new InventoryRepository(client, env.storageBucket));
}

export function createAnalyticsService(): AnalyticsService {
  const env = parseBackendEnv(process.env);
  return new AnalyticsService(createBackendAdminClient(env), analyticsEnvironment(process.env));
}
