export type { MalColumn, MalEmployeeAssignment, MalTask, MalCell, MalGridData } from "./grid-types";
export { cellKey, addDays } from "./grid-types";
export { useMalData } from "./use-week-grid-data";
export { gridKeys } from "./grid-query-keys";

// New grid-first types and hooks (week-grid redesign)
export type { GridColumn, GridCell, GridStats, DayInfo, WeekGridData } from "./grid-types";
export { gridCellKey, UNASSIGNED_CONFIG_ID } from "./grid-types";
export { useWeekGridData } from "./use-week-grid-data";
export {
  useFillFromTemplate,
  usePublishWeek,
  useResetWeek,
  useAssignEmployee,
  useCreateGridShift,
  useRemoveGridShift,
  useReassignShiftType,
} from "./use-grid-mutations";

// Shift lifecycle (Phase 6 / ADR-0095) — cross-platform read hook.
export {
  useShiftLifecycle,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions,
} from "./hooks/useShiftLifecycle";
