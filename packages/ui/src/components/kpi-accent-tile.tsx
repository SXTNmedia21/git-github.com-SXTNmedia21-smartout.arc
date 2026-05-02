/**
 * KpiAccentTile — compact metric card with brand-accent left-border glow.
 *
 * Used in dashboard hub pages (People, Policies, etc.) to render a strip of
 * KPI summary cards above the main data table. Each tile shows a primary
 * metric and an optional secondary metric.
 *
 * Accent variants map to warm OKLCH palette variables via Tailwind — no
 * hardcoded color values.
 */

import type { ComponentType, SVGProps } from "react";

type AccentVariant = "orange" | "emerald" | "blue" | "violet" | "amber";

type MetricValue = {
  label: string;
  value: number | string;
  unit?: string;
};

export type KpiAccentTileProps = {
  /** Heading label shown above the primary metric. */
  title: string;
  /** Lucide icon component. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Color accent applied to left border, icon background, and shadow glow. */
  accent: AccentVariant;
  /** Primary (large) metric display. */
  primary: MetricValue;
  /** Optional secondary (small) metric shown below primary. */
  secondary?: MetricValue;
  /** Render in reduced-height mode when viewport is compact. */
  compact?: boolean;
  /** Click handler — wraps the whole tile as a button when provided. */
  onClick?: () => void;
};

const accentStyles: Record<AccentVariant, { border: string; icon: string; glow: string }> = {
  orange: {
    border: "border-l-brand-orange/60",
    icon: "bg-brand-orange/10 text-brand-orange",
    glow: "shadow-[0_4px_20px_-8px_oklch(0.78_0.18_55_/_0.3)]",
  },
  emerald: {
    border: "border-l-emerald-500/60",
    icon: "bg-emerald-500/10 text-emerald-500",
    glow: "shadow-[0_4px_20px_-8px_oklch(0.70_0.18_145_/_0.3)]",
  },
  blue: {
    border: "border-l-blue-400/60",
    icon: "bg-blue-400/10 text-blue-400",
    glow: "shadow-[0_4px_20px_-8px_oklch(0.68_0.15_225_/_0.3)]",
  },
  violet: {
    border: "border-l-violet-400/60",
    icon: "bg-violet-400/10 text-violet-400",
    glow: "shadow-[0_4px_20px_-8px_oklch(0.60_0.22_300_/_0.3)]",
  },
  amber: {
    border: "border-l-amber-400/60",
    icon: "bg-amber-400/10 text-amber-400",
    glow: "shadow-[0_4px_20px_-8px_oklch(0.78_0.16_75_/_0.3)]",
  },
};

export function KpiAccentTile({
  title,
  icon: Icon,
  accent,
  primary,
  secondary,
  compact,
  onClick,
}: KpiAccentTileProps) {
  const { border, icon: iconStyle, glow } = accentStyles[accent];

  const content = (
    <div
      className={`bg-background/60 ring-border/40 flex items-start gap-3 rounded-2xl border-l-4 px-4 ring-1 backdrop-blur-sm transition-all ${border} ${glow} ${compact ? "py-3" : "py-4"} ${onClick ? "hover:ring-border/80 cursor-pointer" : ""}`}
    >
      {/* Icon badge */}
      <div className={`mt-0.5 rounded-xl p-2 ${iconStyle} shrink-0`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>

      {/* Metrics */}
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">
          {title}
        </p>
        <p className="text-foreground font-mono text-2xl leading-none font-semibold tabular-nums">
          {primary.value}
          {primary.unit && (
            <span className="text-muted-foreground ml-1 text-sm font-normal">{primary.unit}</span>
          )}
        </p>
        {secondary && (
          <p className="text-muted-foreground mt-1 text-xs">
            <span className="text-foreground font-mono font-semibold tabular-nums">
              {secondary.value}
            </span>{" "}
            {secondary.label}
          </p>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        {content}
      </button>
    );
  }

  return content;
}
