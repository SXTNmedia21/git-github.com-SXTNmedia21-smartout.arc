"use client";

/**
 * ChartDragContext — React context that distributes a shared useDragRetiming
 * instance to all chart descendants (TaskBlock, PersonLane, UnassignedLane).
 *
 * ManagerTimelineChart creates the instance once and provides it here.
 * TaskBlock reads onDragStart. PersonLane / UnassignedLane read onDragOver
 * and onDragEnd. Avoids prop-drilling four levels deep.
 *
 * Pattern reference: ADR-0298 Wave 1 Phase A.4 spec.
 */

import { createContext, useContext } from "react";
import type { DragRetimerAPI } from "./useDragRetiming";

export const ChartDragContext = createContext<DragRetimerAPI | null>(null);

/**
 * useChartDrag — safe accessor. Returns the DragRetimerAPI or null when
 * rendered outside a ChartDragContext.Provider (e.g. in isolated tests).
 * Callers guard with `if (!api) return` for no-op outside provider.
 */
export function useChartDrag(): DragRetimerAPI | null {
  return useContext(ChartDragContext);
}
