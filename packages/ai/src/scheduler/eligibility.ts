/**
 * packages/ai/src/scheduler/eligibility.ts
 *
 * Pure eligibility helper — determines whether a profile can be assigned to a shift
 * candidate. Shared between shift_marketplace.claim (C2 sortie) and
 * scheduler.propose_plan (C3 sortie). Single source of truth per ADR-0306 + ADR-0307.
 *
 * CONTRACT:
 *   - Pure function. No DB calls. No async. Deterministic: same input → same output.
 *   - Caller pre-loads context (absences, shifts, contracts, framework_rules).
 *   - Missing required context fields → throws (fail-fast per L-0177, no silent fallback).
 *   - Tie-break throughout: ORDER BY utilized_hours ASC, profile_id ASC
 *     (per L-0determinism-precedent + apps/web/src/app/api/payroll/_shared.ts:93).
 *
 * ADR REFERENCES:
 *   ADR-0306 (marketplace — claim uses this helper)
 *   ADR-0307 (scheduler greedy V1 — propose_plan uses this helper)
 *   ADR-0309 (scheduler bundle proposal pattern)
 *   ADR-0133 (mobile boundary — web-only for Compose, mobile for Approve)
 */

// ─── BlockerCode ─────────────────────────────────────────────────────────────
// Ordered list — helper checks in this order, collects all blockers before returning.
// Callers may display these directly (marketplace rejection reason)
// or log them in the solver gap list (scheduler gap_count).

export type BlockerCode =
  | "not_competent_for_role"
  | "aml_hour_floor_exceeded"
  | "aml_weekly_cap_exceeded"
  | "tariff_rest_period_violation"
  | "absence_overlap"
  | "existing_shift_overlap"
  | "no_active_contract";

// ─── Input shapes ─────────────────────────────────────────────────────────────
// Context is pre-loaded by the caller — no DB access here.

/** Minimal profile shape needed by eligibility checks. */
export interface EligibilityProfile {
  profile_id: string;
  /** Role competences the employee holds. Matches schedule_shift.role values. */
  competent_roles: string[];
  /** Workspace ID — must match shift.workspace_id. */
  workspace_id: string;
  /** Employment status — only 'active' profiles are eligible. */
  employment_status: string;
}

/** Candidate shift being evaluated. */
export interface EligibilityShift {
  shift_id: string;
  workspace_id: string;
  /** Required role for this shift slot. */
  role: string;
  /** ISO 8601 combined datetime strings: date + start_time. */
  start_at: string;
  /** ISO 8601 combined datetime strings: date + end_time. */
  end_at: string;
  /** Duration in fractional hours (gross, including breaks). */
  duration_hours: number;
}

/** An existing booked shift for the profile (from D6 context). */
export interface ExistingShift {
  shift_id: string;
  start_at: string;
  end_at: string;
  duration_hours: number;
}

/** A recorded absence for the profile (from D2 context). */
export interface Absence {
  absence_id: string;
  start_at: string;
  end_at: string;
}

/** A framework rule relevant to hour caps and rest periods (from D3 context). */
export interface FrameworkRule {
  rule_type:
    | "aml_daily_max_hours"
    | "aml_weekly_max_hours"
    | "aml_weekly_min_hours_floor"
    | "tariff_min_rest_hours";
  /** Numeric value in hours (hours for hour caps, hours for rest gap). */
  value_hours: number;
}

/** Employment contract for a profile (from D2 context). */
export interface EmploymentContract {
  contract_id: string;
  /** ISO 8601 date string. */
  start_date: string;
  /** ISO 8601 date string, or null if open-ended. */
  end_date: string | null;
  status: string; // 'active' | 'inactive' | 'draft' | ...
}

/** Pre-loaded context object — caller is responsible for workspace-scoped loading. */
export interface EligibilityContext {
  /**
   * Existing committed shifts for this profile within the relevant planning window.
   * Must cover at least: the 7-day period containing the candidate shift.
   * Fail-fast if undefined (L-0177).
   */
  existing_shifts: ExistingShift[];

