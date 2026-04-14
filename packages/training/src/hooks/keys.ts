// packages/training/src/hooks/keys.ts
// TanStack Query key factory for training data.

export const trainingKeys = {
  assignedProtocols: (profileId: string) => ["training", "assigned-protocols", profileId] as const,
  readiness: (profileId: string) => ["training", "readiness", profileId] as const,
  workspaceReadiness: (workspaceId: string) =>
    ["training", "workspace-readiness", workspaceId] as const,
};
