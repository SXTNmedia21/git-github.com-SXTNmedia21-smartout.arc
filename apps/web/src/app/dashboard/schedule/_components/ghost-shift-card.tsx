"use client";

// ============================================
// ghost-shift-card.tsx
// Renders agent-proposed shifts as ghost cards with approve/reject actions.
// Matches ShiftCardView sizing/layout for both compact and normal modes.
// Connected to: agent-proposals-context.tsx, daily-grid.tsx EmployeeRow.
// ============================================

import React from "react";
import type { ShiftProposalCreate, ShiftProposalUpdate } from "./schedule-types";

type GhostShiftCardProps = {
  proposal: ShiftProposalCreate | ShiftProposalUpdate;
  employeeName?: string;
  isCompact?: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export const GhostShiftCard = React.memo(function GhostShiftCard({
  proposal,
  isCompact,
  onApprove,
  onReject,
}: GhostShiftCardProps) {
  const isCreate = proposal.type === "create";

  const time = isCreate
    ? `${proposal.startTime}–${proposal.endTime}`
    : Object.entries(proposal.patch)
        .filter(([k]) => k === "startTime" || k === "endTime")
        .map(([k, v]) => `${k === "startTime" ? "fra" : "til"} ${v}`)
        .join(", ") || "endring";

  const role = isCreate ? proposal.role : String(proposal.patch.role ?? "");
  const label = isCreate ? (role || "Ny vakt") : "Endring";

  if (isCompact) {
    // Matches ShiftCardView compact: flex items-center, rounded-md, px-2 py-1
    return (
      <div className="group relative flex items-center gap-2 rounded-md border border-dashed border-brand-orange/40 bg-brand-orange/[0.06] px-2 py-1 transition-colors duration-200 overflow-visible animate-[walkai-fade-in_200ms_ease-out]">
        <div className="absolute top-1 bottom-1 left-0 w-0.5 rounded-r-full bg-brand-orange/50" />
        <span className="text-[11px] leading-tight font-semibold text-brand-orange/80 truncate pl-1">
          {label}
        </span>
        <span className="text-[10px] font-medium text-brand-orange/50 ml-auto shrink-0">
          {time}
        </span>

        {/* Approve/reject on hover */}
        <div className="absolute -top-1.5 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md hover:bg-emerald-400 transition-colors"
            aria-label="Godkjenn"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white shadow-md hover:bg-red-400 transition-colors"
            aria-label="Avvis"
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M2 8L8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Normal mode — matches ShiftCardView: flex-col gap-2.5, rounded-lg, p-2.5 xl:p-3
  return (
    <div className="group relative flex flex-col gap-2.5 rounded-lg border border-dashed border-brand-orange/40 bg-brand-orange/[0.06] p-2.5 xl:p-3 transition-colors duration-200 overflow-visible animate-[walkai-fade-in_200ms_ease-out] hover:bg-brand-orange/[0.1]">
      <div className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-r-full bg-brand-orange/50 animate-[walkai-pulse_2s_ease-in-out_infinite]" />

      {/* Ghost label */}
      <div className="absolute -top-2 left-3 px-1.5 py-0 bg-brand-orange/10 rounded text-[8px] font-bold uppercase tracking-wider text-brand-orange/60">
        {isCreate ? "Forslag" : "Endring"}
      </div>

      <div className="relative z-10 flex w-full items-start justify-between">
        <div className="min-w-0 pr-2">
          <span className="text-sm leading-tight font-semibold text-brand-orange/80 line-clamp-1 block truncate">
            {label}
          </span>
        </div>
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-brand-orange/30 bg-brand-orange/10 animate-[walkai-pulse_2s_ease-in-out_infinite]" />
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center gap-1.5 text-xs font-medium text-brand-orange/50">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-brand-orange/40">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" />
          <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        {time}
      </div>

      {/* Approve / Reject buttons — visible on hover */}
      <div className="flex gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onApprove(); }}
          className="flex-1 flex items-center justify-center gap-1 rounded-md bg-emerald-500/15 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Godkjenn
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReject(); }}
          className="flex-1 flex items-center justify-center gap-1 rounded-md bg-red-500/10 py-1 text-[10px] font-medium text-red-400/70 hover:bg-red-500/20 transition-colors"
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M2 8L8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Avvis
        </button>
      </div>
    </div>
  );
});
