"use client";

/**
 * Shared week range helper for components that need weekStart/weekEnd
 * to call TanStack Query hooks. Reads scheduleDateOffset from DashboardContext
 * so navigating weeks works correctly across all consumers.
 * Connected to: use-shifts.ts, use-absences.ts, etc. (all need weekStart param)
 */

import { useContext, useMemo } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

/** Compute Monday–Sunday date strings for a given week offset. */
function getWeekRange(weekOffset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Use local date parts to avoid UTC timezone shift
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return {
    weekStart: fmt(monday),
    weekEnd: fmt(sunday),
  };
}

export function useWeekRange() {
  const { scheduleDateOffset } = useContext(DashboardContext);

  return useMemo(() => getWeekRange(scheduleDateOffset), [scheduleDateOffset]);
}
