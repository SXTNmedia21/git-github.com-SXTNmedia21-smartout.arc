// ============================================
// api.ts
// Request and response types for all API endpoints.
// Used by route handlers and Zod validation schemas.
// Connected to: ARCHITECTURE.md §4.3 (endpoint specs)
// ============================================

import type { MissionMode, SessionChannel, Stage } from "./session.js";

/** POST /sessions — request body */
export type CreateSessionRequest = {
  mission_id: string;
  workspace_id?: string;
  user_id?: string;
  profile_id?: string;
  channel: SessionChannel;
  callback_url?: string;
  context?: Record<string, unknown>;
};

/** POST /sessions — response body */
export type CreateSessionResponse = {
  session_id: string;
  mission: {
    id: string;
    name: string;
    mode: MissionMode;
  };
  current_stage: StageInfo | null;
  stages?: StageInfo[];
  context: Record<string, unknown>;
  progress: string;
  system_prompt: string;
};

/** Stage info returned to clients (subset of full Stage) */
export type StageInfo = {
  stage_id: string;
  goal: string;
  instructions: string;
  success_criteria: string;
  emotion_hint?: string;
};

/** POST /sessions/:id/store — request body */
export type StoreRequest = {
  entity_type: string;
  data: Record<string, unknown>;
  stage_id?: string;
};

/** POST /sessions/:id/store — response body */
export type StoreResponse = {
  inbox_id: string;
  confirmed: true;
  message: string;
};

/** POST /sessions/:id/fetch — request body */
export type FetchRequest = {
  query_type: "context" | "inbox" | "stage" | "history";
  filters?: {
    entity_type?: string;
    stage_id?: string;
  };
};

/** POST /sessions/:id/fetch — response body */
export type FetchResponse = {
  data: Record<string, unknown>;
};

/** POST /sessions/:id/advance — request body */
export type AdvanceRequest = {
  result?: Record<string, unknown>;
  next_stage_id?: string;
  force?: boolean;
};

/** POST /sessions/:id/advance — response body */
export type AdvanceResponse = {
  new_stage?: StageInfo;
  progress: string;
  complete: boolean;
  system_prompt?: string;
  summary?: string;
};

/** Standard error response format */
export type ErrorResponse = {
  error: string;
  message: string;
  status: number;
};
