import { describe, expect, it, vi } from "vitest";
import { authenticateAdmin } from "@/lib/auth/authenticate-admin";
import type {
  LoginAttempt,
  LoginRateLimitStore,
} from "@/lib/auth/login-rate-limit";
import type { AuthEnv } from "@/lib/config/env";

const env: AuthEnv = {
  APP_URL: "https://example.test",
  AUTH_SECRET: "a".repeat(32),
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "$argon2id$test-hash",
  SESSION_VERSION: 1,
};

class MemoryLoginRateLimitStore implements LoginRateLimitStore {
  attempt: LoginAttempt | null = null;
  cleared = false;

  async get() {
    return this.attempt;
  }

  async recordFailure(_keyHash: string, now: Date) {
    const failureCount = (this.attempt?.failureCount ?? 0) + 1;
    this.attempt = {
      windowStartedAt: this.attempt?.windowStartedAt ?? now,
      failureCount,
      lockedUntil:
        failureCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null,
    };
    return this.attempt;
  }

  async clear() {
    this.cleared = true;
    this.attempt = null;
  }
}

describe("authenticateAdmin", () => {
  it("authenticates the configured account and clears prior failures", async () => {
    const store = new MemoryLoginRateLimitStore();
    const result = await authenticateAdmin({
      env,
      ipAddress: "203.0.113.10",
      password: "correct-password",
      passwordVerifier: async () => true,
      rateLimitStore: store,
      username: "admin",
    });

    expect(result).toEqual({ status: "authenticated" });
    expect(store.cleared).toBe(true);
  });

  it("uses the same generic failure for a wrong username and still verifies the password", async () => {
    const store = new MemoryLoginRateLimitStore();
    const passwordVerifier = vi.fn(async () => true);
    const result = await authenticateAdmin({
      env,
      ipAddress: "203.0.113.10",
      password: "correct-password",
      passwordVerifier,
      rateLimitStore: store,
      username: "someone-else",
    });

    expect(result).toEqual({ status: "invalid_credentials" });
    expect(passwordVerifier).toHaveBeenCalledOnce();
    expect(store.attempt?.failureCount).toBe(1);
  });

  it("locks the key on the fifth failed attempt", async () => {
    const store = new MemoryLoginRateLimitStore();

    for (let count = 1; count <= 5; count += 1) {
      const result = await authenticateAdmin({
        env,
        ipAddress: "203.0.113.10",
        now: new Date("2026-11-03T14:00:00.000Z"),
        password: "wrong-password",
        passwordVerifier: async () => false,
        rateLimitStore: store,
        username: "admin",
      });

      expect(result.status).toBe(count === 5 ? "rate_limited" : "invalid_credentials");
    }
  });

  it("does not run another password verification while locked", async () => {
    const store = new MemoryLoginRateLimitStore();
    store.attempt = {
      windowStartedAt: new Date("2026-11-03T14:00:00.000Z"),
      failureCount: 5,
      lockedUntil: new Date("2026-11-03T14:15:00.000Z"),
    };
    const passwordVerifier = vi.fn(async () => true);

    const result = await authenticateAdmin({
      env,
      ipAddress: "203.0.113.10",
      now: new Date("2026-11-03T14:05:00.000Z"),
      password: "correct-password",
      passwordVerifier,
      rateLimitStore: store,
      username: "admin",
    });

    expect(result).toEqual({ status: "rate_limited" });
    expect(passwordVerifier).not.toHaveBeenCalled();
  });
});
