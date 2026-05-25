/**
 * Hook: approve a locked payroll period.
 *
 * Closes P0 GAP-SIM-B02 — terminal state in payroll lifecycle
 * (open → locked → approved → exported).
 *
 * Calls POST /api/payroll/approve-period. BFF enforces:
 *   - gateAction (confirm-level, admin-only, chat channel)
 *   - status must be "locked" (cannot approve open or re-approve)
 *   - sets status→"approved", approved_at, approved_by
 *   - emits payroll.period_approved
 *
 * Returns { ok: false, error: "period_not_locked", status } if the period
 * is not in locked state.
 *
 * On success: invalidates period detail + list.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { payrollKeys } from "../../_hooks/payroll-keys";

type ApproveParams = {
  workspaceId: string;
  periodId: string;
};

type ApproveResult = {
  ok: boolean;
  error?: string;
  status?: string;
};

async function approvePeriod(params: ApproveParams): Promise<ApproveResult> {
  const res = await fetch("/api/payroll/approve-period", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace_id: params.workspaceId, period_id: params.periodId }),
  });

  const data = (await res.json()) as ApproveResult;
  // 409 = period_not_locked, handled by UI. Other non-OK = throw.
  if (!res.ok && res.status !== 409) {
    throw new Error(data.error ?? "approve_failed");
  }
  return data;
}

export function useApprovePeriod(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approvePeriod,
    onSuccess: (result) => {
      if (!result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.period(periodId),
      });
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.all,
      });
    },
  });
}
