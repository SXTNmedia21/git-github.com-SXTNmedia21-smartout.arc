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

// -- Helpers --

/**
 * Parse the calling user's profile_id from a voice session_id.
 *
 * Convention (see services/voice-agent/src/adapter.ts):
 *   session_id = "voice-{workspace_id}-{profile_id}"
 * where workspace_id and profile_id are both UUIDs.
 *
 * Returns the profile_id UUID string, or null if the session_id does not
 * follow the voice convention.
 *
 * Used on the voice path (F-SE-01 fix) because the service-account JWT has
 * no profile in the calling user's workspace — we cannot use deriveProfileId().
 */
function parseVoiceSessionProfileId(sessionId: string): string | null {
  // Expected: "voice-<uuid>-<uuid>" (prefix + two UUIDs separated by hyphens)
  // UUID format: 8-4-4-4-12 hex chars
  const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const VOICE_SESSION_RE = new RegExp(`^voice-(${UUID_PATTERN})-(${UUID_PATTERN})$`, "i");
  const match = VOICE_SESSION_RE.exec(sessionId);
  if (!match) return null;
  return match[2]; // second UUID is the profile_id
}

// -- Schema --

// -- Context block sub-schemas (all optional — graceful degradation when pipe not yet wired) --

// profile_id removed per ADR-0151 — actor identity is server-derived.
// Downstream consumers must use the session's serverDerivedProfileId, not
// any body-supplied identifier.
const userContextSchema = z
  .object({
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
  // session_id accepts two formats:
  //   - UUID string: standard chat path (engine_session.id)
  //   - "voice-{uuid}-{uuid}": voice path — voice-agent convention encoding
  //     the calling user's workspace_id + profile_id for server-side derivation
  //     (F-SE-01 fix; see parseVoiceSessionProfileId)
  session_id: z
    .union([z.string().uuid(), z.string().regex(/^voice-[0-9a-f-]{36}-[0-9a-f-]{36}$/i)])
    .optional(),
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

  // Workspace derivation — three-way priority (highest to lowest):
  //
  // 1. wizard_session_id  → workspace resolved from wizard_session table row
  //    (ADR-0239: godmode admin authoring a journey for another workspace)
  //
  // 2. voice channel      → workspace from body.workspace_context.workspace_id
  //    (F-SE-01 / Option A fix): voice-agent sends BOTSSON_SERVICE_JWT whose
  //    validateJwt resolves the service-account's own workspace (Y), not the
  //    calling user's workspace (X). body.workspace_context is BFF-derived:
  //    GET /api/botsson/voice/session-context validates the workspaceId against
  //    the authenticated user's JWT (profile membership check, 403 on failure)
  //    before returning the workspace snapshot. Safe to trust.
  //    Fail-closed (400) when absent — voice-agent always sends this; absence
  //    means a misconfigured or forged request.
  //    L-0177: never silently fall back to JWT-default workspace.
  //
  // 3. chat / default     → workspace from JWT-derived auth.workspaceId
  //    (existing behaviour — unchanged for non-voice paths)
  let effectiveWorkspaceId = nonEmpty(rawWorkspaceId, "workspaceId");

  if (body.wizard_session_id) {
    // Priority 1 — wizard session workspace (ADR-0239 + L-0177 fail-closed)
    const { data: wizardRow } = await supabaseAdmin
      .from("wizard_session")
      .select("workspace_id")
      .eq("wizard_session_id", body.wizard_session_id)
      .maybeSingle();
    if (!wizardRow?.workspace_id) {
      return c.json(
        {
          error: "WIZARD_NOT_FOUND",
          message: `wizard_session ${body.wizard_session_id} not found or has no workspace_id`,
          status: 404,
        },
        404,
      );
    }
    effectiveWorkspaceId = nonEmpty(wizardRow.workspace_id, "workspaceId");
  } else if (body.channel === "voice") {
    // Priority 2 — voice channel: trust body.workspace_context.workspace_id
    // over the JWT-derived service-account workspace (F-SE-01 fix).
    const voiceWorkspaceId = body.workspace_context?.workspace_id;
    if (!voiceWorkspaceId) {
      // Fail-closed: voice requests without workspace_context are malformed.
      // This prevents cross-tenant routing to the service-account's workspace.
      return c.json(
        {
          error: "MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT",
          message:
            "Voice channel requests must supply workspace_context.workspace_id. " +
            "The voice-agent adapter always provides this from the BFF-derived session-context.",
          status: 400,
        },
        400,
      );
    }
    effectiveWorkspaceId = nonEmpty(voiceWorkspaceId, "workspaceId");
  }
  // Priority 3 — chat / default: effectiveWorkspaceId already set from rawWorkspaceId above.

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

  // Profile derivation:
  // - Chat path (user JWT): derive from auth.userId + workspaceId (standard ADR-0151 path).
  // - Voice path (service JWT): auth.userId is the service-account user ID, which has no
  //   profile in the calling user's workspace. Instead parse profile_id from the session_id
  //   convention "voice-{workspace_id}-{profile_id}" and verify the profile exists.
  //   This is safe: session_id is generated by the voice-agent (trusted process), not
  //   by the browser. The UUID UUID format validates it; the DB lookup confirms it.
  let profileId;

  if (body.channel === "voice" && body.session_id) {
    const voiceProfileId = parseVoiceSessionProfileId(body.session_id);
    if (!voiceProfileId) {
      return c.json(
        {
          error: "MALFORMED_VOICE_SESSION_ID",
          message:
            "Voice session_id must follow format 'voice-{workspace_id}-{profile_id}'. " +
            `Received: ${body.session_id}`,
          status: 400,
        },
        400,
      );
    }
    // Verify the parsed profile exists in the resolved workspace (fail-closed, L-0177).
    const { data: profileRow } = await supabaseAdmin
      .from("profile")
      .select("profile_id")
      .eq("profile_id", voiceProfileId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!profileRow?.profile_id) {
      return c.json(
        {
          error: "PROFILE_NOT_FOUND",
          message: `Voice session profile_id ${voiceProfileId} not found in workspace ${workspaceId}`,
          status: 403,
        },
        403,
      );
    }
    try {
      profileId = nonEmpty(profileRow.profile_id, "profile_id");
    } catch {
      return c.json(
        { error: "PROFILE_NOT_FOUND", message: "profile_id is empty", status: 403 },
        403,
      );
    }
  } else {
    try {
      profileId = await deriveProfileId(auth.userId, workspaceId, supabaseAdmin);
    } catch (err) {
      if (err instanceof ActorDerivationError) {
        return c.json({ error: "PROFILE_NOT_FOUND", message: err.message, status: 403 }, 403);
      }
      throw err;
    }
  }

  // Load or create session.
  // Voice path: session_id is "voice-{ws}-{profile}" (not a DB UUID). Treat as
  // absent — always create a fresh engine session per voice turn. The voice-agent
  // manages its own turn continuity via LiveKit; stage-engine history is not needed.
  const isVoiceSessionId = body.session_id?.startsWith("voice-") ?? false;
  let sessionId = isVoiceSessionId ? undefined : body.session_id;
  let conversationHistory: ConversationTurn[] = [];

  if (sessionId) {
    // Load existing session (chat path only — voice path always creates new)
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
      // Inject server-derived profile_id into userContext (ADR-0151:
      // body.user_context schema does not carry profile_id; downstream
      // UserContext type still requires it for routing/UI display).
      userContext: body.user_context ? { ...body.user_context, profile_id: profileId } : undefined,
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
