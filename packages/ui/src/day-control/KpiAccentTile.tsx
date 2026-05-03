"use client";

import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/utils";

export type KpiAccent = "emerald" | "blue" | "purple" | "orange" | "rose" | "amber";

export type KpiAccentStat = {
  label: string;
  value: string | number;
  unit?: string;
};

export type KpiTrend = {
  direction: "up" | "down" | "flat";
  label: string;
  /** When true, "down" reads as positive (e.g. fewer deviations). */
  invert?: boolean;
};

const ACCENT: Record<
  KpiAccent,
  {
    iconText: string;
    iconBg: string;
    iconBorder: string;
    glow: string;
    primaryText: string;
  }
> = {
  emerald: {
    iconText: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconBorder: "border-emerald-200 dark:border-emerald-500/20",
    glow: "bg-emerald-500/20 dark:bg-emerald-500/15",
    primaryText: "text-foreground",
  },
  blue: {
    iconText: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
    iconBorder: "border-blue-200 dark:border-blue-500/20",
    glow: "bg-blue-500/20 dark:bg-blue-500/15",
    primaryText: "text-foreground",
  },
  purple: {
    iconText: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-50 dark:bg-purple-500/10",
    iconBorder: "border-purple-200 dark:border-purple-500/20",
    glow: "bg-purple-500/20 dark:bg-purple-500/15",
    primaryText: "text-foreground",
  },
  orange: {
    iconText: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
    iconBorder: "border-orange-200 dark:border-orange-500/20",
    glow: "bg-orange-500/20 dark:bg-orange-500/15",
    primaryText: "text-foreground",
  },
  rose: {
    iconText: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-50 dark:bg-rose-500/10",
    iconBorder: "border-rose-200 dark:border-rose-500/20",
    glow: "bg-rose-500/20 dark:bg-rose-500/15",
    primaryText: "text-foreground",
  },
  amber: {
    iconText: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-500/10",
    iconBorder: "border-amber-200 dark:border-amber-500/20",
    glow: "bg-amber-500/20 dark:bg-amber-500/15",
    primaryText: "text-foreground",
  },
};

/**
 * KpiAccentTile — reports-style KPI card.
 *
 * Layout: glow blob top-right · icon chip top-left · big primary value ·
 * eyebrow label · secondary stat row + optional trend pill.
 *
 * Asymmetric: primary stat dominates (`text-3xl font-black`), secondary
 * sits in a small chip below (`text-[11px]`). Used by Day-Control Oversikt.
 */
export function KpiAccentTile({
  title,
  icon: Icon,
  accent,
  primary,
  secondary,
  trend,
  onClick,
  className,
  compact = false,
}: {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: KpiAccent;
  primary: KpiAccentStat;
  secondary?: KpiAccentStat;
  trend?: KpiTrend;
  onClick?: () => void;
  className?: string;
  /** Smaller padding + smaller primary text. Use on dense list-tops. */
  compact?: boolean;
}) {
  const a = ACCENT[accent];
  const interactive = Boolean(onClick);

  const trendPositive = trend
    ? trend.invert
      ? trend.direction === "down"
      : trend.direction === "up"
    : false;
  const trendNegative = trend
    ? trend.invert
      ? trend.direction === "up"
      : trend.direction === "down"
    : false;
  const trendColor = trendPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : trendNegative
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";
  const TrendArrow = trend?.direction === "up" ? "▲" : trend?.direction === "down" ? "▼" : "→";

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "bg-card border-border relative overflow-hidden rounded-2xl border shadow-sm transition-all",
        compact ? "p-3.5" : "p-5",
        interactive &&
          "focus-visible:ring-ring cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full blur-3xl",
          a.glow,
        )}
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                a.iconBg,
                a.iconBorder,
              )}
            >
              <Icon className={cn("h-4 w-4", a.iconText)} />
            </div>
            <div className="text-muted-foreground truncate text-[11px] font-bold tracking-[0.14em] uppercase">
              {title}
            </div>
          </div>
          {trend ? (
            <span
              className={cn(
                "bg-background/60 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums shadow-sm backdrop-blur",
                trendColor,
              )}
            >
              {TrendArrow}
              {trend.label}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-mono leading-none font-black tracking-[-0.02em] tabular-nums",
              compact ? "text-[28px]" : "text-[44px]",
              a.primaryText,
            )}
          >
            {primary.value}
          </span>
          {primary.unit ? (
            <span
              className={cn(
                "text-muted-foreground font-medium",
                compact ? "text-[13px]" : "text-[16px]",
              )}
            >
              {primary.unit}
            </span>
          ) : null}
        </div>
        <div
          className={cn(
            "text-muted-foreground font-medium",
            compact ? "mt-1 text-[12px]" : "mt-1.5 text-[14px]",
          )}
        >
          {primary.label}
        </div>

        {secondary ? (
          <div
            className={cn(
              "border-border/60 flex items-center justify-between border-t",
              compact ? "mt-2.5 pt-2" : "mt-4 pt-3",
            )}
          >
            <span
              className={cn(
                "text-muted-foreground font-medium",
                compact ? "text-[13px]" : "text-[14px]",
              )}
            >
              {secondary.label}
            </span>
            <span
              className={cn(
                "text-foreground font-mono font-semibold tabular-nums",
                compact ? "text-[14px]" : "text-[16px]",
              )}
            >
              {secondary.value}
              {secondary.unit ? (
                <span
                  className={cn(
                    "text-muted-foreground ml-1 font-medium",
                    compact ? "text-[11px]" : "text-[13px]",
                  )}
                >
                  {secondary.unit}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
