"use client";

/**
 * use-proposed-plan.ts
 *
 * TanStack Query hooks for the manager proposed-plan view.
 *
 * Queries:
 *   useProposals  — fetches pending scheduler bundle proposals from BFF.
 *
 * Mutations:
 *   useAcceptBundle  — atomic all-or-nothing accept (POST /api/scheduler/accept-bundle).
 *   useRejectBundle  — rejects the bundle (POST /api/scheduler/reject-bundle).
 *
 * Auth: cookie-session (web dashboard). BFF derives identity server-side (ADR-0151).
 * Telemetry: emit() delegated to BFF per ADR-0134. No client-side emit calls.
 *
 * ADR references:
 *   ADR-0021  (server + client split — this file is the client data layer)
 *   ADR-0099  (gate_action enforced in BFF)
 *   ADR-0134  (emit on mutation — enforced in BFF)
 *   ADR-0151  (server-derived identity)
 *   ADR-0287  (single-call mutateWithGate — BFF delegates to capability tool)
 *   ADR-0309  (atomic accept V1 — single change_proposal row, no per-row toggle)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposedShift = {
  shift_id_proposed: string;
  department_id: string;
  start_at: string;
  end_at: string;
  position_id: string | null;
  assigned_profile_id: string;
  rationale: string;
  tariff_rule_ids: string[];
};

export type ProposalGap = {
  department_id: string;
  start_at: string;
  end_at: string;
  position_id: string | null;
  blocker_codes: string[];
};

export type ProposalChanges = {
  solver_version: string;
  solver_run_id: string;
  solver_inputs_hash: string;
  objective_score: number;
  gap_count: number;
  proposed_shifts: ProposedShift[];
  gaps: ProposalGap[];
};

export type SchedulerProposal = {
  change_proposal_id: string;
  kind: string;
  status: string;
  trigger_type: string;
  initiated_by: string | null;
  created_at: string;
  solver_version: string | null;
  solver_run_id: string | null;
  objective_score: number | null;
  gap_count: number | null;
  proposed_shift_count: number | null;
};

export type ProposalsResponse = {
  ok: boolean;
  proposals: SchedulerProposal[];
};

// ── Full proposal (with JSONB detail) ────────────────────────────────────────

export type FullProposalResponse = {
  ok: boolean;
  proposals: Array<
    SchedulerProposal & {
      changes: ProposalChanges | null;
    }
  >;
};

// ── Query key ─────────────────────────────────────────────────────────────────
const PROPOSALS_KEY = ["dashboard", "schedule", "proposed-plan"] as const;

// ── BFF helpers ───────────────────────────────────────────────────────────────

async function bffGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function bffPost<TBody extends Record<string, unknown>, T = unknown>(
  path: string,
  body: TBody,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; reason?: string };
      msg = j.reason ?? j.error ?? msg;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Query: pending proposals ──────────────────────────────────────────────────

export function useProposals() {
  return useQuery<ProposalsResponse>({
    queryKey: PROPOSALS_KEY,
    queryFn: () => bffGet<ProposalsResponse>("/api/scheduler/proposals?status=pending&limit=10"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAcceptBundle() {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; message?: string }, Error, { change_proposal_id: string }>({
    mutationFn: ({ change_proposal_id }) =>
      bffPost("/api/scheduler/accept-bundle", { change_proposal_id }),
    onSuccess: () => {
      // emit() delegated to BFF per ADR-0134
      toast.success("Plan godtatt — vaktene er opprettet.");
      void qc.invalidateQueries({ queryKey: PROPOSALS_KEY });
    },
    onError: (err) => {
      toast.error(`Godkjenning feilet: ${err.message}`);
    },
  });
}

export function useRejectBundle() {
  const qc = useQueryClient();

  return useMutation<
    { ok: boolean; message?: string },
    Error,
    { change_proposal_id: string; reason?: string }
  >({
    mutationFn: ({ change_proposal_id, reason }) =>
      bffPost("/api/scheduler/reject-bundle", { change_proposal_id, reason }),
    onSuccess: () => {
      // emit() delegated to BFF per ADR-0134
      toast.success("Plan avvist.");
      void qc.invalidateQueries({ queryKey: PROPOSALS_KEY });
    },
    onError: (err) => {
      toast.error(`Avvisning feilet: ${err.message}`);
    },
  });
}
