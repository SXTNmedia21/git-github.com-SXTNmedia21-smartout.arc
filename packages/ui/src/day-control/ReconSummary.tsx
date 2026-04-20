import type { UiPhase } from "./types";
import { PhaseBadge } from "./PhaseBadge";

export interface ReconRow {
  label: string;
  value: string;
  delta: string;
  dir: "up" | "down" | "flat";
}

export function ReconSummary({
  phase,
  dateLabel,
  locationLabel,
  rows,
  onApprove,
  onRequestRevision,
}: {
  phase: UiPhase;
  dateLabel: string; // "19. april"
  locationLabel: string; // "Café Skuta · Kjøkken"
  rows: ReconRow[];
  onApprove?: () => void;
  onRequestRevision?: () => void;
}) {
  const canAct = phase === "pending_signoff";
  return (
    <section className="bg-card border-border rounded-[16px] border p-5">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[22px]">Oppgjør — {dateLabel}</h2>
          <p className="text-muted-foreground mt-0.5 text-[12px]">{locationLabel}</p>
        </div>
        <PhaseBadge phase={phase} />
      </div>
      <div className="bg-border border-border grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border">
        {rows.map((row) => (
          <div key={row.label} className="bg-card px-3.5 py-3">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
              {row.label}
            </div>
            <div className="mt-1 font-mono text-[18px] font-bold tabular-nums">{row.value}</div>
            <div
              className={
                row.dir === "up"
                  ? "mt-0.5 text-[11px] font-medium text-[color:var(--success)]"
                  : row.dir === "down"
                    ? "mt-0.5 text-[11px] font-medium text-[color:var(--warning)]"
                    : "text-muted-foreground mt-0.5 text-[11px] font-medium"
              }
            >
              {row.dir === "up" ? "↗" : row.dir === "down" ? "↘" : "·"} {row.delta}
            </div>
          </div>
        ))}
      </div>
      {canAct ? (
        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={onRequestRevision}
            className="bg-card border-border hover:bg-muted h-[42px] flex-1 rounded-[10px] border text-[13px] font-semibold transition-colors"
          >
            Spør om revisjon
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="bg-brand-orange hover:bg-brand-orange/90 h-[42px] flex-1 rounded-[10px] text-[13px] font-bold text-white shadow-[0_2px_10px_color-mix(in_oklch,var(--brand-orange)_28%,transparent)] transition-colors"
          >
            Godkjenn oppgjør
          </button>
        </div>
      ) : null}
    </section>
  );
}
