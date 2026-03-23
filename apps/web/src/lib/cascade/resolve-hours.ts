/**
 * resolve_hours — Cascade Phase B Pure Function #1
 *
 * Resolves effective operating hours for a department on a specific date.
 * Resolution order: override(date) > season_weekly(day_of_week) > default_weekly > closed.
 *
 * Foundation invariant: when close_time < open_time, the service window
 * crosses midnight. effectiveCloseTimestamp returns the next-day close.
 *
 * Spec: Section 3 Phase B, Function #1
 */

import type {
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
  EffectiveHours,
} from "./types";

/**
 * Get the day-of-week (0=Mon...6=Sun) from an ISO date string.
 * JavaScript Date.getDay() returns 0=Sun, so we convert.
 */
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC avoids timezone edge cases
  const jsDay = d.getUTCDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon...6=Sun
}

export function resolveEffectiveHours(
  departmentId: string,
  locationId: string | null,
  date: string,
  weeklyHours: DepartmentOperatingHoursRow[],
  overrides: DepartmentHoursOverrideRow[],
  seasonId?: string,
): EffectiveHours {
  const closedResult: EffectiveHours = {
    date,
    isOpen: false,
    openTime: null,
    closeTime: null,
    crossesMidnight: false,
    effectiveCloseTimestamp: null,
    source: "closed",
  };

  // 1. Check for date-specific override
  // Prefer exact location match, then null-location fallback
  const exactLocOverride = overrides.find(
    (o) =>
      o.department_id === departmentId && o.override_date === date && o.location_id === locationId,
  );
  const fallbackOverride = overrides.find(
    (o) => o.department_id === departmentId && o.override_date === date && o.location_id === null,
  );
  const matchedOverride = exactLocOverride ?? fallbackOverride;

  if (matchedOverride) {
    if (matchedOverride.is_closed) {
      return { ...closedResult, source: "override" };
    }
    return buildResult(date, matchedOverride.open_time!, matchedOverride.close_time!, "override");
  }

  // 2. Find weekly hours — resolution: season+location > season+null > null+location > null+null
  const dayOfWeek = getDayOfWeek(date);
  const deptRows = weeklyHours.filter(
    (r) => r.department_id === departmentId && r.day_of_week === dayOfWeek,
  );

  const match = pickBestWeeklyRow(deptRows, locationId, seasonId ?? null);
  if (!match) {
    return closedResult;
  }

  if (match.row.is_closed) {
    return {
      ...closedResult,
      source: match.source,
    };
  }

  return buildResult(date, match.row.open_time!, match.row.close_time!, match.source);
}

type WeeklyMatch = {
  row: DepartmentOperatingHoursRow;
  source: "season_weekly" | "default_weekly";
};

function pickBestWeeklyRow(
  rows: DepartmentOperatingHoursRow[],
  locationId: string | null,
  seasonId: string | null,
): WeeklyMatch | null {
  // Priority: season+location > season+null > default+location > default+null
  if (seasonId) {
    const seasonLoc = rows.find(
      (r) => r.season_id === seasonId && r.location_id === locationId && locationId !== null,
    );
    if (seasonLoc) return { row: seasonLoc, source: "season_weekly" };

    const seasonNull = rows.find((r) => r.season_id === seasonId && r.location_id === null);
    if (seasonNull) return { row: seasonNull, source: "season_weekly" };
  }

  // Default (null season)
  const defaultLoc = rows.find(
    (r) => r.season_id === null && r.location_id === locationId && locationId !== null,
  );
  if (defaultLoc) return { row: defaultLoc, source: "default_weekly" };

  const defaultNull = rows.find((r) => r.season_id === null && r.location_id === null);
  if (defaultNull) return { row: defaultNull, source: "default_weekly" };

  return null;
}

function buildResult(
  date: string,
  openTime: string,
  closeTime: string,
  source: EffectiveHours["source"],
): EffectiveHours {
  // Normalize to HH:MM
  const open = openTime.substring(0, 5);
  const close = closeTime.substring(0, 5);
  const crossesMidnight = close < open;

  let effectiveCloseTimestamp: string | null = null;
  if (crossesMidnight) {
    // Close is on the next calendar day
    const nextDay = new Date(date + "T12:00:00Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDayStr = nextDay.toISOString().substring(0, 10);
    effectiveCloseTimestamp = `${nextDayStr}T${close}`;
  } else {
    effectiveCloseTimestamp = `${date}T${close}`;
  }

  return {
    date,
    isOpen: true,
    openTime: open,
    closeTime: close,
    crossesMidnight,
    effectiveCloseTimestamp,
    source,
  };
}
