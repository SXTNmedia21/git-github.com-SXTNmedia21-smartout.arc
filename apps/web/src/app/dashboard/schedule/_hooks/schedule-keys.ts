/**
 * TanStack Query key factory for all schedule queries.
 * Structured for granular invalidation.
 * Connected to: all use-*.ts hooks in this folder
 */
export const scheduleKeys = {
  all: ["schedule"] as const,

  employees: (workspaceId: string) => ["schedule", "employees", workspaceId] as const,

  shifts: (workspaceId: string, weekStart: string) =>
    ["schedule", "shifts", workspaceId, weekStart] as const,

  shift: (id: string) => ["schedule", "shift", id] as const,

  absences: (workspaceId: string, weekStart: string) =>
    ["schedule", "absences", workspaceId, weekStart] as const,

  templates: (workspaceId: string) => ["schedule", "templates", workspaceId] as const,

  openShifts: (workspaceId: string) => ["schedule", "open-shifts", workspaceId] as const,

  dayMessages: (workspaceId: string, weekStart: string) =>
    ["schedule", "messages", workspaceId, weekStart] as const,

  dayTasks: (workspaceId: string, weekStart: string) =>
    ["schedule", "tasks", workspaceId, weekStart] as const,

  dayBookings: (workspaceId: string, weekStart: string) =>
    ["schedule", "bookings", workspaceId, weekStart] as const,

  auditLog: (tableAndRowId: string) => ["schedule", "audit", tableAndRowId] as const,
};
