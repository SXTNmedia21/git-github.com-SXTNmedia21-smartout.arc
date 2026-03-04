/**
 * TanStack Query key factory for Guardian dashboard queries.
 * Structured for granular invalidation.
 * Connected to: all useGuardian*.ts hooks in this folder
 */
export const guardianKeys = {
  all: ["guardian"] as const,

  signals: () => ["guardian", "signals"] as const,
  signalsActive: () => ["guardian", "signals", "active"] as const,

  health: () => ["guardian", "health"] as const,

  sessions: (timeRange: string) => ["guardian", "sessions", timeRange] as const,

  toolUsage: (timeRange: string) => ["guardian", "tool-usage", timeRange] as const,

  stageAnalysis: (missionId?: string) =>
    ["guardian", "stage-analysis", missionId ?? "all"] as const,
};
