"use client";

/**
 * use-create-deviation.ts — thin wrapper over reportDeviationAction.
 *
 * WHY: preserves the hook signature so every call-site continues to use
 * `useCreateDeviation()` as a TanStack Query useMutation. The actual
 * mutation is now the Server Action `reportDeviationAction`, which owns
 * gate_action + admin insert + awaited emit (ADR-0114 closure).
 *
 * The direct supabase.from("deviation").insert() + client-side void emit()
 * that previously lived in mutationFn + onSuccess have been removed.
 * Toast handling stays here so call-sites need zero changes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeviationPayload } from "@smartout/hms";
import { toast } from "sonner";
import { reportDeviationAction } from "@/app/dashboard/_actions/report-deviation-action";

export function useCreateDeviation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<DeviationPayload, "workspace_id" | "reported_by">) => {
      // workspace_id + reported_by are resolved server-side per ADR-0151.
      // channel defaults to "chat" (web surface).
      const result = await reportDeviationAction(input);
      if (result.ok === false) throw new Error(result.error);
      return result.deviationId;
    },
    onSuccess: () => {
      // emit() is now server-side + awaited inside reportDeviationAction.
      // No client-side emit here (ADR-0114 closure).
      queryClient.invalidateQueries({ queryKey: ["hms", "deviations"] });
      toast.success("Avvik meldt");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke melde avvik: ${error.message}`);
    },
  });
}
