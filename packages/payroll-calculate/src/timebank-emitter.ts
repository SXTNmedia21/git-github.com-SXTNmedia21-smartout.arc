/**
 * packages/payroll-calculate/src/timebank-emitter.ts
 *
 * WHAT: Pure function to emit timebank entries for a period.
 *       Handles three account types:
 *         1. feriepenger — NOK accrual (gross_eligible × holiday_allowance_pct / 100)
 *         2. toil — hours accrual (only if banked mode + agreement signed)
 *         3. wellness — days used (decrement from quota, based on absence records)
 *
 * WHY: Timebank entries are derived from payroll aggregation + absence data.
 *      They map to payroll.timebank_entry rows in the DB (written by Day 4 RPC).
 *      This function only PRODUCES the entries — no writes.
 *
 * FERIEPENGER (Holiday pay):
 *   - Riksavtalen default: 12.0%
 *   - Riksavtalen for entitled extra week (62+ employees, extra_holiday_week=true): 12.5%
 *   - Custom per profile: holiday_allowance_pct on employee_payroll_profile
 *   - Base: gross_amount_ore (excludes tips + manual supplements)
 *   - One entry per period per profile, account_type="feriepenger"
 *
 * TOIL (Time Off In Lieu):
 *   - Only fires if overtime_mode="banked" AND toil_agreement_signed_at IS NOT NULL
 *   - Hours banked come from the overtime resolver accumulator
 *   - Caller must provide banked_minutes_by_profile map (from resolveOvertime calls)
 *   - Unit: "hours", value_amount_ore=0 (time, not money)
 *
 * WELLNESS:
 *   - Based on schedule_absence rows with absence_type="wellness"
 *   - One withdrawal entry per wellness absence
 *   - No accrual in this fn (accrual is annual, separate process)
 *
 * Zero I/O. Pure function.
 */

import type {
  AggregatedPeriod,
  AbsenceInput,
  PayrollProfile,
  WorkspaceSettings,
  TimebankEntry,
} from "./types.js";
import { nokToOre, pctSupplementOre } from "./cents.js";

/**
 * emitTimebankEntries — pure function.
 *
 * @param aggregated - one AggregatedPeriod for this profile
 * @param profile - employee payroll profile
 * @param workspaceSettings - for toil_default_max_banked_hours, vacation_pay_pct
 * @param absences - absence records for this profile in the period
 * @param bankedMinutes - OT minutes banked for this profile (from resolveOvertime)
 *   If 0 or not provided, no TOIL entry is created.
 * @param periodEndDate - "YYYY-MM-DD" for effective_date on entries
 * @param payrollCalculationId - link to the calculation row (for audit)
 * @returns array of TimebankEntry rows to write
 */
export function emitTimebankEntries(
  aggregated: AggregatedPeriod,
  profile: PayrollProfile,
  workspaceSettings: WorkspaceSettings,
  absences: ReadonlyArray<AbsenceInput>,
  bankedMinutes: number,
  periodEndDate: string,
  payrollCalculationId: string | null,
): TimebankEntry[] {
  const entries: TimebankEntry[] = [];

  // ── 1. Feriepenger accrual ─────────────────────────────────────────────
  {
    const feriepengerPct = profile.holiday_allowance_pct; // e.g. 12.0 or 12.5
    // Base = gross_amount_ore (shift pay only — tips and manual supplements excluded from
    // feriepenger basis per standard practice)
    const baseOre = aggregated.gross_amount_ore;

    // Compute feriepenger: base * pct / 100
    // pctSupplementOre handles the decimal fraction: pass feriepengerPct as-is
    // (> 1.0 → treated as percentage, e.g. 12.0 → 12%)
    const feriepengerOre = pctSupplementOre(baseOre, feriepengerPct);

    entries.push({
      profile_id: aggregated.profile_id,
      workspace_id: aggregated.workspace_id,
      account_type: "feriepenger",
      entry_type: "accrual",
      hours: 0, // NOK account — hours field = 0
      value_amount_ore: feriepengerOre,
      value_unit: "NOK",
      effective_date: periodEndDate,
      expiry_date: null, // feriepenger expire 3 years after accrual — managed separately
      description: `Feriepenger ${feriepengerPct}% av bruttolønn for periode`,
      payroll_calculation_id: payrollCalculationId,
      schedule_absence_id: null,
    });
  }

  // ── 2. TOIL accrual ────────────────────────────────────────────────────
  if (profile.overtime_mode === "banked" && profile.toil_agreement_signed_at !== null) {
    if (bankedMinutes > 0) {
      const toilHours = bankedMinutes / 60;

      entries.push({
        profile_id: aggregated.profile_id,
        workspace_id: aggregated.workspace_id,
        account_type: "toil",
        entry_type: "accrual",
        hours: toilHours,
        value_amount_ore: 0n, // TOIL is tracked in hours, not money
        value_unit: "hours",
        effective_date: periodEndDate,
        expiry_date: null,
        description: `TOIL avspasering akkumulert: ${toilHours.toFixed(2)} timer`,
        payroll_calculation_id: payrollCalculationId,
        schedule_absence_id: null,
      });
    }
  }

  // ── 3. Wellness withdrawals ────────────────────────────────────────────
  const wellnessAbsences = absences.filter(
    (a) => a.absence_type === "wellness" && a.profile_id === aggregated.profile_id,
  );

  for (const absence of wellnessAbsences) {
    // Compute days in this absence period
    const startMs = new Date(absence.start_date + "T00:00:00Z").getTime();
    const endMs = new Date(absence.end_date + "T00:00:00Z").getTime();
    const days = Math.round((endMs - startMs) / 86_400_000) + 1; // inclusive

    entries.push({
      profile_id: aggregated.profile_id,
      workspace_id: aggregated.workspace_id,
      account_type: "wellness",
      entry_type: "withdrawal",
      hours: days * 8, // 1 wellness day = 8 hours (convention)
      value_amount_ore: 0n, // wellness tracked in days/hours not money
      value_unit: "hours",
      effective_date: absence.start_date,
      expiry_date: null,
      description: `Velferdsdag brukt: ${days} dag(er) (${absence.start_date} – ${absence.end_date})`,
      payroll_calculation_id: null,
      schedule_absence_id: absence.id,
    });
  }

  return entries;
}
