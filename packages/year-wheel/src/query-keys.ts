/**
 * TanStack Query key factory for year-wheel queries.
 * Shared between web and mobile to ensure cache consistency.
 */
export const yearWheelKeys = {
  seasons: (workspaceId: string) => ["dashboard", "seasons", workspaceId] as const,

  seasonBudget: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-budget", workspaceId, seasonId] as const,

  seasonGoals: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-goals", workspaceId, seasonId] as const,

  seasonPolicyBindings: (workspaceId: string, seasonId: string) =>
    ["dashboard", "season-policy-bindings", workspaceId, seasonId] as const,

  dayFactors: (workspaceId: string, seasonBudgetId: string) =>
    ["dashboard", "day-factors", workspaceId, seasonBudgetId] as const,

  hourFactors: (workspaceId: string, seasonBudgetId: string) =>
    ["dashboard", "hour-factors", workspaceId, seasonBudgetId] as const,

  planningEvents: (workspaceId: string, cycleId?: string | null) =>
    ["planning-events", workspaceId, cycleId ?? "all"] as const,

  planningCycles: (workspaceId: string) => ["planning-cycles", workspaceId] as const,

  seasonOperatingHours: (workspaceId: string, seasonId: string) =>
    ["season-operating-hours", workspaceId, seasonId] as const,
};
