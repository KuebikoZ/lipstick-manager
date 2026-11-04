import { z } from "zod";
import { parseAuthEnv } from "@/lib/config/env";
import { InventoryDependencyError } from "@/lib/db/inventory-repository";
import {
  IdempotencyConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from "@/lib/services/inventory-service";
import { errorResponse } from "@/lib/http/api-response";
import { allowedAppOrigins, hasValidOrigin } from "@/lib/http/origin";

export const uuidSchema = z.uuid();

export function invalidOriginResponse(request: Request): Response | null {
  const { APP_URL } = parseAuthEnv(process.env);
  const allowedOrigins = allowedAppOrigins(
    APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  );
  return hasValidOrigin(request, allowedOrigins)
    ? null
    : errorResponse(403, "ORIGIN_MISMATCH", "请求来源无效");
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new InventoryValidationError({ form: "请求必须使用 application/json" });
  }
  try {
    return await request.json();
  } catch {
    throw new InventoryValidationError({ form: "请求 JSON 无效" });
  }
}

export function inventoryErrorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return errorResponse(400, "VALIDATION_ERROR", "请求参数无效");
  }
  if (error instanceof InventoryValidationError) {
    return errorResponse(400, "VALIDATION_ERROR", "请检查填写内容", undefined, error.fieldErrors);
  }
  if (error instanceof InventoryNotFoundError) {
    return errorResponse(404, "NOT_FOUND", "记录不存在或已失效");
  }
  if (error instanceof IdempotencyConflictError) {
    return errorResponse(409, "IDEMPOTENCY_CONFLICT", "保存请求与先前请求不一致，请重新提交");
  }
  if (error instanceof InventoryDependencyError) {
    return errorResponse(503, "DEPENDENCY_UNAVAILABLE", "数据服务暂时不可用，请稍后重试");
  }
  return errorResponse(500, "INTERNAL_ERROR", "暂时无法完成操作");
}
