export const gridKeys = {
  department: (workspaceId: string, departmentName: string) =>
    ["schedule", "grid-department", workspaceId, departmentName] as const,
  templates: (workspaceId: string, departmentId: string) =>
    ["schedule", "grid-configs", workspaceId, departmentId] as const,
  shifts: (workspaceId: string, weekStart: string, templateId: string) =>
    ["schedule", "grid-shifts", workspaceId, weekStart, templateId] as const,
  tasks: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "grid-tasks", workspaceId, weekStart, departmentId] as const,

  // New config-driven keys (week-grid redesign)
  configs: (workspaceId: string, departmentIds: string) =>
    ["schedule", "grid-configs-v2", workspaceId, departmentIds] as const,
  shiftTypes: (shiftTypeIds: string) => ["schedule", "grid-shift-types", shiftTypeIds] as const,
  weekShifts: (workspaceId: string, weekStart: string, departmentIds: string) =>
    ["schedule", "grid-week-shifts", workspaceId, weekStart, departmentIds] as const,
};
