/**
 * Season Planning Calculation Engine (Module 15 MVP)
 *
 * Pure functions — no database or React dependencies.
 * Implements spec §5.1 (day targets), §5.2 (hour targets), §5.3 (staffing).
 *
 * Source: docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
 */

export type DayFactorInput = {
  weekday: number; // 0=Mon...6=Sun
  factor: number;
};

export type HourFactorInput = {
  hour: number; // 0-23
  factor: number;
};

export type OperatingHoursInput = {
  openHour: number; // e.g. 10
  closeHour: number; // e.g. 22 (exclusive — 22 means last open hour is 21)
};

export type DayTarget = {
  date: string; // YYYY-MM-DD
  weekday: number; // 0=Mon...6=Sun
  target: number; // NOK
};

export type HourTarget = {
  hour: number;
  target: number; // NOK
  factor: number;
};

export type StaffingResult = {
  maxLaborCost: number;
  staffNeeded: number;
};

/**
 * §5.1 Revenue Target Per Day
 *
 * Distributes total season target across all days using weekday factors.
 * Factors are relative (not percentages) — system normalizes.
 *
 * Formula:
 *   avg_factor = mean(all day factors for days in season)
 *   day_target = base_daily × (weekday_factor / avg_factor)
 *
 * where base_daily = total_target / season_days
 */
export function calculateDayTargets(input: {
  totalTargetRevenue: number;
  startDate: string;
  endDate: string;
  dayFactors: DayFactorInput[];
}): DayTarget[] {
  const { totalTargetRevenue, startDate, endDate, dayFactors } = input;

  // Build factor lookup (weekday → factor), default 1.0
  const factorMap = new Map<number, number>();
  for (const df of dayFactors) {
    factorMap.set(df.weekday, df.factor);
  }

  // Generate all dates in range (UTC to avoid timezone edge cases)
  const dates: { date: string; weekday: number }[] = [];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    // JS: 0=Sun...6=Sat → convert to 0=Mon...6=Sun
    const jsDay = d.getUTCDay();
    const weekday = jsDay === 0 ? 6 : jsDay - 1;
    dates.push({
      date: d.toISOString().split("T")[0],
      weekday,
    });
  }

  if (dates.length === 0) return [];

  // Calculate average factor across actual season days
  const factors = dates.map((d) => factorMap.get(d.weekday) ?? 1.0);
  const avgFactor = factors.reduce((sum, f) => sum + f, 0) / factors.length;

  const baseDailyTarget = totalTargetRevenue / dates.length;

  return dates.map((d, i) => ({
    date: d.date,
    weekday: d.weekday,
    target: baseDailyTarget * (factors[i] / avgFactor),
  }));
}

/**
 * §5.2 Revenue Target Per Hour
 *
 * Distributes a single day's target across open hours using hour factors.
 *
 * Formula:
 *   hour_target = day_target × (hour_factor / Σ active_hour_factors)
 */
export function calculateHourTargets(input: {
  dayTarget: number;
  hourFactors: HourFactorInput[];
  operatingHours: OperatingHoursInput;
}): HourTarget[] {
  const { dayTarget, hourFactors, operatingHours } = input;
  const { openHour, closeHour } = operatingHours;

  // Build factor lookup (hour → factor), default 1.0
  const factorMap = new Map<number, number>();
  for (const hf of hourFactors) {
    factorMap.set(hf.hour, hf.factor);
  }

  // Generate open hours
  const hours: number[] = [];
  for (let h = openHour; h < closeHour; h++) {
    hours.push(h);
  }

  if (hours.length === 0) return [];

  // Get factors for open hours only
  const activeFactors = hours.map((h) => factorMap.get(h) ?? 1.0);
  const totalFactors = activeFactors.reduce((sum, f) => sum + f, 0);

  return hours.map((h, i) => ({
    hour: h,
    target: dayTarget * (activeFactors[i] / totalFactors),
    factor: activeFactors[i],
  }));
}

/**
 * §5.3 Staffing Need Per Hour
 *
 * Formula:
 *   max_labor_cost = hour_target × target_labor_pct
 *   staff_needed = max_labor_cost / avg_hourly_wage
 */
export function calculateStaffingNeed(input: {
  hourTarget: number;
  targetLaborPercentage: number;
  avgHourlyWage: number;
}): StaffingResult {
  const { hourTarget, targetLaborPercentage, avgHourlyWage } = input;

  const maxLaborCost = hourTarget * targetLaborPercentage;
  const staffNeeded = avgHourlyWage > 0 ? maxLaborCost / avgHourlyWage : 0;

  return { maxLaborCost, staffNeeded };
}
