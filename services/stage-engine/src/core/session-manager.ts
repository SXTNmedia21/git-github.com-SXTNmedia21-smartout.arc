// ============================================
// session-manager.ts
// Core session lifecycle management for the Stage Engine.
// Handles creating, loading, expiring, and abandoning sessions.
// All session state is stored in Supabase engine_sessions table.
// Connected to: src/routes/sessions.ts (route handlers call these functions)
// Connected to: src/types/session.ts (type definitions)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { buildStagePrompt } from "./prompt-builder.js";
import { buildSessionSummary } from "./build-session-summary.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { emitSessionEvent } from "./session-event-bus.js";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import { saveMemory } from "@smartout/ai/context/memory-writer";
import type { Mission, Stage, Session, JourneyStep } from "../types/session.js";
import type { ConversationTurn } from "../types/agent.js";
import type { CreateSessionRequest, CreateSessionResponse } from "../types/api.js";
import type { AuthContext } from "../types/auth.js";
import { SEASON_LIFECYCLE_MISSION_ID } from "@smartout/ai";

/**
 * Load completed onboarding data for a profile.
 * Used by Botsson to inherit previously collected onboarding data.
 */
export async function loadOnboardingContext(
  profileId: string,
  workspaceId: string,
): Promise<Record<string, unknown> | null> {
  const { data: session } = await supabaseAdmin
    .from("engine_sessions")
    .select("collected_data, created_at, completed_at, context")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .eq("status", "complete")
    .eq("mode", "mission")
    .not("journey_id", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) return null;

  return {
    prior_onboarding: {
      collected_data: session.collected_data,
      completed_at: session.completed_at,
      created_at: session.created_at,
    },
  };
}

/** Result of loading a session with workspace authorization */
export type SessionLoadResult =
  | { ok: true; session: Session }
  | { ok: false; status: 404 | 403; message: string };

/**
 * Loads a session and verifies the caller has access to it.
 * Checks that the authenticated user/key belongs to the session's workspace.
 * This prevents cross-workspace data access.
 */
export async function loadAuthorizedSession(
  sessionId: string,
  auth: AuthContext,
): Promise<SessionLoadResult> {
  const session = await getSession(sessionId);
  if (!session) {
    return { ok: false, status: 404, message: `Session "${sessionId}" not found` };
  }

  // Workspace authorization — prevent cross-workspace access
  if (auth.workspaceId && auth.workspaceId !== session.workspace_id) {
    return { ok: false, status: 403, message: "Access denied: workspace mismatch" };
  }

  return { ok: true, session };
}

/** Return type for loadMission — includes optional journey data */
export type LoadMissionResult = {
  mission: Mission;
  stages: Stage[];
  journey: Record<string, unknown> | null;
  journeySteps: JourneyStep[];
};

/**
 * Loads a mission and all its stages from the database.
 * If the mission has a linked journey, also loads the journey and its steps.
 * Returns null if the mission does not exist or is inactive.
 */
export async function loadMission(missionId: string): Promise<LoadMissionResult | null> {
  const { data: mission, error: missionErr } = await supabaseAdmin
    .from("engine_missions")
    .select("*")
    .eq("id", missionId)
    .eq("is_active", true)
    .single();

  if (missionErr || !mission) {
    console.error(
      "[loadMission] Failed to load mission:",
      missionId,
      "error:",
      missionErr?.message,
      "data:",
      mission,
    );
    return null;
  }

  const { data: stages, error: stagesErr } = await supabaseAdmin
    .from("engine_stages")
    .select("*")
    .eq("mission_id", missionId)
    .order("stage_order", { ascending: true });

  if (stagesErr || !stages) return null;

  // If mission has a linked journey, load it with steps
  let journey: Record<string, unknown> | null = null;
  let journeySteps: JourneyStep[] = [];

  if (mission.journey_id) {
    const { data: j } = await supabaseAdmin
      .from("journey")
      .select("*")
      .eq("journey_id", mission.journey_id)
      .single();

    if (j) {
      journey = j as Record<string, unknown>;
      const { data: steps } = await supabaseAdmin
        .from("journey_step")
        .select("*")
        .eq("journey_id", j.journey_id)
        .order("step_order", { ascending: true });
      journeySteps = (steps ?? []) as JourneyStep[];
    }
  }

  return {
    mission: mission as Mission,
    stages: stages as Stage[],
    journey,
    journeySteps,
  };
}

/**
 * Loads identity context for a session — profile and workspace data.
 * This context is stored in the session and available to the agent.
 */
