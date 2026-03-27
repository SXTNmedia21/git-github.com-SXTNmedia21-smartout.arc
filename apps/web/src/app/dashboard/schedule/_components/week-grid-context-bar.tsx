"use client";

/**
 * WeekGridContextBar — Stats bar + import/export actions for the week grid.
 * Replaces the old template chip selector. Shows live per-day stats derived
 * from the grid data and offers template import/save shortcuts.
 */

type WeekGridContextBarProps = {
  stats: {
    slotsPerDay: number;
    hoursPerDay: number;
    costPerDay: number;
  };
  onImportTemplate?: () => void;
  onSaveAsTemplate?: () => void;
};

export function WeekGridContextBar({
  stats,
  onImportTemplate,
  onSaveAsTemplate,
}: WeekGridContextBarProps) {
  return (
    <div className="border-border bg-card/50 relative z-[1] flex items-center gap-2.5 border-b px-4 py-[5px] text-xs">
      <div className="text-muted-foreground flex gap-3 text-[11px]">
        <span>
          Plasser/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.slotsPerDay}</strong>
        </span>
        <span>
          Timer/dag:{" "}
          <strong className="text-foreground font-mono font-bold">{stats.hoursPerDay}t</strong>
        </span>
        <span>
          Kostnad/dag:{" "}
          <strong className="text-foreground font-mono font-bold">
            kr {stats.costPerDay.toLocaleString("nb-NO")}
          </strong>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onImportTemplate}
          className="border-border text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border px-3 py-1 text-[11px] font-bold transition-all"
        >
          Last inn fra mal...
        </button>
        <button
          type="button"
          onClick={onSaveAsTemplate}
          className="text-muted-foreground/60 cursor-pointer text-[11px] font-bold transition-all hover:text-orange-500"
        >
          Lagre som mal
        </button>
      </div>
    </div>
  );
}
