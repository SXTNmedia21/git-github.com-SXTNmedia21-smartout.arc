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

  kpiCopy: (workspaceId: string, locale: string) =>
    ["dashboard", "kpi-copy", workspaceId, locale] as const,

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

  workspaceOperatingHours: (workspaceId: string) =>
    ["dashboard", "workspace-operating-hours", workspaceId] as const,

  // Cascade Tasks (replaces Guardian Protocol)
  cascadeTasks: (workspaceId: string) => ["dashboard", "cascade-tasks", workspaceId] as const,

  // Leader Pulse
  leaderPulse: (workspaceId: string) => ["dashboard", "leader-pulse", workspaceId] as const,

  // Governance
  governanceOverview: (workspaceId: string) =>
    ["dashboard", "governance-overview", workspaceId] as const,

  protocolAssignees: (workspaceId: string, protocolId: string) =>
    ["dashboard", "protocol-assignees", workspaceId, protocolId] as const,

  protocolJourney: (workspaceId: string, assignmentId: string) =>
    ["dashboard", "protocol-journey", workspaceId, assignmentId] as const,

  workspaceSetupStatus: (workspaceId: string) =>
    ["dashboard", "workspace-setup-status", workspaceId] as const,

  onboardingGuide: (workspaceId: string) => ["dashboard", "onboarding-guide", workspaceId] as const,

  // Website Factory
  website: (workspaceId: string) => ["dashboard", "website", workspaceId] as const,

  websitePages: (websiteId: string) => ["dashboard", "website-pages", websiteId] as const,

  websiteSections: (pageId: string) => ["dashboard", "website-sections", pageId] as const,

  // Entity Drawer
  drawerDepartment: (wsId: string, id: string) =>
    ["dashboard", "entity-drawer", "department", wsId, id] as const,
};
