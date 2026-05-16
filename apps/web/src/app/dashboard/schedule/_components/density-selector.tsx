"use client";

// density-selector.tsx
// Why: segmented 4-button control for picking schedule card density.
// Segmented (not dropdown, not cycle) — all options visible simultaneously,
// zero extra clicks versus dropdown. Matches weekSpan toggle pattern from
// planner-command-bar.tsx L120-137.

import { Maximize2, Rows3, Rows4, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

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
  value,
  onChange,
  visible = true,
  "data-testid": testId = "schedule-density-selector",
}: DensitySelectorProps) {
  if (!visible) return null;

  return (
    <div className="border-border bg-muted flex rounded-lg border p-0.5" data-testid={testId}>
      {DENSITY_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            title={option.title}
            aria-pressed={isActive}
            data-testid={`schedule-density-button-${option.value}`}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive ? <span className="text-orange-500">{option.icon}</span> : option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
