"use client";

/**
 * MalEmployeeTag — Compact inline tag representing an assigned employee in the Mal-modus grid.
 * Shows avatar, name, trailing status icons, and a hover tooltip with shift details
 * (time window, role, status) so managers can quickly assess placement.
 */

import { ArrowLeftRight, Check, Circle, MessageCircle } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import type { MalEmployeeAssignment } from "@smartout/schedule";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type MalEmployeeTagProps = {
  assignment: MalEmployeeAssignment;
  onClick?: () => void;
  /** When true, the tag can be dragged to a different column */
  draggable?: boolean;
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

/** Status label mapping for the tooltip */
const STATUS_LABELS: Record<string, string> = {
  created: "Opprettet",
  assigned: "Tildelt",
  published: "Publisert",
  active: "Aktiv",
  completed: "Fullført",
  unpublished: "Upublisert",
};

export function MalEmployeeTag({ assignment, onClick, draggable = false }: MalEmployeeTagProps) {
  const variant = pickColorVariant(assignment.employeeId);
  const isPublished = assignment.status === "published";
  const hasShiftDetails = assignment.startTime || assignment.role;

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `shift-${assignment.shiftId}`,
    data: { assignment },
    disabled: !draggable,
  });

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        backgroundColor: variant.bg,
      }
    : { backgroundColor: variant.bg };

  const tag = (
    <button
      ref={draggable ? setNodeRef : undefined}
      type="button"
      onClick={isDragging ? undefined : onClick}
      className={`inline-flex items-center gap-[3px] rounded-lg py-[3px] pr-[6px] pl-[3px] transition-shadow duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_oklch(0_0_0/0.1)] ${isDragging ? "relative z-50 scale-105 opacity-90 shadow-2xl ring-2 ring-orange-500/40" : ""} ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"}`}
      style={dragStyle}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold"
        style={{ backgroundColor: variant.avatarBg, color: variant.color }}
      >
        {assignment.initials}
      </span>

      <span
        className="max-w-[60px] overflow-hidden text-[10px] font-semibold text-ellipsis whitespace-nowrap"
        style={{ color: variant.color }}
      >
        {assignment.employeeName}
      </span>

      <span className="ml-[2px] flex gap-[1px]">
        {isPublished ? (
          <Check
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#22c55e" }}
          />
        ) : (
          <Circle className="text-muted-foreground h-3 w-3 opacity-60 transition-opacity hover:opacity-100" />
        )}
        {assignment.hasSwapRequest && (
          <ArrowLeftRight
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#f97316" }}
          />
        )}
        {assignment.hasUnreadMessage && (
          <MessageCircle
            className="h-3 w-3 opacity-60 transition-opacity hover:opacity-100"
            style={{ color: "#3b82f6" }}
          />
        )}
      </span>
    </button>
  );

  if (!hasShiftDetails) return tag;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tag}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="rounded-xl border-none bg-zinc-900 px-3 py-2 text-white shadow-xl"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold">{assignment.employeeName}</span>
          {assignment.role && <span className="text-[10px] text-zinc-400">{assignment.role}</span>}
          {assignment.startTime && assignment.endTime && (
            <span className="font-mono text-[10px] text-zinc-300">
              {assignment.startTime} – {assignment.endTime}
            </span>
          )}
          <span className="text-[9px] text-zinc-500">
            {STATUS_LABELS[assignment.status] ?? assignment.status}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
