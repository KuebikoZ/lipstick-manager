import type { AnalyticsEvent } from "@/lib/domain/analytics";

type ClientEvent = Omit<AnalyticsEvent, "event_id" | "session_id">;
const sessionKey = "lipstick-analytics-session";

function sessionId(): string {
  const current = window.sessionStorage.getItem(sessionKey);
  if (current) return current;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(sessionKey, created);
  return created;
}

export function trackEvent(event: ClientEvent): void {
  if (typeof window === "undefined") return;
  const payload = { ...event, event_id: crypto.randomUUID(), session_id: sessionId() };
  void fetch("/api/v1/analytics/events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), keepalive: true,
  }).catch(() => undefined);
}
