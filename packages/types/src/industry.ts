/**
 * Industry Intelligence types — domain types for I1 bootstrap and UI display.
 *
 * These are bootstrap/presentation shapes. For D3 runtime tariff resolution,
 * use TariffRateRow and TariffContext from cascade types.
 * Source of truth for tariff data: tariff_rate_table (database).
 */

export type IndustryType = "hospitality" | "retail" | "default";

export type IndustryFilterKey = "food" | "alcohol" | "overnight" | "delivery";

export type TariffSupplement = {
  id: string;
  name: string;
  rate: number;
  unit: "kr/t" | "%";
  condition_type: "time_range" | "after_hours" | "days" | "always";
  from_hour?: string;
  to_hour?: string;
  after_hours?: number;
  days?: string[];
  description?: string;
};

export type IndustryTariff = {
  key: string;
  label: string;
  supplements: TariffSupplement[];
  minWagePerHour: number;
};

export type IndustryShiftTemplate = {
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  subcategory?: string[];
};

export type IndustrySeasonTemplate = {
  name: string;
  startMonth: number;
  endMonth: number;
  description: string;
};

export type IndustryEmploymentDefaults = {
  probationMonths: number;
  vacationDays: number;
  extraVacationDays: boolean;
  otpPct: number;
  employerTaxPct: number;
};

/**
 * Hospitality-vertical domain identifiers.
 *
 * Used by the Phase 2 Botsson classifier (progressive channel) to route
 * user questions to the correct helpdesk channel. Canonical list — see
 * ADR-0165 and the 2026-04-20 progressive channel spec. `other` is the
 * fallback bucket when no higher-confidence match is found.
 *
 * Non-hospitality industry packages may omit `domains` entirely; the
 * classifier treats a missing list as "no domain routing configured".
 */
export type HospitalityDomain =
  | "payroll"
  | "scheduling"
  | "food_safety"
  | "bar_operations"
  | "kitchen_operations"
  | "service_standards"
  | "hms_safety"
  | "hr_personal"
  | "training"
  | "equipment"
  | "other";

/**
 * A single domain entry inside an industry package.
 *
 * `default_voice_allowed=false` is the voice-safety override for PII-adjacent
 * domains (payroll, hr_personal). Aligned with ADR-0078 (channel restriction)
 * and ADR-0163 (PII allowedChannels mandatory). Admins may override per
 * channel via `channel_ai_policy.voice_participation`; this flag is the
 * platform-level default the classifier consults before proposing a route.
 */
export type Domain = {
  id: HospitalityDomain;
  label: string;
  description: string;
  default_voice_allowed: boolean;
  keywords: string[];
};

export type IndustryPackage = {
  id: IndustryType;
  label: string;
  filterDefaults: Record<IndustryFilterKey, boolean>;
  tariffs: IndustryTariff[];
  defaultTariffKey: string;
  shiftTemplates: IndustryShiftTemplate[];
  seasonTemplates: IndustrySeasonTemplate[];
  employmentDefaults: IndustryEmploymentDefaults;
  botsson: Record<string, string>;
  /**
   * Domain taxonomy for Phase 2 helpdesk routing (optional — non-hospitality
   * packages may omit). See ADR-0165 and the progressive-channel spec.
   */
  domains?: Domain[];
  /**
   * Static role-capability profiles for I1 bootstrap (optional — non-hospitality
   * packages may omit). Populated per role during workspace creation to seed the
   * initial readiness gate configuration. No runtime DB-load path — stays static
   * on the package (ADR-0379a council: bootstrap-only, no K1a runtime read).
   */
  roleCapabilityProfiles?: RoleCapabilityProfile[];
};

export type PositionTier = "basis" | "mid" | "specialist";

export type PositionTemplate = {
  name: string;
  isLeader: boolean;
  tier: PositionTier;
};

/** Suggestion returned by NACE-based department/procedure lookups */
export type IndustrySuggestion = {
  name: string;
  icon: string;
  preselected: boolean;
  positions: string[];
  /** Tiered position templates for onboarding — if absent, falls back to positions[] */
  positionTemplates?: PositionTemplate[];
};

/** Procedure suggestion from NACE lookup */
export type IndustryProcedureSuggestion = {
  name: string;
  preselected: boolean;
};

/**
 * Static role-capability profile for I1 bootstrap.
 *
 * Declares which protocol completions constitute "ready" for a given role.
 * Authored in the industry package (hospitalityPackage.roleCapabilityProfiles[]);
 * consumed at workspace bootstrap to seed the initial readiness gate config.
 * Protocol slugs must match `protocol.name` values inserted by governance templates.
 *
 * Source of truth: docs/engines/industri-inteligence/hospitalety/08-role-capability-profiles/
 * restaurant-role-capability-baseline.md (ADR-0379a, A2).
 */
export type RoleCapabilityProfile = {
  /** Identifies the operational role, e.g. "kokk", "bartender". */
  roleSlug: string;
  /** Position names from POSITION_REGISTRY that map to this role. */
  positionSlugs: string[];
  /** Protocol names (exact match against protocol.name) that must be completed for "ready". */
  mandatoryProtocolSlugs: string[];
  /** Human-readable description of what "ready" means for this role. */
  readySignal: string;
};
