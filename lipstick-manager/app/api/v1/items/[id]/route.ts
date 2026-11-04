import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, readJson, uuidSchema } from "@/lib/http/inventory-api";
import { createInventoryService } from "@/lib/services/service-factory";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  try {
    const id = uuidSchema.parse((await context.params).id);
    return dataResponse(await createInventoryService().getItem(id));
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try {
    const id = uuidSchema.parse((await context.params).id);
    const body = await readJson(request) as Record<string, unknown>;
    const revision = Number(body.revision);
    const payload = { ...body }; delete payload.revision;
    return dataResponse(await createInventoryService().updateItem(id, revision, payload));
  } catch (error) { return inventoryErrorResponse(error); }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try {
    const id = uuidSchema.parse((await context.params).id);
    const body = await readJson(request) as Record<string, unknown>;
    await createInventoryService().deleteItem(id, Number(body.revision));
    return new Response(null, { status: 204 });
  } catch (error) { return inventoryErrorResponse(error); }
}
