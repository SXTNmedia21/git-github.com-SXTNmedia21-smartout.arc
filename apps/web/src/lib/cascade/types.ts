/**
 * Cascade Core Foundation — Type Definitions
 *
 * Pure types for the cascade computation engine.
 * No database imports — these mirror the spec's TypeScript signatures
 * and are used by all pure functions.
 *
 * Spec: Section 3 Phase B
 */

// --------------------------------------------------------
// Operating Hours Resolution (resolve_hours)
// --------------------------------------------------------

export type DepartmentOperatingHoursRow = {
  id: string;
  department_id: string;
  location_id: string | null;
  season_id: string | null;
  day_of_week: number; // 0-6
  open_time: string | null; // HH:MM or HH:MM:SS
  close_time: string | null;
  is_closed: boolean;
};

export type DepartmentHoursOverrideRow = {
  id: string;
  department_id: string;
  location_id: string | null;
  season_id: string | null;
  override_date: string; // YYYY-MM-DD
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason: string | null;
  planning_event_id: string | null;
};

export type EffectiveHours = {
  date: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  crossesMidnight: boolean;
  effectiveCloseTimestamp: string | null;
  source: "override" | "season_weekly" | "default_weekly" | "closed";
};

// --------------------------------------------------------
// Shift Anchoring (compute_anchored_shift)
// --------------------------------------------------------

export type AnchorType = "fixed" | "open" | "close";

export type AnchorInput = {
  anchorType: AnchorType;
  fixedTime: string | null; // HH:MM
  offsetMin: number;
};

export type ComputedShiftTime = {
  resolvedTime: string; // HH:MM
  source: AnchorType;
  isNextDay: boolean;
};

// --------------------------------------------------------
// Framework Rule Evaluation (evaluate_framework_rules)
// --------------------------------------------------------

export type EvaluationOutcome =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

export type ConflictCategory = "constraint" | "advisory" | "commercial";

export type ConflictSeverity = "hard_block" | "hard_warn" | "soft_warn" | "info";

export type Conflict = {
  category: ConflictCategory;
  severity: ConflictSeverity;
  outcome: EvaluationOutcome;
  ruleId: string;
  entityType: string;
  entityId: string;
  description: string;
  exceptionPath?: string;
  resolution?: string;
};

export type FrameworkRule = {
  ruleId: string;
  code: string;
  ruleType: "gate" | "constraint" | "advisory" | "commercial";
  category: string;
  description: string;
  defaultOutcome: EvaluationOutcome;
  severity: ConflictSeverity;
  outcomeOverridable: boolean;
  configTightenAllowed: boolean;
  configLoosenAllowed: boolean;
  overrideMinLevel: string | null;
  evaluationConfig: Record<string, unknown>;
  sourceReference: string | null;
};

export type WorkspaceRuleOverride = {
  ruleId: string;
  overrideOutcome: EvaluationOutcome | null;
  overrideConfig: Record<string, unknown>;
  validFrom: string | null;
  validUntil: string | null;
};

