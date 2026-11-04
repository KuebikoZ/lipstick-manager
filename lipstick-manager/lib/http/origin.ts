export function hasValidOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    if (originUrl.origin === new URL(appUrl).origin) return true;

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
