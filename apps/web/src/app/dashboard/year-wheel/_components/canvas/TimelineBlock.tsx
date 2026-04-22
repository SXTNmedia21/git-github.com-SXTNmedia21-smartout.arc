"use client";

import { motion } from "framer-motion";
import type { Season } from "@/app/dashboard/year-wheel/_hooks";

type Props = {
  season: Season & { lane: number };
  x: number;
  width: number;
  y: number;
  height: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export function TimelineBlock({ season, x, width, y, height, isSelected, onSelect }: Props) {
  const isActive = season.status === "active";
  const isDraft = season.status === "draft";
  const isArchived = season.status === "archived";
  const baseColor = season.color ?? "var(--brand-orange)";

  const bg = isActive
    ? baseColor
    : isArchived
      ? `color-mix(in oklab, ${baseColor} 25%, var(--secondary))`
      : `color-mix(in oklab, ${baseColor} 12%, var(--card))`;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(season.season_id)}
      className="absolute overflow-hidden rounded-[10px] px-3 text-sm font-semibold text-ellipsis whitespace-nowrap"
      style={{
        left: x,
        top: y,
        width: Math.max(20, width),
        height,
        background: bg,
        color: isActive ? "#fff" : "var(--foreground)",
        border: isDraft
          ? `1.5px dashed ${baseColor}`
          : isSelected
            ? "2px solid var(--foreground)"
            : "1px solid transparent",
        boxShadow: isActive
          ? `0 2px 8px color-mix(in oklab, ${baseColor} 25%, transparent)`
          : undefined,
        zIndex: isSelected ? 3 : 2,
      }}
      whileHover={{ y: y - 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
      aria-label={`${season.name}, ${season.start_date} til ${season.end_date}, status ${season.status}`}
    >
      {isActive && (
        <span
          className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-white"
          style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.25)" }}
        />
      )}
      {season.name}
    </motion.button>
  );
}
