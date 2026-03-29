"use client";

/**
 * WeekGridEmptyState — Shown when no shift type configs exist for the
 * selected department. Invites the user to create their first shift type
 * or import from an existing template.
 */

import { CalendarDays, Sparkles } from "lucide-react";

type WeekGridEmptyStateProps = {
  onCreateShiftType?: () => void;
  onImportTemplate?: () => void;
};

export function WeekGridEmptyState({
  onCreateShiftType,
  onImportTemplate,
}: WeekGridEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16">
      <div className="border-border flex max-w-md flex-col items-center gap-5 rounded-2xl border border-dashed p-10">
        <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
          <CalendarDays className="text-muted-foreground/60 h-7 w-7" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-foreground text-sm font-bold">Ingen vakttyper definert</p>
          <p className="text-muted-foreground/60 max-w-xs text-xs">
            Legg til vakttyper for denne avdelingen, eller last inn fra en eksisterende mal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCreateShiftType}
            className="inline-flex items-center gap-2 rounded-[10px] bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all hover:shadow-[0_4px_16px_oklch(0.65_0.22_40/0.3)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Legg til vakttype
          </button>

          <button
            type="button"
            onClick={onImportTemplate}
            className="border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-[10px] border px-4 py-2 text-xs font-bold transition-all"
          >
            Last inn fra mal
          </button>
        </div>
      </div>
    </div>
  );
}