  /**
   * Recorded absences for this profile overlapping the candidate shift's week.
   * Fail-fast if undefined.
   */
  absences: Absence[];

  /**
   * Workspace framework rules relevant to hour limits and rest periods.
   * Typically loaded from regulatory_framework + framework_rule for this workspace.
   * Fail-fast if undefined.
   */
  framework_rules: FrameworkRule[];

  /**
   * Active employment contract for this profile.
   * May be null if no contract exists (will trigger no_active_contract blocker).
   * Fail-fast if undefined (the field itself must be provided, even if null).
   */
  active_contract: EmploymentContract | null;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  /** Empty array when eligible. Populated with all failing checks when not eligible. */
  blockers: BlockerCode[];
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Determines whether `profile` is eligible to be assigned to `shift`.
 *
 * Pure function — deterministic, no side effects, no async.
 * Throws on missing required context fields (L-0177: fail-fast, no silent fallback).
 *
 * Check ordering (all checks run; all blockers collected before returning):
 *   1. not_competent_for_role
 *   2. aml_hour_floor_exceeded (daily max)
 *   3. aml_weekly_cap_exceeded (weekly max)
 *   4. tariff_rest_period_violation (minimum rest gap)
 *   5. absence_overlap
 *   6. existing_shift_overlap
 *   7. no_active_contract
 *
 * Tie-break: ORDER BY utilized_hours ASC, profile_id ASC (callers sort candidates;
 * this function evaluates one profile at a time).
 */
export function eligibilityFor(
  profile: EligibilityProfile,
  shift: EligibilityShift,
  context: EligibilityContext,
): EligibilityResult {
  // ── Fail-fast context validation ─────────────────────────────────────────
  // Per L-0177: missing required context = throw, not silent fallback.
  if (context.existing_shifts === undefined) {
    throw new Error("eligibilityFor: context.existing_shifts is required (not undefined)");
  }
  if (context.absences === undefined) {
    throw new Error("eligibilityFor: context.absences is required (not undefined)");
  }
  if (context.framework_rules === undefined) {
    throw new Error("eligibilityFor: context.framework_rules is required (not undefined)");
  }
  if (!("active_contract" in context)) {
    throw new Error(
      "eligibilityFor: context.active_contract is required (may be null, but must be provided)",
    );
  }

  const blockers: BlockerCode[] = [];

  const shiftStart = new Date(shift.start_at);
  const shiftEnd = new Date(shift.end_at);

  // ── 1. Competence for role ────────────────────────────────────────────────
  if (!profile.competent_roles.includes(shift.role)) {
    blockers.push("not_competent_for_role");
  }

  // ── Extract framework rule values ─────────────────────────────────────────
  // Default Aml §10 values if workspace has no explicit framework_rule overrides.
  // Norway: daily max 9h, weekly max 40h (ordinary), absolute weekly max 48h.
  // Riksavtalen: minimum 8h rest between shifts.
  const dailyMaxRule = context.framework_rules.find((r) => r.rule_type === "aml_daily_max_hours");
  const weeklyMaxRule = context.framework_rules.find((r) => r.rule_type === "aml_weekly_max_hours");
  const restRule = context.framework_rules.find((r) => r.rule_type === "tariff_min_rest_hours");

  const dailyMaxHours = dailyMaxRule?.value_hours ?? 9;
  const weeklyMaxHours = weeklyMaxRule?.value_hours ?? 40;
  const minRestHours = restRule?.value_hours ?? 8;

  // ── 2. AML daily hour cap ────────────────────────────────────────────────
  // Sum of existing shifts on the same calendar day + candidate shift.
  const shiftDate = formatDateOnly(shiftStart);
  const existingDayHours = context.existing_shifts
    .filter((s) => formatDateOnly(new Date(s.start_at)) === shiftDate)
    .reduce((sum, s) => sum + s.duration_hours, 0);

  if (existingDayHours + shift.duration_hours > dailyMaxHours) {
    blockers.push("aml_hour_floor_exceeded");
  }

  // ── 3. AML weekly hour cap ───────────────────────────────────────────────
  // Sum of existing shifts in the ISO week containing the candidate shift.
  const shiftWeek = getIsoWeekKey(shiftStart);
  const existingWeekHours = context.existing_shifts
    .filter((s) => getIsoWeekKey(new Date(s.start_at)) === shiftWeek)
    .reduce((sum, s) => sum + s.duration_hours, 0);

  if (existingWeekHours + shift.duration_hours > weeklyMaxHours) {
    blockers.push("aml_weekly_cap_exceeded");
  }

  // ── 4. Tariff rest period (Riksavtalen) ───────────────────────────────────
  // Check gaps between candidate shift and every existing shift.
  // Both preceding (existing ends before shift starts) and following (shift ends before existing starts).
  for (const existing of context.existing_shifts) {
    const existStart = new Date(existing.start_at);
    const existEnd = new Date(existing.end_at);

    // Gap after existing shift ending before candidate starts
    if (existEnd <= shiftStart) {
      const gapHours = (shiftStart.getTime() - existEnd.getTime()) / MS_PER_HOUR;
      if (gapHours < minRestHours) {
        blockers.push("tariff_rest_period_violation");
        break; // one violation is sufficient to flag
      }
    }

    // Gap after candidate shift ending before existing starts
    if (shiftEnd <= existStart) {
      const gapHours = (existStart.getTime() - shiftEnd.getTime()) / MS_PER_HOUR;
      if (gapHours < minRestHours) {
        blockers.push("tariff_rest_period_violation");
        break;
      }
    }
  }

  // ── 5. Absence overlap ───────────────────────────────────────────────────
  const hasAbsenceOverlap = context.absences.some((absence) => {
    const absStart = new Date(absence.start_at);
    const absEnd = new Date(absence.end_at);
    return overlaps(shiftStart, shiftEnd, absStart, absEnd);
  });

  if (hasAbsenceOverlap) {
    blockers.push("absence_overlap");
  }

  // ── 6. Existing shift overlap ────────────────────────────────────────────
  const hasShiftOverlap = context.existing_shifts.some((existing) => {
    const existStart = new Date(existing.start_at);
    const existEnd = new Date(existing.end_at);
    return overlaps(shiftStart, shiftEnd, existStart, existEnd);
  });

  if (hasShiftOverlap) {
    blockers.push("existing_shift_overlap");
  }

  // ── 7. Active contract ───────────────────────────────────────────────────
  if (!hasActiveContractOnDate(context.active_contract, shiftStart)) {
    blockers.push("no_active_contract");
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;

/** Returns YYYY-MM-DD for a Date (ignores time; shift boundaries are in UTC). */
function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns an ISO year+week key like "2026-W22" for grouping shifts by week.
 * Uses ISO 8601 week numbering (week starts Monday).
 */
function getIsoWeekKey(d: Date): string {
  // ISO week: find Thursday of the week, get its year and week number
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNum = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86_400_000 + yearStart.getUTCDay() + 1) / 7,
  );
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * Returns true if intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 * Uses half-open intervals: touching boundaries (aEnd === bStart) do NOT overlap.
 */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns true if the contract is active (status='active') on the given date.
 * Returns false if contract is null (no contract at all).
 */
function hasActiveContractOnDate(contract: EmploymentContract | null, date: Date): boolean {
  if (!contract) return false;
  if (contract.status !== "active") return false;
  const contractStart = new Date(contract.start_date);
  if (date < contractStart) return false;
  if (contract.end_date !== null) {
    const contractEnd = new Date(contract.end_date);
    if (date >= contractEnd) return false;
  }
  return true;
}
