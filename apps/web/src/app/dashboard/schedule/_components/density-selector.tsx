"use client";

// density-selector.tsx
// Why: segmented 4-button control for picking schedule card density.
// Segmented (not dropdown, not cycle) — all options visible simultaneously,
// zero extra clicks versus dropdown. Matches weekSpan toggle pattern from
// planner-command-bar.tsx L120-137.

import { Maximize2, Rows3, Rows4, Activity } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The four density tiers. Exported for use by consumers (context, sandbox, bridge). */
export type ScheduleDensity = "cozy" | "default" | "compact" | "pulse";

type DensityOption = {
  value: ScheduleDensity;
  label: string;
  icon: React.ReactNode;
  title: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

const DENSITY_OPTIONS: DensityOption[] = [
  {
    value: "cozy",
    label: "Romslig",
    icon: <Maximize2 className="h-3 w-3" />,
    title: "Romslig visning — 120px rader, full korttekst",
  },
  {
    value: "default",
    label: "Standard",
    icon: <Rows3 className="h-3 w-3" />,
    title: "Standard visning — 100px rader",
  },
  {
    value: "compact",
    label: "Kompakt",
    icon: <Rows4 className="h-3 w-3" />,
    title: "Kompakt visning — 52px rader, kun rolle + tid",
  },
  {
    value: "pulse",
    label: "Puls",
    icon: <Activity className="h-3 w-3" />,
    title: "Puls-modus — 28px hetekart, konflikter rømmer til 40px mini-kort",
  },
];

type DensitySelectorProps = {
  value: ScheduleDensity;
  onChange: (next: ScheduleDensity) => void;
  /** Whether the control is visible — pass false when layout != daily. */
  visible?: boolean;
  /** data-testid forwarded to the segmented group root (T7 E2E contract). */
  "data-testid"?: string;
};

/**
 * DensitySelector — 4-button segmented group for schedule card density.
 *
 * Active-state styling mirrors the weekSpan toggle at planner-command-bar.tsx:120-137:
 * container `border-border bg-muted rounded-lg border p-0.5`, active button
 * `bg-background text-foreground shadow-sm`, inactive `text-muted-foreground hover:text-foreground`.
 *
 * data-testid contract (T7 E2E specs):
 *   - Root div: passed via prop (default "schedule-density-selector")
 *   - Buttons: "schedule-density-button-{cozy|default|compact|pulse}"
 */
export function DensitySelector({
  value: _value,
  onChange: _onChange,
  visible: _visible = true,
  "data-testid": _testId = "schedule-density-selector",
}: DensitySelectorProps) {
  // Pontus 2026-05-19: density selector hidden on schedule top bar.
  // Component returns null but kept as no-op for callers / tests.
  // Restore the full markup (segmented button group with DENSITY_OPTIONS)
  // from git history if re-introducing.
  return null;
}
