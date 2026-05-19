/**
 * ShiftBadge — compact shift-count indicator for calendar cells.
 * Renders a pill showing the number of scheduled shifts on a given day.
 * Two sizes: "sm" for month/week header cells, "md" for day-view overlay strip.
 * Uses brand-orange token for accent — Nordic Split warm palette rule.
 */

import { Users } from "lucide-react";

type ShiftBadgeProps = {
  count: number;
  size?: "sm" | "md";
};

export function ShiftBadge({ count, size = "sm" }: ShiftBadgeProps) {
  if (count <= 0) return null;

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] leading-none font-semibold"
        style={{
          backgroundColor: "color-mix(in oklch, var(--brand-orange) 15%, transparent)",
          color: "var(--brand-orange)",
        }}
        aria-label={`${count} vakter`}
      >
        <Users className="h-2.5 w-2.5" aria-hidden />
        {count}
      </span>
    );
  }

  // md — used in day-view overlay strip
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] leading-none font-semibold"
      style={{
        backgroundColor: "color-mix(in oklch, var(--brand-orange) 15%, transparent)",
        color: "var(--brand-orange)",
      }}
      aria-label={`${count} vakter`}
    >
      <Users className="h-3 w-3" aria-hidden />
      {count} vakter
    </span>
  );
}
