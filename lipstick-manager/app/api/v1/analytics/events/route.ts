import { getValidSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, readJson } from "@/lib/http/inventory-api";
import { createAnalyticsService } from "@/lib/services/service-factory";

export async function POST(request: Request): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request);
  if (originError) return originError;
  try {
    await createAnalyticsService().record(await readJson(request));
    return new Response(null, { status: 204 });
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}
