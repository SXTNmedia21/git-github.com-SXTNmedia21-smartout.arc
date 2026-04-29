"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { ChevronDown } from "lucide-react";
import type { SignalStatus } from "@/app/dashboard/_hooks/dashboard-types";

// UI Events:
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - visual: sparkline renders 7-point SVG trend line
// - visual: progressBar renders completion bar
// - visual: ringChart renders animated donut chart
// - interaction: click toggles expandContent panel
// - interaction: hover shows subtle glow pulse

/** Parse a value like "74%" → { num: 74, suffix: "%" } or 74 → { num: 74, suffix: "" } */
function parseNumeric(value: string | number): { num: number; suffix: string } | null {
  if (typeof value === "number") return { num: value, suffix: "" };
  const match = /^(\d+(?:\.\d+)?)(.*)?$/.exec(value.trim());
  if (!match || match[1] === undefined) return null;
  return { num: parseFloat(match[1]), suffix: match[2] ?? "" };
}

function useCountUp(target: number, duration = 1100): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

type SparklineData = number[];

type ProgressBarData = {
  value: number;
  max: number;
};

type RingChartData = {
  value: number;
  max: number;
  label?: string;
};

interface SignalCardProps {
  label: string;
  value: string | number;
  target?: string;
  subtitle?: string;
  status: SignalStatus;
  icon: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  secondary?: string;
  sparkline?: SparklineData;
  progressBar?: ProgressBarData;
  ringChart?: RingChartData;
  expandContent?: ReactNode;
  defaultExpanded?: boolean;
  isActive?: boolean;
  onCardClick?: () => void;
}

