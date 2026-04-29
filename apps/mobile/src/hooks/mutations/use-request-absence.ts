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
export type AbsenceType = Database["public"]["Enums"]["schedule_absence_type"];

const ABSENCE_TYPE_VALUES = new Set<AbsenceType>([
  "sick_leave",
  "parental_leave",
  "vacation",
  "unpaid_leave",
  "military",
  "training",
  "welfare",
]);

// Coerce a free-text label / payroll category to the public.schedule_absence_type enum.
// Unknown values fall back to "unpaid_leave" so the row stays insertable.
function coerceAbsenceType(value: string): AbsenceType {
  if (ABSENCE_TYPE_VALUES.has(value as AbsenceType)) return value as AbsenceType;
  const v = value.toLowerCase();
  if (v.includes("sick") || v.includes("syk") || v.includes("egenmelding")) return "sick_leave";
  if (v.includes("parental") || v.includes("foreldre") || v.includes("omsorg"))
    return "parental_leave";
  if (v.includes("ferie") || v.includes("vacation")) return "vacation";
  if (v.includes("military") || v.includes("militær")) return "military";
  if (v.includes("training") || v.includes("kurs") || v.includes("opplæring")) return "training";
  if (v.includes("welfare") || v.includes("velferd")) return "welfare";
  return "unpaid_leave";
}

/** Input the caller provides — IDs and dates are all that's needed to book an absence. */
export type RequestAbsencePayload = {
  /** Free-text label or category — coerced to schedule_absence_type enum at write time */
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

      // schedule_absence.absence_type is the schedule_absence_type enum — coerce
      // free-text labels / categories at write time so unknown values stay safe.
      // shift_date is required by the DB schema — use startDate as the anchor.
      const coercedType = coerceAbsenceType(input.absenceType);
      const payload: AbsenceRequest = {
        schedule_absence_id: absenceId,
        employee_id: profileId,
        workspace_id: workspaceId,
        absence_type: coercedType,
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
            absence_type: coercedType,
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
