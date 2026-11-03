import { z } from "zod";

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => formatUtcDate(parseLocalDate(value)) === value, "Invalid local date");

export type LocalDate = z.infer<typeof localDateSchema>;

function formatUtcDate(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addCalendarMonths(value: LocalDate, months: number): LocalDate {
  if (!Number.isInteger(months) || months < 1) {
    throw new RangeError("months must be a positive integer");
  }

  const source = parseLocalDate(value);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const targetStart = new Date(Date.UTC(year, month + months, 1));
  const targetYear = targetStart.getUTCFullYear();
  const targetMonth = targetStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return formatUtcDate(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))));
}

export function differenceInCalendarDays(later: LocalDate, earlier: LocalDate): number {
  return Math.round((parseLocalDate(later).getTime() - parseLocalDate(earlier).getTime()) / 86_400_000);
}

export function localToday(now = new Date(), timeZone = "Asia/Shanghai"): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
