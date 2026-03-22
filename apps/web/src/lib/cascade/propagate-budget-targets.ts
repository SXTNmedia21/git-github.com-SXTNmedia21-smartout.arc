/**
 * Cascade Demand Propagation — Budget Target Distribution
 *
 * Pure function: takes season budget parameters + day factors + date range,
 * produces daily targets (revenue, labor cost, staff hours).
 *
 * Used by both the web dashboard (preview) and the engine handler
 * (authoritative propagation into workspace_budget).
 *
 * Spec: docs/superpowers/specs/2026-03-22-cascade-operational-layer-design.md §Phase 3
 */

export type BudgetPropagationInput = {
  totalTargetRevenue: number;
  targetLaborPercentage: number; // 0.0–1.0
  avgHourlyWage: number;
  dayFactors: Array<{ weekday: number; factor: number }>; // weekday 0=Mon...6=Sun
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (inclusive)
};

export type DailyTarget = {
  date: string; // YYYY-MM-DD
  targetRevenue: number;
  targetLaborCost: number;
  targetStaffHours: number;
};

/**
 * Distributes a season's total revenue target across each day in the date range,
 * weighted by day-of-week factors.
 *
 * Algorithm:
 * 1. Enumerate all dates in [startDate, endDate]
 * 2. Look up each date's weekday factor (fallback: 1.0 if missing)
 * 3. Sum all factors across every day in the range
 * 4. Each day's revenue = totalTargetRevenue × (dayFactor / factorSum)
 * 5. Labor cost = revenue × targetLaborPercentage
 * 6. Staff hours = labor cost ÷ avgHourlyWage (0 if wage is 0)
 */
export function propagateBudgetTargets(input: BudgetPropagationInput): DailyTarget[] {
  const {
    totalTargetRevenue,
    targetLaborPercentage,
    avgHourlyWage,
    dayFactors,
    startDate,
    endDate,
  } = input;

  // Build weekday → factor lookup (0=Mon...6=Sun)
  const factorMap = new Map<number, number>();
  for (const df of dayFactors) {
    factorMap.set(df.weekday, df.factor);
  }

  // Enumerate dates and assign factors
  const dates = enumerateDates(startDate, endDate);
  const daysWithFactors = dates.map((date) => {
    const weekday = getIsoWeekday(date);
    const factor = factorMap.get(weekday) ?? 1.0;
    return { date, factor };
  });

  // Sum of all day factors across the range
  const factorSum = daysWithFactors.reduce((sum, d) => sum + d.factor, 0);

  // Guard: if factorSum is 0 (e.g., all factors are 0), distribute equally
  const useFlatDistribution = factorSum === 0;
  const totalDays = daysWithFactors.length;

  return daysWithFactors.map(({ date, factor }) => {
    const targetRevenue = useFlatDistribution
      ? totalDays > 0
        ? totalTargetRevenue / totalDays
        : 0
      : totalTargetRevenue * (factor / factorSum);

    const targetLaborCost = targetRevenue * targetLaborPercentage;
    const targetStaffHours = avgHourlyWage > 0 ? targetLaborCost / avgHourlyWage : 0;

    return {
      date,
      targetRevenue,
      targetLaborCost,
      targetStaffHours,
    };
  });
}

/**
 * Returns ISO weekday for a date string: 0=Mon, 1=Tue, ..., 6=Sun.
 * Uses UTC to avoid timezone issues.
 */
function getIsoWeekday(dateStr: string): number {
  const jsDay = new Date(dateStr + "T12:00:00Z").getUTCDay(); // 0=Sun, 1=Mon...6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon...6=Sun
}

/**
 * Enumerates all dates from start to end (inclusive) as YYYY-MM-DD strings.
 */
function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]!);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
