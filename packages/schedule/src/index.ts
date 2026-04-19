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

// Shift lifecycle (Phase 6 / ADR-0095, ADR-0108) — platform-neutral base hook.
// Apps must use their platform wrapper (`apps/web/src/hooks/useShiftLifecycle.ts`
// or `apps/mobile/src/hooks/useShiftLifecycle.ts`), not this base hook directly,
// to avoid constructing a Supabase client at every call site.
export {
  useShiftLifecycle,
  shiftLifecycleQueryKey,
  type ShiftLifecycleRow,
  type ShiftLifecyclePhase,
  type UseShiftLifecycleOptions,
} from "./hooks/useShiftLifecycle";
