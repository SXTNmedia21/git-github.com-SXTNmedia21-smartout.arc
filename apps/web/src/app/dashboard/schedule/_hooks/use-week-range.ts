"use client";

/**
 * Shared week range helper for components that need weekStart/weekEnd
 * to call TanStack Query hooks. Computes once per render (useMemo).
 * Connected to: use-shifts.ts, use-absences.ts, etc. (all need weekStart param)
 */

import { useMemo } from "react";

export function useWeekRange() {
  return useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      weekStart: monday.toISOString().split("T")[0]!,
      weekEnd: sunday.toISOString().split("T")[0]!,
    };
  }, []);
}
