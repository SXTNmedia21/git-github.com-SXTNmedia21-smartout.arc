"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

// Response shape from POST /api/tips/set-pot (Phase 2 contract).
type SetTipsPotOk = {
  ok: true;
  pool_id: string;
  distribution_count: number;
  total_calculated: number;
};

type SetTipsPotError = {
  ok: false;
  error: string;
};

type SetTipsPotResponse = SetTipsPotOk | SetTipsPotError;

// Variables sent to the BFF — domain fields only (ADR-0151: no identity fields).
export type SetTipsPotVariables = {
  department_session_id: string;
  amount_nok: number;
  notes?: string;
};

/**
 * useSetTipsPot — mutation that POSTs to /api/tips/set-pot.
 *
 * On success, invalidates ["tips-pool", department_session_id] so the
 * useTipsPool query re-fetches the newly created pool + distributions.
 *
 * Throws when the BFF returns ok:false — callers can handle via onError.
 */
export function useSetTipsPot() {
  const queryClient = useQueryClient();

  return useMutation<SetTipsPotOk, Error, SetTipsPotVariables>({
    mutationFn: async (variables) => {
      const { department_session_id, amount_nok, notes } = variables;

      // Build body — no identity fields (workspace_id + profile_id are BFF concern).
      const body: Record<string, unknown> = { department_session_id, amount_nok };
      if (notes !== undefined) body.notes = notes;

      const response = await fetch("/api/tips/set-pot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const json = (await response.json()) as SetTipsPotResponse;

      if (!json.ok) {
        throw new Error(json.error);
      }

      return json;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["tips-pool", variables.department_session_id],
      });
    },
  });
}
