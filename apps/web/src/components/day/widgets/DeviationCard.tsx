import { Camera } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayDeviation, DeviationSeverity, DeviationStatus } from "./types";

const SEVERITY_BORDER: Record<DeviationSeverity, string> = {
  critical: "border-l-[color:var(--destructive)]",
  high: "border-l-[color:var(--destructive)]",
  medium: "border-l-[color:var(--warning)]",
  low: "border-l-[color:var(--info)]",
};

const SEVERITY_TEXT: Record<DeviationSeverity, string> = {
  critical: "text-[color:var(--destructive)]",
  high: "text-[color:var(--destructive)]",
  medium: "text-[color:var(--warning)]",
  low: "text-[color:var(--info)]",
};

const STATUS_STYLE: Record<DeviationStatus, { label: string; class: string }> = {
  open: {
    label: "● ÅPEN",
    class:
      "text-[color:var(--warning)] bg-[color:color-mix(in_oklch,var(--warning)_14%,transparent)]",
  },
  acknowledged: {
    label: "● UNDER OPPFØLGING",
    class: "text-[color:var(--info)] bg-[color:color-mix(in_oklch,var(--info)_14%,transparent)]",
  },
  resolved: {
    label: "✓ LØST",
    class:
      "text-[color:var(--success)] bg-[color:color-mix(in_oklch,var(--success)_14%,transparent)]",
  },
  escalated: {
    label: "⚠ ESKALERT",
    class:
      "text-[color:var(--destructive)] bg-[color:color-mix(in_oklch,var(--destructive)_14%,transparent)]",
  },
};

export function DeviationCard({
  deviation,
  variant = "default",
  onInspect,
  onResolve,
}: {
  deviation: DayDeviation;
  variant?: "default" | "compact";
  onInspect?: () => void;
  onResolve?: () => void;
}) {
  const statusStyle = STATUS_STYLE[deviation.status];
  const isOpen = deviation.status === "open" || deviation.status === "acknowledged";

  return (
    <article
      className={cn(
        "bg-card border-border rounded-[14px] border border-l-[3px] p-4",
        SEVERITY_BORDER[deviation.severity],
      )}
      aria-label={`Avvik: ${deviation.title}`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={cn(
            "text-[9px] font-bold tracking-[0.18em] uppercase",
            SEVERITY_TEXT[deviation.severity],
          )}
        >
          AVVIK · {deviation.severity}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">{deviation.time}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-[3px] text-[10px] font-bold tracking-[0.14em] uppercase",
            statusStyle.class,
          )}
        >
          {statusStyle.label}
        </span>
      </div>
      <div className="mb-1.5 text-[14px] font-semibold">{deviation.title}</div>
      <p className="text-muted-foreground mb-2.5 text-[13px] leading-[1.5]">{deviation.desc}</p>
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]">
        <span>
          Rapportert av{" "}
          <strong className="text-foreground font-semibold">{deviation.reporter}</strong>
        </span>
        {deviation.photos > 0 ? (
          <span className="flex items-center gap-1">
            <Camera className="h-3 w-3" aria-hidden />
            {deviation.photos} bilder
          </span>
        ) : null}
        {deviation.assignedTo ? <span>Tildelt {deviation.assignedTo}</span> : null}
      </div>
      {variant !== "compact" && isOpen ? (
        <div className="mt-3 flex gap-2">
          {onInspect ? (
            <button
              type="button"
              onClick={onInspect}
              className="bg-card border-border hover:bg-muted h-8 rounded-lg border px-3 text-[12px] font-semibold transition-colors"
            >
              Se detaljer
            </button>
          ) : null}
          {onResolve ? (
            <button
              type="button"
              onClick={onResolve}
              className="bg-foreground text-background hover:bg-foreground/85 h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors"
            >
              Marker som løst
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
