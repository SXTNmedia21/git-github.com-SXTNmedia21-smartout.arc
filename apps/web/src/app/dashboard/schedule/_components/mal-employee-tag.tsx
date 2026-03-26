"use client";

/**
 * MalEmployeeTag — Compact inline tag representing an assigned employee in the Mal-modus grid.
 * Shows avatar, name, and trailing status icons (published, swap request, unread message).
 */

import { ArrowLeftRight, Check, Circle, MessageCircle } from "lucide-react";
import type { MalEmployeeAssignment } from "@smartout/schedule";

type MalEmployeeTagProps = {
  assignment: MalEmployeeAssignment;
  onClick?: () => void;
};

// Six deterministic color variants based on a hash of the employeeId.
// Colors use oklch values for perceptual consistency across light/dark modes.
const COLOR_VARIANTS = [
  {
    bg: "oklch(0.62 0.2 260 / 0.07)",
    color: "#3b82f6",
    avatarBg: "oklch(0.62 0.2 260 / 0.14)",
  },
  {
    bg: "oklch(0.72 0.17 160 / 0.07)",
    color: "#22c55e",
    avatarBg: "oklch(0.72 0.17 160 / 0.14)",
  },
  {
    bg: "oklch(0.55 0.25 300 / 0.07)",
    color: "#a855f7",
    avatarBg: "oklch(0.55 0.25 300 / 0.14)",
  },
  {
    bg: "oklch(0.65 0.22 40 / 0.07)",
    color: "#f97316",
    avatarBg: "oklch(0.65 0.22 40 / 0.14)",
  },
  {
    bg: "oklch(0.6 0.22 350 / 0.07)",
    color: "#f43f5e",
    avatarBg: "oklch(0.6 0.22 350 / 0.14)",
  },
  {
    bg: "oklch(0.7 0.15 200 / 0.07)",
    color: "#06b6d4",
    avatarBg: "oklch(0.7 0.15 200 / 0.14)",
  },
] as const;

/** Simple djb2-style hash to pick a stable color variant from an employee ID string. */
function pickColorVariant(id: string): (typeof COLOR_VARIANTS)[number] {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  const index = Math.abs(hash) % COLOR_VARIANTS.length;
  // COLOR_VARIANTS has exactly 6 entries and index is bounded — this is always defined.
  return COLOR_VARIANTS[index] ?? COLOR_VARIANTS[0];
}

export function MalEmployeeTag({ assignment, onClick }: MalEmployeeTagProps) {
  const variant = pickColorVariant(assignment.employeeId);
  const isPublished = assignment.status === "published";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-[3px] rounded-lg py-[3px] pr-[6px] pl-[3px] transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_oklch(0_0_0/0.1)]"
      style={{ backgroundColor: variant.bg }}
    >
      {/* Avatar circle with initials */}
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold"
        style={{ backgroundColor: variant.avatarBg, color: variant.color }}
      >
        {assignment.initials}
      </span>

      {/* Employee name — truncated at 60px */}
      <span
        className="max-w-[60px] overflow-hidden text-[10px] font-semibold text-ellipsis whitespace-nowrap"
        style={{ color: variant.color }}
      >
        {assignment.employeeName}
      </span>

      {/* Trailing status icons — only rendered when relevant */}
      <span className="ml-[2px] flex gap-[1px]">
        {/* Published = green check, otherwise muted circle indicating draft/assigned state */}
        {isPublished ? (
          <Check
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#22c55e" }}
          />
        ) : (
          <Circle className="text-muted-foreground h-3 w-3 opacity-60 transition-opacity hover:opacity-100" />
        )}

        {/* Swap request indicator */}
        {assignment.hasSwapRequest && (
          <ArrowLeftRight
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#f97316" }}
          />
        )}

        {/* Unread message indicator */}
        {assignment.hasUnreadMessage && (
          <MessageCircle
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#3b82f6" }}
          />
        )}
      </span>
    </button>
  );
}
