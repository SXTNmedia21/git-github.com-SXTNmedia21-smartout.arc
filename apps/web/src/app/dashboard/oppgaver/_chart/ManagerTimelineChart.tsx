"use client";

/**
 * ManagerTimelineChart — top-level Gantt composer for the Manager Timeline.
 *
 * Assembles the full chart by composing all lower-level primitives (Task 3.1–3.6)
 * into a CSS grid layout:
 *
 *   [ 80px gutter | 1fr scrollable body ]
 *
 * The left column holds the hour-label ruler (TimeGutter). The right column is a
 * scrollable container that stacks:
 *   1. RoutineStrips   — phase background bands (absolute, z-0)
 *   2. PastDim         — elapsed-time overlay (absolute, z-10)
 *   3. bands.map(AreaBand) — stacked band rows (flow, z-20)
 *   4. NowLine         — current-time marker (absolute, z-30, top-most)
 *
 * The `--hour-h` CSS custom property is set on the scrollable body root so that
 * TimeGutter (which reads it) and RoutineStrips / NowLine / PastDim (which use
 * `pxPerMin = pxPerHour / 60`) all share the same timing unit.
 *
 * Wave 1 Phase A.4: ChartDragContext is provided here so all descendants
 * (TaskBlock, PersonLane, UnassignedLane) share one useDragRetiming instance
 * without prop drilling. onDrop is forwarded up to ManagerTimelineShell which
 * owns the TanStack Query cache update + action dispatch.
 *
 * ADR-0366: no OKLCH literals. ADR-0361: no hardcoded zinc/gray/slate.
 * All colors via CSS variable tokens (bg-background, bg-muted, etc.).
 */

import type React from "react";
import type { RefObject } from "react";
import { TimeGutter } from "./TimeGutter";
import { RoutineStrips } from "./RoutineStrips";
import { NowLine } from "./NowLine";
import { PastDim } from "./PastDim";
import { AreaBand } from "./AreaBand";
import type { Band } from "./AreaBand";
import type { Employee } from "./PersonLane";
import type { TimelineTask } from "./TaskBlock";
import { ChartDragContext } from "./ChartDragContext";
import { useDragRetiming } from "./useDragRetiming";
import type { DragDropResult } from "./useDragRetiming";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = "area" | "role" | "person";

type Props = {
  /** Area bands to render — one AreaBand component per entry. */
  bands: ReadonlyArray<Band>;
  /** All employees — AreaBand filters per band.id. */
  employees: ReadonlyArray<Employee>;
  /** All timeline tasks — AreaBand filters per band and mode. */
  tasks: ReadonlyArray<TimelineTask>;
  /** Determines whether AreaBand renders multi-lane (area) or single-column (role/person). */
  mode: ViewMode;
  /** Pixels per hour — drives NowLine, PastDim, RoutineStrips, and AreaBand layout math. */
  pxPerHour: number;
  /**
   * Current time in absolute minutes (e.g. 14 * 60 + 35 = 875).
   * Passed to NowLine (currentMin) and PastDim (currentMin).
   */
  nowMinutes: number;
  /** Optional set of band IDs to dim — used for focus-area interactions. */
  dimmedBandIds?: ReadonlyArray<string>;
  /** Called when the user clicks an empty lane cell to place a new task. */
  onLaneClick?: (args: { empId: string | null; areaId: string; minutes: number }) => void;
  /** Called when the user activates a TaskBlock. */
  onTaskClick?: (task: TimelineTask) => void;
  /**
   * Called when a DnD drop completes. Parent (ManagerTimelineShell) owns
   * the optimistic update + action dispatch.
   * empId is the new assignee (null = drop onto UnassignedLane).
   */
  onTaskDrop?: (empId: string | null, result: DragDropResult) => void;
  /**
   * YYYY-MM-DD date for the day currently displayed — forwarded to TaskBlock
   * so it can compose an absolute ISO datetime on drag start.
   */
  dateISO?: string;
  /**
   * Called when keyboard-edit (Enter on a TaskBlock) is triggered.
   * Opens TaskEditModal in edit mode (Deliverable 5).
   */
  onKeyboardEdit?: (task: TimelineTask) => void;
  /**
   * Optional ref forwarded to the scrollable chart body div
   * (aria-label="Gantt timeline"). Used by ManagerTimelineShell's
   * scrollToNow callback to imperatively scroll to the current time.
   */
  scrollBodyRef?: RefObject<HTMLDivElement | null>;
};

// ─── ManagerTimelineChart ─────────────────────────────────────────────────────

/**
 * Root chart composer. Renders a two-column CSS grid: hour gutter (80px fixed)
 * + scrollable chart body (1fr). All overlay primitives are stacked inside the
 * body via absolute positioning; AreaBand rows flow in document order below them.
 *
 * Provides ChartDragContext with a useDragRetiming instance so descendants can
 * coordinate drag state without prop drilling.
 */
export function ManagerTimelineChart({
  bands,
  employees,
  tasks,
  mode,
  pxPerHour,
  nowMinutes,
  dimmedBandIds,
  onLaneClick,
  onTaskClick,
  onTaskDrop,
  dateISO,
  onKeyboardEdit,
  scrollBodyRef,
}: Props) {
  const pxPerMin = pxPerHour / 60;
  const retimer = useDragRetiming();

  return (
    <ChartDragContext.Provider value={retimer}>
      <div className="grid h-full grid-cols-[80px_1fr] overflow-hidden">
        {/* Left column — hour ruler */}
        <TimeGutter />

        {/* Right column — scrollable chart body */}
        <div
          ref={scrollBodyRef}
          className="bg-background relative overflow-y-auto focus-visible:outline-none"
          // --hour-h lets TimeGutter (and any CSS descendant) read the same unit
          // without prop drilling. Dynamic-color carve-out: runtime layout value,
          // not a color token — string interpolation is allowed here.
          style={{ "--hour-h": `${pxPerHour}px` } as React.CSSProperties}
          aria-label="Gantt timeline"
          tabIndex={0}
        >
          {/* Layer 0 — phase background strips (absolute, non-interactive) */}
          <RoutineStrips pxPerMin={pxPerMin} />

          {/* Layer 1 — past-time dim overlay (absolute, above strips) */}
          <PastDim currentMin={nowMinutes} pxPerMin={pxPerMin} />

          {/* Layer 2 — area bands rendered as side-by-side columns (flex-row).
               overflow-x-auto enables horizontal scroll when >N bands exceed viewport.
               Each AreaBand receives flex-1 min-w-[220px] to match prototype minWidth logic
               (Math.max(220, totalCols * 110) per timeline-chart.jsx line 338). */}
          <div className="flex flex-row overflow-x-auto">
            {bands.map((band) => (
              <AreaBand
                key={band.id}
                band={band}
                mode={mode}
                employees={employees.filter((e) => e.area === band.id)}
                tasks={tasks}
                pxPerHour={pxPerHour}
                dimmed={dimmedBandIds?.includes(band.id)}
                onLaneClick={onLaneClick}
                onTaskClick={onTaskClick}
                onDrop={onTaskDrop}
                dateISO={dateISO}
                onKeyboardEdit={onKeyboardEdit}
              />
            ))}
          </div>

          {/* Layer 3 — now-line overlay (absolute, top-most z-index) */}
          <NowLine currentMin={nowMinutes} pxPerMin={pxPerMin} />
        </div>
      </div>
    </ChartDragContext.Provider>
  );
}
