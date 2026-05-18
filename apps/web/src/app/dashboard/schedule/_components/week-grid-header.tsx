"use client";

/**
 * MalGridHeader — Sticky column headers for the schedule grid.
 * Each column represents a department shift type config and shows label,
 * time window, slot count, hours, and an estimated cost badge.
 *
 * Uses `display: contents` so the parent CSS Grid controls column placement.
 */

import type { GridColumn } from "@smartout/schedule";
import { UNASSIGNED_CONFIG_ID } from "@smartout/schedule";

type MalGridHeaderProps = {
  columns: GridColumn[];
  onColumnClick?: (column: GridColumn) => void;
};

// Placeholder hourly rate used for cost estimation in the header badge.
// Real rates come from tariff_rate_table — this is display-only.
const DISPLAY_HOURLY_RATE = 230;

export function MalGridHeader({ columns, onColumnClick }: MalGridHeaderProps) {
  return (
    <div style={{ display: "contents" }}>
      {/* "Dag" label — sticky first column */}
      <div className="border-border bg-muted text-muted-foreground sticky left-0 z-[12] border-r border-b p-2 text-left text-[10px] font-bold tracking-[1.5px] uppercase">
        Dag
      </div>

      {columns.map((col) => {
        const isUnassigned = col.configId === UNASSIGNED_CONFIG_ID;

        if (isUnassigned) {
          return (
            <div
              key={col.configId}
              className="border-border bg-muted/60 sticky top-0 z-10 border-b border-dashed p-2 text-center"
            >
              <span className="text-muted-foreground/70 block text-[10px] font-bold tracking-[1.5px] uppercase">
                Ikke tildelt
              </span>
              <span className="text-muted-foreground/40 mt-[1px] block text-[10px] font-medium">
                Vakter uten vakttype
              </span>
            </div>
          );
        }

        return (
          <div
            key={col.configId}
            onClick={() => onColumnClick?.(col)}
            className="border-border bg-muted hover:bg-muted/80 sticky top-0 z-10 cursor-pointer border-b p-2 text-center transition-[background] duration-[250ms]"
          >
            <span className="text-muted-foreground block text-[10px] font-bold tracking-[1.5px] uppercase">
              {col.label}
            </span>

            <span className="text-muted-foreground/60 mt-[1px] block font-mono text-[10px] font-medium tracking-normal normal-case">
              {col.startTime} – {col.endTime}
            </span>

            <div className="mt-[3px] flex justify-center gap-1.5">
              <span className="rounded-md bg-blue-500/8 px-1.5 py-[1px] text-[9px] font-bold text-blue-500">
                {col.slotCount} pl.
              </span>
              <span className="bg-card text-muted-foreground rounded-md px-1.5 py-[1px] text-[9px] font-bold">
                {col.workHours}t
              </span>
              <span className="bg-brand-orange/8 rounded-md px-1.5 py-[1px] text-[9px] font-bold text-orange-500">
                kr {Math.round(col.workHours * DISPLAY_HOURLY_RATE)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
