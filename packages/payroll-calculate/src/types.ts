/**
 * packages/payroll-calculate/src/types.ts
 *
 * WHAT: Domain types for the pure-function payroll calc engine.
 *       All inputs mirror DB row shapes from database.types.ts.
 *       All outputs are intermediate domain types — NOT DB row shapes
 *       (the Day 4 RPC layer maps outputs to DB inserts).
 *
 * WHY: Keep calc engine free of Supabase/DB knowledge. Pure functions
 *      take data in, return data out. Zero I/O.
 *
 * DECIMAL REPRESENTATION: Integer cents (bigint).
 * Rationale: JS floats introduce rounding drift on even simple multiplications
 * (e.g. 42.41 * 2.5 = 106.02499... not 106.025). For payroll — where every
 * øre must be auditable — we use integer arithmetic exclusively.
 *
 * Convention:
 *   - All monetary amounts are stored as `bigint` in ØRES (1 NOK = 100 øre).
 *   - Helper functions `nokToOre(n: number): bigint` and `oreToNok(o: bigint): number`
 *     live in cents.ts. Conversion happens ONLY at package boundary (input parsing
 *     and final output formatting).
 *   - Never use `number` for amounts inside calc functions.
 *   - Exception: `quantity` values (minutes, hours as floats) stay as `number`
 *     because they are counts not money. Multiplication with rate: always done
 *     in bigint space after converting rate to øre/minute.
 */

// ─────────────────────────────────────────────
// ISO helpers
// ─────────────────────────────────────────────

/** ISO-8601 datetime string (UTC), e.g. "2026-04-15T21:00:00Z" */
export type ISODateTime = string;

/** ISO-8601 date string, e.g. "2026-04-15" */
export type ISODate = string;

/** HH:MM string in 24-hour format, e.g. "21:00" */
export type HHMMTime = string;

/** Weekday 1=Monday … 7=Sunday (ISO 8601) */
export type ISOWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ─────────────────────────────────────────────
// INPUT TYPES — mirror DB row shapes
// ─────────────────────────────────────────────

/**
 * ShiftInput — fields needed from schedule_shift + employee linkage.
 * Corresponds to public.schedule_shift Row (relevant fields only).
 */
export type ShiftInput = {
  shift_id: string; // schedule_shift_id
  profile_id: string; // employee_id (auth/profile reference)
  workspace_id: string;
  start_time: ISODateTime; // UTC ISO timestamp
  end_time: ISODateTime; // UTC ISO timestamp
  scheduled_start: ISODateTime; // original scheduled start (for rounding anchor)
  scheduled_end: ISODateTime; // original scheduled end
  /** break_minutes from schedule_shift.breaks (scheduled break, in minutes) */
  scheduled_break_minutes: number;
  shift_date: ISODate; // "YYYY-MM-DD" — the nominal date of the shift
  /** shift_type night_worker_category, nullable when shift_type not set */
  night_worker_category: "night_watch" | "manual" | "ordinary" | null;
  /** custom rate override, null = use tariff/profile rate */
  custom_rate: number | null; // in NOK — converted to øre at boundary
  custom_rate_type: "per_hour" | "per_shift" | null;
};

/**
 * TimeEntryInput — from timesheet.time_entry Row.
 * Punch-in / punch-out as recorded by employee.
 */
export type TimeEntryInput = {
  time_entry_id: string;
  shift_id: string; // foreign key to schedule_shift_id
  profile_id: string;
  workspace_id: string;
  punch_in: ISODateTime; // UTC ISO timestamp
  punch_out: ISODateTime | null; // null = still clocked in (or missing — caller must supply fallback)
  /** breaks JSONB from DB: array of {start: ISO, end: ISO, minutes: number} */
  breaks: Array<{ start: ISODateTime; end: ISODateTime; minutes: number }> | null;
};

/**
 * SupplementRuleInput — from public.supplement_rule Row.
 * Rules are generic data; this engine NEVER references rule names by string.
 */
