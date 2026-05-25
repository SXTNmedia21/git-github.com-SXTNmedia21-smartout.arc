"use client";

import { cn } from "../lib/utils";

export type FilterChipProps = {
  label: string;
  active: boolean;
  onToggle: (next: boolean) => void;
  count?: number;
  tone?: "default" | "destructive" | "warning";
  className?: string;
};

/**
 * FilterChip — boolean filter affordance rendered as inline pill.
 *
 * Active = fg/bg inverted (Manager Timeline chip recipe). Inactive = muted bg.
 * Optional count badge shown when count > 0; tone variant tints the badge
 * (destructive for "Avvik" count, warning for at-risk threshold, default
 * for neutral counts like "Kun åpne").
 *
 * Used by: P11 TimelineToolbar (filter chips), P10 TidslinjeTab (follow-up).
 *
 * Warning tone: uses `bg-warning/20 text-warning-foreground` — semantic token
 * from design-tokens warningForeground (oklch 0.75 0.15 75), mapped to
 * --color-warning / --color-warning-foreground via globals.css. No yellow-*
 * fallback needed; token resolves in Tailwind v4 via --color-* mapping.
 *
 * Nordic Split: semantic tokens only, no hardcoded colors, no OKLCH literals.
 * WCAG 2.4.11: focus-visible ring for keyboard navigation.
 * WCAG 4.1.2: aria-pressed reflects active state.
 */
export function FilterChip({
  label,
  active,
  onToggle,
  count,
  tone = "default",
  className,
}: FilterChipProps) {
  const showBadge = typeof count === "number" && count > 0;

  const inactiveBadgeTone =
    tone === "destructive"
      ? "bg-destructive/20 text-destructive-foreground"
      : tone === "warning"
        ? "bg-warning/20 text-warning-foreground"
        : "bg-background text-muted-foreground";

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle(!active)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-muted text-foreground hover:bg-background",
        className,
      )}
    >
      {label}
      {showBadge && (
        <span
          className={cn(
            "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums",
            active ? "bg-background/20 text-background" : inactiveBadgeTone,
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
