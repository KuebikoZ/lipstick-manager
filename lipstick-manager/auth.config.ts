import type { NextAuthConfig } from "next-auth";

export function shouldUseSecureCookies(
  appUrl: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  return appUrl?.startsWith("https://") ?? nodeEnv === "production";
}

const secureCookies = shouldUseSecureCookies(process.env.APP_URL, process.env.NODE_ENV);

export const authConfig = {
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
  useSecureCookies: secureCookies,
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      const configuredVersion = Number(process.env.SESSION_VERSION);

      if (user) {
        token.sessionVersion = configuredVersion;
      }

      token.sessionValid =
        Number.isInteger(configuredVersion) &&
        configuredVersion > 0 &&
        token.sessionVersion === configuredVersion;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.sessionVersion =
        typeof token.sessionVersion === "number" ? token.sessionVersion : null;
      session.sessionValid = token.sessionValid === true;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