async function loadIdentityContext(
  workspaceId?: string,
  userId?: string,
  profileId?: string,
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  // Load workspace info
  if (workspaceId) {
    const { data: workspace } = await supabaseAdmin
      .from("workspace")
      .select("workspace_id, name, slug")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspace) {
      context.workspace = workspace;
    }
  }

  // Load profile info if profile_id provided
  if (profileId) {
    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("profile_id, display_name, role, status")
      .eq("profile_id", profileId)
      .single();

    if (profile) {
      context.profile = profile;
    }
  }

  // Load user identity if user_id provided
  if (userId) {
    const { data: identity } = await supabaseAdmin
      .from("user_identity")
      .select("user_id, email, first_name, last_name")
      .eq("user_id", userId)
      .single();

    if (identity) {
      context.identity = identity;
    }
  }

  return context;
}

/**
 * Creates a new session for a mission.
 * Loads mission + stages, identity context, and determines the first stage.
 *
 * @returns CreateSessionResponse or null if mission not found
 */
export async function createSession(
  req: CreateSessionRequest,
  auth: AuthContext,
): Promise<CreateSessionResponse | null> {
  // Load mission, stages, and journey data (if linked)
  const result = await loadMission(req.mission_id);
  if (!result) return null;

  const { mission, stages, journey, journeySteps } = result;

  // Determine first stage based on mission mode
  const firstStage = mission.mode === "free" ? null : (stages[0] ?? null);

  // Load identity context
  const identityContext = await loadIdentityContext(req.workspace_id, req.user_id, req.profile_id);

  // Merge additional context from request
  const context: Record<string, unknown> = { ...identityContext, ...(req.context ?? {}) };

  // Include journey context if mission is linked to a journey
  const journeyContext = journey
    ? {
        journey_id: mission.journey_id,
        journey_title: journey.title as string,
        journey_code: journey.code as string,
        total_steps: journeySteps.length,
        steps: journeySteps.map((s) => ({
          step_order: s.step_order,
          title: s.title,
          action: s.action,
          expects: s.expects,
          screen: s.screen,
          component: s.component,
          data_writes: s.data_writes ?? [],
          data_reads: s.data_reads ?? [],
          min_duration_seconds: s.min_duration_seconds,
          max_duration_seconds: s.max_duration_seconds,
          required_confirmation: s.required_confirmation,
        })),
      }
    : null;

  if (journeyContext) {
    context.journey = journeyContext;
  }

  // Long-lived missions (e.g. season-lifecycle) never expire
  const isLongLived = mission.id === SEASON_LIFECYCLE_MISSION_ID;
  const expiresAt = isLongLived ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Create session row
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mission_id: req.mission_id,
      workspace_id: req.workspace_id ?? null,
      user_id: req.user_id ?? null,
      profile_id: req.profile_id ?? null,
      channel: req.channel,
      current_stage_id: firstStage?.stage_id ?? null,
      stage_index: firstStage ? 0 : -1,
      status: "active",
      context,
      collected_data: {},
      callback_url: req.callback_url ?? null,
      journey_id: mission.journey_id ?? null,
      stage_started_at: new Date().toISOString(),
      guardian_whisper_count: 0,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error || !session) {
    console.error("[session-manager] Failed to create session:", error?.message);
    return null;
  }

  if (req.workspace_id) {
    emitGuardianEvent({
      session_id: session.id,
      workspace_id: req.workspace_id,
      event_type: "session.started",
      actor: "system",
      summary: `Session started: ${req.mission_id}`,
      data: {
        mission_id: req.mission_id,
        channel: req.channel,
        profile_id: req.profile_id ?? null,
      },
    });
    emitSessionEvent("session.started", req.workspace_id, session.id);
  }

  // Build stage info for response
  const stageInfo = firstStage
    ? {
        stage_id: firstStage.stage_id,
        goal: firstStage.goal,
        instructions: firstStage.instructions,
        success_criteria: firstStage.success_criteria,
        emotion_hint: firstStage.emotion_hint ?? undefined,
      }
    : null;

  // Build progress string
  const total = stages.length;
  const current = firstStage ? 1 : 0;
  const progress = `${current}/${total}`;

  // Persona prompt from client (Botsson persona engine) overrides mission system_prompt.
  // This lets the frontend control who the agent IS — name, personality, behavior rules.
  const personaPrompt = typeof context.persona_prompt === "string" ? context.persona_prompt : null;
  const basePrompt = personaPrompt ?? mission.system_prompt ?? null;

  const systemPrompt = firstStage
    ? buildStagePrompt(firstStage, context, {}, basePrompt)
    : (basePrompt ??
      "You are a helpful assistant. The mission is in free mode — choose a stage to start.");

  return {
    session_id: session.id,
    mission: {
      id: mission.id,
      name: mission.name,
      mode: mission.mode as "sequential" | "free" | "hybrid",
    },
    current_stage: stageInfo,
    stages:
      mission.mode === "free"
        ? stages.map((s) => ({
            stage_id: s.stage_id,
            goal: s.goal,
            instructions: s.instructions,
            success_criteria: s.success_criteria,
            emotion_hint: s.emotion_hint ?? undefined,
          }))
        : undefined,
    context,
    progress,
    system_prompt: systemPrompt,
  };
}

