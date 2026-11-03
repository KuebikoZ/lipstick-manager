import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sessionVersion: number | null;
    sessionValid: boolean;
    user: DefaultSession["user"] & { id: string };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sessionVersion?: number;
    sessionValid?: boolean;
  }
}
