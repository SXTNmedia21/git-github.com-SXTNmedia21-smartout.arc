"use client";

import type { ReactNode } from "react";
import type { SignalStatus } from "@/app/dashboard/_hooks/dashboard-types";

// UI Events:
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - visual: sparkline renders 7-point SVG trend line
// - visual: progressBar renders completion bar

type SparklineData = number[];

type ProgressBarData = {
  value: number;
  max: number;
};

interface SignalCardProps {
  label: string;
  value: string | number;
  target?: string;
  status: SignalStatus;
  icon: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  secondary?: string;
  sparkline?: SparklineData;
  progressBar?: ProgressBarData;
}

const STATUS_STYLES = {
  good: {
    glow: "bg-emerald-500/10",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    value: "text-foreground",
    trend: "text-emerald-500",
    bar: "bg-emerald-500",
    sparkStroke: "stroke-emerald-500",
  },
  warning: {
    glow: "bg-orange-500/10",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    value: "text-orange-500",
    trend: "text-orange-500",
    bar: "bg-orange-500",
    sparkStroke: "stroke-orange-500",
  },
  critical: {
    glow: "bg-red-500/10",
    icon: "border-red-500/20 bg-red-500/10 text-red-500",
    value: "text-red-500",
    trend: "text-red-500",
    bar: "bg-red-500",
    sparkStroke: "stroke-red-500",
  },
} as const;

function Sparkline({ data, className }: { data: SparklineData; className: string }) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 24;
  const padding = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-6 w-20 ${className}`}
      fill="none"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="fill-none"
      />
    </svg>
  );
}

function ProgressBar({ data, barClass }: { data: ProgressBarData; barClass: string }) {
  const percent = data.max > 0 ? Math.round((data.value / data.max) * 100) : 0;

  return (
    <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full ${barClass} transition-all duration-1000 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function SignalCard({
  label,
  value,
  target,
  status,
  icon,
  trend,
  secondary,
  sparkline,
  progressBar,
}: SignalCardProps) {
  const styles = STATUS_STYLES[status];

  return (
    <div className="group border-border bg-card relative overflow-hidden rounded-2xl border p-5">
      <div
        className={`absolute -top-4 -right-4 h-24 w-24 rounded-full ${styles.glow} blur-2xl transition-colors group-hover:opacity-80`}
      />
      <div className="relative z-10 mb-3 flex items-center gap-3">
        <div className={`rounded-lg border p-2 ${styles.icon}`}>{icon}</div>
        <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          {label}
        </h3>
      </div>
      <div className="relative z-10 flex items-end gap-2">
        <span className={`text-3xl leading-none font-bold ${styles.value}`}>{value}</span>
        {sparkline && <Sparkline data={sparkline} className={styles.sparkStroke} />}
        {target && (
          <span className="text-muted-foreground mb-0.5 text-sm font-medium">{target}</span>
        )}
        {trend && (
          <span className={`mb-0.5 text-sm font-medium ${styles.trend}`}>
            {trend.direction === "up" ? "\u2191" : trend.direction === "down" ? "\u2193" : "\u2192"}{" "}
            {trend.label}
          </span>
        )}
      </div>
      {progressBar && (
        <div className="relative z-10">
          <ProgressBar data={progressBar} barClass={styles.bar} />
        </div>
      )}
      {secondary && (
        <p className="text-muted-foreground relative z-10 mt-2 text-xs font-semibold">
          {secondary}
        </p>
      )}
    </div>
  );
}
