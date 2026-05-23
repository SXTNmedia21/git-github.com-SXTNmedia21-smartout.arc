"use client";

/**
 * use-routine-mutations.ts
 *
 * TanStack Query mutations for routine authoring (procedure-engine Phase 1).
 * Pattern mirrors use-governance-mutations.ts exactly:
 *   - useMutation wraps a Server Action (create-routine-action.ts)
 *   - emit() in onSuccess with registered events (routine.created is emitted
 *     inside the server action; client emits "button clicked" for UI funnel)
 *   - invalidateQueries on success to refresh governance overview
 *
 * Connected to: RoutineForm.tsx
 */

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";
import {
  createRoutineAction,
  type CreateRoutineInput,
} from "@/app/dashboard/governance/_actions/create-routine-action";

export function useCreateRoutine() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: CreateRoutineInput) => {
      const result = await createRoutineAction(input);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result;
    },

    onSuccess: (data) => {
      // Registered events (routine.created + routine.assigned_to_location) are
      // emitted inside the server action. Client-side "button clicked" retained
      // for UI funnel tracking — same pattern as useUpdateProtocol.
      void emit({
        event: "button clicked",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          trackingId: "governance-routine-created",
          context: data.routine_id,
        },
      });
      toast.success("Rutine opprettet og knyttet til lokasjon");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      // Invalidate any routine-specific query keys.
      void queryClient.invalidateQueries({
        queryKey: ["routines", workspace.workspace_id],
      });
    },

    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Kunne ikke opprette rutine");
    },
  });
}
