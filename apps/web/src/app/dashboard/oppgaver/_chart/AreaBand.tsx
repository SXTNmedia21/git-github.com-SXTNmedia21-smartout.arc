"use client";

/**
 * AreaBand — one vertical column in the Manager Timeline day-line.
 *
 * Ported from docs/domains/day-session/day-planner/project/timeline-chart.jsx
 * lines 253-360 (UnassignedLane + SingleLaneBand functions). Key deviations:
 *
 *  - No inline OKLCH literals (ADR-0366, ADR-0361). `--area-color` receives
 *    a CSS variable reference, never a raw color value. Dynamic-color carve-out
 *    per token-audit doc: `var(--dept-<id>)` is a CSS custom-prop chain, not a
 *    literal color.
 *  - No drag handlers in V1 — DnD deferred to V2 per G19a/b/c.
 *  - mode="area"   → N PersonLane columns (one per employee) + UnassignedLane
 *  - mode="role"   → SingleLaneBand semantics: layoutOverlap over tasks, one
 *                    TaskBlock column per overlapping group.
 *  - mode="person" → same as "role" semantics (single stacked column).
 *  - `dimmed` prop adds opacity-50 to the whole band.
 *  - Header: band name + employees-on-shift count + open/close times (mono).
 *  - UnassignedLane: inline sub-component for area-anchored tasks with no emp.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PersonLane } from "./PersonLane";
import type { Employee } from "./PersonLane";
import { TaskBlock } from "./TaskBlock";
import type { TimelineTask } from "./TaskBlock";
import { layoutOverlap } from "./layoutOverlap";
import { useChartDrag } from "./ChartDragContext";
import type { DragDropResult } from "./useDragRetiming";
import { resolveDeptToken } from "./dept-token-resolver";
import { hmToMin, DAY_START_HOUR } from "./timeMath";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "area" | "role" | "person";

export type Band = {
  id: string;
  name: string;
  short: string;
  open: string;
  close: string;
};

type Props = {
  band: Band;
  mode: ViewMode;
  employees: ReadonlyArray<Employee>;
  tasks: ReadonlyArray<TimelineTask>;
  pxPerHour: number;
  dimmed?: boolean;
  onLaneClick?: (args: { empId: string | null; areaId: string; minutes: number }) => void;
  onTaskClick?: (task: TimelineTask) => void;
  /**
   * Called when a DnD drop lands on any lane in this band.
   * Parent owns action dispatch + optimistic update.
   */
  onDrop?: (empId: string | null, result: DragDropResult) => void;
  /** YYYY-MM-DD for the current day — forwarded to TaskBlock for ISO composition. */
  dateISO?: string;
  /** Keyboard-edit callback forwarded to TaskBlock. */
  onKeyboardEdit?: (task: TimelineTask) => void;
};

// ─── UnassignedLane ───────────────────────────────────────────────────────────

/**
 * Inline variant rendered at the bottom of mode="area" bands. Shows all
 * area-anchored tasks where emp == null (not yet assigned to a person).
 *
 * Height matches every PersonLane (pxPerHour × 20) so time-ruler alignment
 * is preserved across the chart.
 */
