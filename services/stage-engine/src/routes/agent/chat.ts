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
import type { AppVariables } from "../../types/app-env.js";
import type { AuthContext } from "../../types/auth.js";
import type { ConversationTurn } from "../../types/agent.js";

const agentChat = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

// -- Schema --

const chatSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().uuid().optional(),
  profile_id: z.string().uuid(),
  channel: z.enum(["chat", "voice"]).optional().default("chat"),
  page_context: z.string().optional(), // current page pathname from frontend
  /** Employee JWT for RLS-enforced PII writes (contract intake). */
  user_jwt: z.string().optional(),
});

// -- POST /agent/chat --

agentChat.post("/agent/chat", zValidator("json", chatSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth") as AuthContext;
  const workspaceId = auth.workspaceId;

  if (!workspaceId) {
    return c.json(
      {
        error: "FORBIDDEN",
        message: "Workspace context is required for agent chat",
        status: 403,
      },
      403,
    );
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
      profileId: body.profile_id,
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
      actor_id: body.profile_id,
      correlation_id: c.get("requestId"),
      properties: {
        data: {
          session_id: sessionId,
          message_preview:
            body.message.length > 100 ? body.message.slice(0, 100) + "\u2026" : body.message,
          channel: body.channel,
        },
      },
    });

    // Route message through agent pipeline
    const response = await routeAgentMessage({
      message: body.message,
      sessionId,
      workspaceId,
      profileId: body.profile_id,
      userId: auth.userId,
      conversationHistory,
      pageContext: body.page_context,
      channel: body.channel,
      userJwt: body.user_jwt,
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
      actor_id: body.profile_id,
      correlation_id: c.get("requestId"),
      properties: {
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
