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
import {
  harnessAdapterChatEnabled,
  resolveChatTools,
  ResolverNotImplementedError,
} from "../../core/chat-tool-resolver.js";
import { baseLogger } from "../../lib/logger.js";
import type { AppVariables } from "../../types/app-env.js";
import type { AuthContext } from "../../types/auth.js";
import type { ConversationTurn } from "../../types/agent.js";
import type { ClientToolDefinition, ClientToolCallResult } from "@smartout/ai/harness/types";

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

// D2+D6 workforce snapshot delivered at session start (2026-05-13 directive).
// Assembled by BFF /api/botsson/voice/session-context with PII already filtered
// (ADR-0078). Body shape mirrors @smartout/ai WorkforceContext exactly so the
// stage-engine renderWorkforceSlice() can render uniformly across chat + voice.
const workforceEmployeeSchema = z.object({
  profile_id: z.string(), // not-actor: workforce-snapshot data describing other employees, not caller identity
  display_name: z.string(),
  role: z.string(),
  status: z.string(),
  department_id: z.string().nullable(),
  department_name: z.string().nullable(),
  phone: z.string().nullable(),
});
const workforceShiftSchema = z.object({
  shift_id: z.string(),
  profile_id: z.string().nullable(), // not-actor: shift-assignment data, not caller identity
  employee_name: z.string().nullable(),
  shift_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  department_id: z.string().nullable(),
  department_name: z.string().nullable(),
  position_label: z.string().nullable(),
});
const workforceAbsenceSchema = z.object({
  absence_id: z.string(),
  profile_id: z.string(), // not-actor: absence record's subject employee, not caller identity
  employee_name: z.string().nullable(),
  absence_type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
});
const workforceSessionSchema = z.object({
  session_id: z.string(),
  department_id: z.string().nullable(),
  department_name: z.string().nullable(),
  status: z.string(),
  scheduled_date: z.string(),
});
const workforceContextSchema = z
  .object({
    employees: z.array(workforceEmployeeSchema),
    shifts_today: z.array(workforceShiftSchema),
    shifts_tomorrow: z.array(workforceShiftSchema),
    absences_active: z.array(workforceAbsenceSchema),
    sessions_today: z.array(workforceSessionSchema),
    snapshot_at: z.string(),
  })
  .optional();

// -- ClientToolDefinition sub-schema (ADR-0327 Phase 3) --
// Mirrors packages/ai/src/harness/types.ts:ClientToolDefinition (lines 36-43).
// Duplicated here so Zod can validate the incoming body without importing the
// harness type directly into the schema layer.
const clientToolParameterSchema = z.object({
  name: z.string(),
  location: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.union([
    z.object({ type: z.literal("string"), enum: z.array(z.string()).optional() }),
    z.object({ type: z.literal("number") }),
    z.object({ type: z.literal("boolean") }),
    z.object({ type: z.literal("object"), properties: z.record(z.unknown()).optional() }),
    z.object({ type: z.literal("array"), items: z.unknown().optional() }),
  ]),
});

const clientToolDefinitionSchema = z.object({
  temporaryTool: z.object({
    modelToolName: z.string(),
    description: z.string(),
    dynamicParameters: z.array(clientToolParameterSchema),
    client: z.record(z.never()),
  }),
});

