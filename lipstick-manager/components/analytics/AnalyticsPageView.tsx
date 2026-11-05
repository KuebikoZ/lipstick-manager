"use client";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/domain/analytics";

export function AnalyticsPageView({ pageId, intakeId }: { pageId: AnalyticsEvent["page_id"]; intakeId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent({ event_name: "page_view", page_id: pageId, intake_id: intakeId, properties: {} });
  }, [intakeId, pageId]);
  return null;
}
