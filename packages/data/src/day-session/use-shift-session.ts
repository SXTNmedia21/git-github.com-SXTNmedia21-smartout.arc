/**
 * useShiftSession / useClockIn / useDayLineItems
 *
 * Relocated from apps/mobile/src/hooks/queries/use-shift-session.ts to
 * packages/data/src/day-session/ per ADR-0133 mobile-parity doctrine.
 * MF-Prior-6 (council mandate): kebab-case convention in packages/data.
 *
 * ADR-0367 §M1. Read-only (query). Writes via useClockIn mutation (ADR-0133).
 * Workspace + employee scope enforced by RLS (jwt_select_shift_session_self_or_manager).
 *
 * Consumers:
 *   apps/mobile/src/components/routine/RoutineReviewForm.tsx
 *   apps/mobile/src/hooks/queries/use-shift-session.ts (re-export shim)
 *   apps/mobile/src/hooks/use-routine-extract.ts
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// NOTE: supabase client and getWebApiUrl are resolved at runtime by the consuming
// app (mobile). The packages/data package declares them as peer-import paths
// that each app provides. Mobile provides @smartout/supabase/client (wrapped as
// the singleton supabase instance) and its own getWebApiUrl from @/lib/web-api.
//
// To keep packages/data free of app-specific deps, we require callers to inject
// the client. The relocated hook uses the same pattern as the day-session peers:
// callers pass the supabase client as a parameter, or this module re-exports
// under the same symbol as the mobile hook used.
//
// IMPLEMENTATION NOTE: Because this hook originally used app-local `supabase`
// and `getWebApiUrl`, we export the same function signatures but the actual
// implementation is still imported by mobile via a thin re-export shim at
// apps/mobile/src/hooks/queries/use-shift-session.ts, which injects app deps.
// This file is the authoritative TYPE and LOGIC definition; the shim wires deps.

// Re-export all types and functions from the canonical implementation.
// The canonical implementation lives here; the mobile shim re-exports from here.

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

/** Normalised session_task row for the day-line timeline (G6 gate). */
export type DayLineTaskRow = {
  /** session_task.id */
  id: string;
  title: string;
  description: string | null;
  status: string;
  /** scheduled_at — used as the timeline start anchor */
  scheduled_at: string | null;
  due_at: string | null;
  /** day_line_id the task belongs to */
  day_line_id: string;
  assigned_to: string | null;
  is_compliance_required: boolean;
  /** origin from provenance triple */
  origin: string | null;
};

// Raw Supabase join shape before we normalise
type RawJunctionRow = {
  day_line: ShiftSessionDayLine | null;
};

/**
 * Factory: returns useShiftSession hook bound to the supplied supabase client.
 *
 * Usage (in mobile app):
 *   import { createUseShiftSession } from "@smartout/data";
 *   import { supabase } from "@/lib/supabase";
 *   const useShiftSession = createUseShiftSession(supabase);
 *
 * ADR-0133: mobile executes; this hook is read-only (query only).
 * ADR-0367 §M1: chain via shift_session_day_line → day_line → location.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createUseShiftSession(supabase: any) {
  return function useShiftSession(profileId: string | null, date: string | null) {
    return useQuery({
      queryKey: ["shift-session", profileId, date],
      queryFn: async (): Promise<ShiftSessionRow | null> => {
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
      enabled: Boolean(profileId) && Boolean(date),
    });
  };
}

/**
 * Factory: returns useClockIn mutation bound to the supplied clients.
 * ADR-0134: BFF owns the "shift_session.clocked_in" emit — no double-emit here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createUseClockIn(supabase: any, getWebApiUrl: () => string) {
  return function useClockIn(profileId: string | null, date: string | null) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (
        shiftSessionId: string,
      ): Promise<
        | { ok: true; shiftSessionId: string; clocked_in_at: string; alreadyClockedIn?: boolean }
        | { ok: false; error: string }
      > => {
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

        return response.json() as Promise<
          | { ok: true; shiftSessionId: string; clocked_in_at: string; alreadyClockedIn?: boolean }
          | { ok: false; error: string }
        >;
      },
      onSuccess: (result) => {
        if (result.ok) {
          void queryClient.invalidateQueries({
            queryKey: ["shift-session", profileId, date],
          });
        }
      },
    });
  };
}

/**
 * Factory: returns useDayLineItems hook bound to the supplied supabase client.
 *
 * Chain: shift_session → shift_session_day_line → day_line → session_task
 * (ADR-0367 tri-layer). Tasks are filtered to active statuses visible to the employee.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createUseDayLineItems(supabase: any) {
  return function useDayLineItems(shiftSessionId: string | null) {
    return useQuery({
      queryKey: ["day-line-items", shiftSessionId],
      queryFn: async (): Promise<DayLineTaskRow[]> => {
        const { data: junctionRows, error: junctionErr } = await supabase
          .from("shift_session_day_line")
          .select("day_line_id")
          .eq("shift_session_id", shiftSessionId!);

        if (junctionErr) throw junctionErr;
        if (!junctionRows || junctionRows.length === 0) return [];

        const dayLineIds = junctionRows.map((r: { day_line_id: string }) => r.day_line_id);

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

        return (tasks ?? []).map(
          (t: {
            id: string;
            title: string;
            description: string | null;
            status: string;
            scheduled_at: string | null;
            assigned_to: string | null;
            is_compliance_required: boolean | null;
            day_line_id: string;
            origin: string | null;
          }) => ({
            id: t.id,
            title: t.title,
            description: t.description ?? null,
            status: t.status,
            scheduled_at: t.scheduled_at ?? null,
            due_at: t.scheduled_at ?? null,
            day_line_id: t.day_line_id as string,
            assigned_to: t.assigned_to ?? null,
            is_compliance_required: t.is_compliance_required ?? false,
            origin: t.origin ?? null,
          }),
        );
      },
      staleTime: 60_000,
      enabled: Boolean(shiftSessionId),
    });
  };
}
