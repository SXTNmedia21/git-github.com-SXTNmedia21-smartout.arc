/**
 * Season planning definitions for Module 15 setup flows.
 *
 * Why this file exists:
 * The season page previously spread defaults, labels, templates, and validation
 * rules across multiple components. This centralizes the canonical setup
 * definitions so budget/factor configuration stays consistent.
 */

export type SeasonBudgetStatus = "draft" | "active" | "locked";

export type DayFactorTemplateId = "restaurant" | "hotel" | "event" | "flat";
export type HourFactorTemplateId = "restaurant" | "dinner_peak" | "flat";

export type DayFactorDefinition = {
  weekday: number;
  factor: number;
};

export type HourFactorDefinition = {
  hour: number;
  factor: number;
};

export const SEASON_BUDGET_STATUS_OPTIONS: Array<{
  value: SeasonBudgetStatus;
  label: string;
  description: string;
}> = [
  { value: "draft", label: "Draft", description: "Kan redigeres fritt" },
  { value: "active", label: "Active", description: "I bruk for styring" },
  { value: "locked", label: "Locked", description: "Lest modus, ingen endringer" },
];

export const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

export const BUDGET_SETUP_LIMITS = {
  totalTargetRevenue: { min: 1_000, max: 1_000_000_000 },
  targetLaborPercentage: { min: 10, max: 70 },
  avgHourlyWage: { min: 100, max: 2_000 },
  basePricePerGuest: { min: 50, max: 10_000 },
  seasonPriceFactor: { min: 0.5, max: 3.0 },
  dayFactor: { min: 0.1, max: 10 },
  hourFactor: { min: 0.1, max: 10 },
} as const;

/**
 * Returns default day-factor templates for configuration.
 */
export function getDayFactorTemplate(template: DayFactorTemplateId): DayFactorDefinition[] {
  if (template === "hotel") {
    return [
      { weekday: 0, factor: 1.0 },
      { weekday: 1, factor: 1.0 },
      { weekday: 2, factor: 1.1 },
      { weekday: 3, factor: 1.1 },
      { weekday: 4, factor: 1.3 },
      { weekday: 5, factor: 1.4 },
      { weekday: 6, factor: 1.1 },
    ];
  }

  if (template === "event") {
    return [
      { weekday: 0, factor: 0.8 },
      { weekday: 1, factor: 0.9 },
      { weekday: 2, factor: 1.0 },
      { weekday: 3, factor: 1.3 },
      { weekday: 4, factor: 2.4 },
      { weekday: 5, factor: 2.8 },
      { weekday: 6, factor: 1.2 },
    ];
  }

  if (template === "flat") {
    return Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      factor: 1.0,
    }));
  }

  // Restaurant standard (weekend-heavy)
  return [
    { weekday: 0, factor: 1.0 },
    { weekday: 1, factor: 1.1 },
    { weekday: 2, factor: 1.2 },
    { weekday: 3, factor: 1.4 },
    { weekday: 4, factor: 2.2 },
    { weekday: 5, factor: 2.5 },
    { weekday: 6, factor: 1.3 },
  ];
}

/**
 * Builds hour factors for the selected opening range.
 */
export function getHourFactorTemplate(
  template: HourFactorTemplateId,
  openHour: number,
  closeHour: number,
): HourFactorDefinition[] {
  const hours = Array.from({ length: Math.max(closeHour - openHour, 0) }, (_, i) => openHour + i);

  if (template === "flat") {
    return hours.map((hour) => ({ hour, factor: 1.0 }));
  }

  if (template === "dinner_peak") {
    return hours.map((hour) => {
      if (hour >= 18 && hour <= 20) return { hour, factor: 2.4 };
      if (hour === 17 || hour === 21) return { hour, factor: 1.6 };
      if (hour >= 12 && hour <= 13) return { hour, factor: 1.2 };
      return { hour, factor: 0.8 };
    });
  }

  // Restaurant standard with lunch and dinner peaks.
  return hours.map((hour) => {
    if (hour === 10) return { hour, factor: 0.4 };
    if (hour === 11) return { hour, factor: 0.7 };
    if (hour === 12) return { hour, factor: 1.3 };
    if (hour === 13) return { hour, factor: 1.0 };
    if (hour === 14) return { hour, factor: 0.8 };
    if (hour === 15) return { hour, factor: 0.6 };
    if (hour === 16) return { hour, factor: 0.9 };
    if (hour === 17) return { hour, factor: 1.5 };
    if (hour === 18) return { hour, factor: 2.0 };
    if (hour === 19) return { hour, factor: 2.4 };
    if (hour === 20) return { hour, factor: 2.2 };
    if (hour === 21) return { hour, factor: 1.1 };
    return { hour, factor: 1.0 };
  });
}

/**
 * Returns true if all minimum setup elements are complete.
 */
export function isSeasonSetupReady(input: {
  hasBudget: boolean;
  hasDayFactors: boolean;
  hasHourFactors: boolean;
}): boolean {
  return input.hasBudget && input.hasDayFactors && input.hasHourFactors;
}
