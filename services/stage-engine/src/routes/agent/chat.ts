// ============================================
// chat.ts
// POST /agent/chat — Main endpoint for agent mode conversations.
// Creates or resumes a session, processes the message through the
// agent router, and returns the response.
// Connected to: src/core/agent-router.ts (message processing)
// Connected to: src/core/agent-session.ts (session management)
// Connected to: src/types/agent.ts (request/response types)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { routeAgentMessage } from "../../core/agent-router.js";
import {
  createAgentSession,
  loadAgentSession,
  appendConversationTurn,
  getConversationHistory,
} from "../../core/agent-session.js";
import { emitGuardianEvent } from "../../core/guardian-bus.js";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import { deriveProfileId, ActorDerivationError } from "../../core/derive-profile-id.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import type { AppVariables } from "../../types/app-env.js";
import type { AuthContext } from "../../types/auth.js";
import type { ConversationTurn } from "../../types/agent.js";

const agentChat = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

// -- Schema --

// -- Context block sub-schemas (all optional — graceful degradation when pipe not yet wired) --

const userContextSchema = z
  .object({
    profile_id: z.string(),
    role: z.enum(["owner", "admin", "manager", "employee"]),
    status: z.enum(["trainee", "active", "inactive", "offboarding"]),
    department_id: z.string().nullable(),
    display_name: z.string(),
    language: z.enum(["no", "en", "sv", "da", "fi"]),
  })
  .optional();

const workspaceContextSchema = z
  .object({
    workspace_id: z.string(),
    name: z.string(),
    niche: z.string().nullable(),
    active_season_id: z.string().nullable(),
    active_framework_id: z.string().nullable(),
    planning_cycle_id: z.string().nullable(),
  })
  .optional();

const routeContextSchema = z
  .object({
    path: z.string(),
    query: z.record(z.string()),
    entity_type: z.string().nullable(),
    entity_id: z.string().nullable(),
    entity_label: z.string().nullable(),
  })
  .optional();

const chatSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().uuid().optional(),
  // profile_id removed — server-derived per ADR-0151.
  channel: z.enum(["chat", "voice"]).optional().default("chat"),
  page_context: z.string().optional(), // current page pathname from frontend
  /** Employee JWT for RLS-enforced PII writes (contract intake). */
  user_jwt: z.string().optional(),
  /** ADR-0239: wizard_session_id forwarded by /api/emma/chat when
   *  mission="journey_authoring". Threaded into AgentToolContext.wizardSessionId
   *  so save_draft + publish_draft tools can write to wizard_session.* without
   *  conflating engine_sessions.id with wizard_session_id. */
  wizard_session_id: z.string().uuid().optional(),
  /** Botsson context pipe: who is speaking. Derived server-side at session start
   *  via GET /api/botsson/voice/session-context; forwarded by the BFF. */
  user_context: userContextSchema,
  /** Botsson context pipe: workspace cascade state (season, framework, cycle). */
  workspace_context: workspaceContextSchema,
  /** Botsson context pipe: current page + focused entity published by the browser. */
  route_context: routeContextSchema,
});

// -- POST /agent/chat --

