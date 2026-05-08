"use client";

/**
 * use-payroll-proposals.ts
 *
 * TanStack Query hooks for the proposals inbox (T6.1).
 *
 * Three hooks:
 *   usePayrollProposals()      — list pending wage_line_override proposals
 *   usePayrollProposal(id)     — detail + audit trail for one proposal
 *   useApproveProposal()       — mutation: approve → calls approve-proposal BFF
 *   useRejectProposal()        — mutation: reject → calls reject-proposal BFF
 *
 * emit() is called in onSuccess per project convention (ADR-0134). Navigation-
 * level events (list_viewed, detail_viewed) are skipped — the proposal actions
 * themselves are the meaningful audit points.
 *
 * Key-shape: proposalKeys — prevents TanStack Query cache collisions (L-0178
 * shape-collision pattern: unique keys per shape, not shared with other hooks).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── API types ──────────────────────────────────────────────────────────────

export type ProposalProfile = {
  profile_id: string;
  display_name: string | null;
};

export type ProposalChanges = {
  calculation_id?: string;
  calculation_line_id?: string;
  original_amount_cents?: number;
  proposed_amount_cents?: number;
  reason?: string;
  category?: string;
  period_id?: string;
  rejection_reason?: string;
};

export type ProposalListItem = {
  change_proposal_id: string;
  workspace_id: string;
  status: "pending" | "applied" | "rejected";
  kind: string;
  changes: ProposalChanges;
  initiated_by: string;
  created_at: string;
  profile: ProposalProfile | null;
};

export type AuditTrailRow = {
  id: string;
  event_type: string;
  actor_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type ProposalDetail = ProposalListItem & {
  resolved_by: string | null;
  resolved_at: string | null;
  resolver: ProposalProfile | null;
};

// ─── Query keys ─────────────────────────────────────────────────────────────
// Separate keys per shape per L-0178 / TanStack Query shape-collision pattern.

export const proposalKeys = {
  list: ["payroll", "proposals", "list"] as const,
  detail: (id: string) => ["payroll", "proposals", "detail", id] as const,
};

// ─── Fetchers ────────────────────────────────────────────────────────────────

async function fetchProposals(): Promise<ProposalListItem[]> {
  const res = await fetch("/api/payroll/proposals", {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `proposals fetch failed (${res.status})`);
  }
  const data = (await res.json()) as { ok: boolean; proposals: ProposalListItem[] };
  return data.proposals;
}

async function fetchProposal(proposalId: string): Promise<{
  proposal: ProposalDetail;
  audit: AuditTrailRow[];
}> {
  const res = await fetch(`/api/payroll/proposals/${proposalId}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `proposal fetch failed (${res.status})`);
  }
  return res.json() as Promise<{ proposal: ProposalDetail; audit: AuditTrailRow[] }>;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * usePayrollProposals — list of pending wage_line_override proposals.
 * Refetches every 30 s so inbox stays live without manual refresh.
 */
export function usePayrollProposals() {
  return useQuery({
    queryKey: proposalKeys.list,
    queryFn: fetchProposals,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/**
 * usePayrollProposal — single proposal detail + audit trail.
 */
export function usePayrollProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: proposalId
      ? proposalKeys.detail(proposalId)
      : ["payroll", "proposals", "detail", "__noop"],
    queryFn: () => fetchProposal(proposalId!),
    enabled: Boolean(proposalId),
    staleTime: 10_000,
  });
}

// ─── Approve mutation ────────────────────────────────────────────────────────

type ApproveArgs = { change_proposal_id: string };

type ApproveResult = {
  ok: boolean;
  change_proposal_id: string;
  new_calculation_id?: string;
  new_calculation_version?: number;
  supersession_event_id?: string;
  period_id?: string;
  idempotent?: boolean;
};

/**
 * useApproveProposal — mutation that approves a wage_line_override proposal.
 *
 * On success:
 *   - Invalidates proposals list (inbox clears the row)
 *   - Invalidates the individual proposal detail
 *   - Caller receives period_id to redirect to payroll period
 *   - Toast shown from mutation options — caller can override via onSuccess
 */
export function useApproveProposal() {
  const queryClient = useQueryClient();

  return useMutation<ApproveResult, Error, ApproveArgs>({
    mutationFn: async (args) => {
      const res = await fetch("/api/payroll/approve-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ change_proposal_id: args.change_proposal_id }),
      });
      const body = (await res.json()) as ApproveResult & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `approve failed (${res.status})`);
      }
      return body;
    },
    onSuccess: (_data, _vars) => {
      void queryClient.invalidateQueries({ queryKey: proposalKeys.list });
      void queryClient.invalidateQueries({
        queryKey: proposalKeys.detail(_vars.change_proposal_id),
      });
    },
    onError: (err) => {
      toast.error(`Godkjenning feilet: ${err.message}`);
    },
  });
}

// ─── Reject mutation ─────────────────────────────────────────────────────────

type RejectArgs = { change_proposal_id: string; rejection_reason: string };

type RejectResult = {
  ok: boolean;
  change_proposal_id: string;
  status: "rejected";
  idempotent?: boolean;
};

/**
 * useRejectProposal — mutation that rejects a wage_line_override proposal.
 *
 * rejection_reason is required (validated server-side as well).
 * On success: invalidates list + detail; caller handles toast and navigation.
 */
export function useRejectProposal() {
  const queryClient = useQueryClient();

  return useMutation<RejectResult, Error, RejectArgs>({
    mutationFn: async (args) => {
      const res = await fetch("/api/payroll/reject-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          change_proposal_id: args.change_proposal_id,
          rejection_reason: args.rejection_reason,
        }),
      });
      const body = (await res.json()) as RejectResult & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `reject failed (${res.status})`);
      }
      return body;
    },
    onSuccess: (_data, _vars) => {
      void queryClient.invalidateQueries({ queryKey: proposalKeys.list });
      void queryClient.invalidateQueries({
        queryKey: proposalKeys.detail(_vars.change_proposal_id),
      });
    },
    onError: (err) => {
      toast.error(`Avvisning feilet: ${err.message}`);
    },
  });
}
