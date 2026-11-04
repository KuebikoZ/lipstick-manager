import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import { inventoryErrorResponse } from "@/lib/http/inventory-api";
import { createInventoryService } from "@/lib/services/service-factory";

export async function GET(request: Request): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const url = new URL(request.url);
  if (url.searchParams.get("kind") !== "new" || url.searchParams.has("item_id")) {
    return errorResponse(400, "VALIDATION_ERROR", "当前阶段仅支持新增草稿");
  }
  try {
    const draft = await createInventoryService().getCurrentNewDraft();
    return draft ? dataResponse(draft) : errorResponse(404, "NOT_FOUND", "没有可恢复的草稿");
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}
