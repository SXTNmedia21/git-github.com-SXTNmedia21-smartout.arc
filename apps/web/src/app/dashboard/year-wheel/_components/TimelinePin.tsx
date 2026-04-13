/**
 * TimelinePin — a single planning event rendered as a pin on the timeline.
 *
 * Positioned horizontally on the 12-month grid based on event_date.
 * Provides a 44px invisible hit area (WCAG 2.5.8 minimum target size).
 * When 3+ pins cluster on the same month, they collapse into a numbered badge.
 *
 * All colors come from CSS variables (bg-card, bg-muted, etc.) — no hardcoded
 * zinc/blue/purple classes. Springs come from @smartout/design-tokens.
 */

"use client";

import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import type { PlanningEventRow } from "@/lib/cascade/types";

type TimelineViewMode = "year" | "month";

type TimelinePinProps = {
  event: PlanningEventRow;
  year: number;
  onClick: (eventId: string) => void;
  viewMode?: TimelineViewMode;
  /** 0–11 when viewMode is "month". */
  zoomMonth?: number;
};

/**
 * Computes the horizontal position of a pin as a percentage of the year grid.
 * Returns null if the event falls outside the visible year.
 */
function computePinPosition(eventDate: string, year: number): number | null {
  const date = new Date(eventDate);
  if (date.getFullYear() !== year) return null;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const dayOfYear = (date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);

  return (dayOfYear / totalDays) * 100;
}

function computePinPositionInMonth(
  eventDate: string,
  year: number,
  monthIndex: number,
): number | null {
  const date = new Date(eventDate);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex) return null;
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const day = date.getDate();
  return ((day - 0.5) / dim) * 100;
}

/**
 * Maps planning event categories to chart CSS variables so colors
 * respond to light/dark mode automatically.
 */
const CATEGORY_COLORS: Record<string, string> = {
  external_scraped: "bg-chart-1",
  cultural_commercial: "bg-chart-4",
  internal: "bg-chart-3",
  weather: "bg-chart-1",
  recurring: "bg-chart-3",
};

export function TimelinePin({
  event,
  year,
  onClick,
  viewMode = "year",
  zoomMonth = 0,
}: TimelinePinProps) {
  const position =
    viewMode === "month"
      ? computePinPositionInMonth(event.event_date, year, zoomMonth)
      : computePinPosition(event.event_date, year);
  if (position === null) return null;

  const dotColor = CATEGORY_COLORS[event.category] ?? "bg-chart-5";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", ...motionTokens.springSnappy }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event.planning_event_id);
      }}
      className="group focus-visible:ring-ring absolute flex min-h-[44px] min-w-[44px] items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      style={{
        left: `${position}%`,
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "44px",
        height: "44px",
      }}
      aria-label={`${event.name} — ${new Date(event.event_date).toLocaleDateString("nb-NO")}`}
      tabIndex={0}
    >
      {/* Visible dot — 8px centered in the 44px hit area */}
      <span
        className={`absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${dotColor} transition-transform group-hover:scale-150`}
      />

      {/* Tooltip on hover */}
      <span className="bg-card text-card-foreground border-border pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-md border px-2 py-1 text-[10px] font-medium whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {event.name}
      </span>
    </motion.button>
  );
}

/**
 * PinCluster — renders a numbered badge when 3+ events fall in the same
 * month on the timeline.
 */
type PinClusterProps = {
  events: PlanningEventRow[];
  month: number;
  year: number;
  onClick: (eventIds: string[]) => void;
};

export function PinCluster({ events, month, year, onClick }: PinClusterProps) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const yearStart = new Date(year, 0, 1);
  const totalDays = 365;

  const midDay =
    ((monthStart.getTime() + monthEnd.getTime()) / 2 - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const position = (midDay / totalDays) * 100;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", ...motionTokens.springSnappy }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(events.map((e) => e.planning_event_id));
      }}
      className="group focus-visible:ring-ring absolute flex min-h-[44px] min-w-[44px] items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      style={{
        left: `${position}%`,
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "44px",
        height: "44px",
      }}
      aria-label={`${events.length} events in this month`}
      tabIndex={0}
    >
      <span className="bg-muted text-muted-foreground absolute top-1/2 left-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold transition-transform group-hover:scale-125">
        {events.length}
      </span>
    </motion.button>
  );
}

export { computePinPosition, computePinPositionInMonth };
