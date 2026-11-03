import { describe, expect, it } from "vitest";
import {
  calculateDeadline,
  classifyDeadline,
  isDueWithinThirtyDays,
  type DeadlineInput,
} from "@/lib/domain/deadline";
import { addCalendarMonths, localDateSchema, localToday } from "@/lib/domain/local-date";
import { validateDeadlineDates } from "@/lib/domain/validation";

const baseInput: DeadlineInput = {
  lifecycle: "opened",
  opened_on: "2026-03-01",
  opening_precision: "exact",
  pao_months: 12,
  manufactured_on: null,
  shelf_life_months: null,
  expires_on: "2026-12-01",
};

describe("deadline rules", () => {
  it("uses the earlier PAO and effective expiry (AC-006)", () => {
    expect(calculateDeadline(baseInput, "2026-11-03")).toMatchObject({
      pao_deadline: "2027-03-01",
      effective_expiry: "2026-12-01",
      deadline: "2026-12-01",
      deadline_basis: "pao_and_expiry",
      days_left: 28,
      deadline_status: "days_1_30",
    });
  });

  it("uses PAO alone, expiry alone, or unknown as fields permit (AC-006)", () => {
    expect(calculateDeadline({ ...baseInput, expires_on: null }, "2026-11-03").deadline).toBe(
      "2027-03-01",
    );
    expect(
      calculateDeadline(
        { ...baseInput, opened_on: null, pao_months: null },
        "2026-11-03",
      ).deadline,
    ).toBe("2026-12-01");
    expect(
      calculateDeadline(
        { ...baseInput, opened_on: null, pao_months: null, expires_on: null },
        "2026-11-03",
      ).deadline,
    ).toBeNull();
  });

  it("clips calendar-month addition to the target month end (AC-007)", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it.each([
    [-1, "expired"],
    [0, "due_today"],
    [1, "days_1_30"],
    [30, "days_1_30"],
    [31, "days_31_90"],
    [90, "days_31_90"],
    [91, "days_91_180"],
    [180, "days_91_180"],
    [181, "over_180"],
    [null, "unknown"],
  ] as const)("classifies %s days as %s (AC-007)", (days, status) => {
    expect(classifyDeadline(days)).toBe(status);
  });

  it("counts only today through day 30 in the due summary", () => {
    expect(isDueWithinThirtyDays(-1)).toBe(false);
    expect(isDueWithinThirtyDays(0)).toBe(true);
    expect(isDueWithinThirtyDays(30)).toBe(true);
    expect(isDueWithinThirtyDays(31)).toBe(false);
    expect(isDueWithinThirtyDays(null)).toBe(false);
  });

  it("rejects future source dates and opening after expiry", () => {
    expect(
      validateDeadlineDates(
        {
          ...baseInput,
          opened_on: "2026-11-04",
          manufactured_on: "2026-11-05",
          expires_on: "2026-11-03",
        },
        "2026-11-03",
      ),
    ).toEqual([
      "OPENED_ON_IN_FUTURE",
      "MANUFACTURED_ON_IN_FUTURE",
      "OPENED_AFTER_EXPIRY",
    ]);
  });

  it("validates real calendar dates and calculates Shanghai today", () => {
    expect(localDateSchema.safeParse("2026-02-29").success).toBe(false);
    expect(localDateSchema.safeParse("2024-02-29").success).toBe(true);
    expect(localToday(new Date("2026-11-02T16:30:00.000Z"))).toBe("2026-11-03");
  });
});
