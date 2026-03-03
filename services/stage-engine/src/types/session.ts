// ============================================
// session.ts
// Type definitions for missions, stages, and sessions.
// These mirror the Supabase database schema exactly.
// Connected to: ARCHITECTURE.md §3 (database schema)
// ============================================

/** Mission mode determines how stages are navigated */
export type MissionMode = "sequential" | "free" | "hybrid";

/** Session mode: mission = multi-stage workflow, agent = free-form conversation */
export type SessionMode = "mission" | "agent";

/** Channel through which the agent communicates */
export type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous";

/** Session lifecycle status */
export type SessionStatus = "active" | "complete" | "expired" | "abandoned";

/**
 * A mission defines a multi-stage agent workflow.
 * Missions are reusable templates — sessions are instances.
 */
export type Mission = {
  id: string;
  name: string;
  description: string | null;
  mode: MissionMode;
  context_source: string | null;
  workspace_id: string | null;
  journey_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * A stage is one step within a mission.
 * Contains instructions for the agent and personality overlay.
 */
export type Stage = {
  id: string;
  mission_id: string;
  stage_id: string;
  stage_order: number;
  goal: string;
  instructions: string;
  success_criteria: string;
  escalation_instructions: string | null;
  personality_override: string | null;
  emotion_hint: string | null;
  creative_freedom: number;
  next_stage: string | null;
  is_required: boolean;
  journey_step_id: string | null;
  deferred_templates: unknown[];
  inline_instructions: unknown[];
  created_at: string;
};

/**
 * A journey step loaded from the journey system.
 * Provides screen/component/action context for stages linked to journeys.
 */
export type JourneyStep = {
  journey_step_id: string;
  journey_id: string;
  workspace_id: string;
  step_order: number;
  title: string;
  action: string;
  expects: string | null;
  screen: string | null;
  component: string | null;
  data_reads: string[];
  data_writes: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A session is a single run of a mission.
 * Tracks the user, current stage, and all collected data.
 */
export type Session = {
  id: string;
  mode: SessionMode;
  mission_id: string | null;
  workspace_id: string;
  user_id: string | null;
  profile_id: string | null;
  channel: SessionChannel;
  current_stage_id: string | null;
  stage_index: number;
  status: SessionStatus;
  context: Record<string, unknown>;
  collected_data: Record<string, unknown>;
  summary: string | null;
  callback_url: string | null;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * An inbox entry — data stored by an agent during a session.
 * Freeform, categorized by entity_type.
 */
export type InboxEntry = {
  id: string;
  session_id: string;
  stage_id: string;
  workspace_id: string;
  entity_type: string;
  data: Record<string, unknown>;
  validated: boolean;
  processed: boolean;
  created_at: string;
};
