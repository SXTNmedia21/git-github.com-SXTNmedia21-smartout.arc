// ============================================
// store.ts
// POST /sessions/:id/store — agent stores data to the engine inbox.
// Validates the data, writes to inbox, and returns a tool response
// message that instructs the agent what to do next.
// Connected to: src/core/inbox-writer.ts (write logic)
// Connected to: src/core/session-manager.ts (session lookup)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { loadAuthorizedSession } from "../core/session-manager.js";
import { validateStoreData, writeToInbox } from "../core/inbox-writer.js";
import { emitGuardianEvent } from "../core/guardian-bus.js";
import { evaluateSession } from "../core/guardian-evaluator.js";
import type { AuthContext } from "../types/auth.js";

const store = new Hono<{ Variables: { auth: AuthContext } }>();

const storeSchema = z.object({
  entity_type: z.string().min(1),
  data: z.record(z.unknown()),
  stage_id: z.string().optional(),
});

/**
 * POST /sessions/:id/store
 * Agent sends data to the inbox. Returns a tool response message.
 */
store.post("/sessions/:id/store", zValidator("json", storeSchema), async (c) => {
  const sessionId = c.req.param("id");
  const body = c.req.valid("json");
  const auth = c.get("auth");

  // Load session with workspace authorization
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
      { error: "SESSION_NOT_ACTIVE", message: `Session is "${session.status}"`, status: 409 },
      409,
    );
  }

  // Validate data
  const validationError = validateStoreData(body.entity_type, body.data as Record<string, unknown>);
  if (validationError) {
    return c.json({ error: "VALIDATION_ERROR", message: validationError, status: 400 }, 400);
  }

  // Determine stage_id — use provided or current session stage
  const stageId = body.stage_id ?? session.current_stage_id ?? "unknown";

  // Write to inbox
  const entry = await writeToInbox({
    sessionId,
    stageId,
    workspaceId: session.workspace_id,
    entityType: body.entity_type,
    data: body.data as Record<string, unknown>,
  });

  if (!entry) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to store data", status: 500 }, 500);
  }

  emitGuardianEvent({
    session_id: sessionId,
    workspace_id: session.workspace_id,
    event_type: "data.collected",
    actor: "agent",
    summary: `Data collected: ${body.entity_type}`,
    data: { entity_type: body.entity_type, inbox_id: entry.id },
  });

  // Fire-and-forget guardian evaluation after data collected
  evaluateSession(sessionId).catch((err) => console.error("Guardian eval after store:", err));

  return c.json({
    inbox_id: entry.id,
    confirmed: true,
    message: `Data stored successfully. Type: ${body.entity_type}. Continue with the conversation.`,
  });
});

export { store };
