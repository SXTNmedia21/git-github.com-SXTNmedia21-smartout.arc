export const malKeys = {
  department: (workspaceId: string, departmentName: string) =>
    ["schedule", "mal-department", workspaceId, departmentName] as const,
  templates: (workspaceId: string, departmentId: string) =>
    ["schedule", "mal-templates", workspaceId, departmentId] as const,
  shifts: (workspaceId: string, weekStart: string, templateId: string) =>
    ["schedule", "mal-shifts", workspaceId, weekStart, templateId] as const,
  tasks: (workspaceId: string, weekStart: string, departmentId: string) =>
    ["schedule", "mal-tasks", workspaceId, weekStart, departmentId] as const,
};
