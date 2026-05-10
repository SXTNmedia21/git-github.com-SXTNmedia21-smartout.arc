/**
 * Hooks for line-override operations (T6.1, T4.2).
 *
 * usePendingOverrides — TanStack Query: polls GET /api/payroll/pending-line-overrides
 *   Returns a Set<string> of calculation_line_ids that have a pending override proposal.
 *   Used by LineDrawer to render "Venter godkjenning" badge (T4.2).
 *
 * useProposeLineOverride — TanStack Mutation: POST /api/payroll/propose-line-override
 *   Submits a new wage_line_override change_proposal.
 *   On success: toast + invalidate pending-overrides query.
 *   emit() is performed server-side in the BFF (ADR-0134).
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Query key factory ─────────────────────────────────────────────────────

export const overrideKeys = {
  pending: (periodId: string) => ["payroll", "pending-overrides", periodId] as const,
};

// ─── Types ─────────────────────────────────────────────────────────────────

type PendingOverride = {
  change_proposal_id: string;
  calculation_line_id: string;
  created_at: string;
  initiated_by: string;
};

type ProposeOverridePayload = {
  workspace_id: string;
  period_id: string;
  calculation_line_id: string;
  proposed_amount: number;
  reason: string;
  category: "manual_adjustment" | "tariff_interpretation" | "shift_data_error" | "other";
};

// ─── usePendingOverrides ───────────────────────────────────────────────────

/**
 * Fetches all pending wage_line_override proposals for a period.
 * Returns a Set<string> of calculation_line_ids for O(1) badge lookup.
 */
export function usePendingOverrides(periodId: string) {
  const query = useQuery<Set<string>>({
    queryKey: overrideKeys.pending(periodId),
    queryFn: async () => {
      const res = await fetch(
        `/api/payroll/pending-line-overrides?periodId=${encodeURIComponent(periodId)}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { ok: boolean; pending: PendingOverride[] };
      return new Set(data.pending.map((p) => p.calculation_line_id));
    },
    staleTime: 30 * 1000, // 30s — badge state is low-stakes, don't hammer on every keystroke
    retry: 1,
    enabled: !!periodId,
  });

  return query;
}

// ─── useProposeLineOverride ────────────────────────────────────────────────

/**
 * Mutation: submit a wage_line_override change_proposal.
 * Invalidates pending-overrides cache on success.
 */
export function useProposeLineOverride(periodId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation<{ change_proposal_id: string }, Error, ProposeOverridePayload>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/payroll/propose-line-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        change_proposal_id?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return { change_proposal_id: data.change_proposal_id! };
    },
    onSuccess: () => {
      toast.success("Forslag sendt til admin for godkjenning.");
      void queryClient.invalidateQueries({ queryKey: overrideKeys.pending(periodId) });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(`Kunne ikke sende forslag: ${err.message}`);
    },
  });
}
