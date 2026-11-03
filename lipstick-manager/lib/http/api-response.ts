export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ORIGIN_MISMATCH"
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
): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export function unauthorizedResponse(): Response {
  return errorResponse(401, "UNAUTHORIZED", "请先登录");
}
