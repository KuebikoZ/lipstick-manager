import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import { inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
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
