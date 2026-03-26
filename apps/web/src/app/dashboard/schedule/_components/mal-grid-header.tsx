"use client";

/**
 * MalGridHeader — Sticky column headers for the Mal-modus schedule grid.
 * Each column represents a template shift type and shows role, time window,
 * slot count, hours, and an estimated cost badge.
 *
 * Uses `display: contents` so the parent CSS Grid controls column placement.
 */

import type { MalColumn } from "@smartout/schedule";

type MalGridHeaderProps = {
  columns: MalColumn[];
  onColumnClick?: (column: MalColumn) => void;
};

// Placeholder hourly rate used for cost estimation in the header badge.
// Real rates come from tariff_rate_table — this is display-only.
const DISPLAY_HOURLY_RATE = 230;

export function MalGridHeader({ columns, onColumnClick }: MalGridHeaderProps) {
  return (
    // display: contents lets these cells participate directly in the parent CSS Grid
    <div style={{ display: "contents" }}>
      {/* "Dag" label — sticky first column */}
      <div className="border-border bg-muted text-muted-foreground sticky left-0 z-[12] border-r border-b p-2 text-left text-[10px] font-bold tracking-[1.5px] uppercase">
        Dag
      </div>

      {/* One header cell per template shift column */}
      {columns.map((col) => (
        <div
          key={col.templateShiftId}
          onClick={() => onColumnClick?.(col)}
          className="border-border bg-muted sticky top-0 z-10 cursor-pointer border-b p-2 text-center transition-[background] duration-[250ms] hover:bg-[oklch(0.95_0.008_55)]"
        >
          {/* Role name */}
          <span className="text-muted-foreground block text-[10px] font-bold tracking-[1.5px] uppercase">
            {col.role}
          </span>

          {/* Time window — monospaced for alignment */}
          <span className="text-muted-foreground/60 mt-[1px] block font-mono text-[10px] font-medium tracking-normal normal-case">
            {col.startTime} – {col.endTime}
          </span>

          {/* Stats badges row */}
          <div className="mt-[3px] flex justify-center gap-1.5">
            {/* Slot count */}
            <span className="rounded-md bg-[oklch(0.62_0.2_260/0.08)] px-1.5 py-[1px] text-[9px] font-bold text-blue-500">
              {col.slotCount} pl.
            </span>

            {/* Hours */}
            <span className="bg-card text-muted-foreground rounded-md px-1.5 py-[1px] text-[9px] font-bold">
              {col.workHours}t
            </span>

            {/* Estimated cost — uses display-only rate, not a contract calculation */}
            <span className="rounded-md bg-[oklch(0.65_0.22_40/0.08)] px-1.5 py-[1px] text-[9px] font-bold text-orange-500">
              kr {Math.round(col.workHours * DISPLAY_HOURLY_RATE)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
