import { getValidSession } from "@/lib/auth/session";
import { parseSupabaseEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { UploadService } from "@/lib/services/upload-service";
type Context = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try { const env = parseSupabaseEnv(process.env); await new UploadService(createSupabaseAdminClient(env), env.SUPABASE_STORAGE_BUCKET).remove(uuidSchema.parse((await context.params).id)); return new Response(null, { status: 204 }); }
  catch (error) { return inventoryErrorResponse(error); }
}
