"use client";

/**
 * DayLineStripHeader
 *
 * Renders the identity + status bar for a single day_line strip.
 * Shows: location name, department name, planned open–close window,
 * a status pill, and an edit-hours pencil button (manager/admin only).
 *
 * Status labels (Norwegian per CLAUDE.md i18n requirement):
 *   draft    → Utkast
 *   active   → Aktiv
 *   closed   → Lukket
 *   locked   → Låst
 *   cancelled → Avbrutt
 *
 * References: ADR-0367, Nordic Split design system.
 */

import { Pencil } from "lucide-react";
import { cn } from "@smartout/ui";
import { Button } from "@/components/ui/button";
import type { DayLineRow, DayLineStatus } from "./_hooks/use-day-lines.types";

// ── Status pill helpers ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DayLineStatus, string> = {
  draft: "Utkast",
  active: "Aktiv",
  closed: "Lukket",
  locked: "Låst",
  cancelled: "Avbrutt",
};

// Nordic Split semantic colours via CSS variables — no hardcoded OKLCH literals.
const STATUS_CLASSES: Record<DayLineStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-muted text-foreground border-border",
  closed: "bg-muted/60 text-muted-foreground border-border",
  locked: "bg-muted/40 text-muted-foreground border-border",
  cancelled: "bg-muted/30 text-muted-foreground/60 border-border line-through",
};

// ── Component ─────────────────────────────────────────────────────────────────

export type DayLineStripHeaderProps = {
  line: DayLineRow;
  status: DayLineStatus;
  onEditHours: () => void;
  readOnly: boolean;
};

/**
 * Header bar for one day_line strip.
 * Renders identity info, time window, status pill, and optional edit button.
 */
export function DayLineStripHeader({
  line,
  status,
  onEditHours,
  readOnly,
}: DayLineStripHeaderProps) {
  const { day_line_id, location_name, department_name, planned_open, planned_close } = line;

  // Format time "HH:MM:SS" → "HH:MM" for display
  const fmt = (t: string) => t.slice(0, 5);

  return (
    <div
      className="bg-background border-border flex items-center gap-2 rounded-t-[calc(var(--radius)-1px)] border px-3 py-2"
      data-testid={`day-line-strip-header-${day_line_id}`}
    >
      {/* Area identity */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[13px] leading-tight font-medium">
          {location_name}
        </p>
        <p className="text-muted-foreground truncate text-[11px] leading-tight">
          {department_name} · {fmt(planned_open)}–{fmt(planned_close)}
        </p>
      </div>

      {/* Status pill */}
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide",
          STATUS_CLASSES[status],
        )}
        aria-label={`Status: ${STATUS_LABELS[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>

      {/* Edit-hours button — hidden in read-only mode or for cancelled/locked lines */}
      {!readOnly && status !== "locked" && status !== "cancelled" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0"
          onClick={onEditHours}
          aria-label="Endre åpningstider"
          data-testid={`day-line-edit-hours-${day_line_id}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      )}
    </div>
  );
}
