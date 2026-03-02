"use client";

import type { ReactNode } from "react";
import type { SignalStatus } from "@/app/dashboard/_hooks/dashboard-types";

interface SignalCardProps {
  isDark: boolean;
  label: string;
  value: string | number;
  target?: string;
  status: SignalStatus;
  icon: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  isPlaceholder?: boolean;
}

const STATUS_STYLES = {
  good: {
    border: { dark: "border-emerald-500/20", light: "border-emerald-200" },
    glow: "bg-emerald-500/10",
    icon: {
      dark: "border-zinc-800 bg-zinc-900 text-emerald-400",
      light: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    value: { dark: "text-white", light: "text-zinc-900" },
    trend: { dark: "text-emerald-400", light: "text-emerald-600" },
  },
  warning: {
    border: { dark: "border-orange-500/20", light: "border-orange-200" },
    glow: "bg-orange-500/10",
    icon: {
      dark: "border-orange-500/20 bg-orange-500/10 text-orange-500",
      light: "border-orange-200 bg-orange-50 text-orange-600",
    },
    value: { dark: "text-orange-400", light: "text-orange-600" },
    trend: { dark: "text-orange-400", light: "text-orange-600" },
  },
  critical: {
    border: { dark: "border-red-500/20", light: "border-red-200" },
    glow: "bg-red-500/10",
    icon: {
      dark: "border-red-500/20 bg-red-500/10 text-red-500",
      light: "border-red-200 bg-red-50 text-red-600",
    },
    value: { dark: "text-red-400", light: "text-red-600" },
    trend: { dark: "text-red-400", light: "text-red-600" },
  },
} as const;

export function SignalCard({
  isDark,
  label,
  value,
  target,
  status,
  icon,
  trend,
  isPlaceholder,
}: SignalCardProps) {
  const styles = STATUS_STYLES[status];
  const theme = isDark ? "dark" : "light";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 ${
        isDark ? `border-zinc-800/50 bg-zinc-950` : `border-zinc-200 bg-white`
      } ${isPlaceholder ? "opacity-60" : ""}`}
    >
      <div
        className={`absolute -top-4 -right-4 h-24 w-24 rounded-full ${styles.glow} blur-2xl transition-colors group-hover:opacity-80`}
      />
      <div className="relative z-10 mb-3 flex items-center gap-3">
        <div className={`rounded-lg border p-2 ${styles.icon[theme]}`}>{icon}</div>
        <h3
          className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
        >
          {label}
          {isPlaceholder && (
            <span className="ml-1.5 rounded bg-zinc-500/20 px-1 py-0.5 text-[9px] font-bold tracking-normal text-zinc-500 normal-case">
              Soon
            </span>
          )}
        </h3>
      </div>
      <div className="relative z-10 flex items-end gap-2">
        <span className={`text-3xl leading-none font-bold ${styles.value[theme]}`}>
          {isPlaceholder ? "--" : value}
        </span>
        {target && (
          <span
            className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
          >
            {target}
          </span>
        )}
        {trend && (
          <span className={`mb-0.5 text-sm font-medium ${styles.trend[theme]}`}>
            {trend.direction === "up" ? "\u2191" : trend.direction === "down" ? "\u2193" : "\u2192"}{" "}
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
