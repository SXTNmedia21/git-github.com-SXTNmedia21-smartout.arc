/**
 * packages/payroll-export/src/feriepenger.ts
 *
 * WHAT: Feriepenger BASIS compute helper — SMA-346 / ADR-0295.
 *
 * WHY: Smartout exposes the per-period basis (sum(holiday_eligible_pay) × pct / 100).
 *      Regnskapsfører computes accrued liability, 6G cap, and payout timing.
 *      Smartout never accumulates across periods — only the per-period basis.
 *
 * Rate defaults (ADR-0295 §Decision):
 *   12.00 % — Riksavtalen voksen ufaglært (default on employee_payroll_profile)
 *   14.30 % — Over-60 employees per Ferieloven §10 third paragraph
 *   10.20 % — 4-week agreements (FF/NHO), edge case
 */

/**
 * Compute feriepenger basis for one employee for one period.
 *
 * Formula: round(basePayTotal × holidayAllowancePct / 100, 2)
 *
 * Rounding is to 2 decimal places (NOK precision).
 * Caller passes the sum of holiday-eligible pay lines as basePayTotal.
 * Default pct is 12.00 but MUST be sourced from employee_payroll_profile,
 * never hardcoded at the call site.
 */
export function computeFeriepengerBasis(input: {
  basePayTotal: number;
  holidayAllowancePct: number;
}): number {
  const raw = input.basePayTotal * (input.holidayAllowancePct / 100);
  return Math.round(raw * 100) / 100; // NOK 2-decimal precision
}
