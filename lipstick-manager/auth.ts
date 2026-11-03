import { verify } from "@node-rs/argon2";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { getClientIp } from "@/lib/auth/client-ip";
import { ADMIN_SUBJECT } from "@/lib/auth/constants";
import { authenticateAdmin } from "@/lib/auth/authenticate-admin";
import {
  createSupabaseAdminClient,
  LoginRateLimitUnavailableError,
  SupabaseLoginRateLimitStore,
} from "@/lib/auth/login-rate-limit";
import { parseAuthEnv, parseSupabaseEnv } from "@/lib/config/env";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1_000),
});

class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

class LoginDependencyUnavailableError extends CredentialsSignin {
  code = "dependency_unavailable";
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsedCredentials = credentialsSchema.safeParse(rawCredentials);
        if (!parsedCredentials.success) return null;

        try {
          const authEnv = parseAuthEnv(process.env);
          const supabaseEnv = parseSupabaseEnv(process.env);
          const rateLimitStore = new SupabaseLoginRateLimitStore(
            createSupabaseAdminClient(supabaseEnv),
          );
          const result = await authenticateAdmin({
            env: authEnv,
            ipAddress: getClientIp(request),
            password: parsedCredentials.data.password,
            passwordVerifier: verify,
            rateLimitStore,
            username: parsedCredentials.data.username,
          });

          if (result.status === "rate_limited") throw new LoginRateLimitedError();
          if (result.status === "invalid_credentials") return null;

          return {
            id: ADMIN_SUBJECT,
            name: authEnv.ADMIN_USERNAME,
          };
        } catch (error) {
          if (error instanceof CredentialsSignin) throw error;
          if (error instanceof LoginRateLimitUnavailableError) {
            throw new LoginDependencyUnavailableError();
          }
          throw error;
        }
      },
    }),
  ],
});
