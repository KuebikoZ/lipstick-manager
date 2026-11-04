export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ORIGIN_MISMATCH"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "REVISION_CONFLICT"
  | "DEPENDENCY_UNAVAILABLE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "IMAGE_VALIDATION_FAILED"
  | "AI_OUTPUT_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId = createRequestId(),
  fieldErrors?: Record<string, string>,
): Response {
  return Response.json(
    { error: { code, message, ...(fieldErrors ? { field_errors: fieldErrors } : {}) } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export function dataResponse(data: unknown, status = 200, requestId = createRequestId()): Response {
  return Response.json(
    { data },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}

export function unauthorizedResponse(): Response {
  return errorResponse(401, "UNAUTHORIZED", "请先登录");
}
