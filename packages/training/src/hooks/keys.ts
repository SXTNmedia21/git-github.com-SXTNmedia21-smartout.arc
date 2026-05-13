// packages/training/src/hooks/keys.ts
// TanStack Query key factory for training data.
//
// Allowing `null` in the key arguments lets callers build the key while the
// identity is still loading without an empty-string fallback on
// `profile_id` / `workspace_id` (ADR-0134 / L-0083). Queries are gated
// separately via `enabled: !!id`.

export const trainingKeys = {
  assignedProtocols: (profileId: string | null) =>
    ["training", "assigned-protocols", profileId] as const,
  readiness: (profileId: string | null) => ["training", "readiness", profileId] as const,
  workspaceReadiness: (workspaceId: string | null) =>
    ["training", "workspace-readiness", workspaceId] as const,
};
