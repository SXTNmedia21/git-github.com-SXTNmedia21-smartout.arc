/**
 * Fetches schedule_shift data for an entire department/team over a date range.
 * Used by the Master Roster screen to display a weekly grid of all employees.
 *
 * Joins profile to get employee names for display. Groups shifts by week
 * and day for the calendar grid layout.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "./use-my-profile";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

/** A shift with the employee's display name attached */
export type RosterShift = ScheduleShift & {
  employee_name: string;
};

/** Grouped structure for the roster grid */
export type RosterWeek = {
  weekNumber: number;
  dateRange: string;
  days: RosterDay[];
};

export type RosterDay = {
  dayIndex: number; // 0=Mon, 6=Sun
  date: string; // YYYY-MM-DD
  isToday: boolean;
  isWeekend: boolean;
  shifts: { name: string; time: string }[];
};

const STALE_TIME_MS = 5 * 60 * 1000;

/** Get ISO week number from a date */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get Monday of the week containing the given date */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a date range like "16 Apr — 22 Apr" */
function formatDateRange(monday: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return `${monday.getDate()} ${months[monday.getMonth()]} — ${sunday.getDate()} ${months[sunday.getMonth()]}`;
}

async function fetchTeamShifts(
  workspaceId: string,
  departmentId: string | null,
  startDate: string,
  endDate: string,
): Promise<RosterShift[]> {
  let query = supabase
    .from("schedule_shift")
    .select("*, profile:employee_id(first_name, last_name)")
    .eq("workspace_id", workspaceId)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)
    .eq("is_published", true)
    .order("shift_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as ScheduleShift & {
      profile: { first_name: string; last_name: string } | null;
    };
    const firstName = r.profile?.first_name ?? "";
    const lastInitial = r.profile?.last_name ? ` ${r.profile.last_name.charAt(0)}.` : "";
    return {
      ...r,
      employee_name: `${firstName}${lastInitial}`.trim() || "Ukjent",
    } as RosterShift;
  });
}

/**
 * Hook: returns team/department shifts grouped by week for the roster grid.
 * Shows 2 weeks starting from the current week's Monday.
 */
export function useTeamShifts() {
  const { data: profile } = useMyProfile();

  const workspaceId = profile?.workspace_id ?? null;
  const departmentId = profile?.department_id ?? null;

  // Calculate date range: current week Monday to 2 weeks out
  const { startDate, endDate } = useMemo(() => {
    const monday = getMonday(new Date());
    const end = new Date(monday);
    end.setDate(end.getDate() + 13); // 2 weeks
    return {
      startDate: monday.toISOString().split("T")[0]!,
      endDate: end.toISOString().split("T")[0]!,
    };
  }, []);

  const query = useQuery<RosterShift[]>({
    queryKey: ["team-shifts", workspaceId, departmentId, startDate, endDate],
    queryFn: () => fetchTeamShifts(workspaceId!, departmentId, startDate, endDate),
    enabled: !!workspaceId,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });

  // Group shifts into weeks for the roster grid
  const weeks = useMemo<RosterWeek[]>(() => {
    const shifts = query.data ?? [];
    const todayStr = new Date().toISOString().split("T")[0]!;
    const monday = getMonday(new Date());

    const result: RosterWeek[] = [];

    // Generate 2 weeks
    for (let w = 0; w < 2; w++) {
      const weekMonday = new Date(monday);
      weekMonday.setDate(weekMonday.getDate() + w * 7);

      const days: RosterDay[] = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekMonday);
        dayDate.setDate(dayDate.getDate() + d);
        const dateStr = dayDate.toISOString().split("T")[0]!;

        const dayShifts = shifts
          .filter((s) => s.shift_date === dateStr)
          .map((s) => ({
            name: s.employee_name,
            time: s.start_time.slice(0, 5),
          }));

        days.push({
          dayIndex: d,
          date: dateStr,
          isToday: dateStr === todayStr,
          isWeekend: d >= 5,
          shifts: dayShifts,
        });
      }

      result.push({
        weekNumber: getISOWeek(weekMonday),
        dateRange: formatDateRange(weekMonday),
        days,
      });
    }

    return result;
  }, [query.data]);

  return {
    ...query,
    weeks,
  };
}
