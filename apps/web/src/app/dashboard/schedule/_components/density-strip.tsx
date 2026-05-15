"use client";

// density-strip.tsx
// Why: single component for the 4px left rail present in every density tier.
// Centralises role-color vs conflict-color logic so neither ShiftCardView
// (T5) nor the Pulse mini-card need duplicated switch logic.
//
// NOTE: SHIFT_INDICATOR_STYLES is not yet exported from draggable-card-views.tsx
// (that file must not be modified in the sandbox phase). This file maintains an
// identical mirror. T5 live integration will export the map from the source file
// and remove this mirror.

import { cn } from "@/lib/utils";

// ── Indicator type + style map ────────────────────────────────────────────────
// Mirror of SHIFT_INDICATOR_STYLES in draggable-card-views.tsx.
// Values MUST stay in sync until T5 consolidates the export.
export type ShiftIndicator = "blue" | "emerald" | "purple" | "orange";

export const SHIFT_INDICATOR_STYLES_MAP: Record<ShiftIndicator, string> = {
  blue: "bg-blue-400/40",
  emerald: "bg-emerald-400/40",
  purple: "bg-purple-400/40",
  orange: "bg-orange-400/40",
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
    <div className={cn("absolute top-2 bottom-2 left-0 rounded-r-full", widthClass, colorClass)} />
  );
}
