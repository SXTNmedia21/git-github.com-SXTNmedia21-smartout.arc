/**
 * Focused dashboard contexts — split of the monolithic DashboardContext
 * per ADR-0113. New code should import from these slice hooks rather
 * than the legacy facade.
 */

export {
  ThemeProvider,
  useThemeContext,
  useThemeContextOptional,
  type ThemeContextValue,
} from "./ThemeContext";

export {
  WorkspaceProvider,
  useWorkspaceContext,
  useWorkspaceContextOptional,
  type WorkspaceContextValue,
  type WorkspaceSlice,
  type WorkspaceProviderProps,
} from "./WorkspaceContext";

export {
  AdminProvider,
  useAdminContext,
  useAdminContextOptional,
  type AdminContextValue,
  type AdminViewType,
} from "./AdminContext";

export {
  ScheduleCoordinationProvider,
  useScheduleCoordinationContext,
  useScheduleCoordinationContextOptional,
  type ScheduleCoordinationContextValue,
  type ScheduleLayoutMode,
  type ScheduleViewMode,
} from "./ScheduleCoordinationContext";

export { useDashboard, type DashboardFacade } from "./useDashboard";
