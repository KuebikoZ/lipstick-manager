import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import {
  invalidOriginResponse,
  inventoryErrorResponse,
  readJson,
  uuidSchema,
} from "@/lib/http/inventory-api";
import { createInventoryService } from "@/lib/services/service-factory";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request);
  if (originError) return originError;
  try {
    const id = uuidSchema.parse((await context.params).id);
    const body = await readJson(request);
    const payload = typeof body === "object" && body !== null && "payload" in body ? body.payload : body;
    return dataResponse(await createInventoryService().saveNewDraft(id, payload));
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request);
  if (originError) return originError;
  try {
    const id = uuidSchema.parse((await context.params).id);
    await createInventoryService().deleteNewDraft(id);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}
