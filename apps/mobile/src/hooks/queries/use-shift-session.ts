/**
 * useShiftSession — Fetch the viewer's shift_session row for a given business date.
 *
 * Joins shift_session_day_line → day_line → location so the caller gets
 * the list of day_lines (with open/close times and location name) in one
 * round-trip.
 *
 * ADR-0367 §M1. Read-only. No writes here (ADR-0133 — mobile EXECUTES, never authors).
 * Workspace + employee scope enforced by RLS (jwt_select_shift_session_self_or_manager).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Day-line slice returned inside a ShiftSessionRow. */
export type ShiftSessionDayLine = {
  day_line_id: string;
  planned_open: string;
  planned_close: string;
  location: { name: string };
};

/** Hydrated shift_session row with nested day_lines. */
export type ShiftSessionRow = {
  shift_session_id: string;
  workspace_id: string;
  schedule_shift_id: string;
  business_date: string;
  status: "scheduled" | "clocked_in" | "clocked_out" | "cancelled";
  push_topic: string | null;
  day_lines: ShiftSessionDayLine[];
};

// Raw Supabase join shape before we normalise
type RawJunctionRow = {
  day_line: ShiftSessionDayLine | null;
};

/**
 * Load the current employee's shift_session for `(profileId, date)`.
 *
 * Returns null when no session exists (e.g. day off, pre-creation).
 * Throws on network/auth failure — TanStack Query surfaces to the
 * nearest error boundary.
 *
 * @param profileId - The current employee's profile_id (null while loading — query disabled).
 * @param date      - ISO date string YYYY-MM-DD matching business_date (null → disabled).
 */
export function useShiftSession(profileId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["shift-session", profileId, date],
    queryFn: async (): Promise<ShiftSessionRow | null> => {
      // profileId and date are guaranteed non-null here because of the
      // `enabled` guard below — but TypeScript needs the assertion.
      const { data, error } = await supabase
        .from("shift_session")
        .select(
          `
          shift_session_id,
          workspace_id,
          schedule_shift_id,
          business_date,
          status,
          push_topic,
          day_lines:shift_session_day_line(
            day_line:day_line_id(
              day_line_id,
              planned_open,
              planned_close,
              location:location_id(name)
            )
          )
          `,
        )
        .eq("employee_id", profileId!)
        .eq("business_date", date!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Normalise: junction rows arrive as { day_line: {...} } — unwrap.
      const junctions = (data.day_lines ?? []) as unknown as RawJunctionRow[];
      const day_lines: ShiftSessionDayLine[] = junctions
        .map((j) => j.day_line)
        .filter((dl): dl is ShiftSessionDayLine => dl !== null);

      return {
        shift_session_id: data.shift_session_id,
        workspace_id: data.workspace_id,
        schedule_shift_id: data.schedule_shift_id,
        business_date: data.business_date as string,
        status: data.status as ShiftSessionRow["status"],
        push_topic: data.push_topic ?? null,
        day_lines,
      };
    },
    staleTime: 30_000,
    // Only run when both arguments are non-null and non-empty strings.
    enabled: Boolean(profileId) && Boolean(date),
  });
}
