/**
 * TimelineBlock — a single season rendered as a colored bar on the timeline.
 *
 * Positioned horizontally across the year or month grid based on start/end dates.
 * Left/right edges are draggable to update start_date / end_date when a resolver
 * and commit callback are provided. The center opens the season drawer on click.
 *
 * Theme: all colors are CSS variables — no isDark prop needed.
 * Spring physics: from @smartout/design-tokens motionTokens.springSnappy.
 */

"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { useTranslation } from "@smartout/i18n";
import type { Season } from "../_hooks/use-seasons";

export type TimelineViewMode = "year" | "month";

type TimelineBlockProps = {
  season: Season;
  year: number;
  viewMode: TimelineViewMode;
  /** Calendar month index 0–11 when viewMode is "month". */
  zoomMonth: number;
  onClick: (seasonId: string) => void;
  /** Maps viewport X to YYYY-MM-DD; null if track is not measurable. */
  resolveDateFromClientX: (clientX: number) => string | null;
  /** Persist new start or end after a resize gesture on an edge handle. */
  onEdgeCommit?: (seasonId: string, edge: "start" | "end", dateIso: string) => void;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/**
 * Computes the left position and width of a block as percentages of the
 * 12-month grid. Clamps to the visible year boundaries.
 */
function computeBlockPosition(
  startDate: string | null,
  endDate: string | null,
  year: number,
): { left: number; width: number } | null {
  if (!startDate) return null;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = (yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(year, 11, 31);

  if (end < yearStart || start > yearEnd) return null;

  const clampedStart = start < yearStart ? yearStart : start;
  const clampedEnd = end > yearEnd ? yearEnd : end;

  const startDay = (clampedStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const endDay = (clampedEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24) + 1;

  const left = (startDay / totalDays) * 100;
  const width = ((endDay - startDay) / totalDays) * 100;

  return { left: Math.max(0, left), width: Math.min(100 - left, width) };
}

/**
 * Block position within a single calendar month (day columns as equal fractions).
 */
function computeBlockPositionInMonth(
  startDate: string | null,
  endDate: string | null,
  year: number,
  monthIndex: number,
): { left: number; width: number } | null {
  if (!startDate) return null;

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const dim = monthEnd.getDate();

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : monthEnd;

  if (end < monthStart || start > monthEnd) return null;

  const clampedStart = start < monthStart ? monthStart : start;
  const clampedEnd = end > monthEnd ? monthEnd : end;

  const dayStart = clampedStart.getDate();
  const dayEnd = clampedEnd.getDate();

  const left = ((dayStart - 1) / dim) * 100;
  const width = ((dayEnd - dayStart + 1) / dim) * 100;

  return { left: Math.max(0, left), width: Math.min(100 - left, width) };
}

/**
 * Returns CSS variable class names for a season's visual style based on status.
 * No isDark needed — classes resolve via Tailwind v4 CSS variables that
 * auto-switch when the `dark` class is on <html>.
 */
function getBlockStyle(status: Season["status"]) {
  switch (status) {
    case "draft":
      return {
        bg: "bg-muted",
        border: "border-dashed border-border",
        accent: "bg-muted-foreground",
        text: "text-muted-foreground",
      };
    case "active":
      return {
        bg: "bg-success/5",
        border: "border-solid border-success",
        accent: "bg-emerald-500",
        text: "text-success",
      };
    case "archived":
      return {
        bg: "bg-muted/60",
        border: "border-solid border-border",
        accent: "bg-muted-foreground",
        text: "text-muted-foreground",
      };
  }
}

export function TimelineBlock({
  season,
  year,
  viewMode,
  zoomMonth,
  onClick,
  resolveDateFromClientX,
  onEdgeCommit,
}: TimelineBlockProps) {
  const { t } = useTranslation("dashboard");

  const pos =
    viewMode === "year"
      ? computeBlockPosition(season.start_date, season.end_date, year)
      : computeBlockPositionInMonth(season.start_date, season.end_date, year, zoomMonth);
  if (!pos) return null;

  const style = getBlockStyle(season.status);
  const startMonth = season.start_date ? MONTH_LABELS[new Date(season.start_date).getMonth()] : "";
  const endMonth = season.end_date ? MONTH_LABELS[new Date(season.end_date).getMonth()] : "";

  const effectiveEndIso = season.end_date ?? `${year}-12-31`;
  const effectiveStartIso = season.start_date ?? effectiveEndIso;

  const handleEdgePointerDown = useCallback(
    (edge: "start" | "end") => (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onEdgeCommit || !season.start_date) return;
      event.stopPropagation();
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== event.pointerId) return;
        ev.preventDefault();
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== event.pointerId) return;
        target.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        const picked = resolveDateFromClientX(ev.clientX);
        if (!picked) return;

        if (edge === "start") {
          const cap = new Date(picked) > new Date(effectiveEndIso) ? effectiveEndIso : picked;
          onEdgeCommit(season.season_id, "start", cap);
        } else {
          const cap = new Date(picked) < new Date(effectiveStartIso) ? effectiveStartIso : picked;
          onEdgeCommit(season.season_id, "end", cap);
        }
      };

      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      onEdgeCommit,
      season.season_id,
      season.start_date,
      resolveDateFromClientX,
      effectiveEndIso,
      effectiveStartIso,
    ],
  );

  const showHandles = Boolean(onEdgeCommit && season.start_date);

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ type: "spring", ...motionTokens.springSnappy }}
      className={`absolute top-0 h-10 rounded-xl border ${style.bg} ${style.border} group transition-shadow hover:shadow-md`}
      style={{
        left: `${pos.left}%`,
        width: `${pos.width}%`,
        minWidth: "4rem",
      }}
    >
      {showHandles ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("yearWheel.drag_start_date")}
          onPointerDown={handleEdgePointerDown("start")}
          className="absolute top-0 left-0 z-20 h-full w-3 cursor-ew-resize rounded-l-xl border-r border-transparent hover:border-emerald-500/40 hover:bg-accent before:absolute before:inset-y-0 before:-inset-x-4 before:content-['']"
        />
      ) : null}

      <motion.button
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          onClick(season.season_id);
        }}
        className={`absolute inset-y-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
          showHandles ? "right-3 left-3" : "inset-x-0"
        }`}
        aria-label={`${season.name} (${season.status}) — ${startMonth} to ${endMonth}`}
        tabIndex={0}
      >
        <div className={`absolute top-1 bottom-1 left-2 w-[3px] rounded-full ${style.accent}`} />
        <div className="flex h-full items-center overflow-hidden pr-3 pl-5">
          <span className={`truncate text-xs font-medium ${style.text}`}>{season.name}</span>
        </div>
      </motion.button>

      {showHandles ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("yearWheel.drag_end_date")}
          onPointerDown={handleEdgePointerDown("end")}
          className="absolute top-0 right-0 z-20 h-full w-3 cursor-ew-resize rounded-r-xl border-l border-transparent hover:border-emerald-500/40 hover:bg-accent before:absolute before:inset-y-0 before:-inset-x-4 before:content-['']"
        />
      ) : null}
    </motion.div>
  );
}

export { computeBlockPosition, computeBlockPositionInMonth };
