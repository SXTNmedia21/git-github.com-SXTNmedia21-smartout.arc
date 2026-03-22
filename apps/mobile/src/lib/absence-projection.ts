/**
 * absence-projection.ts
 *
 * Pure function for projecting how many days an absence request would consume
 * and whether the request is allowed given balance, instance limits, and overlaps.
 *
 * No React or Supabase dependencies — safe to use in any context including tests.
 *
 * Business rules:
 * - Workday counting (Mon-Fri) by default; all calendar days when countWeekends=true
 * - Public holidays are excluded from vacation counts (unless countWeekends=true)
 * - Balance goes negative → isAllowed=false
 * - Instance limits exceeded (maxDaysPerInstance, maxInstancesPerYear) → isAllowed=false
 * - Overlapping pending/approved requests → warning (non-blocking unless combined with other failures)
 * - Cross-year ranges are counted as a single continuous range
 */

export type AbsenceTypeConfig = {
  category: string;
  countWeekends: boolean;
  maxDaysPerInstance: number | null;
  maxInstancesPerYear: number | null;
  currentYearInstances: number;
};

export type ProjectionInput = {
  currentBalance: number;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  absenceType: AbsenceTypeConfig;
  holidays: string[]; // ISO date strings for public holidays in range
  existingRequests: { startDate: string; endDate: string; status: string }[];
};

export type ProjectionResult = {
  requestedDays: number;
  balanceAfter: number;
  isAllowed: boolean;
  warnings: string[];
};

// Statuses that represent active/relevant requests — cancelled/rejected are ignored
const ACTIVE_REQUEST_STATUSES = new Set(["pending", "approved"]);

/**
 * Parses an ISO date string (YYYY-MM-DD) to a UTC midnight Date.
 * Using UTC explicitly so weekday calculations are stable regardless of local timezone.
 */
function parseDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

/**
 * Returns the ISO date string (YYYY-MM-DD) from a UTC Date.
 */
function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Checks whether a Date (UTC) falls on a weekend (Saturday=6 or Sunday=0).
 */
function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Counts the number of days in a date range [start, end] (inclusive) that
 * should be charged against an absence balance.
 *
 * Rules:
 * - countWeekends=false: only Mon-Fri count; public holidays on weekdays are excluded
 * - countWeekends=true: all calendar days count; holidays are NOT excluded (every day costs)
 *
 * @param start       ISO date string YYYY-MM-DD (inclusive)
 * @param end         ISO date string YYYY-MM-DD (inclusive)
 * @param countWeekends  Whether to count Saturday and Sunday
 * @param holidays    ISO date strings for public holidays to exclude (only when countWeekends=false)
 */
export function countDaysInRange(
  start: string,
  end: string,
  countWeekends: boolean,
  holidays: string[],
): number {
  const holidaySet = new Set(holidays);
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  let count = 0;
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    if (countWeekends) {
      // All calendar days count — holidays are included
      count++;
    } else {
      // Only weekdays count, and weekday holidays are excluded
      if (!isWeekend(cursor) && !holidaySet.has(toISODate(cursor))) {
        count++;
      }
    }

    // Advance by one day using UTC to avoid DST issues
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/**
 * Checks whether two date ranges [aStart, aEnd] and [bStart, bEnd] overlap.
 * Ranges that are adjacent (end of one = start of other) do NOT overlap.
 */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = parseDate(aStart).getTime();
  const aE = parseDate(aEnd).getTime();
  const bS = parseDate(bStart).getTime();
  const bE = parseDate(bEnd).getTime();

  // Strictly less-than: adjacent ranges don't overlap
  return aS < bE + 1 && aE + 1 > bS && aS !== bE + 1 && aE + 1 !== bS;
}

/**
 * Projects how many days an absence request consumes and whether it's permitted.
 *
 * Returns:
 * - requestedDays: calendar/workdays consumed by this request
 * - balanceAfter:  currentBalance minus requestedDays (may be negative)
 * - isAllowed:     false when balance goes negative OR instance limits are exceeded
 * - warnings:      human-readable Norwegian messages for each violation
 */
export function projectAbsenceBalance(input: ProjectionInput): ProjectionResult {
  const { currentBalance, startDate, endDate, absenceType, holidays, existingRequests } = input;

  const warnings: string[] = [];

  // --- Step 1: Count the days this request would consume ---
  const requestedDays = countDaysInRange(startDate, endDate, absenceType.countWeekends, holidays);

  const balanceAfter = currentBalance - requestedDays;

  // --- Step 2: Balance check ---
  if (balanceAfter < 0) {
    warnings.push("Ikke nok dager tilgjengelig");
  }

  // --- Step 3: Overlap detection ---
  // Only flag overlaps with pending or approved requests — cancelled/rejected are irrelevant
  for (const existing of existingRequests) {
    if (!ACTIVE_REQUEST_STATUSES.has(existing.status)) {
      continue;
    }

    if (rangesOverlap(startDate, endDate, existing.startDate, existing.endDate)) {
      warnings.push(`Overlapper med eksisterende fravær ${existing.startDate}–${existing.endDate}`);
    }
  }

  // --- Step 4: Instance limit checks ---
  let instanceLimitExceeded = false;

  if (absenceType.maxDaysPerInstance !== null && requestedDays > absenceType.maxDaysPerInstance) {
    warnings.push(
      `Maks dager per sykemelding er ${absenceType.maxDaysPerInstance} (du valgte ${requestedDays})`,
    );
    instanceLimitExceeded = true;
  }

  if (
    absenceType.maxInstancesPerYear !== null &&
    absenceType.currentYearInstances >= absenceType.maxInstancesPerYear
  ) {
    warnings.push(`Maks antall egenmeldinger per år er ${absenceType.maxInstancesPerYear}`);
    instanceLimitExceeded = true;
  }

  // --- Step 5: Determine isAllowed ---
  // Blocked by: negative balance OR instance limit exceeded
  const isAllowed = balanceAfter >= 0 && !instanceLimitExceeded;

  return {
    requestedDays,
    balanceAfter,
    isAllowed,
    warnings,
  };
}
