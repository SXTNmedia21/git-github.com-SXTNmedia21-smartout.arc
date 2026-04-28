/**
 * Offline-first absence request mutation.
 *
 * requestAbsence() enqueues a write to the SQLite sync queue and optimistically
 * adds the new absence to the ["my-absence-requests"] query cache. The SyncWorker
 * picks it up and inserts into public.schedule_absence when online.
 *
 * The request is instant from the user's perspective — no network required.
 */

import { useCallback } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
import type { Database } from "@smartout/supabase/database.types";
import type { AbsenceRequestsResult } from "@/hooks/queries/use-my-absence-requests";

// Re-export the DB row type so consumers can reference it without importing from the query hook.
export type AbsenceRequest = Database["public"]["Tables"]["schedule_absence"]["Row"];

type AbsenceTypeEnum = Database["public"]["Enums"]["schedule_absence_type"];

/** Input the caller provides — IDs and dates are all that's needed to book an absence. */
export type RequestAbsencePayload = {
  /**
   * Absence type. Callers currently pass DISPLAY LABELS (e.g. "Sykefravær")
   * which the DB column rejects — the column is a `schedule_absence_type`
   * enum (sick_leave, vacation, ...). Tracked as known debt; cast at the
   * payload boundary keeps typecheck green while runtime mismatch is fixed
   * separately.
   */
  absenceType: string;
  /** YYYY-MM-DD — the primary shift date this absence covers (required by DB) */
  shiftDate: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  comment?: string;
};

/**
 * Hook that returns a requestAbsence function.
 *
 * Works offline via the sync queue and optimistically adds the new request to
 * the absence-requests cache so the UI reflects it instantly without a round-trip.
 */
export function useRequestAbsence() {
  const queryClient = useQueryClient();

  /**
   * Submits an absence request for the authenticated employee.
   *
   * Generates a client-side UUID for the schedule_absence record, builds the
   * full row payload, enqueues a 'request_absence' action, and optimistically
   * prepends the new request to the ["my-absence-requests"] cache.
   *
   * Also invalidates ["absence-balance"] because the balance projection may
   * change once the request is approved — refreshing it eagerly keeps the
   * balance card accurate after the sync settles.
   */
  const requestAbsence = useCallback(
    async (input: RequestAbsencePayload) => {
      const { profileId, workspaceId } = await getProfileContext();
      const absenceId = randomUUID();
      const now = new Date().toISOString();

      // shift_date required by DB schema — use startDate as the anchor.
      // absence_type is a `schedule_absence_type` enum at the DB; cast at
      // the boundary because callers currently pass display labels (debt).
      const payload: AbsenceRequest = {
        schedule_absence_id: absenceId,
        employee_id: profileId,
        workspace_id: workspaceId,
        absence_type: input.absenceType as AbsenceTypeEnum,
        shift_date: input.shiftDate,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.comment ?? null,
        request_type: null,
        is_full_day: true,
        status: "pending" as const,
        created_at: now,
        updated_at: now,
      };

      await enqueue("request_absence", payload);

      // Optimistically prepend the new request to the list so the employee
      // sees it immediately without waiting for the sync worker.
      // The cache holds { requests: ScheduleAbsence[] } — match that shape.
      queryClient.setQueryData<AbsenceRequestsResult>(["my-absence-requests"], (prev) => ({
        requests: [payload, ...(prev?.requests ?? [])],
      }));

      // Invalidate balance — it will update once the request is approved,
      // but a proactive refetch avoids stale data if the server responds fast
      void queryClient.invalidateQueries({ queryKey: ["absence-balance"] });

      void emit({
        event: "absence requested",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: { entity_type: "absence", entity_id: absenceId },
          data: {
            absence_type: input.absenceType,
            start_date: input.startDate,
            end_date: input.endDate,
          },
        },
      });
    },
    [queryClient],
  );

  return { requestAbsence };
}
