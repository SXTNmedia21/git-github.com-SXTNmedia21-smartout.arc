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
import { getSession } from "../core/session-manager.js";
import { validateStoreData, writeToInbox } from "../core/inbox-writer.js";

const store = new Hono();

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

  // Load session
  const session = await getSession(sessionId);
  if (!session || session.status !== "active") {
    return c.json(
      {
        error: "SESSION_NOT_ACTIVE",
        message: session ? `Session is "${session.status}"` : "Session not found",
        status: session ? 409 : 404,
      },
      session ? 409 : 404,
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

  return c.json({
    inbox_id: entry.id,
    confirmed: true,
    message: `Data stored successfully. Type: ${body.entity_type}. Continue with the conversation.`,
  });
});

export { store };
