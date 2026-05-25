"use client";

/**
 * SegmentGroup — exclusive-choice pill row (radio-group semantics).
 *
 * WHY: Multiple dashboard surfaces (P11 TimelineToolbar view-mode switcher,
 * P10 TidslinjeTab) each reimplemented ad-hoc TabButton variants with
 * inconsistent ARIA and token usage. SegmentGroup is the single primitive
 * for all "pick one from N" pill patterns (WCAG 4.1.2 compliance).
 *
 * Design: active segment inverts fg/bg per Manager Timeline chip recipe.
 * Nordic Split: semantic tokens only — no hardcoded colors, no OKLCH literals.
 */

import { cn } from "../lib/utils";

export type Segment<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SegmentGroupProps<T extends string> = {
  /** Currently selected value — controlled. */
  value: T;
  /** Called with the new value when the user clicks a segment. */
  onValueChange: (next: T) => void;
  /** List of segments to render. */
  segments: ReadonlyArray<Segment<T>>;
  /** Additional className applied to the container. */
  className?: string;
  /** Visual size. Defaults to "md". */
  size?: "sm" | "md";
};

export function SegmentGroup<T extends string>({
  value,
  onValueChange,
  segments,
  className,
  size = "md",
}: SegmentGroupProps<T>) {
  const sizeClass = size === "sm" ? "h-7 text-xs" : "h-9 text-sm";

  return (
    <div
      role="radiogroup"
      className={cn(
        "border-border bg-muted inline-flex items-center gap-1 rounded-full border p-1",
        className,
      )}
    >
      {segments.map((seg) => {
        const isActive = seg.value === value;

        return (
          <button
            key={seg.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={seg.disabled}
            onClick={() => onValueChange(seg.value)}
            className={cn(
              "focus-visible:ring-ring rounded-full px-3 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              sizeClass,
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
