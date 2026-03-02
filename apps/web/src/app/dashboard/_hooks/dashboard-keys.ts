/**
 * TanStack Query key factory for all dashboard queries.
 * Structured for granular invalidation.
 * Connected to: all use-*.ts hooks in this folder
 */
export const dashboardKeys = {
  all: ["dashboard"] as const,

  actionItems: (workspaceId: string) => ["dashboard", "action-items", workspaceId] as const,

  staffingCoverage: (workspaceId: string, weekStart: string) =>
    ["dashboard", "staffing-coverage", workspaceId, weekStart] as const,

  taskCompletion: (workspaceId: string) => ["dashboard", "task-completion", workspaceId] as const,

  workforcePipeline: (workspaceId: string) =>
    ["dashboard", "workforce-pipeline", workspaceId] as const,

  trainingReadiness: (workspaceId: string) =>
    ["dashboard", "training-readiness", workspaceId] as const,

  departmentShifts: (workspaceId: string, date: string) =>
    ["dashboard", "department-shifts", workspaceId, date] as const,

  activityHeatmap: (workspaceId: string, timeframe: string) =>
    ["dashboard", "activity-heatmap", workspaceId, timeframe] as const,

  trainingProgress: (workspaceId: string) =>
    ["dashboard", "training-progress", workspaceId] as const,

  myShifts: (profileId: string) => ["dashboard", "my-shifts", profileId] as const,

  myReadiness: (profileId: string) => ["dashboard", "my-readiness", profileId] as const,

  openShifts: (workspaceId: string) => ["dashboard", "open-shifts", workspaceId] as const,

  kpiTargets: (workspaceId: string) => ["dashboard", "kpi-targets", workspaceId] as const,
};
