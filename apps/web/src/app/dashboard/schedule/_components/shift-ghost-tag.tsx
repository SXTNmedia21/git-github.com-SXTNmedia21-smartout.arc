"use client";

/**
 * MalGhostTag — Visual proposal tag in the MalGrid.
 * Renders as a dashed-border, semi-transparent variant of MalEmployeeTag.
 * On hover, shows approve (checkmark) and reject (X) action buttons.
 */

import { Check, X } from "lucide-react";
import type { ShiftProposalCreate } from "./schedule-types";

type MalGhostTagProps = {
  proposal: ShiftProposalCreate;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

// Desaturated color variants — same hues as MalEmployeeTag but at lower chroma
const GHOST_VARIANTS = [
  {
    bg: "oklch(0.62 0.1 260 / 0.05)",
    color: "oklch(0.62 0.15 260)",
    border: "oklch(0.62 0.1 260 / 0.2)",
  },
  {
    bg: "oklch(0.72 0.08 160 / 0.05)",
    color: "oklch(0.72 0.12 160)",
    border: "oklch(0.72 0.08 160 / 0.2)",
  },
  {
    bg: "oklch(0.55 0.12 300 / 0.05)",
    color: "oklch(0.55 0.18 300)",
    border: "oklch(0.55 0.12 300 / 0.2)",
  },
  {
    bg: "oklch(0.65 0.11 40 / 0.05)",
    color: "oklch(0.65 0.16 40)",
    border: "oklch(0.65 0.11 40 / 0.2)",
  },
  {
    bg: "oklch(0.6 0.11 350 / 0.05)",
    color: "oklch(0.6 0.16 350)",
    border: "oklch(0.6 0.11 350 / 0.2)",
  },
  {
    bg: "oklch(0.7 0.07 200 / 0.05)",
    color: "oklch(0.7 0.1 200)",
    border: "oklch(0.7 0.07 200 / 0.2)",
  },
] as const;

function pickGhostVariant(id: string): (typeof GHOST_VARIANTS)[number] {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  const index = Math.abs(hash) % GHOST_VARIANTS.length;
  return GHOST_VARIANTS[index] ?? GHOST_VARIANTS[0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length >= 2 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  if (first && last) return (first + last).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

export function MalGhostTag({ proposal, onApprove, onReject }: MalGhostTagProps) {
  const variant = pickGhostVariant(proposal.employeeId);
  const displayName = proposal.employeeName ?? proposal.role;
  const initials = proposal.employeeName
    ? getInitials(proposal.employeeName)
    : proposal.role.slice(0, 2).toUpperCase();

  return (
    <div
      className="group/ghost relative inline-flex animate-pulse items-center gap-[3px] rounded-lg border border-dashed py-[3px] pr-[6px] pl-[3px] transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      style={{
        backgroundColor: variant.bg,
        borderColor: variant.border,
        animationDuration: "3s",
      }}
    >
      {/* Avatar circle */}
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold opacity-60"
        style={{ backgroundColor: variant.bg, color: variant.color }}
      >
        {initials}
      </span>

      {/* Name */}
      <span
        className="max-w-[60px] overflow-hidden text-[10px] font-semibold text-ellipsis whitespace-nowrap opacity-60"
        style={{ color: variant.color }}
      >
        {displayName}
      </span>

      {/* Hover actions — appear on ghost tag hover */}
      <span className="ml-[1px] flex gap-[2px] opacity-0 transition-opacity duration-150 group-hover/ghost:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onApprove(proposal.id);
          }}
          className="flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors hover:bg-green-500/20"
          title="Godkjenn"
        >
          <Check className="h-[10px] w-[10px]" style={{ color: "#22c55e" }} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReject(proposal.id);
          }}
          className="flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors hover:bg-red-500/20"
          title="Avslå"
        >
          <X className="h-[10px] w-[10px]" style={{ color: "#ef4444" }} />
        </button>
      </span>
    </div>
  );
}
