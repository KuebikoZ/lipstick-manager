export type AccessDecision = "allow" | "redirect_to_login" | "unauthorized_api";

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth/")
  );
}

export function decideAccess(pathname: string, authenticated: boolean): AccessDecision {
  if (isPublicPath(pathname) || authenticated) return "allow";
  return pathname.startsWith("/api/") ? "unauthorized_api" : "redirect_to_login";
}
