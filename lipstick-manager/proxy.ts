import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { decideAccess } from "@/lib/auth/access-policy";
import { unauthorizedResponse } from "@/lib/http/api-response";

const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const authenticated = Boolean(request.auth?.user?.id && request.auth.sessionValid);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  const decision = decideAccess(pathname, authenticated);

  if (decision === "unauthorized_api") {
    return unauthorizedResponse();
  }

  if (decision === "redirect_to_login") {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
