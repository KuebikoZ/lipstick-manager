import { getValidSession } from "@/lib/auth/session";
import { parseBackendEnv } from "@/lib/config/env";
import { createBackendAdminClient } from "@/lib/db/supabase-admin";
import { errorResponse, dataResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { UploadService } from "@/lib/services/upload-service";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try { const env = parseBackendEnv(process.env); return dataResponse(await new UploadService(createBackendAdminClient(env), env.storageBucket).complete(uuidSchema.parse((await context.params).id))); }
  catch (error) { return inventoryErrorResponse(error); }
}
