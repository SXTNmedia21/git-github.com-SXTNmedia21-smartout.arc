"use client";

/**
 * proposals-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/proposals surface.
 *
 * Why a bridge:
 *  - Keeps ProposalsListClient clean from voice-tool registration concerns.
 *  - Mounts only when proposals data is non-null (avoids tools returning
 *    empty state before the first fetch completes).
 *
 * Data sourcing:
 *  - Receives live proposals list + filter state + callbacks from the parent.
 *    No duplicate fetch — parent already holds usePayrollProposals result.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 *
 * ADR-0238: proposals page does NOT own a domain chat surface — Orb remains
 * interactive. No <DomainChatOwnership> declaration needed.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useProposalsTools } from "./use-proposals-tools";
import type { ProposalListItem } from "../_hooks/use-payroll-proposals";

type StatusFilter = "all" | "pending" | "applied" | "rejected";

type ProposalsToolsBridgeProps = {
  proposals: ProposalListItem[];
  activeFilter: StatusFilter;
  setActiveFilter: (filter: StatusFilter) => void;
  navigateToProposal: (id: string) => void;
};

export function ProposalsToolsBridge({
  proposals,
  activeFilter,
  setActiveFilter,
  navigateToProposal,
}: ProposalsToolsBridgeProps) {
  const tools = useProposalsTools({
    proposals,
    activeFilter,
    setActiveFilter,
    navigateToProposal,
  });

  useRegisterTools("proposals", tools);

  return null;
}