export type SupplementRuleInput = {
  id: string;
  workspace_id: string | null; // null = platform-level rule
  is_active: boolean;
  supplement_type: string; // DB enum string: "normal"|"week_based"|"day_based"|"manual"|"holiday"|"contract_rule"
  rate_type: string; // "fixed_per_hour"|"percentage"|"fixed_per_shift"
  rate_value: number; // in NOK (fixed_per_hour / fixed_per_shift) or percentage (0.27 = 27%)
  tariff_rate_table_id: string | null; // if set, prefer tariff lookup over rate_value
  /**
   * match_predicate JSONB — canonical shape per BATCH 1:
   * {
   *   windows?: Array<{ weekdays: number[]; time_from: "HH:MM"; time_to: "HH:MM" }>;
   *   night_worker_category?: "night_watch" | "manual" | "ordinary";
   * }
   * Empty windows = [] means no time-window filter.
   * Absence of windows key also means no time-window filter.
   */
  match_predicate: MatchPredicate;
  paragraf_ref: string | null;
  version_hash: string | null;
  valid_from: ISODate | null;
  valid_until: ISODate | null;
};

/** Canonical match_predicate shape (see BATCH 1 + ADR-0250) */
export type MatchPredicate = {
  /** Time windows to match. If absent or empty → no time-window restriction */
  windows?: Array<{
    weekdays: number[]; // ISO weekdays: 1=Mon, 7=Sun
    time_from: HHMMTime;
    time_to: HHMMTime;
  }>;
  /** Optional: restrict to shifts with this night_worker_category */
  night_worker_category?: "night_watch" | "manual" | "ordinary";
};

/**
 * TariffRateInput — from public.tariff_rate_table Row.
 * Used for both supplement rate lookup and minstelønn check.
 */
export type TariffRateInput = {
  id: string;
  workspace_id: string | null; // null = platform (Riksavtalen) row
  rate_type: string; // e.g. "nattillegg_nattvakt", "minstelonn_begynner", "kveldstillegg"
  amount: number; // NOK value — converted to øre at boundary
  unit: string; // "kr/t" | "kr/mnd" | "pct"
  source: string; // "riksavtalen" | "local_agreement" | "custom"
  law_version: string; // e.g. "2025"
  effective_from: ISODate;
  effective_until: ISODate | null;
  paragraf_ref: string | null;
  seniority_level: string | null; // e.g. "begynner", "2_aar"
  role_class: string | null; // e.g. "voksen_ufaglart", "voksen_faglart"
};

/**
 * WorkspaceSettings — from payroll.workspace_settings Row.
 * All policy knobs the calc engine needs.
 */
export type WorkspaceSettings = {
  workspace_id: string;
  is_tariff_bound: boolean;
  supplement_stacking_policy: "all_stack" | "highest_only" | "category_exclusive";
  overtime_requires_pre_approval: boolean;
  overtime_warn_threshold_minutes: number;
  punch_rounding_minutes: 0 | 5 | 10 | 15 | 20 | 30 | 60;
  punch_rounding_direction: "toward_employee" | "snap_to_scheduled" | "half_up";
  punch_rounding_snap_window_minutes: number;
  punch_window_early_minutes: number;
  punch_window_late_minutes: number;
  punch_grace_after_scheduled_minutes: number;
  forced_break_reminder_minutes: number;
  toil_default_max_banked_hours: number;
  wellness_days_per_year_default: number;
  split_shift_threshold_minutes: number;
  split_shift_allowance_amount: number; // NOK
  vacation_pay_pct: number; // e.g. 12.0 or 12.5
  period_type: string; // "monthly" | "biweekly" | "weekly"
};

/**
 * PayrollProfile — from public.employee_payroll_profile Row.
 * Per-employee payroll configuration.
 */
export type PayrollProfile = {
  id: string;
  profile_id: string;
  workspace_id: string;
  salary_type: string; // "hourly" | "monthly" (free text from DB)
  agreed_weekly_hours: number;
  holiday_allowance_pct: number; // e.g. 12.0
  overtime_mode: "paid_out" | "banked";
  toil_agreement_signed_at: string | null; // ISO timestamp
  toil_max_banked_hours: number | null; // profile override; null = use workspace default
  seniority_start_date: ISODate; // YYYY-MM-DD — base for seniority_resolver
  tariff_category: string; // e.g. "voksen_ufaglart"
  has_fagbrev: boolean;
  sector_experience_years: number;
};

/**
 * ManualSupplementInput — from payroll.manual_supplement Row (simplified).
 * Admin-added one-off supplement per shift.
 */
export type ManualSupplementInput = {
  id: string;
  schedule_shift_id: string;
  profile_id: string;
  workspace_id: string;
  amount: number; // NOK — converted at boundary
  salary_code: string | null;
  description: string;
  supplement_rule_id: string | null;
};

