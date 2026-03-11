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
  const label = isCreate ? role || "Ny vakt" : "Endring";

  if (isCompact) {
    // Matches ShiftCardView compact: flex items-center, rounded-md, px-2 py-1
    return (
      <div className="group border-brand-orange/40 bg-brand-orange/[0.06] relative flex animate-[walkai-fade-in_200ms_ease-out] items-center gap-2 overflow-visible rounded-md border border-dashed px-2 py-1 transition-colors duration-200">
        <div className="bg-brand-orange/50 absolute top-1 bottom-1 left-0 w-0.5 rounded-r-full" />
        <span className="text-brand-orange/80 truncate pl-1 text-[11px] leading-tight font-semibold">
          {label}
        </span>
        <span className="text-brand-orange/50 ml-auto shrink-0 text-[10px] font-medium">
          {time}
        </span>

        {/* Approve/reject on hover */}
        <div className="absolute -top-1.5 -right-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md transition-colors hover:bg-emerald-400"
            aria-label="Godkjenn"
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
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/80 text-white shadow-md transition-colors hover:bg-red-400"
            aria-label="Avvis"
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2L8 8M2 8L8 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Normal mode — matches ShiftCardView: flex-col gap-2.5, rounded-lg, p-2.5 xl:p-3
  return (
    <div className="group border-brand-orange/40 bg-brand-orange/[0.06] hover:bg-brand-orange/[0.1] relative flex animate-[walkai-fade-in_200ms_ease-out] flex-col gap-2.5 overflow-visible rounded-lg border border-dashed p-2.5 transition-colors duration-200 xl:p-3">
      <div className="bg-brand-orange/50 absolute top-2.5 bottom-2.5 left-0 w-1 animate-[walkai-pulse_2s_ease-in-out_infinite] rounded-r-full" />

      {/* Ghost label */}
      <div className="bg-brand-orange/10 text-brand-orange/60 absolute -top-2 left-3 rounded px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase">
        {isCreate ? "Forslag" : "Endring"}
      </div>

      <div className="relative z-10 flex w-full items-start justify-between">
        <div className="min-w-0 pr-2">
          <span className="text-brand-orange/80 line-clamp-1 block truncate text-sm leading-tight font-semibold">
            {label}
          </span>
        </div>
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <div className="border-brand-orange/30 bg-brand-orange/10 h-2.5 w-2.5 animate-[walkai-pulse_2s_ease-in-out_infinite] rounded-full border-2" />
        </div>
      </div>

      <div className="text-brand-orange/50 relative z-10 mt-auto flex items-center gap-1.5 text-xs font-medium">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="text-brand-orange/40"
        >
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" />
          <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        {time}
      </div>

      {/* Approve / Reject buttons — visible on hover */}
      <div className="mt-1 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onApprove();
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-500/15 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
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
          Godkjenn
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReject();
          }}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-red-500/10 py-1 text-[10px] font-medium text-red-400/70 transition-colors hover:bg-red-500/20"
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2L8 8M2 8L8 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Avvis
        </button>
      </div>
    </div>
  );
});
