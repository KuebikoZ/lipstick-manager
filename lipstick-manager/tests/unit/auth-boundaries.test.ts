import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/auth/access-policy";
import { getClientIp } from "@/lib/auth/client-ip";
import { createLoginKeyHash } from "@/lib/auth/login-rate-limit";
import { safeReturnTo } from "@/lib/auth/return-to";
import { messageForLoginCode } from "@/lib/auth/login-state";
import { hasValidOrigin } from "@/lib/http/origin";

describe("authentication boundaries", () => {
  it("protects pages and APIs while keeping login, health, and Auth.js public", () => {
    expect(decideAccess("/", false)).toBe("redirect_to_login");
    expect(decideAccess("/inventory", false)).toBe("redirect_to_login");
    expect(decideAccess("/api/v1/items", false)).toBe("unauthorized_api");
    expect(decideAccess("/login", false)).toBe("allow");
    expect(decideAccess("/api/health", false)).toBe("allow");
    expect(decideAccess("/api/auth/session", false)).toBe("allow");
    expect(decideAccess("/api/v1/items", true)).toBe("allow");
  });

  it("only allows internal return paths", () => {
    expect(safeReturnTo("/inventory?sort=expiry")).toBe("/inventory?sort=expiry");
    expect(safeReturnTo("https://evil.example/steal")).toBe("/");
    expect(safeReturnTo("//evil.example/steal")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("never stores the plaintext IP or username in the login key", () => {
    const key = createLoginKeyHash("203.0.113.8", "Admin", "s".repeat(32));
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.8");
    expect(key).not.toContain("admin");
  });

  it("accepts only the configured origin", () => {
    expect(
      hasValidOrigin(
        new Request("https://app.example.test/api/v1/items", {
          headers: { origin: "https://app.example.test" },
        }),
        "https://app.example.test",
      ),
    ).toBe(true);
    expect(
      hasValidOrigin(
        new Request("https://app.example.test/api/v1/items", {
          headers: { origin: "https://evil.example" },
        }),
        "https://app.example.test",
      ),
    ).toBe(false);
  });

  it("maps login failures without revealing which credential was wrong", () => {
    expect(messageForLoginCode("credentials")).toBe("用户名或密码不正确");
    expect(messageForLoginCode("rate_limited")).toContain("15 分钟");
    expect(messageForLoginCode("dependency_unavailable")).toContain("暂时不可用");
  });

  it("uses a stable source only for localhost acceptance testing", () => {
    expect(
      getClientIp(
        new Request("http://127.0.0.1:3000/api/auth/callback/credentials", {
          headers: { "x-forwarded-for": "198.51.100.1" },
        }),
      ),
    ).toBe("local-development");
    expect(
      getClientIp(
        new Request("https://app.example/api/auth/callback/credentials", {
          headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
        }),
      ),
    ).toBe("198.51.100.1");
  });
});