/**
 * TipDistributionInput — from public.tip_distribution Row.
 * Pool-approved tip amounts per profile.
 */
export type TipDistributionInput = {
  id: string;
  profile_id: string;
  workspace_id: string;
  pool_id: string;
  calculated_amount: number; // NOK
  adjusted_amount: number | null; // NOK — use if non-null
  payroll_period_id: string | null;
  status: string; // "approved" | "pending" | "paid" etc.
};

/**
 * PublicHoliday — from public.public_holiday seed rows.
 */
export type PublicHoliday = {
  date: ISODate; // "YYYY-MM-DD"
  name: string;
};

/**
 * AbsenceInput — from public.schedule_absence Row.
 */
export type AbsenceInput = {
  id: string;
  profile_id: string;
  workspace_id: string;
  absence_type: string; // "sick" | "vacation" | "wellness" | "parental" etc.
  start_date: ISODate;
  end_date: ISODate;
};

/**
 * RegulatoryFrameworkInput — parameters for deviation checks from framework_rule rows.
 * These govern Aml. compliance thresholds.
 * Passed as parameter to deviation-checks; never queried inside the fn.
 */
export type RegulatoryFrameworkInput = {
  /** Minimum rest between consecutive shifts (hours). Aml. §10-8 = 11. */
  min_rest_hours_between_shifts: number;
  /** Max daily working hours. Aml. §10-4 = 9. */
  max_daily_hours: number;
  /** Max weekly working hours (normal). Aml. §10-4 = 40. */
  max_weekly_hours: number;
  /** Max weekly OT hours. Aml. §10-6 = 10 OT/week, 25 OT/4wk. */
  max_weekly_ot_hours: number;
  /** Forced break threshold (minutes of work before mandatory break). Aml. §10-9 = 5.5h */
  forced_break_threshold_minutes: number;
};

// ─────────────────────────────────────────────
// OUTPUT TYPES — intermediate domain types
// ─────────────────────────────────────────────

/**
 * Classification of a time-bucket segment.
 * Used for rate lookup and supplement evaluation.
 */
export type TimeClassification =
  | "day_normal" // Mon–Fri, normal daytime
  | "evening" // Mon–Fri 18:00–21:00 (example window — actual via supplement rules)
  | "night" // Night hours (Riksavtalen definition)
  | "weekend_sat" // Saturday
  | "weekend_sun" // Sunday
  | "holiday"; // Public holiday (overrides day/weekend)

/**
 * TimeBucket — a contiguous time segment within a shift, tagged with classification.
 * Output of interpret-shift; input to evaluate-supplements.
 * Minutes are integer (floor).
 */
export type TimeBucket = {
  from: ISODateTime; // segment start (UTC)
  to: ISODateTime; // segment end (UTC)
  minutes: number; // integer minutes in this segment
  weekday: ISOWeekday; // ISO weekday of the Oslo-local date this segment falls on
  classification: TimeClassification;
};

/**
 * FiredSupplement — one supplement rule that matched and produced a pay amount.
 * Amount stored in øre (bigint).
 */
export type FiredSupplement = {
  rule_id: string;
  supplement_type: string; // supplement_rule.supplement_type
  rate_type: string; // "fixed_per_hour" | "percentage" | "fixed_per_shift"
  tariff_rate_table_id: string | null; // non-null if rate came from tariff lookup
  rate_value_nok: number; // NOK rate (for display/audit — convert from øre at output boundary)
  /** amount_ore: the computed amount in øre (integer arithmetic) */
  amount_ore: bigint;
  /** quantity: what the rate was applied to (minutes for per_hour, 1 for per_shift) */
  quantity_minutes: number;
  provenance: {
    matched_window?: { weekdays: number[]; time_from: string; time_to: string };
    matched_category?: string;
    rate_source: "tariff_lookup" | "rule_fallback"; // which path resolved the rate
    applies_only_if_bound?: true; // set when is_tariff_bound=false but rule still fired
  };
};

/**
 * InterpretedShift — output of interpretShift().
 * All monetary values are in øre (bigint).
 */