export type ProposedChange = {
  entityType: string;
  entityId: string;
  changeType: "create" | "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

// --------------------------------------------------------
// Proposal Freshness
// --------------------------------------------------------

export type ChangeProposalRow = {
  changeProposalId: string;
  inputStateHash: string | null;
  status: "pending" | "approved" | "applied" | "rejected" | "expired";
  createdAt: string;
};

export type FreshnessResult = {
  fresh: boolean;
  staleFields: string[];
};

// --------------------------------------------------------
// Planning Event
// --------------------------------------------------------

export type PlanningEventCategory =
  | "external_scraped"
  | "cultural_commercial"
  | "internal"
  | "weather"
  | "recurring";

export type PlanningEventSource =
  | "manual"
  | "scraped_municipality"
  | "scraped_cultural"
  | "weather_api"
  | "booking_integration"
  | "historical_import";

export type PlanningEventRow = {
  planning_event_id: string;
  workspace_id: string;
  planning_cycle_id: string | null;
  name: string;
  description: string | null;
  category: PlanningEventCategory;
  source: PlanningEventSource;
  event_date: string; // YYYY-MM-DD
  end_date: string | null;
  demand_multiplier: number;
  expected_covers: number | null;
  confidence: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  external_source_url: string | null;
  hours_override_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --------------------------------------------------------
// Planning Cycle
// --------------------------------------------------------

export type PlanningCycleStatus = "draft" | "active" | "archived";

export type PlanningCycleRow = {
  planning_cycle_id: string;
  workspace_id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  total_revenue_target: number | null;
  status: PlanningCycleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --------------------------------------------------------
// Season Goal (governance metadata — season-scoped targets)
// --------------------------------------------------------

export type SeasonGoalStatus = "active" | "completed" | "cancelled";

export type SeasonGoalRow = {
  season_goal_id: string;
  workspace_id: string;
  season_id: string;
  title: string;
  description: string | null;
  metric_key: string | null;
  target_value: number | null;
  target_unit: string | null;
  status: SeasonGoalStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// --------------------------------------------------------
// Season Policy Binding (governance — per-season HMS activation)
// --------------------------------------------------------

export type SeasonPolicyBindingRow = {
  season_policy_binding_id: string;
  workspace_id: string;
  season_id: string;
  policy_id: string;
  is_active: boolean;
  notes: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

// --------------------------------------------------------
// Bootstrap Types (I1 → workspace seeding)
// --------------------------------------------------------

export type BootstrapSourcePath = "onboarding" | "join" | "manual";
export type BootstrapStatus = "running" | "completed" | "failed" | "partial";

export type BootstrapWarning = {
  step: string;
  departmentId?: string;
  departmentName?: string;
  message: string;
};

export type BootstrapStepName =
  | "workspace_operating_hours"
  | "department_type"
  | "department_operating_hours"
  | "framework_binding"
  | "tariff_rates"
  | "planning_cycle"
  | "season_budget"
  | "day_hour_factors"
  | "payroll_templates"
  | "authority_config"
  | "completion_check";

// --------------------------------------------------------
// Tariff Resolution Types (D3 → payroll calculation)
// --------------------------------------------------------

export type TariffContext = {
  payrollProfile: {
    tariffOverrideId: string | null;
    tariffCategory: string;
    seniorityStartDate: string;
    hasFagbrev: boolean;
  } | null;
  workspaceTariffRates: TariffRateRow[];
  platformTariffRates: TariffRateRow[];
  isPublicHoliday: boolean;
  /** Hourly rate from employment_contract. Null = no contract found. */
  baseRate: number | null;
};

export type TariffRateRow = {
  id: string;
  rateType: string;
  amount: number;
  unit: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export type TariffSupplement = {
  type: string;
  amount: number;
  unit: "kr/t" | "percent";
  reason: string;
};

export type TariffResolution = {
  baseRate: number;
  baseRateUnit: "hourly" | "monthly";
  supplements: TariffSupplement[];
  effectiveHourlyRate: number;
  sourceTier: "override" | "workspace" | "platform";
  tariffCategory: string | null;
};

// --------------------------------------------------------
// New Evaluation Types (Phase B rewrite — replaces Conflict-based types above)
// Old types kept until Task 11 migrates all consumers
// --------------------------------------------------------

export type EvaluationOutcomeLevel =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

export type RuleHit = {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  outcome: EvaluationOutcomeLevel;
  reason: string;
  overrideApplied: boolean;
  overrideId?: string;
};

export type EvaluationResult = {
  outcome: EvaluationOutcomeLevel;
  hits: RuleHit[];
  worstHit: RuleHit | null;
};

export type EntityContext = {
  profileId?: string;
  shiftId?: string;
  date: string;
  employeeAge?: number;
  contractType?: string;
  weeklyHoursWorked?: number;
  dailyHoursWorked?: number;
  lastShiftEnd?: string; // ISO timestamp
};

// --------------------------------------------------------
// Framework Rule Row (DB shape for pre-loaded rules)
// --------------------------------------------------------

export type FrameworkRuleRow = {
  ruleId: string;
  code: string;
  ruleType: "gate" | "constraint" | "advisory" | "commercial";
  category: string;
  description: string;
  defaultOutcome: EvaluationOutcomeLevel;
  severity: string;
  outcomeOverridable: boolean;
  evaluationConfig: Record<string, unknown>;
  sourceReference: string | null;
};

export type WorkspaceRuleOverrideRow = {
  overrideId: string;
  ruleId: string;
  overrideOutcome: EvaluationOutcomeLevel | null;
  overrideConfig: Record<string, unknown>;
  validFrom: string | null;
  validUntil: string | null;
};
