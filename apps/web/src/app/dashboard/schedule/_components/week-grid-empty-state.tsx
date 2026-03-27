"use client";

/**
 * MalEmptyState — Shown in the Mal-modus grid when no templates exist for the
 * selected department. Prompts the user to create their first template.
 */

import { CalendarDays } from "lucide-react";

type MalEmptyStateProps = {
  onCreateTemplate?: () => void;
};

export function MalEmptyState({ onCreateTemplate }: MalEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <CalendarDays className="text-muted-foreground/40 h-12 w-12" />

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-muted-foreground text-sm">Ingen maler for denne avdelingen</p>
        <p className="text-muted-foreground/60 text-xs">Opprett en mal for å komme i gang</p>
      </div>

      <button
        type="button"
        onClick={() => onCreateTemplate?.()}
        className="inline-flex items-center gap-2 rounded-[10px] bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all hover:shadow-[0_4px_16px_oklch(0.65_0.22_40/0.3)]"
      >
        + Opprett mal
      </button>
    </div>
  );
}
