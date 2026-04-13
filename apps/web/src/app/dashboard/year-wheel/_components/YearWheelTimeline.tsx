/**
 * YearWheelTimeline — horizontal timeline canvas for seasons and planning events.
 *
 * Supports a full-year grid (12 months) or a single-month “zoom” with one column
 * per day. Season blocks can report edge drags to the parent for persistence.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import type { Season } from "../_hooks/use-seasons";
import type { PlanningEventRow } from "@/lib/cascade/types";
import { clientXToIsoDateMonth, clientXToIsoDateYear, getDaysInYear } from "../_lib/timeline-date";
import { TimelineBlock, type TimelineViewMode } from "./TimelineBlock";
import { TimelinePin, PinCluster } from "./TimelinePin";

type YearWheelTimelineProps = {
  seasons: Season[];
  events: PlanningEventRow[];
  year: number;
  viewMode: TimelineViewMode;
  /** Month index 0–11 when viewMode is "month". */
  zoomMonth: number;
  onBlockClick: (seasonId: string) => void;
  onPinClick: (eventId: string) => void;
  onDateLaneClick?: (date: string) => void;
  focusedDate?: string | null;
  isDark: boolean;
  onSeasonEdgeCommit?: (seasonId: string, edge: "start" | "end", dateIso: string) => void;
};

const MONTH_LABELS_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAI",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OKT",
  "NOV",
  "DES",
];

function groupEventsByMonth(events: PlanningEventRow[], year: number) {
  const monthBuckets: Record<number, PlanningEventRow[]> = {};

  for (const ev of events) {
    const date = new Date(ev.event_date);
    if (date.getFullYear() !== year) continue;
    const month = date.getMonth();
    if (!monthBuckets[month]) monthBuckets[month] = [];
    monthBuckets[month]!.push(ev);
  }

  const singles: PlanningEventRow[] = [];
  const clusters: { month: number; events: PlanningEventRow[] }[] = [];

  for (const [monthStr, evs] of Object.entries(monthBuckets)) {
    if (evs.length >= 3) {
      clusters.push({ month: Number(monthStr), events: evs });
    } else {
      singles.push(...evs);
    }
  }

  return { singles, clusters };
}

function seasonTouchesYear(s: Season, year: number): boolean {
  if (!s.start_date) return false;
  const start = new Date(s.start_date);
  const end = s.end_date ? new Date(s.end_date) : new Date(year, 11, 31);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  return start <= yearEnd && end >= yearStart;
}

function seasonTouchesMonth(s: Season, year: number, monthIndex: number): boolean {
  if (!s.start_date) return false;
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const start = new Date(s.start_date);
  const end = s.end_date ? new Date(s.end_date) : new Date(year, 11, 31);
  return start <= monthEnd && end >= monthStart;
}

