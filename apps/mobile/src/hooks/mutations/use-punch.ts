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
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import { subscribeShiftSessionTopic, unsubscribeShiftSessionTopic } from "@/lib/push";
import type { TimeEntry } from "@/types/time-entry";
import type { BreakEntry } from "@smartout/shift-clock";

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
   *
   * @param shiftId         - schedule_shift_id.
   * @param shiftSessionId  - Optional shift_session_id. When provided (ADR-0367 §M4),
   *                          subscribe to the push topic for live session updates.
   * @param pushTopic       - push_topic from the shift_session row (required when
   *                          shiftSessionId is supplied).
   */
  const punchIn = useCallback(
    async (shiftId: string, shiftSessionId?: string, pushTopic?: string) => {
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
          entity_type: "shift",
          entity_id: shiftId,
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

      // ADR-0367 §M4 — subscribe push topic on clock-in when session is known.
      if (shiftSessionId && pushTopic) {
        void subscribeShiftSessionTopic(shiftSessionId, pushTopic).catch(() => {
          // Non-fatal — push subscribe failure does not abort clock-in.
        });
      }
    },
    [queryClient],
  );

  /**
   * Punches out for the active time entry: updates it via the offline queue.
   *
   * Sets punch_out timestamp and status to 'completed', enqueues a 'punch_out'
   * action, and optimistically nulls the active time entry in the query cache
   * so the PunchButton flips back to "STEMPLE INN" immediately.
   *
   * @param timeEntryId    - The active time_entry_id.
   * @param shiftSessionId - Optional shift_session_id (ADR-0367 §M4). When
   *                         provided, unsubscribes from the push topic and emits
   *                         shift_session.clocked_out.
   */
  const punchOut = useCallback(
    async (timeEntryId: string, shiftSessionId?: string) => {
      // Resolve BEFORE enqueue so broken attribution fails fast (ADR-0134)
      const { profileId, workspaceId } = await getProfileContext();
      // Capture shift_id from the cache BEFORE we clear it — needed for
      // engine_event / entity_id (schedule_shift) routing.
      const activeEntry = queryClient.getQueryData<TimeEntry | null>(["active-time-entry"]);
      // Fail fast on missing shift_id. The downstream emit routes
      // engine_state via `entity_id = shift_id` (shift_lifecycle_v1).
      // Empty-string fallback would silently break the process chain
      // (ADR-0134 / L-0083 / shift_lifecycle contract).
      if (!activeEntry?.shift_id) {
        throw new Error("punchOut called without an active shift_id in the cache");
      }
      const shiftId = activeEntry.shift_id;
      const now = new Date().toISOString();

      const punchInMs = activeEntry?.punch_in ? new Date(activeEntry.punch_in).getTime() : null;
      const workMinutes =
        punchInMs !== null ? Math.max(0, Math.round((Date.now() - punchInMs) / 60_000)) : 0;

      // S2 fix: compute actual break duration from time_entry.breaks JSONB.
      // Hardcoded break_minutes: 0 was misleading telemetry (lovsen S2).
      // Sum all completed break intervals (both start AND end present).
      const breakEntries = (activeEntry?.breaks as BreakEntry[] | null) ?? [];
      const breakMinutes = breakEntries.reduce((sum, b) => {
        if (!b.start || !b.end) return sum;
        const startMs = new Date(b.start).getTime();
        const endMs = new Date(b.end).getTime();
        return sum + Math.max(0, Math.round((endMs - startMs) / 60_000));
      }, 0);

      const payload = {
        time_entry_id: timeEntryId,
        punch_out: now,
        status: "completed" as const,
      };

      await enqueue("punch_out", payload);

      // Optimistically clear the active time entry — employee is no longer clocked in
      queryClient.setQueryData<TimeEntry | null>(["active-time-entry"], null);

      // entity_id MUST be the schedule_shift id — engine-dispatch stamps
      // engine_state.entity_id from payload.entity_id so shift_lifecycle_v1
      // can match subsequent steps (update_entity on schedule_shift,
      // derive_shift_hours RPC keyed by p_shift_id). Using time_entry_id
      // here would break the entire process chain.
      void emit({
        event: "shift punched_out",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity_type: "shift",
          entity_id: shiftId,
          data: {
            shift_id: shiftId,
            time_entry_id: timeEntryId,
            punch_time: now,
            work_minutes: workMinutes,
            break_minutes: breakMinutes,
            gps_verified: false,
          },
        },
      });

      // ADR-0367 §M4 — unsubscribe push topic on clock-out when session is known.
      if (shiftSessionId) {
        void unsubscribeShiftSessionTopic(shiftSessionId).catch(() => {
          // Non-fatal — push unsubscribe failure does not abort clock-out.
        });
      }
    },
    [queryClient],
  );

  return { punchIn, punchOut };
}
