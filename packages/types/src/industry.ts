/**
 * Industry Intelligence types — domain types for I1 bootstrap and UI display.
 *
 * These are bootstrap/presentation shapes. For D3 runtime tariff resolution,
 * use TariffRateRow and TariffContext from cascade types.
 * Source of truth for tariff data: tariff_rate_table (database).
 */

export type IndustryType = "hospitality" | "retail" | "default";

export type IndustryFilterKey = "food" | "alcohol" | "overnight" | "delivery";

export type IndustryTariff = {
  key: string;
  label: string;
  supplements: {
    kveldstillegg: { rate: number; unit: string; from_hour: string; to_hour: string };
    helgetillegg: { rate: number; unit: string; days: string[] };
    helligdagstillegg: { rate: number; unit: string };
    overtid_50: { threshold_hours: number; unit: string };
    overtid_100: { threshold_hours: number; unit: string };
  };
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
