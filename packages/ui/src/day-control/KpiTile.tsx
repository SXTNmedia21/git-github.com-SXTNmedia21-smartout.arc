import { cn } from "../lib/utils";
import type { DayKpi } from "./types";
import { SOURCE_SUFFIX, deltaGlyph, deltaTone } from "./kpi-tile-shared";

/**
 * KpiTile (web) — numeric KPI tile with label, value, unit, optional delta
 * + sub-line + source tier footnote.
 *
 * ADR-0158 dual-platform: paired with `KpiTile.native.tsx`. Shared source
 * suffix / delta glyph / delta tone mapping lives in `kpi-tile-shared.ts`
 * so both variants render identical semantics.
 */
export function KpiTile({
  tile,
  variant = "default",
}: {
  tile: DayKpi;
  variant?: "default" | "compact";
}) {
  const tone = deltaTone(tile.deltaDir);
  const deltaColor =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "text-muted-foreground";

  const padding = variant === "compact" ? "p-3.5" : "p-4.5";
  const numberSize = variant === "compact" ? "text-[22px]" : "text-[30px]";
  const sourceHint = tile.source ? SOURCE_SUFFIX[tile.source] : "";

  return (
    <div
      className={cn(
        "bg-card border-border relative overflow-hidden rounded-[14px] border",
        padding,
      )}
    >
      <div className="text-muted-foreground mb-2 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase">
        {tile.label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-foreground font-mono font-black tracking-[-0.02em] tabular-nums",
            numberSize,
          )}
        >
          {tile.value}
        </span>
        <span className="text-muted-foreground text-[13px] font-medium">{tile.unit}</span>
      </div>
      {tile.sub || tile.delta ? (
        <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11px]">
          {tile.delta ? (
            <span className={cn("font-mono font-semibold", deltaColor)}>
              {deltaGlyph(tile.deltaDir)} {tile.delta}
            </span>
          ) : null}
          <span>
            {tile.sub}
            {sourceHint}
          </span>
        </div>
      ) : null}
    </div>
  );
}
