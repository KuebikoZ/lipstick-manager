import { parseSupabaseEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { InventoryRepository } from "@/lib/db/inventory-repository";
import { InventoryService } from "@/lib/services/inventory-service";

export function createInventoryService(): InventoryService {
  const env = parseSupabaseEnv(process.env);
  const client = createSupabaseAdminClient(env);
  return new InventoryService(new InventoryRepository(client, env.SUPABASE_STORAGE_BUCKET));
}
