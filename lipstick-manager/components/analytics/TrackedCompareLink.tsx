"use client";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/client";

export function TrackedCompareLink({ value, label, count, active }: { value: string; label: string; count: number; active: boolean }) {
  return <Link aria-current={active ? "page" : undefined} style={active ? { borderColor: "var(--accent)", boxShadow: "0 0 0 2px rgb(152 85 102 / 15%)" } : undefined} href={`/compare?color=${value}`} onClick={() => trackEvent({ event_name: "action", page_id: "compare", properties: { action: "compare_color_select", selection: value as "nude" } })}><strong>{label}</strong><span>{count} 支</span></Link>;
}
