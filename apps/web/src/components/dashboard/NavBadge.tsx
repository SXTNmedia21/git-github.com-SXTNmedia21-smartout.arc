"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * NavBadge — sidebar variant of the people-data-table StatusBadge.
 *
 * Shares the uppercase-tracking pill language so tags feel consistent
 * across dashboard surfaces, scaled down (9px / px-1.5) to fit next to
 * the 12px NavItem label.
 *
 * Multiple indicators stack right-aligned; in collapsed sidebar mode
 * each indicator collapses to a small dot overlay on the icon corner
 * (stacked vertically when there are several).
 */
export type NavBadgeVariant =
  | { type: "count"; value: number }
  | { type: "live" }
  | { type: "warning"; value?: number; label?: string }
  | { type: "attention" }
  | { type: "text"; label: string };

function formatCount(value: number): string {
  return value > 99 ? "99+" : String(value);
}

/**
 * Expanded rendering — pill with icon/dot + value. Right-aligned by parent.
 */
export function NavBadgePill({ variant }: { variant: NavBadgeVariant }) {
  const base =
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase";

  switch (variant.type) {
    case "count":
      return (
        <span
          className={cn(base, "border-orange-500/20 bg-orange-500/10 text-orange-500")}
          aria-label={`${variant.value} uleste`}
        >
          {formatCount(variant.value)}
        </span>
      );

    case "live":
      return (
        <span
          className={cn(base, "border-rose-500/25 bg-rose-500/10 text-rose-500")}
          aria-label="Live"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
          </span>
          Live
        </span>
      );

    case "warning":
      return (
        <span
          className={cn(base, "border-orange-500/25 bg-orange-500/10 text-orange-500")}
          aria-label={variant.label ?? "Krever handling"}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {variant.label ?? (variant.value != null ? formatCount(variant.value) : null)}
        </span>
      );

    case "attention":
      return (
        <span
          className={cn(base, "border-orange-500/20 bg-orange-500/10 px-1 py-0.5 text-orange-500")}
          aria-label="Nytt"
        >
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-orange-500" />
        </span>
      );

    case "text":
      return (
        <span className={cn(base, "bg-secondary text-muted-foreground border-transparent")}>
          {variant.label}
        </span>
      );
  }
}

/**
 * Collapsed rendering — small dot overlay on the icon's top-right corner.
 * No text, just colour. Parent provides the `relative` positioning context.
 */
export function NavBadgeDot({ variant }: { variant: NavBadgeVariant }) {
  switch (variant.type) {
    case "live":
      return (
        <span className="flex h-2 w-2" aria-label="Live">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[var(--background,#fff)]" />
        </span>
      );

    case "warning":
      return (
        <span
          className="inline-flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[var(--background,#fff)]"
          aria-label={variant.label ?? "Krever handling"}
        />
      );

    case "count":
    case "attention":
    case "text":
      return (
        <span
          className="inline-flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[var(--background,#fff)]"
          aria-label={variant.type === "count" ? `${variant.value} uleste` : "Nytt"}
        />
      );
  }
}
