"use client";

/**
 * use-update-deviation.ts — Thin TanStack mutation wrapper for deviation status updates.
 *
 * WHY: Previously performed `supabase.from("deviation").update(...)` directly from
 * the browser anon client with fire-and-forget `void emit()`. This violated:
 *   - ADR-0099: no gate_action() RPC
 *   - ADR-0114: client-side DB write
 *   - ADR-0151: workspace_id resolved client-side
 *   - ADR-0134: fire-and-forget emit
 *
 * NOW: Delegates to gated Server Actions in `_actions/update-deviation-action.ts`.
 * All gate_action, admin-client write, server-resolved IDs, and awaited emit
 * live in the Server Action. This hook is a thin TanStack mutation adapter only.
 *
 * Sortie 1 of M5 HMS 4-sortie sequence. Council-verified 2026-05-17.
 * ADR refs: 0099, 0114, 0134, 0151, 0204.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  resolveDeviationAction,
  acknowledgeDeviationAction,
  escalateDeviationAction,
} from "@/app/dashboard/_actions/update-deviation-action";
import { toast } from "sonner";

type UpdateDeviationInput =
  | { deviationId: string; action: "status"; status: "acknowledged" | "escalated" }
  | { deviationId: string; action: "resolve"; resolutionNotes: string };

export function useUpdateDeviation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateDeviationInput) => {
      if (input.action === "resolve") {
        const result = await resolveDeviationAction({
          deviation_id: input.deviationId,
          resolution_notes: input.resolutionNotes,
        });
        if (!result.ok) throw new Error(result.error);
        return input;
      }

      if (input.status === "acknowledged") {
        const result = await acknowledgeDeviationAction({
          deviation_id: input.deviationId,
        });
        if (!result.ok) throw new Error(result.error);
        return input;
      }

      // status === "escalated"
      const result = await escalateDeviationAction({
        deviation_id: input.deviationId,
      });
      if (!result.ok) throw new Error(result.error);
      return input;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["hms", "deviations"] });
      toast.success(result.action === "resolve" ? "Avvik lukket" : "Avvik oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere avvik: ${error.message}`);
    },
  });
}
