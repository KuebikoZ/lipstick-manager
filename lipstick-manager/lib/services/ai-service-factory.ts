import { parseAIEnv, parseBackendEnv } from "@/lib/config/env";
import { createBackendAdminClient } from "@/lib/db/supabase-admin";
import { AITaskService } from "@/lib/services/ai-task-service";
import { InventoryDependencyError } from "@/lib/db/inventory-repository";
export function createAITaskService() {
  try {
    const db = parseBackendEnv(process.env);
    return new AITaskService(createBackendAdminClient(db), db.storageBucket, parseAIEnv(process.env));
  } catch { throw new InventoryDependencyError(); }
}
