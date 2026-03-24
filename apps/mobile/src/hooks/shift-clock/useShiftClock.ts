/**
 * useShiftClock — Offline-first shift clock state machine for mobile.
 *
 * Mirrors the web shift clock state machine but all mutations go through the
 * SQLite sync queue via enqueue() instead of hitting Supabase directly. Every
 * action is instant from the user's perspective — no network required.
 *
 * State is derived from useActiveTimeEntry (current punch status) and the
 * @smartout/shift-clock state machine (valid transitions).
 *
 * Break state is tracked in the time_entry.breaks JSONB column. Each
 * startBreak() / endBreak() call enqueues an update to that column and
 * optimistically patches the query cache.
 */

import { useCallback, useMemo } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { canTransition, getNextPhase } from "@smartout/shift-clock";
import type { ShiftClockPhase, BreakEntry } from "@smartout/shift-clock";

import { enqueue } from "@/lib/sync/queue";
import { useActiveTimeEntry } from "@/hooks/queries/use-active-time-entry";
import type { TimeEntry } from "@/types/time-entry";

/**
 * Resolves the current ShiftClockPhase from the active time entry.
 *
 * Maps the time_entry.status field to the shared ShiftClockPhase enum used
 * by the state machine. A time entry with an active break is detected by
 * inspecting the breaks JSONB array for an entry without an `end` timestamp.
 */
function resolvePhase(entry: TimeEntry | null | undefined): ShiftClockPhase {
  if (!entry || entry.status !== "clocked_in") return "idle";

  // Check if there is an open break (start set, end missing)
  const breaks = entry.breaks as BreakEntry[] | null;
  const hasOpenBreak = Array.isArray(breaks) && breaks.some((b) => b.start && !b.end);

  return hasOpenBreak ? "on_break" : "clocked_in";
}

export type ShiftClockActions = {
  /** Current phase derived from the active time entry */
  phase: ShiftClockPhase;
  /** The active time entry, or null if not clocked in */
  activeTimeEntry: TimeEntry | null | undefined;
  /** True while the active time entry is loading */
  isLoading: boolean;
  /** Punch in for a shift — enqueues punch_in, optimistic cache update */
  punchIn: (shiftId: string, profileId: string, workspaceId: string) => Promise<void>;
  /** Punch out — enqueues punch_out, clears active time entry cache */
  punchOut: () => Promise<void>;
  /** Start a break — enqueues break_start, patches breaks JSONB optimistically */
  startBreak: () => Promise<void>;
  /** End the current break — enqueues break_end, patches breaks JSONB optimistically */
  endBreak: () => Promise<void>;
};

/**
 * Hook: provides shift clock state and all clock actions with offline-first sync.
 *
 * Callers should resolve profileId and workspaceId from useMyProfile() before
 * calling punchIn() — this hook does not fetch auth context to stay lightweight.
 */
export function useShiftClock(): ShiftClockActions {
  const queryClient = useQueryClient();
  const { data: activeTimeEntry, isLoading } = useActiveTimeEntry();
  const phase = useMemo(() => resolvePhase(activeTimeEntry), [activeTimeEntry]);

  /**
   * Punches in for a shift. Generates a client-side time_entry_id, enqueues
   * the punch_in action, and optimistically sets the active time entry cache
   * so the UI flips to "clocked in" immediately.
   */
  const punchIn = useCallback(
    async (shiftId: string, profileId: string, workspaceId: string) => {
      if (!canTransition(phase, "punch_in")) return;

      const timeEntryId = randomUUID();
      const now = new Date().toISOString();

      await enqueue("punch_in", {
        time_entry_id: timeEntryId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: workspaceId,
        punch_in: now,
        status: "clocked_in",
      });

      queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], {
        time_entry_id: timeEntryId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: workspaceId,
        punch_in: now,
        punch_out: null,
        breaks: null,
        punch_in_location: null,
        status: "clocked_in",
        created_at: now,
        updated_at: now,
      } satisfies TimeEntry);
    },
    [phase, queryClient],
  );

  /**
   * Punches out for the currently active time entry. Enqueues the punch_out
   * action and optimistically clears the active time entry cache so the UI
   * flips back to "idle" immediately.
   */
  const punchOut = useCallback(async () => {
    if (!activeTimeEntry || !canTransition(phase, "punch_out")) return;

    const now = new Date().toISOString();

    await enqueue("punch_out", {
      time_entry_id: activeTimeEntry.time_entry_id,
      punch_out: now,
      status: "completed",
    });

    queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], null);
  }, [activeTimeEntry, phase, queryClient]);

  /**
   * Starts a break on the active time entry. Appends a new BreakEntry with a
   * start timestamp (no end) to the breaks JSONB array, enqueues break_start,
   * and patches the cache so the UI enters "on_break" phase immediately.
   */
  const startBreak = useCallback(async () => {
    if (!activeTimeEntry || !canTransition(phase, "start_break")) return;

    const now = new Date().toISOString();
    const existingBreaks = (activeTimeEntry.breaks as BreakEntry[] | null) ?? [];
    const newBreak: BreakEntry = {
      start: now,
      end: null,
      startLocation: null,
      endLocation: null,
    };
    const updatedBreaks = [...existingBreaks, newBreak];

    await enqueue("break_start", {
      time_entry_id: activeTimeEntry.time_entry_id,
      breaks: updatedBreaks,
      updated_at: now,
    });

    queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], {
      ...activeTimeEntry,
      breaks: updatedBreaks,
      updated_at: now,
    });
  }, [activeTimeEntry, phase, queryClient]);

  /**
   * Ends the current open break. Finds the last BreakEntry without an end
   * timestamp, sets its end time, enqueues break_end, and patches the cache
   * so the UI returns to "clocked_in" phase immediately.
   */
  const endBreak = useCallback(async () => {
    if (!activeTimeEntry || !canTransition(phase, "end_break")) return;

    const now = new Date().toISOString();
    const existingBreaks = (activeTimeEntry.breaks as BreakEntry[] | null) ?? [];

    // Close the last open break — there should only ever be one at a time
    const updatedBreaks = existingBreaks.map((b, idx) => {
      const isLastOpenBreak = idx === existingBreaks.length - 1 && !b.end;
      return isLastOpenBreak ? { ...b, end: now } : b;
    });

    await enqueue("break_end", {
      time_entry_id: activeTimeEntry.time_entry_id,
      breaks: updatedBreaks,
      updated_at: now,
    });

    queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], {
      ...activeTimeEntry,
      breaks: updatedBreaks,
      updated_at: now,
    });
  }, [activeTimeEntry, phase, queryClient]);

  // Derive next phase for each action — useful for UI button labeling
  const _nextPhases = useMemo(
    () => ({
      afterPunchIn: getNextPhase(phase, "punch_in"),
      afterPunchOut: getNextPhase(phase, "punch_out"),
      afterStartBreak: getNextPhase(phase, "start_break"),
      afterEndBreak: getNextPhase(phase, "end_break"),
    }),
    [phase],
  );
  void _nextPhases; // consumed by callers via the phase field

  return {
    phase,
    activeTimeEntry,
    isLoading,
    punchIn,
    punchOut,
    startBreak,
    endBreak,
  };
}
