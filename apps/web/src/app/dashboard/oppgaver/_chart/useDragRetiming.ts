"use client";

/**
 * useDragRetiming — drag-and-drop retiming hook for Manager Timeline.
 *
 * Owns the drag state machine:
 *   IDLE → DRAGGING (onDragStart) → DROPPED (onDragEnd returns new coords)
 *                                 → IDLE (reset)
 *
 * Pixel-to-minute math:
 *   mouseY relative to lane top → raw minutes since day start →
 *   snap to 5-min grid → clamp to [DAY_START_MIN, DAY_START_MIN + DAY_MINUTES - 60] →
 *   compose ISO timestamp for the date in scope.
 *
 * The date is passed at dragStart so the hook can compose an absolute ISO
 * datetime when onDragEnd is called.
 *
 * Snap grid: 5 minutes (matches prototype timeline-shared.jsx §snap behavior).
 * Boundary: cannot place a task past (DAY_END_HOUR * 60 - 60) minutes
 * (last slot = 01:00 next day) to ensure 60-min duration fits in the chart.
 *
 * Pure computation extracted to `createDragRetimer()` (no React) so it can
 * be tested in a Node environment without a React dispatcher. The hook just
 * wraps the factory in a stable ref.
 *
 * References: ADR-0298 (Wave 1 Phase A spec), timeMath.ts constants.
 */

import { useRef } from "react";
import { DAY_START_HOUR, DAY_MINUTES, minToHM } from "./timeMath";

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_MINUTES = 5;
const DAY_START_MIN = DAY_START_HOUR * 60; // 360 (06:00)
const DAY_END_MIN_LAST_SLOT = DAY_START_MIN + DAY_MINUTES - 60; // 1500 (01:00 next day)

// ─── Types ────────────────────────────────────────────────────────────────────

export type DragState = {
  draggedTaskId: string | null;
  fromMinutes: number | null;
  fromAssignee: string | null;
  dateISO: string | null;
  dragOverLaneId: string | null;
  dragOverMinutes: number | null;
};

export type DragDropResult = {
  taskId: string;
  newScheduledAt: string; // ISO 8601
  newAssignee: string | null;
  fromIso: string | null;
  fromAssignee: string | null;
};

export type DragRetimerAPI = {
  state: Readonly<DragState>;
  onDragStart: (
    taskId: string,
    fromMinutes: number,
    fromAssignee: string | null,
    dateISO: string,
  ) => void;
  onDragOver: (laneId: string, mouseY: number, laneTopY: number, pxPerHour: number) => void;
  onDragEnd: (newAssignee: string | null) => DragDropResult | null;
  reset: () => void;
};

// ─── Pure factory (no React) ──────────────────────────────────────────────────

/**
 * createDragRetimer — pure mutable object implementing the drag state machine.
 * No React hooks. Used directly in tests; wrapped in a stable ref by the hook.
 */
export function createDragRetimer(): DragRetimerAPI {
  const state: DragState = {
    draggedTaskId: null,
    fromMinutes: null,
    fromAssignee: null,
    dateISO: null,
    dragOverLaneId: null,
    dragOverMinutes: null,
  };

  function onDragStart(
    taskId: string,
    fromMinutes: number,
    fromAssignee: string | null,
    dateISO: string,
  ) {
    state.draggedTaskId = taskId;
    state.fromMinutes = fromMinutes;
    state.fromAssignee = fromAssignee;
    state.dateISO = dateISO;
    state.dragOverLaneId = null;
    state.dragOverMinutes = null;
  }

  function onDragOver(laneId: string, mouseY: number, laneTopY: number, pxPerHour: number) {
    if (!state.draggedTaskId) return;
    const relativeY = mouseY - laneTopY;
    const rawMin = (relativeY / pxPerHour) * 60 + DAY_START_MIN;
    const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN_LAST_SLOT, snapped));
    state.dragOverLaneId = laneId;
    state.dragOverMinutes = clamped;
  }

  function onDragEnd(newAssignee: string | null): DragDropResult | null {
    if (!state.draggedTaskId || state.dragOverMinutes === null || !state.dateISO) {
      return null;
    }

    const hm = minToHM(state.dragOverMinutes);
    const [hStr, mStr] = hm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);

    const [yyyy, mm, dd] = state.dateISO.split("-").map(Number);

    // For times >= 24:00 (next day portion of the 06–02 span), increment date
    const isNextDay = h >= 24;
    const adjH = isNextDay ? h - 24 : h;
    const baseDate = new Date(yyyy!, mm! - 1, dd!);
    if (isNextDay) baseDate.setDate(baseDate.getDate() + 1);
    baseDate.setHours(adjH, m, 0, 0);
    const newScheduledAt = baseDate.toISOString();

    // Reconstruct fromIso from fromMinutes + dateISO
    let fromIso: string | null = null;
    if (state.fromMinutes !== null) {
      const fromHM = minToHM(state.fromMinutes);
      const [fhStr, fmStr] = fromHM.split(":");
      const fh = Number(fhStr);
      const fm = Number(fmStr);
      const isFromNextDay = fh >= 24;
      const adjFH = isFromNextDay ? fh - 24 : fh;
      const fromDate = new Date(yyyy!, mm! - 1, dd!);
      if (isFromNextDay) fromDate.setDate(fromDate.getDate() + 1);
      fromDate.setHours(adjFH, fm, 0, 0);
      fromIso = fromDate.toISOString();
    }

    // No-op: same time + same assignee
    const sameTime = state.dragOverMinutes === state.fromMinutes;
    const sameAssignee = newAssignee === state.fromAssignee;
    if (sameTime && sameAssignee) return null;

    return {
      taskId: state.draggedTaskId,
      newScheduledAt,
      newAssignee,
      fromIso,
      fromAssignee: state.fromAssignee,
    };
  }

  function reset() {
    state.draggedTaskId = null;
    state.fromMinutes = null;
    state.fromAssignee = null;
    state.dateISO = null;
    state.dragOverLaneId = null;
    state.dragOverMinutes = null;
  }

  return { state, onDragStart, onDragOver, onDragEnd, reset };
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * useDragRetiming — stable React hook wrapper around createDragRetimer().
 *
 * The factory instance is stored in a ref so it persists across renders
 * without triggering re-renders on drag moves. Components that need visual
 * feedback (drop-zone highlight) manage their own `isDragOver` useState.
 */
export function useDragRetiming(): DragRetimerAPI {
  const retimerRef = useRef<DragRetimerAPI | null>(null);
  if (!retimerRef.current) {
    retimerRef.current = createDragRetimer();
  }
  return retimerRef.current;
}
