import { getValidSession } from "@/lib/auth/session";
import { errorResponse, dataResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { createAITaskService } from "@/lib/services/ai-service-factory";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try { const id = uuidSchema.parse((await context.params).id); await createAITaskService().cancel(id); return dataResponse({ task_id: id, status: "cancelled" }, 202); }
  catch (error) { return inventoryErrorResponse(error); }
}
