import { z } from "zod";
import { getValidSession } from "@/lib/auth/session";
import { dataResponse, errorResponse } from "@/lib/http/api-response";
import {
  invalidOriginResponse,
  inventoryErrorResponse,
  readJson,
} from "@/lib/http/inventory-api";
import { createInventoryService } from "@/lib/services/service-factory";

export async function GET(request: Request): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  try {
    const params = new URL(request.url).searchParams;
    return dataResponse(await createInventoryService().listItems({
      life: params.get("life") || undefined,
      time: params.get("time") || undefined,
      color: params.get("color") || undefined,
      brand: params.get("brand") || undefined,
      sort: params.get("sort") || undefined,
    }));
  } catch (error) {
    return inventoryErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request);
  if (originError) return originError;

  try {
    const idempotencyKey = z.uuid().parse(request.headers.get("idempotency-key"));
    const item = await createInventoryService().createItem(await readJson(request), idempotencyKey);
    return dataResponse(item, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "VALIDATION_ERROR", "缺少有效的 Idempotency-Key", undefined, {
        idempotency_key: "Idempotency-Key 必须是 UUID",
      });
    }
    return inventoryErrorResponse(error);
  }
}
