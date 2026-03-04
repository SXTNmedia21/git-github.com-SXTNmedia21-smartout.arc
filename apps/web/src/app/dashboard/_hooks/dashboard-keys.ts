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

  budgets: (workspaceId: string, periodType: string, startDate: string, endDate: string) =>
    ["dashboard", "budgets", workspaceId, periodType, startDate, endDate] as const,

  // Season Planning (Module 15)
  seasons: (workspaceId: string) => ["dashboard", "seasons", workspaceId] as const,

  seasonBudget: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-budget", workspaceId, seasonId] as const,

  dayFactors: (workspaceId: string, seasonBudgetId: string) =>
    ["dashboard", "day-factors", workspaceId, seasonBudgetId] as const,

  hourFactors: (workspaceId: string, seasonBudgetId: string) =>
    ["dashboard", "hour-factors", workspaceId, seasonBudgetId] as const,

  operatingHours: (workspaceId: string) => ["dashboard", "operating-hours", workspaceId] as const,

  // Guardian Protocol
  guardianSignals: (workspaceId: string) => ["dashboard", "guardian-signals", workspaceId] as const,

  guardianSessions: (workspaceId: string) =>
    ["dashboard", "guardian-sessions", workspaceId] as const,

  guardianSeasonPulse: (workspaceId: string) =>
    ["dashboard", "guardian-season-pulse", workspaceId] as const,
};
