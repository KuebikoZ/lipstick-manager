import { timingSafeEqual } from "node:crypto";
import type { AuthEnv } from "@/lib/config/env";
import {
  createLoginKeyHash,
  isLoginLimited,
  type LoginRateLimitStore,
} from "@/lib/auth/login-rate-limit";

export type AuthenticationResult =
  | { status: "authenticated" }
  | { status: "invalid_credentials" }
  | { status: "rate_limited" };

type AuthenticateAdminOptions = {
  env: AuthEnv;
  ipAddress: string;
  now?: Date;
  passwordVerifier: (hash: string, password: string) => Promise<boolean>;
  rateLimitStore: LoginRateLimitStore;
  username: string;
  password: string;
};

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const paddedLength = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const leftPadded = Buffer.alloc(paddedLength);
  const rightPadded = Buffer.alloc(paddedLength);
  leftBuffer.copy(leftPadded);
  rightBuffer.copy(rightPadded);

  return timingSafeEqual(leftPadded, rightPadded) && leftBuffer.length === rightBuffer.length;
}

export async function authenticateAdmin({
  env,
  ipAddress,
  now = new Date(),
  passwordVerifier,
  rateLimitStore,
  username,
  password,
}: AuthenticateAdminOptions): Promise<AuthenticationResult> {
  const normalizedUsername = username.trim();
  const keyHash = createLoginKeyHash(
    ipAddress,
    normalizedUsername,
    env.AUTH_SECRET,
  );
  const existingAttempt = await rateLimitStore.get(keyHash);

  if (isLoginLimited(existingAttempt, now)) {
    return { status: "rate_limited" };
  }

  const [passwordMatches, usernameMatches] = await Promise.all([
    passwordVerifier(env.ADMIN_PASSWORD_HASH, password),
    Promise.resolve(constantTimeStringEqual(normalizedUsername, env.ADMIN_USERNAME)),
  ]);

  if (!passwordMatches || !usernameMatches) {
    const updatedAttempt = await rateLimitStore.recordFailure(keyHash, now);
    return isLoginLimited(updatedAttempt, now)
      ? { status: "rate_limited" }
      : { status: "invalid_credentials" };
  }

  await rateLimitStore.clear(keyHash);
  return { status: "authenticated" };
}
