// services/stage-engine/src/types/app-env.ts
// Shared Hono context types for stage-engine.
// Augment `Variables` when adding new per-request context fields.

import type { SessionLane } from "../core/session-lane.js";

export type AppVariables = {
  requestId: string;
  sessionLane: SessionLane;
  // Future: auth?: AuthContext; etc.
};

export type AppEnv = {
  Variables: AppVariables;
};
