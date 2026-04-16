// services/stage-engine/src/types/app-env.ts
// Shared Hono context types for stage-engine.
// Augment `Variables` when adding new per-request context fields.

export type AppVariables = {
  requestId: string;
  // Future: auth?: AuthContext; sessionLane?: SessionLane; etc.
};

export type AppEnv = {
  Variables: AppVariables;
};
