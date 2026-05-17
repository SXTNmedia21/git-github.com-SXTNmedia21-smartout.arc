/**
 * Hooks for line-override operations (T6.1, T4.2, SMA-328).
 *
 * usePendingOverrides — TanStack Query: polls GET /api/payroll/pending-line-overrides
 *   Returns a Set<string> of calculation_line_ids that have a pending override proposal.
 *   Used by LineDrawer to render "Venter godkjenning" badge (T4.2).
 *
 * useProposeLineOverride — TanStack Mutation: POST /api/payroll/propose-line-override
 *   Submits a new wage_line_override change_proposal.
 *   On success: toast + invalidate pending-overrides query.
 *   emit() is performed server-side in the BFF (ADR-0134).
 *
 * useDeductionConsents — TanStack Query: GET /api/payroll/deduction-consents
 *   SMA-328: fetches active payroll.consent_document rows for an employee.
 *   Used by LineOverrideModal to populate the consent picker for category='deduction'.
 */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Query key factory ─────────────────────────────────────────────────────

export const overrideKeys = {
  pending: (periodId: string) => ["payroll", "pending-overrides", periodId] as const,
  deductionConsents: (profileId: string) => ["payroll", "deduction-consents", profileId] as const,
};

// ─── Types ─────────────────────────────────────────────────────────────────

type PendingOverride = {
  change_proposal_id: string;
  calculation_line_id: string;
  created_at: string;
  initiated_by: string;
};

// SMA-328: Deduction consent document row (from payroll.consent_document).
export type DeductionConsent = {
  id: string;
  consent_type: string;
  signed_at: string;
  signed_document_url: string;
  expires_at: string | null;
};

type DeductionConsentsResponse = {
  ok: boolean;
  consents: DeductionConsent[];
};

type ProposeOverridePayload = {
  workspace_id: string;
  period_id: string;
  calculation_line_id: string;
  // SMA-328: negative for deduction, positive for all other categories.
  proposed_amount: number;
  reason: string;
  category:
    | "manual_adjustment"
    | "tariff_interpretation"
    | "shift_data_error"
    | "other"
    | "deduction";
  // SMA-328: required when category='deduction'.
  consent_document_id?: string;
  deduction_type?:
    | "loan_agreement"
    | "uniform_policy"
    | "union_dues"
    | "court_order"
    | "other_voluntary";
};

// ─── usePendingOverrides ───────────────────────────────────────────────────

/**
 * Fetches all pending wage_line_override proposals for a period.
 * Returns a Set<string> of calculation_line_ids for O(1) badge lookup.
 */
export function usePendingOverrides(periodId: string, workspaceId: string) {
  const query = useQuery<Set<string>>({
    queryKey: overrideKeys.pending(periodId),
    queryFn: async () => {
      const url = `/api/payroll/pending-line-overrides?periodId=${encodeURIComponent(periodId)}&workspaceId=${encodeURIComponent(workspaceId)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { ok: boolean; pending: PendingOverride[] };
      return new Set(data.pending.map((p) => p.calculation_line_id));
    },
    staleTime: 30 * 1000, // 30s — badge state is low-stakes, don't hammer on every keystroke
    retry: 1,
    enabled: !!periodId && !!workspaceId,
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

// ─── useDeductionConsents ──────────────────────────────────────────────────

/**
 * SMA-328 / ADR-0311: Fetch active payroll.consent_document rows for an employee.
 * Used by LineOverrideModal when category='deduction' to populate the consent picker.
 *
 * workspaceId is server-derived in the BFF — only profileId is sent (ADR-0151).
 * enabled flag: only fetch when category='deduction' and profileId is known.
 */
export function useDeductionConsents(profileId: string | null, enabled: boolean) {
  return useQuery<DeductionConsentsResponse>({
    queryKey: overrideKeys.deductionConsents(profileId ?? ""),
    queryFn: async () => {
      if (!profileId) return { ok: true, consents: [] };
      const url = `/api/payroll/deduction-consents?profileId=${encodeURIComponent(profileId)}`;
      const res = await fetch(url, { method: "GET" });
      const data = (await res.json()) as DeductionConsentsResponse & { error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      return data;
    },
    enabled: enabled && !!profileId,
    staleTime: 60 * 1000, // 1 minute — consent documents don't change frequently
    retry: 1,
  });
}