function UnassignedLane({
  areaId,
  tasks,
  pxPerHour,
  dimmed,
  onLaneClick,
  onTaskClick,
  onDrop,
  dateISO,
  onKeyboardEdit,
}: {
  areaId: string;
  tasks: ReadonlyArray<TimelineTask>;
  pxPerHour: number;
  dimmed?: boolean;
  onLaneClick?: (args: { empId: string | null; areaId: string; minutes: number }) => void;
  onTaskClick?: (task: TimelineTask) => void;
  onDrop?: (empId: string | null, result: DragDropResult) => void;
  dateISO?: string;
  onKeyboardEdit?: (task: TimelineTask) => void;
}) {
  // Only tasks with no employee assignment (emp == null / undefined)
  const unassignedTasks = tasks.filter(
    (t) => t.area === areaId && (t.emp == null || t.emp === null),
  );

  const { items, totalCols } = useMemo(
    () => layoutOverlap(unassignedTasks),
    // Intentional: depend on length + areaId only to avoid re-sorting on task
    // object identity changes — same pattern as layoutOverlap in PersonLane.
    // eslint-disable-next-line -- exhaustive-deps intentionally partial
    [unassignedTasks.length, areaId],
  );
  const colByTaskId = new Map(items.map(({ task, col }) => [task.id, col]));

  const drag = useChartDrag();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onLaneClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = (y / pxPerHour) * 60 + 6 * 60; // DAY_START_HOUR = 6
    const snapped = Math.round(rawMin / 15) * 15;
    onLaneClick({ empId: null, areaId, minutes: snapped });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!drag?.state.draggedTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    drag.onDragOver(`${areaId}__unassigned`, e.clientY, rect.top, pxPerHour);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!drag?.state.draggedTaskId) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!drag) return;
    const result = drag.onDragEnd(null); // null = unassign
    if (result) onDrop?.(null, result);
    drag.reset();
  };

  return (
    <div
      role="group"
      aria-label={`Ikke tildelt – ${areaId}`}
      className={cn(
        "border-border relative w-full overflow-hidden border-t border-dashed transition-colors",
        dimmed && "opacity-30",
        isDragOver && "bg-primary/10",
      )}
      style={{ height: pxPerHour * 20 }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Label */}
      <span
        aria-hidden="true"
        className="text-muted-foreground absolute top-1 left-2 text-xs font-medium tracking-wide uppercase"
      >
        Ikke tildelt
      </span>

      {/* Unassigned task blocks */}
      {unassignedTasks.map((task) => (
        <TaskBlock
          key={task.id}
          task={task}
          pxPerHour={pxPerHour}
          col={colByTaskId.get(task.id) ?? 0}
          totalCols={totalCols}
          onClick={onTaskClick}
          dateISO={dateISO}
          onKeyboardEdit={onKeyboardEdit}
        />
      ))}
    </div>
  );
}

// ─── OpenPeriodWash ───────────────────────────────────────────────────────────

/**
 * Absolute overlay inside the lane body that highlights the band's planned
 * open period with a dashed border + gradient tint.
 *
 * ADR-0366: no OKLCH literals. Gradient and border colour use color-mix()
 * against `var(--area-color)` which is set on the AreaBand root via `style`.
 *
 * Prototype reference: timeline-chart.jsx:410-422 (open-period wash).
 */
function OpenPeriodWash({
  open,
  close,
  pxPerHour,
}: {
  open: string;
  close: string;
  pxPerHour: number;
}) {
  const DAY_START_MIN = DAY_START_HOUR * 60;
  const pxPerMin = pxPerHour / 60;

  // Wall-clock minutes → pixel offset from chart top (DAY_START offset subtracted)
  const topPx = (hmToMin(open) - DAY_START_MIN) * pxPerMin;

  // close may be past midnight — handle wrap by adding 24*60 when close < open
  const openMin = hmToMin(open);
  const rawCloseMin = hmToMin(close);
  const closeMin = rawCloseMin < openMin ? rawCloseMin + 24 * 60 : rawCloseMin;
  const heightPx = (closeMin - openMin) * pxPerMin;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute rounded-xl border border-dashed",
        // color-mix against --area-color (CSS var set on AreaBand root)
        // these are arbitrary-value Tailwind classes, not hardcoded colors
        "border-[color:color-mix(in_oklch,var(--area-color)_35%,transparent)]",
      )}
      style={{
        top: topPx,
        left: 4,
        right: 4,
        height: heightPx,
        // Gradient uses color-mix via inline style — cannot express multi-stop
        // color-mix gradients via Tailwind arbitrary values, so inline is required.
        // This is the approved dynamic-color carve-out for multi-stop gradients.
        background: [
          "linear-gradient(to bottom,",
          "color-mix(in oklch, var(--area-color) 10%, transparent),",
          "color-mix(in oklch, var(--area-color) 3%, transparent)",
          ")",
        ].join(" "),
      }}
    >
      {/* Åpent label — positioned at top-left of wash, muted mono */}
      <span className="text-muted-foreground absolute top-1 left-2 font-mono text-xs select-none">
        Åpent · {open}–{close}
      </span>
    </div>
  );
}

// ─── EmpStrip ─────────────────────────────────────────────────────────────────

/**
 * Row of employee avatar-chips rendered in the band header, below the band
 * name + time meta row. Max 6 chips visible; remainder shown as "+N" overflow.
 *
 * Chips for employees currently on shift receive an accent ring (--area-color).
 * Employees not yet on shift are rendered at reduced opacity.
 *
 * Prototype reference: timeline-chart.jsx:366-385 (emp-strip + emp-chip).
 */
