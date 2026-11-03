import type { Lifecycle, OpeningPrecision } from "@/lib/domain/inventory";
import {
  addCalendarMonths,
  differenceInCalendarDays,
  type LocalDate,
} from "@/lib/domain/local-date";

export type DeadlineBasis = "pao" | "expiry" | "pao_and_expiry" | null;
export type DeadlineStatus =
  | "over_180"
  | "days_91_180"
  | "days_31_90"
  | "days_1_30"
  | "due_today"
  | "expired"
  | "unknown";

export type DeadlineInput = {
  lifecycle: Lifecycle;
  opened_on: LocalDate | null;
  opening_precision: OpeningPrecision;
  pao_months: number | null;
  manufactured_on: LocalDate | null;
  shelf_life_months: number | null;
  expires_on: LocalDate | null;
};

export type DeadlineResult = {
  pao_deadline: LocalDate | null;
  calculated_expiry: LocalDate | null;
  effective_expiry: LocalDate | null;
  deadline: LocalDate | null;
  deadline_basis: DeadlineBasis;
  days_left: number | null;
  deadline_status: DeadlineStatus;
};

function earlier(left: LocalDate, right: LocalDate): LocalDate {
  return left <= right ? left : right;
}

export function classifyDeadline(daysLeft: number | null): DeadlineStatus {
  if (daysLeft === null) return "unknown";
  if (daysLeft < 0) return "expired";
  if (daysLeft === 0) return "due_today";
  if (daysLeft <= 30) return "days_1_30";
  if (daysLeft <= 90) return "days_31_90";
  if (daysLeft <= 180) return "days_91_180";
  return "over_180";
}

export function isDueWithinThirtyDays(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
}

export function calculateDeadline(input: DeadlineInput, today: LocalDate): DeadlineResult {
  const paoDeadline =
    input.lifecycle === "opened" &&
    input.opening_precision === "exact" &&
    input.opened_on &&
    input.pao_months
      ? addCalendarMonths(input.opened_on, input.pao_months)
      : null;
  const calculatedExpiry =
    input.manufactured_on && input.shelf_life_months
      ? addCalendarMonths(input.manufactured_on, input.shelf_life_months)
      : null;
  const effectiveExpiry = input.expires_on ?? calculatedExpiry;
  const deadline =
    paoDeadline && effectiveExpiry
      ? earlier(paoDeadline, effectiveExpiry)
      : (paoDeadline ?? effectiveExpiry);
  const deadlineBasis: DeadlineBasis =
    paoDeadline && effectiveExpiry ? "pao_and_expiry" : paoDeadline ? "pao" : effectiveExpiry ? "expiry" : null;
  const daysLeft = deadline ? differenceInCalendarDays(deadline, today) : null;

  return {
    pao_deadline: paoDeadline,
    calculated_expiry: calculatedExpiry,
    effective_expiry: effectiveExpiry,
    deadline,
    deadline_basis: deadlineBasis,
    days_left: daysLeft,
    deadline_status: classifyDeadline(daysLeft),
  };
}
