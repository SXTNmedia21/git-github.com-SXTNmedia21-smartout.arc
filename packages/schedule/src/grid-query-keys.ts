export const gridKeys = {
  department: (workspaceId: string, departmentName: string) =>
    ["schedule", "grid-department", workspaceId, departmentName] as const,
  templates: (workspaceId: string, departmentId: string) =>
    ["schedule", "grid-configs", workspaceId, departmentId] as const,
  shifts: (workspaceId: string, weekStart: string, templateId: string) =>
    ["schedule", "grid-shifts", workspaceId, weekStart, templateId] as const,
  tasks: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "grid-tasks", workspaceId, weekStart, departmentId] as const,
};
