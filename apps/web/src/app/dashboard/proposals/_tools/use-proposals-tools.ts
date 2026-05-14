"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-proposals-tools.ts — Botsson tools for the /dashboard/proposals surface.
 *
 * Five tools: 3 read, 1 nav, 1 filter.
 *   listProposals        — list proposals, optionally filtered by status
 *   getProposalDetail    — full detail for one proposal by change_proposal_id
 *   getPendingProposals  — convenience shortcut: pending proposals only + count
 *   openProposal         — navigate to /dashboard/proposals/[id]
 *   switchStatusFilter   — client-side status filter (pending|applied|rejected|all)
 *
 * dataRef pattern keeps definitions stable while implementations always read
 * the latest live data (same pattern as use-notifications-tools.ts).
 *
 * Scope: useRegisterTools("proposals", tools) — distinct from other scopes.
 *
 * Change proposals are C4 governance artefacts (change_proposal table).
 * This surface covers kind='wage_line_override'. Admin-only access.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ProposalListItem } from "../_hooks/use-payroll-proposals";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "pending" | "applied" | "rejected";

const VALID_STATUS_FILTERS: StatusFilter[] = ["all", "pending", "applied", "rejected"];

export type ProposalsToolInput = {
  /** All proposals currently loaded (list hook data). */
  proposals: ProposalListItem[];
  /** Active status filter in the list view. */
  activeFilter: StatusFilter;
  /** Client state setter: switch active status filter. */
  setActiveFilter: (filter: StatusFilter) => void;
  /** Navigation callback: push to /dashboard/proposals/[id]. */
  navigateToProposal: (id: string) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProposalsTools(input: ProposalsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listProposals",
          description:
            "List wage override proposals in the admin inbox. Filter by status (pending|applied|rejected|all). Use when admin asks 'hva venter på godkjenning?', 'vis alle forslag', or 'hvilke overrides er avvist?'.",
          dynamicParameters: [
            {
              name: "status",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["all", "pending", "applied", "rejected"],
                description:
                  "Proposal status to filter by. Omit or use 'all' to return everything.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getProposalDetail",
          description:
            "Get full detail for one change proposal — original amount, proposed amount, delta, reason, category, and status. Use when admin asks about a specific proposal or says 'vis detaljer for [id]'.",
          dynamicParameters: [
            {
              name: "proposalId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID (change_proposal_id) of the proposal to retrieve.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPendingProposals",
          description:
            "Get the number and list of proposals still waiting for admin approval. Use when admin asks 'hvor mange venter?' or 'trenger jeg å gjøre noe?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openProposal",
          description:
            "Navigate to the detail page for a specific proposal. Use when admin says 'åpne forslaget' or 'gå til [id]'.",
          dynamicParameters: [
            {
              name: "proposalId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID (change_proposal_id) of the proposal to open.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchStatusFilter",
          description:
            "Switch the visible status filter in the proposals inbox (pending|applied|rejected|all). Use when admin says 'vis bare godkjente' or 'filtrer på ventende'.",
          dynamicParameters: [
            {
              name: "status",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["all", "pending", "applied", "rejected"],
                description: "The status tab to activate.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      listProposals: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const status = (params.status as StatusFilter | undefined) ?? "all";
        let rows = d.proposals;

        if (status !== "all") {
          rows = rows.filter((p) => p.status === status);
        }

        return JSON.stringify({
          status,
          total: rows.length,
          proposals: rows.map((p) => ({
            id: p.change_proposal_id,
            status: p.status,
            kind: p.kind,
            proposer: p.profile?.display_name ?? "Ukjent",
            originalAmountCents: p.changes.original_amount_cents,
            proposedAmountCents: p.changes.proposed_amount_cents,
            reason: p.changes.reason,
            category: p.changes.category,
            createdAt: p.created_at,
          })),
        });
      },

      getProposalDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const proposalId = params.proposalId as string | undefined;
        if (!proposalId) {
          return JSON.stringify({ ok: false, reason: "proposalId is required" });
        }

        const proposal = d.proposals.find((p) => p.change_proposal_id === proposalId);
        if (!proposal) {
          return JSON.stringify({
            ok: false,
            reason: `Proposal '${proposalId}' not found in current view. Try navigating to the proposal detail page.`,
          });
        }

        const { changes } = proposal;
        const delta =
          changes.original_amount_cents !== undefined && changes.proposed_amount_cents !== undefined
            ? changes.proposed_amount_cents - changes.original_amount_cents
            : null;

        return JSON.stringify({
          ok: true,
          id: proposal.change_proposal_id,
          status: proposal.status,
          kind: proposal.kind,
          proposer: proposal.profile?.display_name ?? "Ukjent",
          originalAmountCents: changes.original_amount_cents,
          proposedAmountCents: changes.proposed_amount_cents,
          deltaCents: delta,
          reason: changes.reason,
          category: changes.category,
          periodId: changes.period_id,
          calculationId: changes.calculation_id,
          createdAt: proposal.created_at,
        });
      },

      getPendingProposals: () => {
        const d = dataRef.current;
        const pending = d.proposals.filter((p) => p.status === "pending");

        return JSON.stringify({
          pendingCount: pending.length,
          hasItemsRequiringAction: pending.length > 0,
          proposals: pending.map((p) => ({
            id: p.change_proposal_id,
            proposer: p.profile?.display_name ?? "Ukjent",
            originalAmountCents: p.changes.original_amount_cents,
            proposedAmountCents: p.changes.proposed_amount_cents,
            reason: p.changes.reason,
            createdAt: p.created_at,
          })),
        });
      },

      openProposal: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const proposalId = params.proposalId as string | undefined;
        if (!proposalId) {
          return JSON.stringify({ ok: false, reason: "proposalId is required" });
        }
        d.navigateToProposal(proposalId);
        return JSON.stringify({ ok: true, navigatingTo: `/dashboard/proposals/${proposalId}` });
      },

      switchStatusFilter: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const status = params.status as StatusFilter | undefined;
        if (!status || !VALID_STATUS_FILTERS.includes(status)) {
          return JSON.stringify({
            ok: false,
            reason: `Invalid status '${String(status)}'. Must be one of: ${VALID_STATUS_FILTERS.join(", ")}`,
          });
        }
        d.setActiveFilter(status);
        return JSON.stringify({ ok: true, activeFilter: status });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
