"use client";

/**
 * useDashboard — temporary compatibility facade over the four new
 * focused dashboard contexts (Theme, Workspace, Admin,
 * ScheduleCoordination).
 *
 * Why: ADR-0113 splits the monolithic DashboardContext but commits to
 * migrating its 155 consumer sites gradually, one route at a time.
 * This facade merges the four slices into the old return shape so
 * existing `useContext(DashboardContext)` call sites keep working
 * unchanged. New code MUST NOT use `useDashboard()` — new code uses
 * the targeted slice hooks (`useThemeContext`, `useWorkspaceContext`,
 * `useAdminContext`, `useScheduleCoordinationContext`).
 *
 * The facade is scheduled for removal once all consumer sites migrate.
 *
 * @deprecated Use the targeted slice hooks instead. Retained only for
 *   backwards compatibility with the pre-ADR-0113 DashboardContext
 *   consumers during their staged migration.
 */

import { useThemeContext } from "./ThemeContext";
import { useWorkspaceContext, type WorkspaceSlice } from "./WorkspaceContext";
import { useAdminContext, type AdminViewType } from "./AdminContext";
import {
  useScheduleCoordinationContext,
  type ScheduleLayoutMode,
  type ScheduleViewMode,
} from "./ScheduleCoordinationContext";

/**
 * Shape of the old `DashboardContext` default value, reproduced here so
 * the facade signature is an explicit, reviewable contract.
 */
export type DashboardFacade = {
  // Admin slice
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean) => void;
  adminView: AdminViewType;
  setAdminView: (val: AdminViewType) => void;

  // Theme slice
  isDark: boolean;
  setIsDark: (val: boolean) => void;

  // Schedule coordination slice
  scheduleLayout: ScheduleLayoutMode;
  setScheduleLayout: (val: ScheduleLayoutMode) => void;
  scheduleView: ScheduleViewMode;
  setScheduleView: (val: ScheduleViewMode) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  weeklyPeriodCount: number;
  setWeeklyPeriodCount: (val: number) => void;
  scheduleDateOffset: number;
  setScheduleDateOffset: (val: number | ((prev: number) => number)) => void;
  onPublishAll: () => void;
  setOnPublishAll: (val: (() => void) | null) => void;
  scheduleDraftCount: number;
  setScheduleDraftCount: (val: number) => void;
  scheduleCompactMode: boolean;
  setScheduleCompactMode: (val: boolean) => void;

  // Workspace slice
  activeDepartment: string;
  setActiveDepartment: (val: string) => void;
  workspaceData: WorkspaceSlice;
  profileId: string | null;
  isSetupMode: boolean;
  isSetupLoading: boolean;
  dismissSetup: () => void;
};

/**
 * @deprecated New code should use targeted slice hooks:
 *   - `useThemeContext` for isDark / setIsDark
 *   - `useWorkspaceContext` for workspaceData / profileId / activeDepartment / setup
 *   - `useAdminContext` for isAdminMode / adminView
 *   - `useScheduleCoordinationContext` for schedule cross-route state
 */
export function useDashboard(): DashboardFacade {
  const theme = useThemeContext();
  const workspace = useWorkspaceContext();
  const admin = useAdminContext();
  const schedule = useScheduleCoordinationContext();

  return {
    // Admin
    isAdminMode: admin.isAdminMode,
    setIsAdminMode: admin.setIsAdminMode,
    adminView: admin.adminView,
    setAdminView: admin.setAdminView,

    // Theme
    isDark: theme.isDark,
    setIsDark: theme.setIsDark,

    // Schedule coordination
    scheduleLayout: schedule.scheduleLayout,
    setScheduleLayout: schedule.setScheduleLayout,
    scheduleView: schedule.scheduleView,
    setScheduleView: schedule.setScheduleView,
    isSidebarCollapsed: schedule.isSidebarCollapsed,
    setIsSidebarCollapsed: schedule.setIsSidebarCollapsed,
    weeklyPeriodCount: schedule.weeklyPeriodCount,
    setWeeklyPeriodCount: schedule.setWeeklyPeriodCount,
    scheduleDateOffset: schedule.scheduleDateOffset,
    setScheduleDateOffset: schedule.setScheduleDateOffset,
    onPublishAll: schedule.onPublishAll,
    setOnPublishAll: schedule.setOnPublishAll,
    scheduleDraftCount: schedule.scheduleDraftCount,
    setScheduleDraftCount: schedule.setScheduleDraftCount,
    scheduleCompactMode: schedule.scheduleCompactMode,
    setScheduleCompactMode: schedule.setScheduleCompactMode,

    // Workspace
    activeDepartment: workspace.activeDepartment,
    setActiveDepartment: workspace.setActiveDepartment,
    workspaceData: workspace.workspaceData,
    profileId: workspace.profileId,
    isSetupMode: workspace.isSetupMode,
    isSetupLoading: workspace.isSetupLoading,
    dismissSetup: workspace.dismissSetup,
  };
}