/**
 * Extracts the conversation turns from a session's collected_data.
 * Inlined here to avoid a circular import with agent-session.ts.
 */
function extractConversation(session: Session): ConversationTurn[] {
  return (session.collected_data?.conversation ?? []) as ConversationTurn[];
}

/**
 * Writes an auto-summary to engine_memory when a session ends.
 * Called from the expiry path (getSession) and the abandon path (abandonSession).
 *
 * Skips silently if:
 *   - profile_id or workspace_id are missing (L-0177 fail-fast at DB write)
 *   - summary would be empty (all-assistant conversation)
 *
 * Does NOT call gate_action — this is a system-actor write (session-end
 * background job), not a user-agent mutation. The memory capability authority
 * row allows service-role writes without a C4 gate (same pattern as onboarding
 * memory seed via add_key_fact).
 */
async function writeSessionSummary(
  session: Session,
  closeReason: "expired" | "abandoned",
): Promise<void> {
  // L-0177: fail-fast on missing IDs — never write with null actor.
  if (!session.profile_id || !session.workspace_id) {
    return;
  }

  const conversation = extractConversation(session);
  const summary = buildSessionSummary(conversation);

  if (summary.trim().length === 0) {
    return;
  }

  const userTurnCount = conversation.filter((t) => t.role === "user").length;

  const result = await saveMemory({
    supabaseAdmin,
    workspaceId: session.workspace_id,
    profileId: session.profile_id,
    content: summary,
    memoryType: "summary",
    scope: "conversation",
    importance: 0.6,
    sourceSessionId: session.id,
  });

  if (!result.ok) {
    console.warn(
      "[session-manager] writeSessionSummary: saveMemory failed",
      result.reason,
      "detail" in result ? result.detail : undefined,
    );
    return;
  }

  await emit({
    event: "agent.memory.summary_written",
    workspace_id: nonEmpty(session.workspace_id, "workspace_id"),
    actor_id: nonEmpty(session.profile_id, "profile_id"),
    properties: {
      data: {
        session_id: session.id,
        close_reason: closeReason,
        summary_length: summary.length,
        turn_count: userTurnCount,
      },
    },
  });
}

/**
 * Loads a session by ID. Returns null if not found.
 * Also checks expiry — if expired, updates status automatically.
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !session) return null;

  // Check if expired (long-lived sessions have expires_at = null and never expire)
  if (
    session.status === "active" &&
    session.expires_at !== null &&
    new Date(session.expires_at) < new Date()
  ) {
    await supabaseAdmin
      .from("engine_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    const expiredSession = { ...session, status: "expired" } as Session;

    // Write session summary to engine_memory on expiry. Fire-and-forget — do not
    // block the caller waiting for memory write; a summary failure must not fail
    // the session load.
    void writeSessionSummary(expiredSession, "expired").catch((err) => {
      console.warn("[session-manager] getSession: writeSessionSummary error", err);
    });

    return expiredSession;
  }

  return session as Session;
}

/**
 * Marks a session as abandoned. Returns the updated session or null if not found.
 */
export async function abandonSession(sessionId: string): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  if (session.status !== "active") {
    return session;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("engine_sessions")
    .update({ status: "abandoned", updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) return null;

  if (updated) {
    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: updated.workspace_id,
      event_type: "session.abandoned",
      actor: "system",
      summary: "Session abandoned",
      data: { last_stage: updated.current_stage_id },
    });
    if (updated.workspace_id) {
      emitSessionEvent("session.ended", updated.workspace_id, sessionId);
    }

    // Write session summary to engine_memory on abandon. Fire-and-forget — a
    // summary failure must not fail the abandon response to the caller.
    void writeSessionSummary(updated as Session, "abandoned").catch((err) => {
      console.warn("[session-manager] abandonSession: writeSessionSummary error", err);
    });
  }

  return updated as Session;
}

/**
 * Runs the session expiry cleanup job.
 * Marks all active sessions past their expires_at as expired.
 * Returns the count of expired sessions.
 */
export async function expireStaleSession(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("engine_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[session-manager] Cleanup error:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}
