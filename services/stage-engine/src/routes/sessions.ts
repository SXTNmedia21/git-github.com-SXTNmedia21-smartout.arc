// ============================================
// sessions.ts
// Route handlers for session lifecycle endpoints:
//   POST /sessions       — start a new session
//   GET  /sessions/:id   — get session status
//   POST /sessions/:id/abandon — abandon a session
// Connected to: src/core/session-manager.ts (business logic)
// Connected to: src/types/api.ts (request/response types)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSession, loadAuthorizedSession, abandonSession } from "../core/session-manager.js";
import { sendWebhook } from "../core/webhook-sender.js";
import type { AppVariables } from "../types/app-env.js";
import type { AuthContext } from "../types/auth.js";

const sessions = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

// -- Schemas --

const createSessionSchema = z.object({
  mission_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  channel: z.enum(["voice", "sms", "chat", "email", "autonomous"]),
  callback_url: z.string().url().optional(),
  context: z.record(z.unknown()).optional(),
});

// -- POST /sessions --

sessions.post("/sessions", zValidator("json", createSessionSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth") as AuthContext;

  const result = await createSession(body, auth);
  if (!result) {
    return c.json(
      {
        error: "NOT_FOUND",
        message: `Mission "${body.mission_id}" not found or inactive`,
        status: 404,
      },
      404,
    );
  }

  // Fire webhook if callback_url set
  if (body.callback_url) {
    sendWebhook(body.callback_url, {
      event: "session.started",
      session_id: result.session_id,
      stage_id: result.current_stage?.stage_id,
      progress: result.progress,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json(result, 200);
});

// -- GET /sessions/:id --

sessions.get("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const auth = c.get("auth") as AuthContext;
  const result = await loadAuthorizedSession(sessionId, auth);

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

  const session = result.session;

  return c.json({
    session_id: session.id,
    status: session.status,
    current_stage_id: session.current_stage_id,
    stage_index: session.stage_index,
    collected_data: session.collected_data,
    context: session.context,
    summary: session.summary,
    channel: session.channel,
    expires_at: session.expires_at,
    created_at: session.created_at,
  });
});

// -- POST /sessions/:id/abandon --

sessions.post("/sessions/:id/abandon", async (c) => {
  const sessionId = c.req.param("id");
  const auth = c.get("auth") as AuthContext;
  const result = await loadAuthorizedSession(sessionId, auth);

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

  const session = result.session;

  if (session.status !== "active") {
    return c.json(
      {
        error: "SESSION_NOT_ACTIVE",
        message: `Session is already "${session.status}"`,
        status: 409,
      },
      409,
    );
  }

  await abandonSession(sessionId);

  // Fire webhook
  if (session.callback_url) {
    sendWebhook(session.callback_url, {
      event: "session.abandoned",
      session_id: sessionId,
      collected_data: session.collected_data as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json({ session_id: sessionId, status: "abandoned" });
});

export { sessions };
