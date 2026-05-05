"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

// Response shape from POST /api/tips/adjust-share (Phase 2 contract).
type AdjustTipsShareOk = {
  ok: true;
  distribution_id: string;
  old_amount: number;
  new_amount: number;
};

type AdjustTipsShareError = {
  ok: false;
  error: string;
};

type AdjustTipsShareResponse = AdjustTipsShareOk | AdjustTipsShareError;

// Variables sent to the BFF — domain fields + session id for cache invalidation.
// `department_session_id` is NOT sent to the BFF; it is used only for
// invalidating ["tips-pool", department_session_id] after success (ADR-0151).
export type AdjustTipsShareVariables = {
  distribution_id: string;
  new_amount: number;
  reason: string;
  // Used for invalidation only — not forwarded to the BFF body.
  department_session_id: string;
};

/**
 * useAdjustTipsShare — mutation that POSTs to /api/tips/adjust-share.
 *
 * On success, invalidates:
 *   - ["tips-pool", department_session_id] — refresh pool + distribution view
 *   - ["tip-adjustment-log", distribution_id] — refresh the adjustment log
 *
 * The wildcard invalidation for ["tips-pool"] uses an exact session key derived
 * from `variables.department_session_id` to avoid over-broadcasting.
 *
 * Throws when the BFF returns ok:false — callers can handle via onError.
 */
export function useAdjustTipsShare() {
  const queryClient = useQueryClient();

  return useMutation<AdjustTipsShareOk, Error, AdjustTipsShareVariables>({
    mutationFn: async (variables) => {
      // BFF body — no identity fields, no department_session_id (ADR-0151).
      const body = {
        distribution_id: variables.distribution_id,
        new_amount: variables.new_amount,
        reason: variables.reason,
      };

      const response = await fetch("/api/tips/adjust-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const json = (await response.json()) as AdjustTipsShareResponse;

      if (!json.ok) {
        throw new Error(json.error);
      }

      return json;
    },
    onSuccess: (_data, variables) => {
      // Invalidate pool view for the parent session.
      void queryClient.invalidateQueries({
        queryKey: ["tips-pool", variables.department_session_id],
      });

      // Invalidate adjustment log for the specific distribution.
      void queryClient.invalidateQueries({
        queryKey: ["tip-adjustment-log", variables.distribution_id],
      });
    },
  });
}
