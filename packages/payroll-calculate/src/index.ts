/**
 * packages/payroll-calculate/src/index.ts
 *
 * Public surface of @smartout/payroll-calculate.
 *
 * WHAT: Pure-function payroll calculation engine.
 *       Zero I/O. Deterministic. Every function takes data in, returns data out.
 *       All monetary amounts use bigint (øre = 1/100 NOK) for exact arithmetic.
 *
 * WHY: Isolated from DB/network concerns so calc logic can be:
 *        - Unit tested with golden-month fixtures
 *        - Re-run deterministically for audit
 *        - Used by Day 4 RPCs (Supabase Edge Functions) without circular deps
 *
 * PIPELINE ORDER (per ARCHITECTURE.md):
 *   1. interpretShift()        → InterpretedShift (Layer 3)
 *   2. evaluateSupplements()   → FiredSupplement[] per bucket (Layer 3)
 *   3. applyStackingPolicy()   → filtered FiredSupplement[] (Layer 3)
 *   4. snapshotShiftCost()     → SnapshottedShiftCost (Layer 4)
 *   5. aggregatePeriod()       → AggregatedPeriod[] (Layer 5)
 *   6. runDeviationChecks()    → Deviation[] (cross-cutting)
 *   7. emitTimebankEntries()   → TimebankEntry[] per profile
 *   +  resolveSeniorityTier()  → SeniorityTier (utility, used in W13)
 *   +  resolveOvertime()       → OvertimeResult (utility, used per bucket)
 */

// ── Pure functions ────────────────────────────────────────────────────────
export { interpretShift } from "./interpret-shift.js";
export { evaluateSupplements } from "./evaluate-supplements.js";
export { applyStackingPolicy } from "./stacking.js";
export { snapshotShiftCost } from "./snapshot-cost.js";
export { aggregatePeriod } from "./aggregate-period.js";
export { runDeviationChecks } from "./deviation-checks.js";
export type { DeviationChecksInput } from "./deviation-checks.js";
export { emitTimebankEntries } from "./timebank-emitter.js";
export { resolveOvertime } from "./overtime-resolver.js";
export type { OvertimeResult } from "./overtime-resolver.js";
export { resolveSeniorityTier } from "./seniority-resolver.js";

// ── Cents / monetary helpers ──────────────────────────────────────────────
export { nokToOre, oreToNok, sumOre, orePerMinuteFromHourlyNok } from "./cents.js";

// ── Oslo time utilities ───────────────────────────────────────────────────
export {
  osloParts,
  weekdayOslo,
  hourMinuteOslo,
  osloDateString,
  minutesBetween,
  addMinutes,
  isPublicHoliday,
  hhmToMinutes,
  osloMinuteSinceMidnight,
} from "./oslo-time.js";

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  // Input types
  ShiftInput,
  TimeEntryInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
  PayrollProfile,
  ManualSupplementInput,
  TipDistributionInput,
  PublicHoliday,
  AbsenceInput,
  RegulatoryFrameworkInput,
  MatchPredicate,
  // Output types
  InterpretedShift,
  TimeBucket,
  TimeClassification,
  FiredSupplement,
  SnapshottedShiftCost,
  PayrollLine,
  PeriodLine,
  AggregatedPeriod,
  Deviation,
  TimebankEntry,
  SeniorityTier,
  // Helpers
  ISODateTime,
  ISODate,
  HHMMTime,
  ISOWeekday,
} from "./types.js";
