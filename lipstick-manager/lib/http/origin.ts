function toOrigin(value: string): string | null {
  try {
    const url = value.includes("://") ? value : `https://${value}`;
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function allowedAppOrigins(
  appUrl: string,
  vercelUrl?: string,
  vercelBranchUrl?: string,
): string[] {
  return [
    ...new Set(
      [appUrl, vercelUrl, vercelBranchUrl].flatMap((value) => {
        if (!value) return [];
        const origin = toOrigin(value);
        return origin ? [origin] : [];
      }),
    ),
  ];
}

export function hasValidOrigin(request: Request, allowedOrigins: string | string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
    if (origins.some((allowedOrigin) => originUrl.origin === toOrigin(allowedOrigin))) return true;

    const requestUrl = new URL(request.url);
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      localHosts.has(requestUrl.hostname) &&
      localHosts.has(originUrl.hostname) &&
      originUrl.protocol === requestUrl.protocol &&
      originUrl.port === requestUrl.port
    );
  } catch {
    return false;
  }
}
