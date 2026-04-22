"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  year: number;
  onYearChange: (year: number) => void;
  onNewSeasonHint: () => void; // shows toast "Dra i lerretet for å tegne en sesong"
};

export function YearWheelTopbar({ year, onYearChange, onNewSeasonHint }: Props) {
  return (
    <header className="border-border bg-card flex items-center gap-4 border-b px-7 py-3.5">
      <div className="text-muted-foreground text-[11px] font-semibold tracking-[2px] uppercase">
        Smartout <span className="mx-1.5 opacity-50">/</span> Planlegging
      </div>
      <h1 className="font-heading m-0 text-[28px] font-normal tracking-[-0.02em]">Årshjul</h1>
      <div className="ml-2 flex items-center gap-0.5">
        <button
          onClick={() => onYearChange(year - 1)}
          className="text-foreground hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md"
          aria-label="Forrige år"
          type="button"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <div className="min-w-[60px] px-2.5 text-center font-mono text-[15px] font-bold">
          {year}
        </div>
        <button
          onClick={() => onYearChange(year + 1)}
          className="text-foreground hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md"
          aria-label="Neste år"
          type="button"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <Button onClick={onNewSeasonHint} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Ny sesong
        </Button>
      </div>
    </header>
  );
}
