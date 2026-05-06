"use client";

/**
 * Shared week range helper for components that need weekStart/weekEnd
 * to call TanStack Query hooks. Reads scheduleDateOffset from DashboardContext
 * so navigating weeks works correctly across all consumers.
 * Connected to: use-shifts.ts, use-absences.ts, etc. (all need weekStart param)
 *
 * D2 fix: uses Oslo-anchored week boundaries via osloWeekStartString /
 * osloWeekEndString from @smartout/utils. The old `getDay() + setHours(0,0,0,0)`
 * pattern computed the week boundary in the JS runtime's LOCAL timezone. On
 * Vercel/Droplet servers (UTC) that was fine, but Next.js also runs "use client"
 * hooks during SSR — server-side UTC != browser-side Europe/Oslo, so the first
 * render could emit the wrong week start, causing a hydration mismatch.
 * Refs: Council 2026-04-28 voice + tool perf, ADR-0192 (Oslo TZ canonical).
 */

import { useContext, useMemo } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { osloWeekStartString, osloWeekEndString } from "@smartout/utils";

export function useWeekRange() {
  const { scheduleDateOffset } = useContext(DashboardContext);

  return useMemo(() => {
    const now = new Date();
    return {
      weekStart: osloWeekStartString(now, scheduleDateOffset),
      weekEnd: osloWeekEndString(now, scheduleDateOffset),
    };
  }, [scheduleDateOffset]);
}
