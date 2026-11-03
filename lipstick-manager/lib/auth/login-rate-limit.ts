import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginAttempt = {
  windowStartedAt: Date;
  failureCount: number;
  lockedUntil: Date | null;
};

export interface LoginRateLimitStore {
  get(keyHash: string): Promise<LoginAttempt | null>;
  recordFailure(keyHash: string, now: Date): Promise<LoginAttempt>;
  clear(keyHash: string): Promise<void>;
}

export class LoginRateLimitUnavailableError extends Error {
  constructor() {
    super("Login rate limit store is unavailable");
    this.name = "LoginRateLimitUnavailableError";
  }
}

type LoginAttemptRow = {
  window_started_at: string;
  failure_count: number;
  locked_until: string | null;
};

function toLoginAttempt(row: LoginAttemptRow): LoginAttempt {
  return {
    windowStartedAt: new Date(row.window_started_at),
    failureCount: row.failure_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
  };
}

export function createLoginKeyHash(
  ipAddress: string,
  username: string,
  secret: string,
): string {
  const ipHash = createHmac("sha256", secret)
    .update(`ip:${ipAddress}`)
    .digest("hex");
  const usernameHash = createHmac("sha256", secret)
    .update(`username:${username.trim().toLocaleLowerCase("en-US")}`)
    .digest("hex");

  return createHash("sha256").update(`${ipHash}:${usernameHash}`).digest("hex");
}

export function isLoginLimited(attempt: LoginAttempt | null, now: Date): boolean {
  return Boolean(attempt?.lockedUntil && attempt.lockedUntil.getTime() > now.getTime());
}

export class SupabaseLoginRateLimitStore implements LoginRateLimitStore {
  constructor(private readonly client: SupabaseClient) {}

  async get(keyHash: string): Promise<LoginAttempt | null> {
    const { data, error } = await this.client
      .from("auth_login_attempts")
      .select("window_started_at,failure_count,locked_until")
      .eq("key_hash", keyHash)
      .maybeSingle<LoginAttemptRow>();

    if (error) throw new LoginRateLimitUnavailableError();
    return data ? toLoginAttempt(data) : null;
  }

  async recordFailure(keyHash: string, now: Date): Promise<LoginAttempt> {
    const { data, error } = await this.client.rpc("record_auth_login_failure", {
      p_key_hash: keyHash,
      p_now: now.toISOString(),
    });
    const row = Array.isArray(data) ? (data[0] as LoginAttemptRow | undefined) : undefined;

    if (error || !row) throw new LoginRateLimitUnavailableError();
    return toLoginAttempt(row);
  }

  async clear(keyHash: string): Promise<void> {
    const { error } = await this.client
      .from("auth_login_attempts")
      .delete()
      .eq("key_hash", keyHash);

    if (error) throw new LoginRateLimitUnavailableError();
  }
}
