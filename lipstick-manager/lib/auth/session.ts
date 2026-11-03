import "server-only";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

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
  const session = await auth();
  return isValidSession(session) ? session : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getValidSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requirePageSession(): Promise<Session> {
  const session = await getValidSession();
  if (!session) redirect("/login");
  return session;
}
