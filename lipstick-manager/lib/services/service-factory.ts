import { parseSupabaseEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { InventoryRepository } from "@/lib/db/inventory-repository";
import { InventoryService } from "@/lib/services/inventory-service";

export function createInventoryService(): InventoryService {
  const client = createSupabaseAdminClient(parseSupabaseEnv(process.env));
  return new InventoryService(new InventoryRepository(client));
}
