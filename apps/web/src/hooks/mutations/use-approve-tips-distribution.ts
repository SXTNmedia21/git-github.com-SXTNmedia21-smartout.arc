"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

// Response shape from POST /api/tips/approve-distribution (Phase 2 contract).
type ApproveTipsDistributionOk = {
  ok: true;
  pool_id: string;
  total_distributed: number;
  distribution_count: number;
  adjustment_count: number;
};

type ApproveTipsDistributionError = {
  ok: false;
  error: string;
};

type ApproveTipsDistributionResponse = ApproveTipsDistributionOk | ApproveTipsDistributionError;

// Variables sent to the BFF — pool_id for the mutation, session id for cache
// invalidation only.
// `department_session_id` is NOT sent to the BFF; it is used only for
// invalidating ["tips-pool", department_session_id] after success (ADR-0151).
export type ApproveTipsDistributionVariables = {
  pool_id: string;
  // Used for invalidation only — not forwarded to the BFF body.
  department_session_id: string;
};

/**
 * useApproveTipsDistribution — mutation that POSTs to /api/tips/approve-distribution.
 *
 * On success, invalidates ["tips-pool", department_session_id] so the UI
 * reflects the pool's new `approved` status and locked distribution amounts.
 *
 * Throws when the BFF returns ok:false — callers can handle via onError.
 */
export function useApproveTipsDistribution() {
  const queryClient = useQueryClient();

  return useMutation<ApproveTipsDistributionOk, Error, ApproveTipsDistributionVariables>({
    mutationFn: async (variables) => {
      // BFF body — pool_id only. No identity fields, no department_session_id (ADR-0151).
      const body = { pool_id: variables.pool_id };

      const response = await fetch("/api/tips/approve-distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const json = (await response.json()) as ApproveTipsDistributionResponse;

      if (!json.ok) {
        throw new Error(json.error);
      }

      return json;
    },
    onSuccess: (_data, variables) => {
      // Invalidate pool view for the session — pool.status is now 'approved'.
      void queryClient.invalidateQueries({
        queryKey: ["tips-pool", variables.department_session_id],
      });
    },
  });
}
