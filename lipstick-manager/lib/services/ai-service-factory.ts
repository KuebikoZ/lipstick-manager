import { parseAIEnv, parseSupabaseEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { AITaskService } from "@/lib/services/ai-task-service";
import { InventoryDependencyError } from "@/lib/db/inventory-repository";
export function createAITaskService() {
  try {
    const db = parseSupabaseEnv(process.env);
    return new AITaskService(createSupabaseAdminClient(db), db.SUPABASE_STORAGE_BUCKET, parseAIEnv(process.env));
  } catch { throw new InventoryDependencyError(); }
}
