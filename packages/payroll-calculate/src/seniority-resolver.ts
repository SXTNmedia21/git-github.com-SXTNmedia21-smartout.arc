/**
 * packages/payroll-calculate/src/seniority-resolver.ts
 *
 * WHAT: Resolve seniority tier from contract start date and evaluation date.
 *
 * WHY: Riksavtalen and tariff tables tier minimum wages by seniority.
 *      The resolver computes integer years elapsed and maps to the discrete
 *      tier boundaries. Completely pure — no I/O, no DB access.
 *
 * Tier boundaries (Riksavtalen):
 *   < 2 years    → "begynner"
 *   [2, 4) years → "2_aar"
 *   [4, 6) years → "4_aar"
 *   [6, 8) years → "6_aar"
 *   [8, 10) yrs  → "8_aar"
 *   ≥ 10 years   → "10_aar"
 *
 * Anniversary convention: an employee hired 2024-04-15 reaches the "2_aar"
 * tier on 2026-04-15 (not 2026-04-14). Inclusive on anniversary date.
 * Leap-year edge: 2024-02-29 → 2026-02-28 (no Feb 29 in non-leap years).
 * This follows the standard Norwegian employer practice (same as Aml.).
 *
 * Input: ISO-8601 date strings "YYYY-MM-DD". Pure string parsing — no Date
 * constructor to avoid DST surprises.
 */

import type { SeniorityTier } from "./types.js";

/**
 * Compute full years elapsed between two ISO dates (YYYY-MM-DD).
 * "Full year" = same-or-later month/day in evaluation year vs start year.
 *
 * Edge cases:
 *   - startDate > evaluationDate → 0 years (new hire evaluated before start)
 *   - Leap-year anniversary (02-29): compare against 02-28 in non-leap year
 */
function fullYearsElapsed(startDate: string, evaluationDate: string): number {
  const [sY, sM, sD] = startDate.split("-").map(Number) as [number, number, number];
  const [eY, eM, eD] = evaluationDate.split("-").map(Number) as [number, number, number];

  if (eY < sY) return 0;

  let years = eY - sY;

  // Check if anniversary month/day has been reached in evaluation year
  // Handle leap-year edge: if start is Feb 29 and eval year has no Feb 29,
  // anniversary is Feb 28.
  const anniversaryMonth = sM;
  let anniversaryDay = sD;
  if (sM === 2 && sD === 29 && !isLeapYear(eY)) {
    anniversaryDay = 28;
  }

  // If evaluation month/day is before anniversary, subtract 1 year
  if (eM < anniversaryMonth || (eM === anniversaryMonth && eD < anniversaryDay)) {
    years -= 1;
  }

  return Math.max(0, years);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Resolve seniority tier for an employee.
 *
 * @param contractStartDate - ISO "YYYY-MM-DD" of the seniority start date
 *   (employee_payroll_profile.seniority_start_date — may differ from contract start
 *    if sector experience is counted; but pure date comparison here, caller adjusts)
 * @param evaluationDate - ISO "YYYY-MM-DD" — the date to evaluate as of (typically
 *   the period end date or shift date)
 * @returns SeniorityTier — the discrete tier bucket
 */
export function resolveSeniorityTier(
  contractStartDate: string,
  evaluationDate: string,
): SeniorityTier {
  const years = fullYearsElapsed(contractStartDate, evaluationDate);

  if (years < 2) return "begynner";
  if (years < 4) return "2_aar";
  if (years < 6) return "4_aar";
  if (years < 8) return "6_aar";
  if (years < 10) return "8_aar";
  return "10_aar";
}
