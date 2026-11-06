import { getValidSession } from "@/lib/auth/session";
import { parseBackendEnv } from "@/lib/config/env";
import { createBackendAdminClient } from "@/lib/db/supabase-admin";
import { errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { UploadService } from "@/lib/services/upload-service";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request);
  if (originError) return originError;
  try {
    const env = parseBackendEnv(process.env);
    const id = uuidSchema.parse((await context.params).id);
    const mimeType = request.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
    const bytes = new Uint8Array(await request.arrayBuffer());
    await new UploadService(createBackendAdminClient(env), env.storageBucket)
      .uploadReserved(id, bytes, mimeType);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}
