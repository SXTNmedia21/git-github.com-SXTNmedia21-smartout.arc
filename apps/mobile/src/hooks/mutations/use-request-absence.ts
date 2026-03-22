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
import { supabase } from "@/lib/supabase";

/** Shape of the public absence row we track in the local cache. */
export type AbsenceRequest = {
  id: string;
  employee_id: string;
  workspace_id: string;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  comment: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
};

/** Input the caller provides — IDs and dates are all that's needed to book an absence. */
export type RequestAbsencePayload = {
  absenceTypeId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  comment?: string;
};

/**
 * Fetches profile_id and workspace_id for the current user.
 * Same pattern as use-punch.ts — reused to avoid a shared helper dependency.
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

      const payload = {
        id: absenceId,
        employee_id: profileId,
        workspace_id: workspaceId,
        absence_type_id: input.absenceTypeId,
        start_date: input.startDate,
        end_date: input.endDate,
        comment: input.comment ?? null,
        status: "pending" as const,
      };

      await enqueue("request_absence", payload);

      // Optimistically add the new request to the top of the list so the
      // employee sees it immediately without waiting for the sync worker
      queryClient.setQueryData<AbsenceRequest[]>(["my-absence-requests"], (prev) => [
        {
          ...payload,
          created_at: now,
        },
        ...(prev ?? []),
      ]);

      // Invalidate balance — it will update once the request is approved,
      // but a proactive refetch avoids stale data if the server responds fast
      void queryClient.invalidateQueries({ queryKey: ["absence-balance"] });
    },
    [queryClient],
  );

  return { requestAbsence };
}
