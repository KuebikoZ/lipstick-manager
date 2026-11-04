import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, readJson, uuidSchema } from "@/lib/http/inventory-api";
import { createInventoryService } from "@/lib/services/service-factory";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try { const body = await readJson(request) as Record<string, unknown>; return dataResponse(await createInventoryService().discardItem(uuidSchema.parse((await params).id), Number(body.revision))); }
  catch (error) { return inventoryErrorResponse(error); }
}
