"use client";

/**
 * PersonLane — single employee lane for the Manager Timeline day-line.
 *
 * Ported from docs/domains/day-session/day-planner/project/timeline-chart.jsx
 * lines 191-250. Key deviations from the prototype:
 *
 *  - No inline OKLCH literals (ADR-0366, ADR-0361). Shift fill uses CSS
 *    variable tokens (bg-card, border-border) — never raw color values.
 *  - No drag handlers in V1 — DnD fully deferred per G19a/b/c task spec.
 *  - `role="group"` + `aria-label` per WCAG 4.1.2.
 *  - tasks prop is caller-supplied (parent filters); no TASKS global reference.
 *  - layoutOverlap drives col + totalCols for sibling TaskBlock placement.
 *  - Click-to-place math: Y position → raw minutes → snap to 15-min boundary.
 *    Formula matches prototype lines 202-204 with DAY_START_HOUR offset added
 *    so `minutes` is an absolute wall-clock minute value.
 *  - Shift fill pixel positions derived from hmToMin (timeMath) — typed, pure.
 */

import { cn } from "@/lib/utils";
import { hmToMin, DAY_START_HOUR } from "./timeMath";
import { layoutOverlap } from "./layoutOverlap";
import { TaskBlock } from "./TaskBlock";
import type { TimelineTask } from "./TaskBlock";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Employee = {
  id: string;
  name: string;
  role: string;
  area: string;
  shift?: [string, string] | null;
};

type Props = {
  emp: Employee;
  areaId: string;
  /** Pixels rendered per one hour of wall-clock time — set by chart composer. */
  pxPerHour: number;
  tasks: ReadonlyArray<TimelineTask>;
  /** When true, dims the whole lane (e.g. another area is focused). */
  dimmed?: boolean;
  /** Called when the user clicks an empty area of the lane. */
  onLaneClick?: (args: { empId: string; areaId: string; minutes: number }) => void;
  /** Called when the user activates a task block. */
  onTaskClick?: (task: TimelineTask) => void;
};

// ─── PersonLane ───────────────────────────────────────────────────────────────

/**
 * Renders a full-height lane containing:
 *  1. An optional shift-fill rectangle (when emp.shift is present).
 *  2. All TaskBlock children from the tasks prop, column-assigned via layoutOverlap.
 *
 * Height is set by the chart composer via `style` or a shared CSS variable.
 * This component is stateless — it only reads props.
 */
export function PersonLane({
  emp,
  areaId,
  pxPerHour,
  tasks,
  dimmed = false,
  onLaneClick,
  onTaskClick,
}: Props) {
  // ── Shift fill geometry ──────────────────────────────────────────────────
  const shift = emp.shift ?? null;
  const shiftTopPx = shift ? ((hmToMin(shift[0]) - DAY_START_HOUR * 60) / 60) * pxPerHour : null;
  const shiftHeightPx = shift ? ((hmToMin(shift[1]) - hmToMin(shift[0])) / 60) * pxPerHour : null;

  // ── Overlap layout ───────────────────────────────────────────────────────
  // layoutOverlap assigns a column index to each task so overlapping entries
  // are side-by-side rather than stacked. We index the result by task id so
  // tasks.map below can look up col + totalCols in O(1).
  const { items: overlapItems, totalCols } = layoutOverlap(tasks);
  const colByTaskId = new Map(overlapItems.map(({ task, col }) => [task.id, col]));

  // ── Click-to-place handler ───────────────────────────────────────────────
  // Snap raw Y → minutes → 15-min grid (matches prototype lines 202-204).
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLaneClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Convert pixel offset to absolute wall-clock minutes
    const rawMin = (y / pxPerHour) * 60 + DAY_START_HOUR * 60;
    const snapped = Math.round(rawMin / 15) * 15;
    onLaneClick({
      empId: emp.id,
      areaId: emp.area || areaId,
      minutes: snapped,
    });
  };

  return (
    <div
      role="group"
      aria-label={`${emp.name} – ${emp.role}`}
      className={cn(
        "relative w-full overflow-hidden",
        // Lane total height: 20 hours × pxPerHour — set by chart via inline style
        // Dimmed when a sibling area/lane is the focus
        dimmed && "opacity-50",
      )}
      style={{ height: pxPerHour * 20 }}
      onClick={handleClick}
    >
      {/* Shift fill — only when emp.shift is provided */}
      {shift && shiftTopPx !== null && shiftHeightPx !== null && (
        <div
          aria-hidden="true"
          className={cn(
            "border-border bg-card absolute inset-x-0 rounded-sm border",
            // Subtle label row — matches prototype's .shift-fill .lbl pattern
            "flex flex-col justify-between px-2 py-1",
          )}
          style={{
            top: shiftTopPx,
            height: shiftHeightPx,
          }}
        >
          <span className="text-muted-foreground text-[0.6rem] font-medium tracking-wide uppercase">
            På vakt
          </span>
          <span className="text-muted-foreground text-[0.6rem]">
            {shift[0]} – {shift[1]}
          </span>
        </div>
      )}

      {/* Task blocks — one per task, column-assigned by layoutOverlap */}
      {tasks.map((task) => (
        <TaskBlock
          key={task.id}
          task={task}
          pxPerHour={pxPerHour}
          col={colByTaskId.get(task.id) ?? 0}
          totalCols={totalCols}
          onClick={onTaskClick}
        />
      ))}
    </div>
  );
}
