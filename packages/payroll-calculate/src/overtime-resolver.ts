/**
 * packages/payroll-calculate/src/overtime-resolver.ts
 *
 * WHAT: Pure function to resolve overtime pay for a single time-bucket,
 *       given the employee's overtime mode and accumulated weekly hours.
 *
 * WHY: Norwegian overtime rules (Aml. §10-6) are ufravikelig (mandatory),
 *      regardless of overtime_mode setting:
 *        - Overtime premium (50%/100%) is ALWAYS paid out as money
 *        - The BASE hours may be "banked" (toil) instead of paid
 *
 *      Two modes:
 *        paid_out: overtime hours paid at base + 50% (daily) or 100% (extreme)
 *                  No time-bank accrual for OT. Normal day-to-day use.
 *        banked:   overtime hours go to time-bank (TOIL) instead of being paid
 *                  at double rate. BUT: the premium (50%/100%) is STILL paid
 *                  as money (spec §10.2 — "tillegg betales alltid").
 *                  This requires toil_agreement_signed_at NOT NULL (verified upstream).
 *
 * THRESHOLDS (Aml. §10-6):
 *   Daily OT: > 9h/day → 50% premium on the excess
 *   Weekly OT: > 40h/week → 50% premium on the excess (if not already daily-OT)
 *   Extreme OT: no single threshold — extreme is implicit at daily + weekly overlap
 *   100% rate: applies when individual agreements specify (not in base Aml.)
 *
 * SIMPLIFICATION for Phase 1:
 *   - 50% premium on OT hours (daily > 9h, weekly > 40h)
 *   - 100% not auto-computed (requires explicit workspace config — out of scope)
 *   - This fn is called PER BUCKET — caller accumulates weekly hours externally
 *
 * Zero I/O. Pure function.
 */

import type { PayrollProfile, TimeBucket } from "./types.js";
import { orePerMinuteFromHourlyNok, pctSupplementOre } from "./cents.js";

// OT thresholds (Aml. §10-6)
const DAILY_OT_THRESHOLD_MINUTES = 9 * 60; // 9 hours
const WEEKLY_OT_THRESHOLD_MINUTES = 40 * 60; // 40 hours = 2400 minutes

// OT premium rate: 50% (0.50 of base rate per hour)
const OT_PREMIUM_PCT = 0.5;

export type OvertimeResult = {
  /** Minutes of this bucket that are OT (exceed threshold) */
  ot_minutes: number;
  /** Amount to pay out in øre (premium only for banked mode, premium+base for paid_out) */
  paid_out_amount_ore: bigint;
  /** Minutes to bank in TOIL (only for banked mode; OT base minutes → TOIL) */
  banked_minutes: number;
};

/**
 * resolveOvertime — pure function.
 *
 * @param profile - employee payroll profile (overtime_mode, toil_agreement_signed_at)
 * @param bucket - the time-bucket being evaluated
 * @param dailyWorkedMinutesSoFar - worked minutes SO FAR for this day (excluding this bucket)
 * @param weeklyWorkedMinutesSoFar - worked minutes SO FAR for this week (excluding this bucket)
 * @param baseHourlyRateNok - base rate for premium computation
 * @returns OvertimeResult
 */
export function resolveOvertime(
  profile: PayrollProfile,
  bucket: TimeBucket,
  dailyWorkedMinutesSoFar: number,
  weeklyWorkedMinutesSoFar: number,
  baseHourlyRateNok: number,
): OvertimeResult {
  const bucketMinutes = bucket.minutes;

  // Compute how many minutes of this bucket are "over threshold"
  // Check daily threshold first, then weekly

  // Daily OT: minutes in this bucket that push daily total past 9h
  const dailyOtMinutes = Math.max(
    0,
    Math.min(bucketMinutes, dailyWorkedMinutesSoFar + bucketMinutes - DAILY_OT_THRESHOLD_MINUTES),
  );

  // Weekly OT: minutes in this bucket that push weekly total past 40h
  // (only counts if not already daily OT)
  const weeklyOtMinutes = Math.max(
    0,
    Math.min(bucketMinutes, weeklyWorkedMinutesSoFar + bucketMinutes - WEEKLY_OT_THRESHOLD_MINUTES),
  );

  // OT minutes = max of daily and weekly OT (they can overlap)
  const otMinutes = Math.max(dailyOtMinutes, weeklyOtMinutes);

  if (otMinutes === 0) {
    return {
      ot_minutes: 0,
      paid_out_amount_ore: 0n,
      banked_minutes: 0,
    };
  }

  // Compute premium in øre (50% of base rate for OT minutes)
  const baseOrePerMin = orePerMinuteFromHourlyNok(baseHourlyRateNok);
  const baseOreForOt = baseOrePerMin * BigInt(Math.round(otMinutes));
  const premiumOre = pctSupplementOre(baseOreForOt, OT_PREMIUM_PCT);

  if (profile.overtime_mode === "paid_out") {
    // Full pay: base + premium for OT minutes
    const totalOreForOt = baseOreForOt + premiumOre;
    return {
      ot_minutes: otMinutes,
      paid_out_amount_ore: totalOreForOt,
      banked_minutes: 0,
    };
  }

  // Banked mode:
  //   - Premium is paid out as money (always — Aml.)
  //   - Base minutes go to TOIL bank (not paid)
  // Note: caller must verify toil_agreement_signed_at IS NOT NULL before using banked mode.
  return {
    ot_minutes: otMinutes,
    paid_out_amount_ore: premiumOre, // only premium paid; base goes to bank
    banked_minutes: otMinutes, // these minutes accrue to TOIL
  };
}
