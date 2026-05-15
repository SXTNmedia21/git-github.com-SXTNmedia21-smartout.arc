"use client";

// density-strip.tsx
// Why: single component for the 4px left rail present in every density tier.
// Centralises role-color vs conflict-color logic so neither ShiftCardView
// nor the Pulse mini-card need duplicated switch logic.
//
// T5 E4 consolidation: SHIFT_INDICATOR_STYLES is now imported from the
// authoritative draggable-card-views.tsx source. The local mirror is removed.

import { cn } from "@/lib/utils";
import { SHIFT_INDICATOR_STYLES } from "./draggable-card-views";

// ── Indicator type + style map ────────────────────────────────────────────────
export type ShiftIndicator = "blue" | "emerald" | "purple" | "orange";

// Re-export so downstream consumers (density-pulse-cell.tsx etc.) can import
// the canonical map without reaching into draggable-card-views directly.
export const SHIFT_INDICATOR_STYLES_MAP: Record<ShiftIndicator, string> = SHIFT_INDICATOR_STYLES;

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

// ── Component ─────────────────────────────────────────────────────────────────

export type ScheduleDensityTier = "cozy" | "default" | "compact" | "pulse";

type DensityStripProps = {
  /** Key from SHIFT_INDICATOR_STYLES — determines role color when no conflict. */
  indicator: string;
  /** When true the strip switches to bg-destructive (conflict signal, C2). */
  hasConflict: boolean;
  /** Controls strip width: w-1 for cozy/default, w-0.5 for compact/pulse. */
  tier: ScheduleDensityTier;
};

/**
 * DensityStrip — 4px left rail present in all 4 density tiers.
 *
 * Color: bg-destructive when conflict, otherwise SHIFT_INDICATOR_STYLES role color.
 * Width: w-1 (cozy/default), w-0.5 (compact/pulse) — matches existing card patterns.
 * Positioning: absolute, full card height inset 2px top/bottom.
 */
export function DensityStrip({ indicator, hasConflict, tier }: DensityStripProps) {
  const normalizedIndicator = normalizeIndicator(indicator);
  const colorClass = hasConflict
    ? "bg-destructive"
    : SHIFT_INDICATOR_STYLES_MAP[normalizedIndicator];
  const widthClass = tier === "compact" || tier === "pulse" ? "w-0.5" : "w-1";

  return (
    <div
      className={cn("absolute top-2 bottom-2 left-0 rounded-r-full", widthClass, colorClass)}
      data-testid="density-strip"
      data-conflict={hasConflict ? "true" : undefined}
    />
  );
}
