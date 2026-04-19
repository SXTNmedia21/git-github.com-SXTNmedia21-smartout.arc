import { Check } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayHook, UiPhase } from "./types";

/**
 * PhaseTimeline — horizontal rail of hooks with a "NÅ" marker.
 * `nowPct` is a 0-100 percentage of elapsed time within the session window.
 * Ticker cadence is set by caller (OverviewTab uses minute-level).
 */
export function PhaseTimeline({
  hooks,
  nowPct = 0,
  startLabel,
  endLabel,
  onHookClick,
}: {
  hooks: DayHook[];
  phase?: UiPhase;
  nowPct?: number;
  startLabel?: string;
  endLabel?: string;
  onHookClick?: (hook: DayHook) => void;
}) {
  const showNow = nowPct > 0 && nowPct < 100;

  return (
    <div>
      <div className="text-muted-foreground mb-3 flex items-center justify-between font-mono text-[10px] font-semibold tracking-[0.16em] uppercase">
        <span>{startLabel ?? hooks[0]?.time ?? ""}</span>
        <span>Dagens forløp</span>
        <span>{endLabel ?? hooks[hooks.length - 1]?.time ?? ""}</span>
      </div>
      <div className="relative h-11" role="group" aria-label="Dagens forløp tidslinje">
        <div className="bg-muted absolute top-5 right-0 left-0 h-1 rounded-full" />
        <div
          className="bg-brand-orange absolute top-5 left-0 h-1 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${nowPct}%` }}
        />
        {hooks.map((hook, i) => {
          const pct = hooks.length === 1 ? 50 : 4 + (i / (hooks.length - 1)) * 92;
          return (
            <button
              key={hook.id}
              type="button"
              onClick={onHookClick ? () => onHookClick(hook) : undefined}
              disabled={!onHookClick}
              className={cn(
                "absolute top-0 -translate-x-1/2 text-center",
                onHookClick ? "cursor-pointer" : "cursor-default",
              )}
              style={{ left: `${pct}%` }}
              aria-label={`${hook.time} ${hook.title} — ${hook.state === "completed" ? "ferdig" : hook.state === "in_progress" ? "pågår" : "kommer"}`}
            >
              <div className="text-muted-foreground mb-1 font-mono text-[10px]">{hook.time}</div>
              <div
                className={cn(
                  "mx-auto grid h-3.5 w-3.5 place-items-center rounded-full border-2",
                  hook.state === "completed"
                    ? "border-[color:var(--success)] bg-[color:color-mix(in_oklch,var(--success)_14%,transparent)]"
                    : hook.state === "in_progress"
                      ? "border-brand-orange bg-[color:color-mix(in_oklch,var(--brand-orange)_16%,transparent)]"
                      : "bg-muted border-muted-foreground",
                )}
              >
                {hook.state === "completed" ? (
                  <Check
                    className="h-2 w-2 text-[color:var(--success)]"
                    strokeWidth={3}
                    aria-hidden
                  />
                ) : null}
              </div>
            </button>
          );
        })}
        {showNow ? (
          <div
            className="pointer-events-none absolute -top-1 h-8 -translate-x-1/2"
            style={{ left: `${nowPct}%` }}
            aria-label="Nå"
          >
            <div className="bg-brand-orange h-8 w-0.5 rounded-full" />
            <div className="text-brand-orange absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[9px] font-bold tracking-[0.12em]">
              NÅ
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