function EmpStrip({
  employees,
  onShiftIds,
}: {
  employees: ReadonlyArray<Employee>;
  /** Set of employee IDs whose shift covers the current wall-clock time. */
  onShiftIds: ReadonlySet<string>;
}) {
  const visible = employees.slice(0, 6);
  const overflow = employees.length - visible.length;

  if (employees.length === 0) {
    return (
      <div
        className="text-muted-foreground px-3 pb-1 text-[0.65rem]"
        aria-label="Ingen ansatte tildelt"
      >
        Ingen tildelt
      </div>
    );
  }

  return (
    <div
      className="flex flex-row flex-wrap items-center gap-1 px-3 pt-1 pb-2"
      role="list"
      aria-label="Ansatte i avdeling"
    >
      {visible.map((emp) => {
        const isOn = onShiftIds.has(emp.id);
        // Initials: first letter of first + last name
        const parts = emp.name.trim().split(/\s+/);
        const initials =
          parts.length >= 2
            ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`
            : (parts[0]?.[0] ?? "?");
        const firstName = parts[0] ?? emp.name;

        return (
          <div
            key={emp.id}
            role="listitem"
            title={`${emp.name} · ${emp.shift ? `${emp.shift[0]}–${emp.shift[1]}` : "Ingen vakt"}`}
            className={cn(
              "flex items-center gap-1 rounded-full px-1.5 py-0.5",
              "bg-muted text-muted-foreground text-xs font-medium",
              "transition-opacity",
              isOn
                ? // On shift: accent ring derived from --area-color
                  "opacity-100 ring-1 ring-[color:color-mix(in_oklch,var(--area-color)_60%,transparent)]"
                : "opacity-50",
            )}
          >
            {/* Avatar circle — initials, tinted with area color */}
            <span
              aria-hidden="true"
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-[0.5rem] leading-none font-semibold text-white uppercase"
              style={{
                // Avatar bg: area-color at 80% — uses CSS var, no literal
                background: "color-mix(in oklch, var(--area-color) 80%, var(--muted))",
              }}
            >
              {initials.toUpperCase()}
            </span>
            <span className="max-w-[3.5rem] truncate">{firstName}</span>
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          role="listitem"
          className="bg-muted text-muted-foreground flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ─── AreaBand ─────────────────────────────────────────────────────────────────

/**
 * One vertical band in the Manager Timeline. In mode="area" it expands to
 * N PersonLane columns + an UnassignedLane. In mode="role" and mode="person"
 * it renders a single stacked column using layoutOverlap.
 *
 * `--area-color` is set via `style` as a CSS custom-prop chain so TaskBlock
 * and UnassignedLane can reference it without importing color primitives.
 * The value `var(--dept-<id>)` is a variable reference, NOT a raw OKLCH
 * literal — this is the approved dynamic-color pattern per token-audit doc.
 */
export function AreaBand({
  band,
  mode,
  employees,
  tasks,
  pxPerHour,
  dimmed = false,
  onLaneClick,
  onTaskClick,
  onDrop,
  dateISO,
  onKeyboardEdit,
}: Props) {
  // ── Tasks relevant to this band ───────────────────────────────────────────
  // mode="area": filter by area id. mode="role"/"person": all tasks passed in
  // are already pre-filtered by the chart composer (Task 3.7).
  const areaTasks = useMemo(
    () => (mode === "area" ? tasks.filter((t) => t.area === band.id) : tasks),
    [tasks, band.id, mode],
  );

  // ── Overlap layout for role/person single-column modes ────────────────────
  const { items: overlapItems, totalCols } = useMemo(
    () =>
      mode === "role" || mode === "person" ? layoutOverlap(areaTasks) : { items: [], totalCols: 1 },
    [areaTasks, mode],
  );
  const colByTaskId = new Map(overlapItems.map(({ task, col }) => [task.id, col]));

  // ── Employees on shift ────────────────────────────────────────────────────
  // For the header chip count + EmpStrip on-shift ring indicator.
  // `onShiftIds` is a Set for O(1) lookup in EmpStrip render.
  const nowMin = useMemo(() => new Date().getHours() * 60 + new Date().getMinutes(), []);
  const onShiftEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (!e.shift) return false;
        const startMin = hmToMin(e.shift[0]);
        const endMin = hmToMin(e.shift[1]);
        return startMin <= nowMin && nowMin <= endMin;
      }),
    [employees, nowMin],
  );
  const onShiftIds = useMemo(() => new Set(onShiftEmployees.map((e) => e.id)), [onShiftEmployees]);

  // ── CSS custom-prop: --area-color ─────────────────────────────────────────
  // Reference the dept token by id. `var(--dept-<id>)` is a CSS variable chain
  // that resolves at paint time — NOT an OKLCH literal (ADR-0366 compliant).
  // resolveDeptToken normalises DB-driven location_id values (e.g. "kjokken" →
  // "kitchen") so `var(--dept-kitchen)` resolves to the correct design token.
  // Falls back to `var(--border)` when no dept token exists for this id.
  const deptKey = resolveDeptToken(band.id);
  const areaColorVar = `var(--dept-${deptKey}, var(--border))`;

  return (
    <div
      className={cn(
        "border-border flex min-w-[220px] flex-1 flex-col border-r",
        dimmed && "opacity-30",
      )}
      data-testid={`area-band-${band.id}`}
      data-dimmed={dimmed ? "true" : "false"}
      style={{ "--area-color": areaColorVar } as React.CSSProperties}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-border bg-background sticky top-0 z-10 border-b">
        {/* Row 1: band name + on-shift count + open times */}
        <div className="flex items-baseline gap-2 px-3 pt-2">
          {/* Band name — font-heading (Instrument Serif) per prototype visual hierarchy */}
          <span className="text-foreground font-heading truncate text-sm font-semibold">
            {band.name}
          </span>

          {/* Employees-on-shift count badge */}
          <span className="text-muted-foreground text-[0.65rem] font-medium whitespace-nowrap">
            {onShiftEmployees.length}/{employees.length} på vakt
          </span>

          {/* Open / close times — mono font for time alignment */}
          {band.open && band.close && (
            <span className="text-muted-foreground ml-auto font-mono text-[0.65rem] whitespace-nowrap">
              {band.open}–{band.close}
            </span>
          )}
        </div>

        {/* Row 2: emp-on-shift chip strip (prototype:366-385) */}
        <EmpStrip employees={employees} onShiftIds={onShiftIds} />
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {mode === "area" ? (
        // Area mode: one PersonLane per employee + an UnassignedLane at the end.
        // OpenPeriodWash sits as an absolute overlay on top of the lane body —
        // pointer-events: none so it doesn't interfere with lane click/drag.
        <div className="relative flex flex-1 flex-row">
          {/* Open-period wash — only when band has planned open/close hours */}
          {band.open && band.close && (
            <OpenPeriodWash open={band.open} close={band.close} pxPerHour={pxPerHour} />
          )}

          {employees.map((emp) => {
            // Per-employee tasks: area-scoped tasks assigned to this person
            const empTasks = areaTasks.filter((t) => t.emp === emp.id);
            return (
              <PersonLane
                key={emp.id}
                emp={emp}
                areaId={band.id}
                pxPerHour={pxPerHour}
                tasks={empTasks}
                dimmed={false} // dimmed applied on band root, not per-lane
                onLaneClick={
                  onLaneClick ? (args) => onLaneClick({ ...args, empId: args.empId }) : undefined
                }
                onTaskClick={onTaskClick}
                onDrop={onDrop ? (empId, result) => onDrop(empId, result) : undefined}
                dateISO={dateISO}
                onKeyboardEdit={onKeyboardEdit}
              />
            );
          })}

          {/* UnassignedLane — area-anchored tasks with no employee */}
          <UnassignedLane
            areaId={band.id}
            tasks={areaTasks}
            pxPerHour={pxPerHour}
            dimmed={false}
            onLaneClick={onLaneClick}
            onTaskClick={onTaskClick}
            onDrop={onDrop}
            dateISO={dateISO}
            onKeyboardEdit={onKeyboardEdit}
          />
        </div>
      ) : (
        // Role / person mode: single stacked column using layoutOverlap
        <div
          role="group"
          aria-label={`${mode === "role" ? "Rolle" : "Person"}: ${band.name}`}
          className="relative flex-1"
          style={{ height: pxPerHour * 20 }}
        >
          {band.open && band.close && (
            <OpenPeriodWash open={band.open} close={band.close} pxPerHour={pxPerHour} />
          )}

          {areaTasks.map((task) => (
            <TaskBlock
              key={task.id}
              task={task}
              pxPerHour={pxPerHour}
              col={colByTaskId.get(task.id) ?? 0}
              totalCols={totalCols}
              onClick={onTaskClick}
              dateISO={dateISO}
              onKeyboardEdit={onKeyboardEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