const STATUS_STYLES = {
  good: {
    glow: "bg-emerald-500/10",
    glowPulse: "bg-emerald-500/20",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    value: "text-foreground",
    trend: "text-emerald-500",
    bar: "bg-emerald-500",
    sparkStroke: "stroke-emerald-500",
    ring: "stroke-emerald-500",
    ringTrack: "stroke-emerald-500/15",
    accent: "text-emerald-500",
    expandBg: "bg-emerald-500/5 border-emerald-500/10",
  },
  warning: {
    glow: "bg-orange-500/10",
    glowPulse: "bg-orange-500/20",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    value: "text-orange-500",
    trend: "text-orange-500",
    bar: "bg-orange-500",
    sparkStroke: "stroke-orange-500",
    ring: "stroke-orange-500",
    ringTrack: "stroke-orange-500/15",
    accent: "text-orange-500",
    expandBg: "bg-orange-500/5 border-orange-500/10",
  },
  critical: {
    glow: "bg-red-500/10",
    glowPulse: "bg-red-500/20",
    icon: "border-red-500/20 bg-red-500/10 text-red-500",
    value: "text-red-500",
    trend: "text-red-500",
    bar: "bg-red-500",
    sparkStroke: "stroke-red-500",
    ring: "stroke-red-500",
    ringTrack: "stroke-red-500/15",
    accent: "text-red-500",
    expandBg: "bg-red-500/5 border-red-500/10",
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

function RingChart({
  data,
  ringClass,
  trackClass,
  accentClass,
}: {
  data: RingChartData;
  ringClass: string;
  trackClass: string;
  accentClass: string;
}) {
  const targetPercent = data.max > 0 ? Math.min((data.value / data.max) * 100, 100) : 0;
  const [mounted, setMounted] = useState(false);
  const animatedCount = useCountUp(Math.round(targetPercent), 1200);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const displayPercent = mounted ? targetPercent : 0;
  const strokeDashoffset = circumference - (displayPercent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        {/* Track */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={trackClass}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={ringClass}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: `stroke-dashoffset ${(motionTokens.enterMs * 2.4) / 1000}s cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        />
      </svg>
      <span className={`absolute text-xs font-black ${accentClass}`}>
        {data.label ?? `${mounted ? animatedCount : 0}%`}
      </span>
    </div>
  );
}

function ProgressBar({ data, barClass }: { data: ProgressBarData; barClass: string }) {
  const percent = data.max > 0 ? Math.round((data.value / data.max) * 100) : 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full ${barClass} transition-all duration-1000 ease-out`}
        style={{ width: mounted ? `${percent}%` : "0%" }}
      />
    </div>
  );
}

export function SignalCard({
  label,
  value,
  target,
  subtitle,
  status,
  icon,
  trend,
  secondary,
  sparkline,
  progressBar,
  ringChart,
  expandContent,
  defaultExpanded = false,
  isActive,
  onCardClick,
}: SignalCardProps) {
  const [isExpandedInternal, setIsExpandedInternal] = useState(defaultExpanded);
  // If onCardClick is provided, card is externally controlled — use isActive
  const isControlled = onCardClick !== undefined;
  const isExpanded = isControlled ? (isActive ?? false) : isExpandedInternal;
  const isClickable = isControlled || !!expandContent;
  const styles = STATUS_STYLES[status];
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Count-up animation for numeric values (e.g. "74%" or 85)
  const parsed = parseNumeric(value);
  const countedUp = useCountUp(parsed?.num ?? 0, 1100);
  const displayValue = parsed !== null ? `${countedUp}${parsed.suffix}` : value;

  return (
    <div
      className={`group border-border bg-card relative overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md ${isClickable ? "cursor-pointer" : ""} ${isExpanded ? "shadow-md" : ""}`}
      onClick={
        isClickable
          ? isControlled
            ? onCardClick
            : () => setIsExpandedInternal((v) => !v)
          : undefined
      }
    >
      {/* Ambient glow */}
      <div
        className={`pointer-events-none absolute -top-4 -right-4 h-24 w-24 rounded-full ${styles.glow} blur-2xl transition-all duration-500 group-hover:h-32 group-hover:w-32 group-hover:opacity-100 ${
          isExpanded ? `h-32 w-32 ${styles.glowPulse}` : "opacity-60"
        }`}
      />

      {/* Main content */}
      <div className="relative z-10 p-5">
        {/* Header row */}
        <div className="mb-1 flex items-center gap-3">
          <div className={`rounded-lg border p-2 ${styles.icon}`}>{icon}</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {label}
            </h3>
            {subtitle && (
              <p className="text-muted-foreground/70 mt-0.5 text-[10px] leading-tight">
                {subtitle}
              </p>
            )}
          </div>
          {isClickable && (
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        {/* Value row */}
        <div className="mt-3 flex items-end gap-3">
          {ringChart ? (
            <RingChart
              data={ringChart}
              ringClass={styles.ring}
              trackClass={styles.ringTrack}
              accentClass={styles.accent}
            />
          ) : (
            <span className={`text-3xl leading-none font-bold ${styles.value}`}>
              {displayValue}
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {!ringChart && sparkline && (
              <Sparkline data={sparkline} className={styles.sparkStroke} />
            )}
            {ringChart && (
              <span className={`text-2xl leading-none font-bold ${styles.value}`}>
                {displayValue}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {target && (
                <span className="text-muted-foreground text-xs font-medium">{target}</span>
              )}
              {trend && (
                <span className={`text-xs font-medium ${styles.trend}`}>
                  {trend.direction === "up"
                    ? "\u2191"
                    : trend.direction === "down"
                      ? "\u2193"
                      : "\u2192"}{" "}
                  {trend.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {progressBar && (
          <div className="mt-1">
            <ProgressBar data={progressBar} barClass={styles.bar} />
          </div>
        )}

        {secondary && (
          <p className="text-muted-foreground mt-2 text-xs font-semibold">{secondary}</p>
        )}
      </div>

      {/* Expand panel — grid-rows trick for smooth height animation */}
      {expandContent && (
        <div
          className={`relative z-10 border-t ${isExpanded ? styles.expandBg : "border-transparent"}`}
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            transition: prefersReducedMotion
              ? "none"
              : `grid-template-rows ${motionTokens.enterMs * 0.76}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${motionTokens.exitMs * 1.12}ms ease`,
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div className="p-4">{expandContent}</div>
          </div>
        </div>
      )}
    </div>
  );
}
