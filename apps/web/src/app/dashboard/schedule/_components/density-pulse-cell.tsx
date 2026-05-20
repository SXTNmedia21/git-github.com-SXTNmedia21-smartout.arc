"use client";

// density-pulse-cell.tsx
// Why: Pulse-mode cell renderers for the daily-grid.
// Two visual paths per §8 of the density plan:
//   - PulseHeatmap: colored div at 60% opacity of majority indicator (28px row)
//   - PulseMiniCard: 4px strip + role initials + short time (40px row, conflict escape)
// DensityStrip is reused for the mini-card rail — single source of role/conflict color.

import React from "react";
import { DensityStrip, type ShiftIndicator } from "./density-strip";
import { formatTimeShort } from "../_utils/format-time";

// ── Indicator color map at 60% opacity for heatmap cells ─────────────────────
// Mirrors SHIFT_INDICATOR_STYLES from draggable-card-views (40% opacity base),
// raised to 60% so the heatmap reads on the bg-background/40 cell.
const HEATMAP_INDICATOR_STYLES: Record<ShiftIndicator, string> = {
  blue: "bg-blue-400/60",
  emerald: "bg-emerald-400/60",
  purple: "bg-purple-400/60",
  orange: "bg-orange-400/60",
};

function normalizeIndicator(indicator: string): ShiftIndicator {
  if (
    indicator === "blue" ||
    indicator === "emerald" ||
    indicator === "purple" ||
    indicator === "orange"
  ) {
    return indicator;
  }
  return "orange";
}

/**
 * Derives the majority indicator from a list of indicator strings.
 * Returns "orange" as the default when the list is empty.
 */
function majorityIndicator(indicators: string[]): ShiftIndicator {
  if (indicators.length === 0) return "orange";
  const counts = new Map<string, number>();
  for (const ind of indicators) {
    counts.set(ind, (counts.get(ind) ?? 0) + 1);
  }
  let maxCount = 0;
  let majority: ShiftIndicator = "orange";
  for (const [ind, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      majority = normalizeIndicator(ind);
    }
  }
  return majority;
}

// ── PulseHeatmap — solid-color cell for non-conflict shifts ──────────────────

type PulseHeatmapProps = {
  /** All indicators in the cell — majority wins for color. */
  indicators: string[];
};

/**
 * PulseHeatmap — renders a solid color block at 60% opacity of the majority
 * indicator. Used in Pulse mode when NO shifts in the cell have conflicts.
 *
 * Per plan §8 V1: color = SHIFT_INDICATOR_STYLES of majority indicator at 60%
 * opacity. NOT D4 demand intensity — tokens already available, ships V1.
 */
export const PulseHeatmap = React.memo(function PulseHeatmap({ indicators }: PulseHeatmapProps) {
  const majority = majorityIndicator(indicators);
  const colorClass = HEATMAP_INDICATOR_STYLES[majority];

  return (
    <div
      className={`h-full w-full ${colorClass} rounded-sm`}
      data-testid="schedule-pulse-heatmap"
    />
  );
});

// ── PulseMiniCard — conflict-escape mini card with strip + initials + time ───

type PulseMiniCardShift = {
  id: string;
  role: string;
  startTime: string;
  endTime: string;
  indicator: string;
  hasConflict: boolean;
};

type PulseMiniCardProps = {
  shift: PulseMiniCardShift;
};

/**
 * PulseMiniCard — compact 40px escape card for Pulse cells with conflicts.
 *
 * Renders: 4px DensityStrip rail (red on conflict) + role initials (2 chars) +
 * short time via formatTimeShort. Click-target is full cell — drag handler
 * is the same as normal cards (Pulse is NOT read-only per plan §8).
 */
export const PulseMiniCard = React.memo(function PulseMiniCard({ shift }: PulseMiniCardProps) {
  const initials = shift.role.slice(0, 2).toUpperCase();
  const shortTime = formatTimeShort(shift.startTime, shift.endTime);

  return (
    <div
      className="relative flex items-center gap-1.5 overflow-hidden rounded-md py-0.5 pr-1 pl-2"
      data-testid="schedule-pulse-conflict-card"
    >
      <DensityStrip indicator={shift.indicator} hasConflict={shift.hasConflict} tier="compact" />
      <span className="text-foreground text-[10px] leading-none font-black">{initials}</span>
      <span className="text-muted-foreground ml-auto text-[9px] leading-none font-medium whitespace-nowrap">
        {shortTime}
      </span>
    </div>
  );
});
