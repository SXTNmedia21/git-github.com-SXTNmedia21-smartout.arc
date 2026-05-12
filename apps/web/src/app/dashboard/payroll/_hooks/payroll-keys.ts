/**
 * TanStack Query key factory for payroll manager dashboard queries.
 * Structured for granular invalidation across period list, lines, and deviations.
 */
export const payrollKeys = {
  all: ["payroll"] as const,

  /** Period list for a workspace */
  periods: (workspaceId: string) => ["payroll", "periods", workspaceId] as const,

  /** Single period details */
  period: (periodId: string) => ["payroll", "period", periodId] as const,

  /** Aggregated lines (per-profile totals) for a period */
  lines: (periodId: string) => ["payroll", "lines", periodId] as const,

  /** Per-shift calculation rows for a profile inside a period */
  calculations: (periodId: string, profileId: string) =>
    ["payroll", "calculations", periodId, profileId] as const,

  /** Deviation list for a period */
  deviations: (periodId: string) => ["payroll", "deviations", periodId] as const,
};
