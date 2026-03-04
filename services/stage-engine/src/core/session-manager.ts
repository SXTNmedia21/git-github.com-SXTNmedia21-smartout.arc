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
import { emitGuardianEvent } from "./guardian-bus.js";
import type { Mission, Stage, Session, JourneyStep } from "../types/session.js";
import type { CreateSessionRequest, CreateSessionResponse } from "../types/api.js";
import type { AuthContext } from "../types/auth.js";

/**
 * Load completed onboarding data for a profile.
 * Used by Botsson to inherit Lise's collected data.
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
  workspaceId: string,
  userId?: string,
  profileId?: string,
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {};

  // Load workspace info
  const { data: workspace } = await supabaseAdmin
    .from("workspace")
    .select("workspace_id, name, slug")
    .eq("workspace_id", workspaceId)
    .single();

  if (workspace) {
    context.workspace = workspace;
  }

  // Load profile info if profile_id provided
  if (profileId) {
    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("profile_id, first_name, last_name, role, status")
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
      .select("user_identity_id, email, full_name")
      .eq("user_identity_id", userId)
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
  const isLongLived = mission.id === "season-lifecycle";
  const expiresAt = isLongLived
    ? null
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Create session row
  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mission_id: req.mission_id,
      workspace_id: req.workspace_id,
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

  const systemPrompt = firstStage
    ? buildStagePrompt(firstStage, context, {}, mission.system_prompt)
    : (mission.system_prompt ??
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

    return { ...session, status: "expired" } as Session;
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
