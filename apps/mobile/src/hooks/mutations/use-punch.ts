/**
 * Offline-first punch clock mutations.
 *
 * punchIn() and punchOut() enqueue writes to the SQLite sync queue and
 * optimistically update the TanStack Query cache for useActiveTimeEntry.
 * The SyncWorker picks them up and sends to Supabase when online.
 *
 * punchIn() enforces GPS geofencing when gpsConfig is provided:
 *   - permission_denied / unavailable → throws Norwegian error, blocks submission
 *   - outside geofence radius → throws Norwegian error with distance, blocks submission
 *   - inside geofence / GPS not required → proceeds, telemetry carries real verdict
 *
 * GPS columns (gps_verified, gps_lat, gps_lng) are NOT yet in the sync-queue
 * punchInSchema or time_entry table — those land in a follow-up migration sortie.
 * For now gps_verified and gps_distance_meters are carried in the telemetry emit only.
 */

import { useCallback } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import { subscribeShiftSessionTopic, unsubscribeShiftSessionTopic } from "@/lib/push";
import { useGPSGuard } from "@/hooks/shift-clock/useGPSGuard";
import { calculateGPSDistance } from "@smartout/shift-clock";
import type { TimeEntry } from "@/types/time-entry";
import type { BreakEntry, GPSConfig, GPSSnapshot } from "@smartout/shift-clock";

/**
 * Hook that returns punchIn and punchOut functions.
 *
 * Both work offline via the sync queue and optimistically update the
 * active-time-entry query cache so the UI reflects the punch instantly.
 */
export function usePunch() {
  const queryClient = useQueryClient();
  const { getPosition, isWithinGeofence } = useGPSGuard();

  /**
   * Punches in for a shift: enforces GPS geofence (when config provided), then
   * creates a new time_entry via the offline queue.
   *
   * GPS gate (runs BEFORE enqueue):
   *   - If gpsConfig.required=true and permission is denied/unavailable:
   *     throws with Norwegian Bokmål message — caller shows Alert + blocks.
   *   - If gpsConfig.required=true and employee is outside geofence:
   *     throws with Norwegian Bokmål message including distance — caller shows Alert + blocks.
   *   - On web (Platform.OS==='web') getPosition() returns null, gpsConfig.required is
   *     treated as false — web is always allowed per useGPSGuard design.
   *   - gps_verified and gps_distance_meters in telemetry reflect the ACTUAL verdict.
   *
   * NOTE: GPS columns (gps_verified, gps_lat, gps_lng) are NOT yet in the sync-queue
   * punchInSchema or time_entry table schema. The enqueue payload stays unchanged.
   * Follow-up: add columns via migration + extend punchInSchema (flagged 2026-05-25).
   *
   * @param shiftId         - schedule_shift_id.
   * @param gpsConfig       - Workspace GPS config from useShiftClockConfig. Null = GPS not
   *                          configured for this workspace (allow punch unconditionally).
   * @param shiftSessionId  - Optional shift_session_id. When provided (ADR-0367 §M4),
   *                          subscribe to the push topic for live session updates.
   * @param pushTopic       - push_topic from the shift_session row (required when
   *                          shiftSessionId is supplied).
   */
  const punchIn = useCallback(
    async (
      shiftId: string,
      gpsConfig: GPSConfig | null,
      shiftSessionId?: string,
      pushTopic?: string,
    ) => {
      // ── GPS gate ──────────────────────────────────────────────────────────
      // Resolve GPS verdict BEFORE resolving profile or enqueuing, so a GPS
      // block fails fast with no side effects on the DB or telemetry.
      let gpsVerified = false;
      let gpsDistanceMeters: number | null = null;
      let gpsSnapshot: GPSSnapshot | null = null;

      if (gpsConfig?.required) {
        gpsSnapshot = await getPosition();

        if (gpsSnapshot === null) {
          // null = permission denied, OS hardware unavailable, or timeout.
          // useGPSGuard sets error state internally; we surface user-facing message here.
          throw new Error(
            "GPS-tilgang kreves for stempling. Aktiver GPS i innstillinger og prøv igjen.",
          );
        }

        const within = isWithinGeofence(gpsSnapshot, gpsConfig);

        if (!within && gpsConfig.referenceLat !== null && gpsConfig.referenceLng !== null) {
          // Compute distance so the error message is actionable.
          const distM = Math.round(
            calculateGPSDistance(
              gpsSnapshot.lat,
              gpsSnapshot.lng,
              gpsConfig.referenceLat,
              gpsConfig.referenceLng,
            ),
          );
          gpsDistanceMeters = distM;
          const overBy = Math.max(0, distM - gpsConfig.radiusMeters);
          throw new Error(
            `Du er for langt fra arbeidsplassen til å stemple inn (${overBy} m fra grensen). Beveg deg nærmere og prøv igjen.`,
          );
        }

        // Passed geofence check.
        gpsVerified = true;
        if (gpsConfig.referenceLat !== null && gpsConfig.referenceLng !== null) {
          gpsDistanceMeters = Math.round(
            calculateGPSDistance(
              gpsSnapshot.lat,
              gpsSnapshot.lng,
              gpsConfig.referenceLat,
              gpsConfig.referenceLng,
            ),
          );
        }
      }

      // ── Profile resolution (ADR-0134 — fail fast, never empty-string) ────
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

      // Telemetry carries the actual GPS verdict (no more hardcoded false).
      // gps_verified=true only when guard confirmed employee is within geofence.
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
            gps_verified: gpsVerified,
            gps_distance_meters: gpsDistanceMeters,
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
    [queryClient, getPosition, isWithinGeofence],
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

      // GPS is not re-verified at punch-out — the guard ran at punch-in.
      // gps_verified=false here is intentional: punch-out is a time-recording
      // action, not a location-enforcement point. The punch-in telemetry row
      // already carries the authoritative gps_verified verdict for this shift.
      // Named constant makes this explicit rather than a magic false.
      const GPS_NOT_VERIFIED_AT_PUNCHOUT = false;

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
            gps_verified: GPS_NOT_VERIFIED_AT_PUNCHOUT,
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
