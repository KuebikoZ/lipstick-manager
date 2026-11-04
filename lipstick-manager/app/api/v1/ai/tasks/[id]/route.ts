import { getValidSession } from "@/lib/auth/session";
import { errorResponse, dataResponse } from "@/lib/http/api-response";
import { inventoryErrorResponse, uuidSchema } from "@/lib/http/inventory-api";
import { createAITaskService } from "@/lib/services/ai-service-factory";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  try { return dataResponse(await createAITaskService().get(uuidSchema.parse((await context.params).id))); }
  catch (error) { return inventoryErrorResponse(error); }
}