export type InterpretedShift = {
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  /** Actual punch-in used (after rounding applied) */
  effective_start: ISODateTime;
  /** Actual punch-out used (after rounding applied) */
  effective_end: ISODateTime;
  /** Scheduled break minutes (from schedule_shift.breaks) */
  scheduled_break_minutes: number;
  /** Paid break minutes (subset of breaks that are compensated) */
  paid_break_minutes: number;
  /** Unpaid break minutes = scheduled_break_minutes - paid_break_minutes */
  unpaid_break_minutes: number;
  /** Total gross duration: effective_end - effective_start in minutes */
  gross_minutes: number;
  /** Net working minutes: gross_minutes - unpaid_break_minutes */
  worked_minutes: number;
  /** Time buckets splitting worked_minutes by classification */
  buckets: TimeBucket[];
  /** Supplement rules that fired on this shift */
  fired_supplements: FiredSupplement[];
  /** Original shift night_worker_category for downstream use */
  night_worker_category: "night_watch" | "manual" | "ordinary" | null;
};

/**
 * SnapshottedShiftCost — output of snapshotShiftCost().
 * Tariff rates frozen as snapshot. All amounts in øre.
 */
export type SnapshottedShiftCost = {
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  /** Frozen tariff rates used for this snapshot (for DB JSONB storage) */
  tariff_rate_snapshot: TariffRateInput[];
  /** Base pay in øre (for hourly: worked_minutes × hourly_rate; for monthly: 0 at shift level) */
  base_pay_ore: bigint;
  /** Total supplement amount in øre */
  total_supplements_ore: bigint;
  /** Total amount in øre */
  total_ore: bigint;
  /** Payroll lines — one per pay_code/rule */
  lines: PayrollLine[];
};

/**
 * PayrollLine — one line item in a payslip (per pay_code).
 * Amounts in øre.
 */
export type PayrollLine = {
  pay_code: string; // salary_code or supplement_type slug
  description: string;
  hours: number | null; // null for fixed-per-shift lines
  rate_nok: number | null; // NOK rate (display only)
  amount_ore: bigint;
  supplement_rule_id: string | null;
  provenance: Record<string, unknown>;
};

/**
 * PeriodLine — aggregated payroll line per profile per period.
 */
export type PeriodLine = {
  pay_code: string;
  description: string;
  hours: number | null;
  amount_ore: bigint;
  shift_ids: string[]; // which shifts contributed
  supplement_rule_id: string | null;
};

/**
 * AggregatedPeriod — output of aggregatePeriod().
 * One per profile per period. Amounts in øre.
 */
export type AggregatedPeriod = {
  period_id: string;
  profile_id: string;
  workspace_id: string;
  /** Total gross pay in øre */
  gross_amount_ore: bigint;
  /** Total tip amount in øre (from approved tip_distribution rows) */
  tips_amount_ore: bigint;
  /** Total manual supplement amount in øre */
  manual_supplement_ore: bigint;
  /** Grand total = gross + tips + manual_supplements */
  total_ore: bigint;
  /** All period lines aggregated */
  lines: PeriodLine[];
  /** Shift IDs included in this aggregation */
  shift_ids: string[];
};

/**
 * Deviation — output of runDeviationChecks().
 * Maps to payroll.deviation DB row shape.
 */
export type Deviation = {
  check_id: string; // e.g. "W01", "W02", "W13"
  severity: "error" | "warning" | "info";
  message: string;
  profile_id: string | null;
  shift_id: string | null; // nullable: some checks are period-level
  period_id: string | null;
  /** Suggested action for manager/admin */
  suggested_action: string;
  /** Whether the check auto-resolved itself (W14 case) */
  auto_resolved?: boolean;
  /** Extra details for UI drilldown */
  details: Record<string, unknown>;
};

/**
 * TimebankEntry — output of emitTimebankEntries().
 * Maps to payroll.timebank_entry DB row shape.
 * Monetary values in øre; hours as number.
 */
export type TimebankEntry = {
  profile_id: string;
  workspace_id: string;
  account_type: string; // "feriepenger" | "toil" | "wellness"
  entry_type: "accrual" | "withdrawal" | "adjustment" | "expiry" | "carry_over" | "payout";
  hours: number;
  value_amount_ore: bigint; // for feriepenger NOK; 0 for TOIL (unit=hours)
  value_unit: string; // "NOK" | "hours"
  effective_date: ISODate;
  expiry_date: ISODate | null;
  description: string;
  payroll_calculation_id: string | null; // linked calculation if available
  schedule_absence_id: string | null;
};

// ─────────────────────────────────────────────
// Seniority tier type
// ─────────────────────────────────────────────

export type SeniorityTier = "begynner" | "2_aar" | "4_aar" | "6_aar" | "8_aar" | "10_aar";