agentChat.post("/agent/chat", zValidator("json", chatSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth") as AuthContext;
  const rawWorkspaceId = auth.workspaceId;

  if (!rawWorkspaceId) {
    return c.json(
      {
        error: "FORBIDDEN",
        message: "Workspace context is required for agent chat",
        status: 403,
      },
      403,
    );
  }

  // ADR-0239 fix: when mission=journey_authoring forwards a wizard_session_id,
  // the wizard's workspace MUST drive context (not the JWT-default first
  // profile workspace). validateJwt returns the user's earliest profile
  // workspace for general queries, but a godmode admin authoring a journey
  // for any other workspace would FK-fail on gate_evaluation otherwise.
  let effectiveWorkspaceId = nonEmpty(rawWorkspaceId, "workspaceId");
  if (body.wizard_session_id) {
    const { data: wizardRow } = await supabaseAdmin
      .from("wizard_session")
      .select("workspace_id")
      .eq("wizard_session_id", body.wizard_session_id)
      .maybeSingle();
    if (wizardRow?.workspace_id) {
      effectiveWorkspaceId = nonEmpty(wizardRow.workspace_id, "workspaceId");
    }
  }
  const workspaceId = effectiveWorkspaceId;

  if (!auth.userId) {
    return c.json(
      {
        error: "UNAUTHENTICATED",
        message: "Bearer token required for profile derivation",
        status: 401,
      },
      401,
    );
  }

  let profileId;
  try {
    profileId = await deriveProfileId(auth.userId, workspaceId, supabaseAdmin);
  } catch (err) {
    if (err instanceof ActorDerivationError) {
      return c.json({ error: "PROFILE_NOT_FOUND", message: err.message, status: 403 }, 403);
    }
    throw err;
  }

  // Load or create session
  let sessionId = body.session_id;
  let conversationHistory: ConversationTurn[] = [];

  if (sessionId) {
    // Load existing session
    const result = await loadAgentSession(sessionId, auth);
    if (!result.ok) {
      return c.json(
        {
          error: result.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
          message: result.message,
          status: result.status,
        },
        result.status,
      );
    }

    if (result.session.status !== "active") {
      return c.json(
        {
          error: "SESSION_NOT_ACTIVE",
          message: `Session is "${result.session.status}"`,
          status: 409,
        },
        409,
      );
    }

    conversationHistory = getConversationHistory(result.session);
  } else {
    // Create new agent session
    const session = await createAgentSession({
      workspaceId,
      profileId: profileId,
      userId: auth.userId,
      channel: body.channel,
    });

    if (!session) {
      return c.json(
        { error: "INTERNAL_ERROR", message: "Failed to create agent session", status: 500 },
        500,
      );
    }

    sessionId = session.id;
  }

  // All session-mutating operations serialized per session to prevent race conditions
  const lane = c.get("sessionLane");
  return await lane.run(sessionId, async () => {
    // Append user turn
    const userTurn: ConversationTurn = {
      role: "user",
      content: body.message,
      timestamp: new Date().toISOString(),
    };
    await appendConversationTurn(sessionId, userTurn);

    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "user.message",
      actor: "user",
      summary: body.message.length > 100 ? body.message.slice(0, 100) + "\u2026" : body.message,
      data: { text: body.message, channel: body.channel },
    });

    await emit({
      event: "botsson.turn_started",
      workspace_id: workspaceId,
      actor_id: profileId,
      correlation_id: c.get("requestId"),
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: sessionId,
          entity_label: profileId,
        },
        data: {
          session_id: sessionId,
          // ADR-0077: voice channel carries transcribed PII (personnummer,
          // bank, address). Preview is chat-only; voice is redacted before
          // it reaches PostHog / activity_trail.
          message_preview:
            body.channel === "chat"
              ? body.message.length > 100
                ? body.message.slice(0, 100) + "\u2026"
                : body.message
              : "[voice \u2014 transcript redacted]",
          channel: body.channel,
        },
      },
    });

    // Route message through agent pipeline
    const response = await routeAgentMessage({
      message: body.message,
      sessionId,
      workspaceId,
      profileId: profileId,
      userId: auth.userId,
      conversationHistory,
      pageContext: body.page_context,
      channel: body.channel,
      userJwt: body.user_jwt,
      wizardSessionId: body.wizard_session_id,
      userContext: body.user_context,
      workspaceContext: body.workspace_context,
      routeContext: body.route_context,
    });

    // Append assistant turn
    const assistantTurn: ConversationTurn = {
      role: "assistant",
      content: response.response,
      timestamp: new Date().toISOString(),
    };
    await appendConversationTurn(sessionId, assistantTurn);

    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "agent.response",
      actor: "agent",
      summary:
        response.response.length > 100
          ? response.response.slice(0, 100) + "\u2026"
          : response.response,
      data: { text: response.response, intent: response.intent },
    });

    await emit({
      event: "botsson.turn_completed",
      workspace_id: workspaceId,
      actor_id: profileId,
      correlation_id: c.get("requestId"),
      properties: {
        entity: {
          entity_type: "agent_session",
          entity_id: sessionId,
          entity_label: profileId,
        },
        data: {
          session_id: sessionId,
          intent_capability: response.intent?.capability ?? "unknown",
          intent_confidence: response.intent?.confidence ?? 0,
          response_preview:
            response.response.length > 100
              ? response.response.slice(0, 100) + "\u2026"
              : response.response,
        },
      },
    });

    return c.json(response, 200);
  });
});

export { agentChat };
