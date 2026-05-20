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
// Values sourced from CSS tokens (ADR-0366: no OKLCH literals in component files)
const GHOST_VARIANTS = [
  {
    bg: "var(--tag-indigo-bg)",
    color: "var(--tag-indigo-fg)",
    border: "var(--tag-indigo-border)",
  },
  {
    bg: "var(--tag-teal-bg)",
    color: "var(--tag-teal-fg)",
    border: "var(--tag-teal-border)",
  },
  {
    bg: "var(--tag-purple-bg)",
    color: "var(--brand-purple)",
    border: "var(--tag-purple-border)",
  },
  {
    bg: "var(--tag-orange-bg)",
    color: "var(--tag-orange-fg)",
    border: "var(--tag-orange-border)",
  },
  {
    bg: "var(--tag-rose-bg)",
    color: "var(--tag-rose-fg)",
    border: "var(--tag-rose-border)",
  },
  {
    bg: "var(--tag-cyan-bg)",
    color: "var(--tag-cyan-fg)",
    border: "var(--tag-cyan-border)",
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
