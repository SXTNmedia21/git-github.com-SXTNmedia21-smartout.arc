/**
 * Hook: lock a payroll period.
 *
 * Phase 1 implementation: calls POST /api/payroll/lock-period BFF route.
 * The BFF enforces: gateAction check, unack'd error guard, status→"locked"
 * update, telemetry emit (`payroll.period_locked`).
 *
 * If the period has unacknowledged deviations of severity=error, the BFF
 * returns { ok: false, error: "unacked_errors", unacked: N } and the lock
 * is rejected. The UI shows a modal warning before calling this hook.
 *
 * On success: invalidates the period query and the period list.
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { payrollKeys } from "../../_hooks/payroll-keys";

type LockParams = {
  periodId: string;
};

type LockResult = {
  ok: boolean;
  error?: string;
  unacked?: number;
};

async function lockPeriod(params: LockParams): Promise<LockResult> {
  const res = await fetch("/api/payroll/lock-period", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ period_id: params.periodId }),
  });

  const data = (await res.json()) as LockResult;
  if (!res.ok && res.status !== 409) {
    throw new Error(data.error ?? "lock_failed");
  }
  return data;
}

export function useLockPeriod(periodId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: lockPeriod,
    onSuccess: (result) => {
      if (!result.ok) return; // 409 unacked — UI handles the error display
      // Invalidate period detail + list on successful lock
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.period(periodId),
      });
      void queryClient.invalidateQueries({
        queryKey: payrollKeys.all,
      });
    },
  });
}
