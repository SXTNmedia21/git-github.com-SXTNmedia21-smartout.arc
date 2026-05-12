/**
 * Mutation hook — create a new payroll period for the workspace.
 *
 * On success:
 *   - Shows sonner toast "Periode opprettet"
 *   - Invalidates the periods list query so the new period appears immediately
 *
 * On error:
 *   - Shows sonner toast with a human-readable Norwegian message
 *   - 409 duplicate_period is translated to a clear explanation
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { payrollKeys } from "./payroll-keys";

type CreatePeriodInput = {
  workspaceId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

type CreatePeriodResult = {
  period_id: string;
  status: string;
};

export function useCreatePeriod() {
  const queryClient = useQueryClient();

  return useMutation<CreatePeriodResult, Error, CreatePeriodInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/payroll/create-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: input.workspaceId,
          start_date: input.startDate,
          end_date: input.endDate,
        }),
      });

      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
        period_id?: string;
        status?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return body as CreatePeriodResult;
    },
    onSuccess: (_data, variables) => {
      toast.success("Periode opprettet");
      // Invalidate periods list for this workspace so new period appears.
      void queryClient.invalidateQueries({ queryKey: payrollKeys.periods(variables.workspaceId) });
    },
    onError: (err) => {
      const detail =
        err.message === "duplicate_period"
          ? "Periode finnes allerede for disse datoene"
          : err.message;
      toast.error(`Kunne ikke opprette periode: ${detail}`);
    },
  });
}
