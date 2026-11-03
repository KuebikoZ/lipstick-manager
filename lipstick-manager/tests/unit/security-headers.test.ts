import { describe, expect, it } from "vitest";
import { authConfig, shouldUseSecureCookies } from "@/auth.config";
import nextConfig from "@/next.config";

describe("security headers", () => {
  it("sets the required browser security headers", async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(rules?.[0]?.headers.map(({ key, value }) => [key, value]));

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Referrer-Policy")).toBe("same-origin");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("uses HttpOnly SameSite cookies and enables Secure for HTTPS/production", () => {
    const cookie = authConfig.cookies.sessionToken.options;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(authConfig.session.maxAge).toBe(30 * 24 * 60 * 60);
    expect(shouldUseSecureCookies("https://example.test", "development")).toBe(true);
    expect(shouldUseSecureCookies(undefined, "production")).toBe(true);
    expect(shouldUseSecureCookies("http://localhost:3000", "development")).toBe(false);
  });
});
