"use client";

/**
 * use-calendar-overlays.ts
 * Aggregates shift counts and holiday names for a given week window so
 * CalendarPageShell can pass them down to CalendarTab as flat Record buckets.
 *
 * Shift source: schedule_shift via useShifts (schedule domain hook).
 * Holiday source: payroll.holiday_entry via useHolidayCalendars + useHolidayEntries
 *   — picks the workspace's default holiday calendar; falls back to the first
 *   calendar if no default is set.
 */

import { useMemo } from "react";
import { useShifts } from "@/app/dashboard/schedule/_hooks/use-shifts";
import {
  useHolidayCalendars,
  useHolidayEntries,
} from "@/app/dashboard/settings/_hooks/use-holiday-calendars";

export type CalendarOverlayWindow = {
  weekStart: string; // yyyy-MM-dd
  weekEnd: string; // yyyy-MM-dd
};

export type CalendarOverlays = {
  shiftsByDate: Record<string, number>;
  holidaysByDate: Record<string, { name: string }>;
  isLoading: boolean;
};

export function useCalendarOverlays({
  weekStart,
  weekEnd,
}: CalendarOverlayWindow): CalendarOverlays {
  // ── Shifts ──────────────────────────────────────────────────────────────────
  const shiftsQuery = useShifts(weekStart, weekEnd);

  const shiftsByDate = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    for (const shift of shiftsQuery.data ?? []) {
      result[shift.dateId] = (result[shift.dateId] ?? 0) + 1;
    }
    return result;
  }, [shiftsQuery.data]);

  // ── Holidays — two-step: calendars → entries for default calendar ────────────
  const calendarsQuery = useHolidayCalendars();

  // Pick default calendar; fall back to first if none is flagged as default.
  const activeCalendar = useMemo(() => {
    const cals = calendarsQuery.data ?? [];
    return cals.find((c) => c.is_default) ?? cals[0] ?? null;
  }, [calendarsQuery.data]);

  const entriesQuery = useHolidayEntries(activeCalendar?.id ?? null);

  const holidaysByDate = useMemo<Record<string, { name: string }>>(() => {
    const result: Record<string, { name: string }> = {};
    for (const entry of entriesQuery.data ?? []) {
      // Only include entries that fall within the visible window.
      if (entry.holiday_date >= weekStart && entry.holiday_date <= weekEnd) {
        result[entry.holiday_date] = {
          name: entry.name_no ?? entry.name,
        };
      }
    }
    return result;
  }, [entriesQuery.data, weekStart, weekEnd]);

  return {
    shiftsByDate,
    holidaysByDate,
    isLoading: shiftsQuery.isLoading || calendarsQuery.isLoading || entriesQuery.isLoading,
  };
}
