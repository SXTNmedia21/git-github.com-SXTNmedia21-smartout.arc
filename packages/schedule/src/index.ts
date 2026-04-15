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

// Shift lifecycle (Phase 6 / ADR-0095, platform-neutral per ADR-0108) —
// platform-agnostic read hook. Web consumers should prefer the thin wrapper
// at `apps/web/src/hooks/useShiftLifecycle.ts`, which injects the browser
// Supabase client. Mobile consumers inject an RN Supabase client directly.
export {
  useShiftLifecycle,
  shiftLifecycleQueryKey,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions,
} from "./hooks/useShiftLifecycle";