export function YearWheelTimeline({
  seasons,
  events,
  year,
  viewMode,
  zoomMonth,
  onBlockClick,
  onPinClick,
  onDateLaneClick,
  focusedDate,
  isDark,
  onSeasonEdgeCommit,
}: YearWheelTimelineProps) {
  const { t } = useTranslation("dashboard");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const today = new Date();
  const isCurrentYear = today.getFullYear() === year;

  const daysInZoomMonth = useMemo(
    () => new Date(year, zoomMonth + 1, 0).getDate(),
    [year, zoomMonth],
  );

  const resolveDateFromClientX = useCallback(
    (clientX: number): string | null => {
      const el = canvasRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;
      return viewMode === "year"
        ? clientXToIsoDateYear(clientX, rect, year)
        : clientXToIsoDateMonth(clientX, rect, year, zoomMonth);
    },
    [viewMode, year, zoomMonth],
  );

  const todayPositionPercent = useMemo(() => {
    if (!isCurrentYear) return null;
    if (viewMode === "year") {
      const yearStart = new Date(year, 0, 1);
      const days = getDaysInYear(year);
      const dayOfYear = (today.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
      return (dayOfYear / days) * 100;
    }
    if (today.getMonth() !== zoomMonth) return null;
    const dim = daysInZoomMonth;
    const day = today.getDate();
    return ((day - 0.5) / dim) * 100;
  }, [year, isCurrentYear, viewMode, zoomMonth, daysInZoomMonth]);

  const focusedDatePositionPercent = useMemo(() => {
    if (!focusedDate) return null;
    const date = new Date(focusedDate);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return null;
    if (viewMode === "year") {
      const yearStart = new Date(year, 0, 1);
      const days = getDaysInYear(year);
      const dayOfYear = (date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
      return (dayOfYear / days) * 100;
    }
    if (date.getMonth() !== zoomMonth) return null;
    const dim = daysInZoomMonth;
    const day = date.getDate();
    return ((day - 0.5) / dim) * 100;
  }, [focusedDate, year, viewMode, zoomMonth, daysInZoomMonth]);

  useEffect(() => {
    if (!scrollContainerRef.current || focusedDatePositionPercent === null) return;
    const container = scrollContainerRef.current;
    const fullWidth = container.scrollWidth;
    const targetX = (focusedDatePositionPercent / 100) * fullWidth;
    container.scrollTo({
      left: Math.max(0, targetX - container.clientWidth / 2),
      behavior: "smooth",
    });
  }, [focusedDatePositionPercent]);

  const { singles, clusters } = useMemo(() => groupEventsByMonth(events, year), [events, year]);

  const eventsInZoomMonth = useMemo(() => {
    return events.filter((ev) => {
      const d = new Date(ev.event_date);
      return d.getFullYear() === year && d.getMonth() === zoomMonth;
    });
  }, [events, year, zoomMonth]);

  const visibleSeasons = seasons.filter((s) =>
    viewMode === "year" ? seasonTouchesYear(s, year) : seasonTouchesMonth(s, year, zoomMonth),
  );

  const minCanvasWidth = viewMode === "year" ? 800 : Math.max(480, daysInZoomMonth * 20);

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onDateLaneClick || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const iso =
      viewMode === "year"
        ? clientXToIsoDateYear(event.clientX, rect, year)
        : clientXToIsoDateMonth(event.clientX, rect, year, zoomMonth);
    onDateLaneClick(iso);
  };

  return (
    <section
      aria-label={`Årshjul ${year}`}
      className="w-full overflow-x-auto"
      ref={scrollContainerRef}
    >
      <div style={{ minWidth: minCanvasWidth }}>
        {viewMode === "year" ? (
          <div className="mb-1 grid grid-cols-12">
            {MONTH_LABELS_SHORT.map((label, i) => (
              <div
                key={i}
                className={`py-1 text-center font-mono text-[10px] tracking-widest uppercase ${
                  isDark ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mb-1 grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${daysInZoomMonth}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: daysInZoomMonth }, (_, i) => (
              <div
                key={i}
                className={`py-1 text-center font-mono text-[9px] tabular-nums ${
                  isDark ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}

        <div
          className={`relative rounded-2xl border ${
            isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50/50"
          }`}
          ref={canvasRef}
          style={{ minHeight: "120px" }}
          onClick={handleCanvasClick}
        >
          {viewMode === "year" ? (
            <div className="absolute inset-0 grid grid-cols-12">
              {Array.from({ length: 11 }, (_, i) => (
                <div
                  key={i}
                  className={`border-r ${isDark ? "border-zinc-800/50" : "border-zinc-200/50"}`}
                  style={{ gridColumn: i + 1 }}
                />
              ))}
            </div>
          ) : (
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${daysInZoomMonth}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: daysInZoomMonth }, (_, i) => (
                <div
                  key={i}
                  className={
                    i < daysInZoomMonth - 1
                      ? `border-r ${isDark ? "border-zinc-800/50" : "border-zinc-200/50"}`
                      : ""
                  }
                />
              ))}
            </div>
          )}

          {todayPositionPercent !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10"
              style={{ left: `${todayPositionPercent}%` }}
            >
              <div className="h-full w-[2px] bg-orange-500 opacity-70" />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[9px] font-bold text-orange-500">
                I dag
              </span>
            </div>
          )}

          {focusedDatePositionPercent !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10"
              style={{ left: `${focusedDatePositionPercent}%` }}
            >
              <div className="h-full w-[2px] bg-blue-500 opacity-80" />
            </div>
          )}

          <div className="relative" style={{ paddingTop: "12px", paddingBottom: "12px" }}>
            {visibleSeasons.map((season, idx) => (
              <div
                key={season.season_id}
                className="relative"
                style={{
                  height: "48px",
                  marginBottom: idx < visibleSeasons.length - 1 ? "4px" : "0",
                }}
              >
                <TimelineBlock
                  season={season}
                  year={year}
                  viewMode={viewMode}
                  zoomMonth={zoomMonth}
                  onClick={onBlockClick}
                  resolveDateFromClientX={resolveDateFromClientX}
                  onEdgeCommit={onSeasonEdgeCommit}
                />
              </div>
            ))}

            {visibleSeasons.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center justify-center py-8 text-sm ${
                  isDark ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                {t("yearWheel.empty_select")}
              </motion.div>
            )}
          </div>

          <div
            className={`relative border-t ${isDark ? "border-zinc-800/50" : "border-zinc-200/50"}`}
            style={{ height: "44px" }}
          >
            {viewMode === "year" ? (
              <>
                {singles.map((ev) => (
                  <TimelinePin
                    key={ev.planning_event_id}
                    event={ev}
                    year={year}
                    onClick={onPinClick}
                    isDark={isDark}
                    viewMode="year"
                  />
                ))}
                {clusters.map((cluster) => (
                  <PinCluster
                    key={`cluster-${cluster.month}`}
                    events={cluster.events}
                    month={cluster.month}
                    year={year}
                    onClick={(ids) => {
                      if (ids[0]) onPinClick(ids[0]);
                    }}
                    isDark={isDark}
                  />
                ))}
              </>
            ) : (
              eventsInZoomMonth.map((ev) => (
                <TimelinePin
                  key={ev.planning_event_id}
                  event={ev}
                  year={year}
                  onClick={onPinClick}
                  isDark={isDark}
                  viewMode="month"
                  zoomMonth={zoomMonth}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
