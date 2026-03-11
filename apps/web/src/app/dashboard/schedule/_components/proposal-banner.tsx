"use client";

// ============================================
// proposal-banner.tsx
// Sticky banner showing pending agent proposals with batch approve/reject.
// Connected to: agent-proposals-context.tsx, schedule page.
// ============================================

import { useAgentProposals } from "./agent-proposals-context";

export function ProposalBanner() {
  const { proposals, approveProposal, rejectProposal } = useAgentProposals();

  if (proposals.length === 0) return null;

  const createCount = proposals.filter((p) => p.type === "create").length;
  const updateCount = proposals.filter((p) => p.type === "update").length;

  const parts: string[] = [];
  if (createCount > 0) parts.push(`${createCount} nye vakter`);
  if (updateCount > 0) parts.push(`${updateCount} endringer`);

  const handleApproveAll = async () => {
    for (const p of proposals) {
      await approveProposal(p.id);
    }
  };

  const handleRejectAll = () => {
    for (const p of proposals) {
      rejectProposal(p.id);
    }
  };

  return (
    <div className="border-brand-orange/20 bg-brand-orange/[0.04] sticky top-0 z-30 flex animate-[walkai-fade-in_200ms_ease-out] items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        {/* Pulsing orb */}
        <div className="relative flex items-center justify-center">
          <div className="bg-brand-orange/60 h-2.5 w-2.5 animate-[walkai-pulse_2s_ease-in-out_infinite] rounded-full" />
          <div className="border-brand-orange/20 absolute h-5 w-5 animate-[walkai-pulse_2s_ease-in-out_infinite_0.5s] rounded-full border" />
        </div>

        <div>
          <p className="text-foreground text-xs font-medium">Emma foreslår {parts.join(" og ")}</p>
          <p className="text-muted-foreground/50 text-[10px]">Godkjenn eller avvis forslagene</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRejectAll}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-400/70 transition-colors hover:bg-red-500/10"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2L8 8M2 8L8 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Avvis alle
        </button>
        <button
          onClick={() => void handleApproveAll()}
          className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Godkjenn alle ({proposals.length})
        </button>
      </div>
    </div>
  );
}
