/**
 * useShiftSession — Fetch the viewer's shift_session row for a given business date.
 *
 * Joins shift_session_day_line → day_line → location so the caller gets
 * the list of day_lines (with open/close times and location name) in one
 * round-trip.
 *
 * ADR-0367 §M1. Read-only (query). Writes via useClockIn (ADR-0133 — mobile EXECUTES).
 * Workspace + employee scope enforced by RLS (jwt_select_shift_session_self_or_manager).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

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

// ─── Clock-in mutation ───────────────────────────────────────────────────────

type ClockInResult =
  | { ok: true; shiftSessionId: string; clocked_in_at: string; alreadyClockedIn?: boolean }
  | { ok: false; error: string };

/**
 * Returns a TanStack mutation that POSTs to the BFF clock-in endpoint.
 *
 * On success, invalidates the shift-session query so the UI reflects
 * the new 'clocked_in' status immediately.
 *
 * Auth: Bearer JWT from the active Supabase session (ADR-0132 / ADR-0151).
 * Identity is NEVER sent in the body — derived server-side by the BFF.
 *
 * ADR-0134: no emit here — the BFF owns the "shift_session.clocked_in"
 * emit after the write. Emitting twice would double-count payroll events.
 *
 * @param profileId - current employee's profile_id (for query invalidation key).
 * @param date      - business_date YYYY-MM-DD (for query invalidation key).
 */
export function useClockIn(profileId: string | null, date: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shiftSessionId: string): Promise<ClockInResult> => {
      // Resolve Bearer token from the active Supabase session (ADR-0132 / ADR-0151).
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return { ok: false, error: "Ikke autentisert. Logg inn på nytt." };
      }

      const url = `${getWebApiUrl()}/api/mobile/shift-session/${shiftSessionId}/clock-in`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      return (await response.json()) as ClockInResult;
    },
    onSuccess: (result) => {
      if (result.ok) {
        // Invalidate the shift-session query so the status flips in the UI.
        void queryClient.invalidateQueries({ queryKey: ["shift-session", profileId, date] });
      }
    },
  });
}

// ─── Day-line task timeline hook ─────────────────────────────────────────────

/**
 * Normalised session_task row for the day-line timeline (G6 gate).
 * Only status ∈ {scheduled, clocked_in, pending, available, in_progress}
 * are exposed — completed/skipped/overdue/escalated are excluded from
 * the "active today" timeline view.
 */
export type DayLineTaskRow = {
  /** session_task.id */
  id: string;
  title: string;
  description: string | null;
  status: string;
  /** scheduled_at — used as the timeline start anchor */
  scheduled_at: string | null;
  /** due_at from fn_list_my_tasks equivalent (computed upstream for session_task) */
  due_at: string | null;
  /** day_line_id the task belongs to */
  day_line_id: string;
  assigned_to: string | null;
  is_compliance_required: boolean;
  /** origin from provenance triple */
  origin: string | null;
};

/**
 * useDayLineItems — fetch session_task rows for all day_lines linked to a shift_session.
 *
 * Chain: shift_session → shift_session_day_line → day_line → session_task
 * (ADR-0367 tri-layer). Tasks are filtered to status ∈ {pending, available,
 * in_progress} — the "active today" set visible to the employee (G6).
 *
 * Query is disabled when shiftSessionId is null (pre-clock-in / no session).
 * Returns an empty array (not null) when the session exists but has no tasks.
 *
 * RLS: jwt_read_session_task allows workspace members to read.
 *
 * @param shiftSessionId - shift_session.shift_session_id. Null → query disabled.
 */
export function useDayLineItems(shiftSessionId: string | null) {
  return useQuery({
    queryKey: ["day-line-items", shiftSessionId],
    queryFn: async (): Promise<DayLineTaskRow[]> => {
      // Step 1: resolve day_line_ids for this session via the junction table.
      const { data: junctionRows, error: junctionErr } = await supabase
        .from("shift_session_day_line")
        .select("day_line_id")
        .eq("shift_session_id", shiftSessionId!);

      if (junctionErr) throw junctionErr;
      if (!junctionRows || junctionRows.length === 0) return [];

      const dayLineIds = junctionRows.map((r) => r.day_line_id);

      // Step 2: fetch session_task rows anchored to those day_lines.
      // G6 gate: only active statuses visible to the employee in today's view.
      const { data: tasks, error: tasksErr } = await supabase
        .from("session_task")
        .select(
          `
          id,
          title,
          description,
          status,
          scheduled_at,
          assigned_to,
          is_compliance_required,
          day_line_id,
          origin
          `,
        )
        .in("day_line_id", dayLineIds)
        .in("status", ["pending", "available", "in_progress"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (tasksErr) throw tasksErr;

      return (tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        scheduled_at: t.scheduled_at ?? null,
        // session_task has no separate due_at column — scheduled_at is the
        // timeline anchor. A dedicated due_at window will be added in Phase 2.
        due_at: t.scheduled_at ?? null,
        day_line_id: t.day_line_id as string,
        assigned_to: t.assigned_to ?? null,
        is_compliance_required: t.is_compliance_required ?? false,
        origin: t.origin ?? null,
      }));
    },
    staleTime: 60_000,
    enabled: Boolean(shiftSessionId),
  });
}
