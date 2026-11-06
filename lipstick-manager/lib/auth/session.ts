import "server-only";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { isPublicDemoMode } from "@/lib/config/app-mode";

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

export function isValidSession(session: Session | null): session is Session {
  return Boolean(session?.user?.id && session.sessionValid);
}

export async function getValidSession(): Promise<Session | null> {
  if (isPublicDemoMode()) {
    return {
      expires: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
      sessionValid: true,
      sessionVersion: 1,
      user: { id: "public-demo", name: "公开体验访客" },
    };
  }
  const session = await auth();
  return isValidSession(session) ? session : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getValidSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requirePageSession(): Promise<Session> {
  await connection();
  const session = await getValidSession();
  if (!session) redirect("/login");
  return session;
}
