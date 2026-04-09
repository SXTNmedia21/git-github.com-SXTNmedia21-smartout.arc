/**
 * Offline-first punch clock mutations.
 *
 * punchIn() and punchOut() enqueue writes to the SQLite sync queue and
 * optimistically update the TanStack Query cache for useActiveTimeEntry.
 * The SyncWorker picks them up and sends to Supabase when online.
 *
 * Both functions are instant from the user's perspective — no network required.
 */

import { useCallback } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { supabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import type { TimeEntry } from "@/types/time-entry";

/**
 * Fetches profile_id and workspace_id for the current user.
 * Reuses the same pattern as use-my-shifts and use-active-time-entry.
 */
async function getProfileContext(): Promise<{
  profileId: string;
  workspaceId: string;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !profile) throw error ?? new Error("Profile not found");

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}

/**
 * Hook that returns punchIn and punchOut functions.
 *
 * Both work offline via the sync queue and optimistically update the
 * active-time-entry query cache so the UI reflects the punch instantly.
 */
export function usePunch() {
  const queryClient = useQueryClient();

  /**
   * Punches in for a shift: creates a new time_entry via the offline queue.
   *
   * Generates a client-side UUID for the time_entry_id, builds the payload,
   * enqueues a 'punch_in' action, and optimistically sets the active time entry
   * in the query cache so the PunchButton flips to "STEMPLE UT" immediately.
   */
  const punchIn = useCallback(
    async (shiftId: string) => {
      const { profileId, workspaceId } = await getProfileContext();
      const timeEntryId = randomUUID();
      const now = new Date().toISOString();

      const payload = {
        time_entry_id: timeEntryId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: workspaceId,
        punch_in: now,
        status: "clocked_in" as const,
      };

      await enqueue("punch_in", payload);

      // Optimistically update the active time entry cache so the UI flips instantly
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

      void emit({
        event: "shift punched_in",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: { entity_type: "shift", entity_id: shiftId },
          data: {
            shift_id: shiftId,
            time_entry_id: timeEntryId,
            punch_time: now,
            is_adhoc: false,
            gps_verified: false,
            gps_distance_meters: null,
          },
        },
      });
    },
    [queryClient],
  );

  /**
   * Punches out for the active time entry: updates it via the offline queue.
   *
   * Sets punch_out timestamp and status to 'completed', enqueues a 'punch_out'
   * action, and optimistically nulls the active time entry in the query cache
   * so the PunchButton flips back to "STEMPLE INN" immediately.
   */
  const punchOut = useCallback(
    async (timeEntryId: string) => {
      const now = new Date().toISOString();

      const payload = {
        time_entry_id: timeEntryId,
        punch_out: now,
        status: "completed" as const,
      };

      await enqueue("punch_out", payload);

      // Optimistically clear the active time entry — employee is no longer clocked in
      queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], null);

      void emit({
        event: "shift punched_out",
        workspace_id: null,
        actor_id: "",
        properties: {
          entity: { entity_type: "shift", entity_id: timeEntryId },
          data: {
            shift_id: "",
            time_entry_id: timeEntryId,
            punch_time: now,
            work_minutes: 0,
            break_minutes: 0,
            gps_verified: false,
          },
        },
      });
    },
    [queryClient],
  );

  return { punchIn, punchOut };
}
