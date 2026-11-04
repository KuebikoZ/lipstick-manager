import type { DeadlineInput } from "@/lib/domain/deadline";
import { addCalendarMonths, type LocalDate } from "@/lib/domain/local-date";

export type DateValidationError =
  | "OPENED_ON_IN_FUTURE"
  | "MANUFACTURED_ON_IN_FUTURE"
  | "MANUFACTURED_AFTER_EXPIRY"
  | "OPENED_AFTER_EXPIRY";

export function validateDeadlineDates(
  input: DeadlineInput,
  today: LocalDate,
): DateValidationError[] {
  const errors: DateValidationError[] = [];
  if (input.opened_on && input.opened_on > today) errors.push("OPENED_ON_IN_FUTURE");
  if (input.manufactured_on && input.manufactured_on > today) {
    errors.push("MANUFACTURED_ON_IN_FUTURE");
  }
  const calculatedExpiry =
    input.manufactured_on && input.shelf_life_months
      ? addCalendarMonths(input.manufactured_on, input.shelf_life_months)
      : null;
  const effectiveExpiry = input.expires_on ?? calculatedExpiry;
  if (input.manufactured_on && input.expires_on && input.manufactured_on > input.expires_on) {
    errors.push("MANUFACTURED_AFTER_EXPIRY");
  }
  if (input.opened_on && effectiveExpiry && input.opened_on > effectiveExpiry) {
    errors.push("OPENED_AFTER_EXPIRY");
  }
  return errors;
}
