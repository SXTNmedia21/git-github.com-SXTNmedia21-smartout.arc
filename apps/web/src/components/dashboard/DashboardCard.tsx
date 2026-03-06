"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// UI Events:
// - color-regime: status-based (good=emerald, warning=orange, bad=red)
// - visual: ambient glow orb top-right, status-colored
// - visual: icon in bordered pill top-left
// - visual: status badge top-right (OK / Varsel / Handling)
// - interaction: hover flips card to show explanation text
// - interaction: click expands panel OR calls onCardClick
// - visual: optional sparkline, progressBar, ringChart

type SparklineData = number[];
type ProgressBarData = { value: number; max: number };
type RingChartData = { value: number; max: number; label?: string };

export interface DashboardCardProps {
  label: string;
  value: string | ReactNode;
  icon: ReactNode;
  status: "good" | "warning" | "bad" | "critical"; // critical = alias for bad
  subtitle?: string;
  target?: string;
  secondary?: string;
  explanation?: string;
  sparkline?: SparklineData;
  progressBar?: ProgressBarData;
  ringChart?: RingChartData;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  expandContent?: ReactNode;
  isActive?: boolean;
  onCardClick?: () => void;
  isDark?: boolean;
}

const STATUS_STYLES = {
  good: {
    glow: "bg-emerald-500/10",
    glowHover: "bg-emerald-500/20",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    value: "text-foreground",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
    trend: "text-emerald-500",
    bar: "bg-emerald-500",
    sparkStroke: "stroke-emerald-500",
    ring: "stroke-emerald-500",
    ringTrack: "stroke-emerald-500/15",
    expandBg: "bg-emerald-500/5 border-emerald-500/10",
  },
  warning: {
    glow: "bg-orange-500/10",
    glowHover: "bg-orange-500/20",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    value: "text-foreground",
    badge:
      "border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400",
    trend: "text-orange-500",
    bar: "bg-orange-500",
    sparkStroke: "stroke-orange-500",
    ring: "stroke-orange-500",
    ringTrack: "stroke-orange-500/15",
    expandBg: "bg-orange-500/5 border-orange-500/10",
  },
  bad: {
    glow: "bg-red-500/10",
    glowHover: "bg-red-500/20",
    icon: "border-red-500/20 bg-red-500/10 text-red-500",
    value: "text-foreground",
    badge:
      "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400",
    trend: "text-red-500",
    bar: "bg-red-500",
    sparkStroke: "stroke-red-500",
    ring: "stroke-red-500",
    ringTrack: "stroke-red-500/15",
    expandBg: "bg-red-500/5 border-red-500/10",
  },
} as const;

function resolveStatus(status: DashboardCardProps["status"]) {
  return status === "critical" ? "bad" : status;
}

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
  const percent = data.max > 0 ? Math.min((data.value / data.max) * 100, 100) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={trackClass}
          strokeLinecap="round"
        />
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
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <span className={`absolute text-xs font-black ${accentClass}`}>
        {data.label ?? `${Math.round(percent)}%`}
      </span>
    </div>
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

export function DashboardCard({
  label,
  value,
  icon,
  status,
  subtitle,
  target,
  secondary,
  explanation,
  sparkline,
  progressBar,
  ringChart,
  trend,
  expandContent,
  isActive,
  onCardClick,
  isDark,
}: DashboardCardProps) {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const resolved = resolveStatus(status);
  const styles = STATUS_STYLES[resolved];

  const isControlled = onCardClick !== undefined;
  const isExpanded = isControlled ? (isActive ?? false) : isExpandedInternal;
  const isClickable = isControlled || !!expandContent;

  const badgeLabel = resolved === "good" ? "OK" : resolved === "warning" ? "Varsel" : "Handling";
  const BadgeIcon = resolved === "good" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={`group relative min-h-[100px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-zinc-800 dark:bg-[#0c0c0e] ${isClickable ? "cursor-pointer" : ""} ${isExpanded ? "shadow-md" : ""}`}
      onClick={
        isClickable
          ? isControlled
            ? onCardClick
            : () => setIsExpandedInternal((v) => !v)
          : undefined
      }
      onMouseEnter={() => {
        if (explanation && !isExpanded) setShowExplanation(true);
      }}
      onMouseLeave={() => setShowExplanation(false)}
    >
      {/* Ambient glow */}
      <div
        className={`pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl transition-all duration-500 group-hover:opacity-100 ${styles.glow} ${isExpanded ? `${styles.glowHover} h-32 w-32` : "opacity-60"}`}
      />

      {/* Card face — flips between front and explanation */}
      <AnimatePresence mode="wait" initial={false}>
        {showExplanation && explanation ? (
          <motion.div
            key="back"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="text-foreground relative z-10 flex h-full min-h-[100px] flex-col justify-center p-4"
          >
            <h3 className="mb-2 text-sm font-bold break-words text-emerald-500">
              Hvordan beregnes dette?
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">{explanation}</p>
          </motion.div>
        ) : (
          <motion.div
            key="front"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 p-4"
          >
            {/* Header row */}
            <div className="mb-2 flex items-start justify-between">
              <div className={`rounded-xl border p-2.5 ${styles.icon}`}>{icon}</div>

              <div className="flex items-center gap-2">
                {/* Status badge */}
                <div
                  className={`flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm ${styles.badge}`}
                >
                  <BadgeIcon className="h-3 w-3" />
                  {badgeLabel}
                </div>

                {/* Chevron when expandable */}
                {isClickable && !isControlled && (
                  <ChevronDown
                    className={`text-muted-foreground h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                  />
                )}
              </div>
            </div>

            {/* Label + subtitle */}
            <div className="mb-2">
              <h3 className="text-muted-foreground text-sm font-bold">{label}</h3>
              {subtitle && (
                <p className="text-muted-foreground/70 mt-0.5 text-[10px] leading-tight">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Value row */}
            <div className="flex items-end gap-3">
              {ringChart ? (
                <RingChart
                  data={ringChart}
                  ringClass={styles.ring}
                  trackClass={styles.ringTrack}
                  accentClass={styles.trend}
                />
              ) : (
                <span className={`text-foreground text-2xl leading-none font-black`}>{value}</span>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {!ringChart && sparkline && (
                  <Sparkline data={sparkline} className={styles.sparkStroke} />
                )}
                {ringChart && (
                  <span className="text-foreground text-2xl leading-none font-black">{value}</span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {target && (
                    <span className="text-muted-foreground text-xs font-medium">{target}</span>
                  )}
                  {trend && (
                    <span className={`text-xs font-medium ${styles.trend}`}>
                      {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
                      {trend.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {progressBar && <ProgressBar data={progressBar} barClass={styles.bar} />}
            {secondary && (
              <p className="text-muted-foreground mt-2 text-xs font-semibold">{secondary}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand panel */}
      {expandContent && (
        <div
          className={`relative z-10 border-t ${isExpanded ? styles.expandBg : "border-transparent"}`}
          style={{
            display: "grid",
            gridTemplateRows: isExpanded ? "1fr" : "0fr",
            transition: "grid-template-rows 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 280ms ease",
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
