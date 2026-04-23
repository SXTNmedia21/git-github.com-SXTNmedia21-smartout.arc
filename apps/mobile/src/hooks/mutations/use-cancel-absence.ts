/**
 * Offline-first absence cancellation mutation.
 *
 * cancelAbsence() enqueues a write to the SQLite sync queue and optimistically
 * flips the status to "cancelled" in the ["my-absence-requests"] query cache.
 * The SyncWorker picks it up and updates public.schedule_absence when online.
 *
 * Guard: callers are responsible for only invoking this on status="pending" rows.
 * The action-map will still execute if called on other statuses, but the server
 * may reject the update depending on business rules.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";
import type { AbsenceRequestsResult } from "@/hooks/queries/use-my-absence-requests";

/**
 * Hook that returns a cancelAbsence function.
 *
 * Works offline via the sync queue and optimistically updates the absence status
 * in the cache so the UI reflects the cancellation instantly.
 */
export function useCancelAbsence() {
  const queryClient = useQueryClient();

  /**
   * Cancels a pending absence request by ID.
   *
   * Enqueues a 'cancel_absence' action with the target ID and desired status,
   * then optimistically patches the matching entry in ["my-absence-requests"]
   * so the UI stops showing the request as pending without a round-trip.
   *
   * Also invalidates ["absence-balance"] since the projected days-off balance
   * may change now that this request will no longer be approved.
   */
  const cancelAbsence = useCallback(
    async (scheduleAbsenceId: string) => {
      // absence_status enum only has: "pending" | "approved" | "rejected"
      // There is no "cancelled" value — use "rejected" to represent
      // an employee-initiated withdrawal of their own pending request.
      const payload = {
        schedule_absence_id: scheduleAbsenceId,
        status: "rejected" as const,
      };

      await enqueue("cancel_absence", payload);

      // Optimistically flip the status in cache so the list updates instantly.
      // The cache holds { requests: ScheduleAbsence[] } — match that shape.
      // Match by schedule_absence_id (the real DB PK, not "id").
      queryClient.setQueryData<AbsenceRequestsResult>(["my-absence-requests"], (prev) => ({
        requests:
          prev?.requests.map((request) =>
            request.schedule_absence_id === scheduleAbsenceId
              ? { ...request, status: "rejected" as const }
              : request,
          ) ?? [],
      }));

      // Invalidate balance — the cancelled request is no longer pending approval,
      // so the projected balance should be recalculated
      void queryClient.invalidateQueries({ queryKey: ["absence-balance"] });

      // Resolve workspace_id + actor_id before emit per ADR-0134.
      // getProfileContext() throws on missing auth — fail fast rather than
      // emitting corrupt telemetry with empty IDs.
      const { profileId, workspaceId } = await getProfileContext();

      void emit({
        event: "absence cancelled",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity: { entity_type: "absence", entity_id: scheduleAbsenceId },
          data: { absence_id: scheduleAbsenceId },
        },
      });
    },
    [queryClient],
  );

  return { cancelAbsence };
}