// -- ClientToolCallResult sub-schema (ADR-0327 Phase 3.5) --
// Mirrors packages/ai/src/harness/types.ts:ClientToolCallResult (lines 275-290).
// Sent by browser back to stage-engine to complete a client-tool roundtrip.
// stage-engine seeds these as prior tool messages in conversation history before
// re-running generateText (MVP: one turn per roundtrip round, not multi-step
// within a single LLM call).
const clientToolCallResultSchema = z.object({
  tool_call_id: z.string(),
  result: z.string(),
  is_error: z.boolean().optional(),
});

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
  /** ADR-0327 Phase 3: current page route for HarnessAdapter tool resolution.
   *  When present, resolveChatTools filters page-scope tools to this route.
   *  When absent, only capability tools are returned (no page-scope tools). */
  page_route: z.string().optional(),
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
  /** Botsson context pipe: D2+D6 workforce snapshot (2026-05-13). */
  workforce_context: workforceContextSchema,
  /** ADR-0327 Phase 3: client-side page-scope tools shipped by BotssonProvider.
   *  Shape matches ClientToolDefinition from packages/ai/src/harness/types.ts.
   *  When present and HARNESS_ADAPTER_CHAT=true, merged into tool bundle by
   *  resolveChatTools (client-tool-wins on name collision). */
  client_tools: z.array(clientToolDefinitionSchema).optional(),
  /** ADR-0327 Phase 3.5: client-tool roundtrip results from the browser.
   *  When present, stage-engine seeds these as prior tool messages in
   *  conversation history before running generateText (MVP: one turn per round).
   *  tool_call_id values MUST match tool_call_ids from the previous response's
   *  client_tool_calls array. */
  client_tool_results: z.array(clientToolCallResultSchema).optional(),
  /** Sortie 0 bulk_import: files uploaded via /api/botsson/imports/upload.
   *  Each entry carries a signed URL (1h TTL) + storage path for the file.
   *  MIME-deterministic routing — agent-router checks these BEFORE LLM intent
   *  classification (Wave 2 Track 5). Optional — existing callers unaffected. */
  attachments: z
    .array(
      z.object({
        storage_path: z.string(),
        signed_url: z.string().url(),
        mime: z.string(),
        size_bytes: z.number().int().positive(),
        filename: z.string(),
        expires_at: z.string().datetime(),
      }),
    )
    .optional()
    .describe(
      "Files uploaded via /api/botsson/imports/upload; signed URLs (1h TTL). MIME-deterministic routing.",
    ),
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
  //
  // EXCEPTION: voice channel bypasses SessionLane. Voice-agent sends parallel
  // ask() calls when the Realtime LLM emits multiple tool calls in one turn.
  // The voice LLM owns its conversation state via OpenAI Realtime API — stage-engine
  // is just a tool executor for voice requests. Serializing parallel voice tool
  // calls makes Botsson hang waiting for each one sequentially. activity_trail
  // writes are per-request (own correlation_id) so they don't race. engine_sessions
  // collected_data writes can race (last-writer-wins) but voice doesn't replay from
  // collected_data — LiveKit transcripts are the conversation source of truth.
  //
  // 2026-05-15 fix surfaced by live voice smoke: "han henger igjen, tool calls må
  // skje parallelt" — Botsson serialized 3 parallel tool calls through SessionLane
  // turning ~600ms × 3 parallel into ~1800ms sequential.
  const lane = c.get("sessionLane");
  const runner =
    body.channel === "voice"
      ? <T>(_sid: string, fn: () => Promise<T>): Promise<T> => fn()
      : lane.run.bind(lane);
  return await runner(sessionId, async () => {
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

    // -- HarnessAdapter integration (ADR-0327 Phase 3 + Phase 3.5) --
    //
    // When HARNESS_ADAPTER_CHAT=true, resolve page-scope + capability tools
    // via HarnessAdapter before the LLM call. The resolved bundle is passed to
    // routeAgentMessage so bundle tools reach generateText (Phase 3.5 D1).
    //
    // Falls through to the existing toVercelTools chain (bundle=undefined) on
    // any error or when the flag is off — backward-compat is preserved.
    //
    // ADR-0151: harnessUserContext derives workspace_id + profile_id from
    // server-resolved values — never from request body.
    //
    // Role is advisory (not a security gate — authority filtering is server-side
    // inside resolveChatTools). Body-supplied role is used when available;
    // defaults to "employee" for conservative filtering.
    //
    // ADR-0327 Phase 3.5 — client-tool roundtrip:
    // clientToolResults from body (previous roundtrip results) are seeded as
    // prior tool messages in conversationHistory before the LLM call. This
    // implements the MVP single-round pattern: browser sends NEW request with
    // original message + client_tool_results; stage-engine seeds them and re-runs.
    let resolvedBundle: import("@smartout/ai/harness/types").ToolBundle | undefined;
    let clientToolNames: Set<string> | undefined;

    if (harnessAdapterChatEnabled()) {
      const harnessRole =
        body.user_context?.role === "owner" ||
        body.user_context?.role === "admin" ||
        body.user_context?.role === "manager" ||
        body.user_context?.role === "employee"
          ? body.user_context.role
          : ("employee" as const);

      const harnessUserContext = {
        profile_id: profileId as string,
        workspace_id: workspaceId as string,
        role: harnessRole,
      };

      const resolverInput = {
        pageRoute: body.page_route ?? null,
        userContext: harnessUserContext,
        // Cast: Zod-validated body.client_tools satisfies ClientToolDefinition[]
        // (structural compatibility verified — schema mirrors types.ts:36-43).
        clientTools: (body.client_tools as ClientToolDefinition[] | undefined) ?? null,
      };

      try {
        const resolved = await resolveChatTools(resolverInput);

        baseLogger.info(
          {
            sessionId,
            workspaceId: workspaceId as string,
            profileId: profileId as string,
            pageRoute: body.page_route ?? null,
            toolCount: resolved.bundle.definitions.length,
            clientToolCollisions: resolved.viaHarnessAdapter ? resolved.clientToolCollisions : [],
            viaHarnessAdapter: resolved.viaHarnessAdapter,
          },
          "harness_adapter.chat.resolved",
        );

        // Wire bundle to routeAgentMessage (Phase 3.5 D1: closes DEAD-PIPE-ADR-0327-C1).
        resolvedBundle = resolved.bundle;

        // Derive the set of client-tool names so agent-router can detect
        // LLM calls targeting browser-side tools and route them as client_tool_calls.
        if (body.client_tools && body.client_tools.length > 0) {
          clientToolNames = new Set(
            (body.client_tools as ClientToolDefinition[]).map((t) => t.temporaryTool.modelToolName),
          );
        }
      } catch (err) {
        if (err instanceof ResolverNotImplementedError) {
          // Expected while D1 resolver stub is in place. Warn + continue.
          baseLogger.warn(
            {
              sessionId,
              workspaceId: workspaceId as string,
              reason: err.message,
            },
            "harness_adapter.chat: resolver not implemented — falling back to toVercelTools chain",
          );
        } else {
          // Unexpected error: log + fall through rather than hard-failing the turn.
          baseLogger.error(
            {
              sessionId,
              workspaceId: workspaceId as string,
              err: err instanceof Error ? err.message : String(err),
            },
            "harness_adapter.chat: resolver threw unexpected error — falling back",
          );
        }
        // Both error paths fall through to routeAgentMessage with bundle=undefined.
      }
    }

    // ADR-0327 Phase 3.5 — seed client_tool_results as prior tool messages.
    //
    // MVP roundtrip pattern: browser sends NEW chat request with the original
    // user message + client_tool_results. Stage-engine seeds these as
    // assistant+tool message pairs at the tail of conversation history so the
    // LLM sees the completed tool calls and can continue naturally.
    //
    // Message format for the Vercel AI SDK:
    //   1. AssistantModelMessage with ToolCallPart(s) — tells LLM "I called these tools"
    //   2. ToolModelMessage with ToolResultPart(s)   — tells LLM "results were X"
    //
    // We reconstruct minimal tool-call messages from client_tool_results.
    // Since we don't store the original arguments server-side (MVP simplification),
    // the assistant message gets empty input. The LLM still receives the result
    // and can reason about it correctly.
    const clientToolResults = body.client_tool_results as ClientToolCallResult[] | undefined;
    let augmentedHistory: ConversationTurn[] = conversationHistory;

    if (clientToolResults && clientToolResults.length > 0) {
      // Inject synthetic conversation turns that represent the completed client-tool roundtrip.
      // The LLM history now includes: [...history, assistant(tool-calls), tool(results), user(msg)]
      // where the tool-call+result pair precedes the current user message.
      //
      // We use a JSON-encoded string as the ConversationTurn content for the synthetic turns.
      // routeAgentMessage rebuilds the messages array from ConversationTurn.role + content.
      // Since Vercel AI SDK expects typed messages for tool messages, we encode them here
      // as JSON-annotated user/assistant turns that the router can pass through verbatim.
      //
      // Simpler approach for MVP: extend conversationHistory with two synthetic turns
      // that render the roundtrip as readable text the LLM can reference.
      const toolCallSummary = clientToolResults
        .map((r) => `tool_call_id=${r.tool_call_id}: ${r.is_error ? "[ERROR] " : ""}${r.result}`)
        .join("\n");

      const syntheticAssistantTurn: ConversationTurn = {
        role: "assistant",
        content: `[Client tools were called. Awaiting results.]`,
        timestamp: new Date().toISOString(),
      };
      const syntheticToolResultTurn: ConversationTurn = {
        role: "user",
        content: `[Client tool results]\n${toolCallSummary}`,
        timestamp: new Date().toISOString(),
      };

      augmentedHistory = [...conversationHistory, syntheticAssistantTurn, syntheticToolResultTurn];
    }

    // Route message through agent pipeline
    const response = await routeAgentMessage({
      message: body.message,
      sessionId,
      workspaceId,
      profileId: profileId,
      userId: auth.userId,
      conversationHistory: augmentedHistory,
      pageContext: body.page_context,
      channel: body.channel,
      userJwt: body.user_jwt,
      wizardSessionId: body.wizard_session_id,
      // Inject server-derived profile_id into userContext (ADR-0151:
      // body.user_context schema does not carry profile_id; downstream
      // UserContext type still requires it for routing/UI display).
      userContext: body.user_context ? { ...body.user_context, profile_id: profileId } : undefined,
      workspaceContext: body.workspace_context,
      workforceContext: body.workforce_context,
      routeContext: body.route_context,
      bundle: resolvedBundle,
      clientToolNames,
      // Sortie 0: forward file attachments for MIME-deterministic dispatch (Wave 2 Track 5).
      attachments: body.attachments ?? [],
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
