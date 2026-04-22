/**
 * YearCanvas — linear timeline canvas for the year-wheel redesign.
 *
 * Wires the five Phase 3 leaves:
 *   - NormalDriftWatermark (background)
 *   - TimelineBlock        (lane-packed season row)
 *   - TimelinePin          (event pins row)
 *   - DrawPhantom          (live draw-to-create rectangle)
 *   - lane-pack/assignLanes (pure packer)
 *
 * Implements spec §3.4 (visual) + §4.1 (draw-to-create interaction).
 *
 * Hydration note: the "today" marker is computed after mount (see
 * YearWheelTimeline.tsx:100-115 for the original pattern) because
 * `new Date()` during SSR drifts from the client pass and produces a
 * hydration mismatch on the marker position.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit } from "@smartout/telemetry";
import type { Season } from "@/app/dashboard/year-wheel/_hooks";
import type { PlanningEventRow } from "@smartout/year-wheel/hooks";
import { xForDate, xToDate } from "../../_lib/timeline-date";
import { assignLanes } from "./lane-pack";
import { NormalDriftWatermark } from "./NormalDriftWatermark";
import { TimelineBlock } from "./TimelineBlock";
import { TimelinePin } from "./TimelinePin";
import { DrawPhantom } from "./DrawPhantom";

export type PlanningEvent = PlanningEventRow;

type Props = {
  year: number;
  seasons: Season[];
  events: PlanningEvent[];
  selectedId: string | null;
  onSelectSeason: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onDrawCreate: (args: { start: string; end: string }) => void;
  workspaceId: string;
  profileId: string | null;
};

type DrawState = {
  startX: number;
  currentX: number;
  lane: number;
};

// Canvas layout constants (spec §3.4).
const LANE_H = 44;
const PINS_Y = 28;
const BLOCKS_START_Y = PINS_Y + 32; // 60
const BLOCK_HEIGHT = LANE_H - 8; // leaves a 4px top+bottom breathing room per lane
const DRAW_COMMIT_MIN_PX = 12;
const DEFAULT_WIDTH = 1200;

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
] as const;

export function YearCanvas({
  year,
  seasons,
  events,
  selectedId,
  onSelectSeason,
  onSelectEvent,
  onDrawCreate,
  workspaceId,
  profileId,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Width is observed — start at a sensible default so SSR output stabilises.
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // Seed immediately on mount in case the layout is already settled.
    const initial = el.getBoundingClientRect().width;
    if (initial > 0) setWidth(initial);
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Post-mount today marker (hydration-safe — carried from YearWheelTimeline).
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
  }, []);
  const todayX = useMemo(() => {
    if (today === null) return null;
    if (today.getUTCFullYear() !== year) return null;
    const iso = today.toISOString().split("T")[0]!;
    return xForDate(iso, year, width);
  }, [today, year, width]);

  // Lane-pack the seasons (filters out nulls internally).
  const lanedSeasons = useMemo(() => assignLanes(seasons), [seasons]);
  const laneCount = useMemo(() => {
    if (lanedSeasons.length === 0) return 1;
    return lanedSeasons.reduce((max, s) => Math.max(max, s.lane + 1), 0);
  }, [lanedSeasons]);

  const canvasH = BLOCKS_START_Y + laneCount * LANE_H + 24;
  const watermarkCenterY = BLOCKS_START_Y + (laneCount * LANE_H) / 2 - 12;

  // Project events into x/xEnd pairs. Range events (with end_date) get xEnd.
  const positionedEvents = useMemo(() => {
    return events.map((ev) => ({
      ...ev,
      x: xForDate(ev.event_date, year, width),
      xEnd: ev.end_date ? xForDate(ev.end_date, year, width) : null,
    }));
  }, [events, year, width]);

  // ── Draw-to-create state ───────────────────────────────────────
  const [draw, setDraw] = useState<DrawState | null>(null);
  // Ref mirror for the keyboard handler (doesn't need to re-register).
  const drawRef = useRef<DrawState | null>(null);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Hover date tooltip (empty canvas).
  const [hoverDate, setHoverDate] = useState<{ x: number; y: number; iso: string } | null>(null);

  const cancelDraw = useCallback(
    (reason: "esc" | "mouse_exit" | "short_drag") => {
      setDraw(null);
      setHoverDate(null);
      emit({
        event: "season draw_cancelled",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: { data: { reason } },
      });
    },
    [workspaceId, profileId],
  );

  // Esc cancels an in-progress draw.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawRef.current) {
        cancelDraw("esc");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelDraw]);

  const resolveXY = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
      const el = canvasRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore if the click originated on a block or pin — those have their own onClick.
      const target = e.target as HTMLElement | null;
      if (target && (target.closest(".yw-block") || target.closest(".yw-pin"))) {
        return;
      }
      const pt = resolveXY(e);
      if (!pt) return;
      if (pt.y < BLOCKS_START_Y - 8) return; // only start draw in/near the blocks area
      const lane = Math.max(0, Math.floor((pt.y - BLOCKS_START_Y) / LANE_H));
      setDraw({ startX: pt.x, currentX: pt.x, lane });
      setHoverDate(null);
      emit({
        event: "season draw_started",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: { data: { year, lane } },
      });
    },
    [resolveXY, workspaceId, profileId, year],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pt = resolveXY(e);
      if (!pt) return;
      if (draw) {
        setDraw({ ...draw, currentX: pt.x });
        return;
      }
      // Date tooltip on empty canvas (below blocks row only — avoids pin row noise).
      if (pt.y >= BLOCKS_START_Y - 8) {
        setHoverDate({ x: pt.x, y: pt.y, iso: xToDate(pt.x, year, width) });
      } else {
        setHoverDate(null);
      }
    },
    [draw, resolveXY, year, width],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!draw) return;
      const pt = resolveXY(e);
      const finalX = pt ? pt.x : draw.currentX;
      const dx = Math.abs(finalX - draw.startX);
      if (dx <= DRAW_COMMIT_MIN_PX) {
        cancelDraw("short_drag");
        return;
      }
      const startPx = Math.min(draw.startX, finalX);
      const endPx = Math.max(draw.startX, finalX);
      const start = xToDate(startPx, year, width);
      const end = xToDate(endPx, year, width);
      const lane = draw.lane;
      setDraw(null);
      setHoverDate(null);
      emit({
        event: "season draw_completed",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: { data: { start, end, lane } },
      });
      onDrawCreate({ start, end });
    },
    [draw, resolveXY, year, width, workspaceId, profileId, onDrawCreate, cancelDraw],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverDate(null);
    if (drawRef.current) cancelDraw("mouse_exit");
  }, [cancelDraw]);

  // Live dates for the phantom.
  const phantomDates = useMemo(() => {
    if (!draw) return null;
    const a = Math.min(draw.startX, draw.currentX);
    const b = Math.max(draw.startX, draw.currentX);
    return { start: xToDate(a, year, width), end: xToDate(b, year, width) };
  }, [draw, year, width]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        ref={canvasRef}
        className="border-border bg-muted/30 relative w-full overflow-hidden rounded-2xl border select-none"
        style={{
          height: canvasH,
          cursor: draw ? "ew-resize" : "crosshair",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Watermark sits behind blocks. */}
        <NormalDriftWatermark centerY={watermarkCenterY} />

        {/* Month guides — 12 vertical lines + labels. First line transparent. */}
        {MONTH_LABELS.map((label, i) => {
          const iso = `${year}-${String(i + 1).padStart(2, "0")}-01`;
          const x = xForDate(iso, year, width);
          return (
            <div key={label} aria-hidden>
              <div
                className={i === 0 ? "" : "border-border/50 border-l"}
                style={{
                  position: "absolute",
                  left: x,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  pointerEvents: "none",
                }}
              />
              <span
                className="text-muted-foreground pointer-events-none absolute font-mono text-[10px] tracking-widest uppercase"
                style={{ left: x + 6, top: 6 }}
              >
                {label}
              </span>
            </div>
          );
        })}

        {/* Today marker (post-mount) */}
        {todayX !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0"
            style={{ left: todayX, width: 0, zIndex: 4 }}
          >
            <div
              className="bg-brand-orange absolute top-0 bottom-0"
              style={{ width: 1.5, left: -0.75, opacity: 0.8 }}
            />
            <span
              className="bg-brand-orange absolute left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold text-white"
              style={{ top: -4 }}
            >
              I dag
            </span>
          </div>
        )}

        {/* Pins row */}
        {positionedEvents.map((ev) => (
          <div key={ev.planning_event_id} className="yw-pin">
            <TimelinePin event={ev} onSelect={onSelectEvent} />
          </div>
        ))}

        {/* Lane-packed blocks */}
        {lanedSeasons.map((s) => {
          // assignLanes filters nulls at runtime, but the generic keeps the
          // nullable shape — guard explicitly so we don't feed null into xForDate.
          if (!s.start_date || !s.end_date) return null;
          const x = xForDate(s.start_date, year, width);
          const xEnd = xForDate(s.end_date, year, width);
          const w = Math.max(20, xEnd - x);
          const y = BLOCKS_START_Y + s.lane * LANE_H;
          return (
            <div key={s.season_id} className="yw-block">
              <TimelineBlock
                season={s}
                x={x}
                width={w}
                y={y}
                height={BLOCK_HEIGHT}
                isSelected={selectedId === s.season_id}
                onSelect={onSelectSeason}
              />
            </div>
          );
        })}

        {/* Draw phantom */}
        {draw && phantomDates && (
          <DrawPhantom
            startX={draw.startX}
            currentX={draw.currentX}
            top={BLOCKS_START_Y + draw.lane * LANE_H}
            height={BLOCK_HEIGHT}
            startDate={phantomDates.start}
            endDate={phantomDates.end}
          />
        )}

        {/* Hover date tooltip — suppressed while drawing. */}
        {!draw && hoverDate && (
          <span
            aria-hidden
            className="bg-card text-muted-foreground border-border pointer-events-none absolute rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
            style={{ left: hoverDate.x + 8, top: hoverDate.y + 12, zIndex: 5 }}
          >
            {hoverDate.iso}
          </span>
        )}
      </div>
    </div>
  );
}
