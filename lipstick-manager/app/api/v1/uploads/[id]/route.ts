import { getValidSession } from "@/lib/auth/session";
import { parseBackendEnv } from "@/lib/config/env";
import { createBackendAdminClient } from "@/lib/db/supabase-admin";
import { errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { UploadService } from "@/lib/services/upload-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  try {
    const env = parseBackendEnv(process.env);
    const preview = await new UploadService(createBackendAdminClient(env), env.storageBucket).getPreview(uuidSchema.parse((await context.params).id));
    return new Response(preview.data, {
      headers: {
        "Content-Type": preview.mimeType,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return inventoryErrorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try { const env = parseBackendEnv(process.env); await new UploadService(createBackendAdminClient(env), env.storageBucket).remove(uuidSchema.parse((await context.params).id)); return new Response(null, { status: 204 }); }
  catch (error) { return inventoryErrorResponse(error); }
}
