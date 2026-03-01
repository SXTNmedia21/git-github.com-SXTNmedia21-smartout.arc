// ============================================
// advance.ts
// POST /sessions/:id/advance — moves the session to the next stage.
// Saves current stage result, determines next stage, rebuilds prompt.
// Connected to: src/core/stage-manager.ts (navigation logic)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getSession } from "../core/session-manager.js";
import { advanceStage } from "../core/stage-manager.js";

const advance = new Hono();

const advanceSchema = z.object({
  result: z.record(z.unknown()).optional(),
  next_stage_id: z.string().optional(),
  force: z.boolean().optional(),
});

/**
 * POST /sessions/:id/advance
 * Advances the session to the next stage.
 * Returns new stage info, updated progress, and a new system prompt.
 */
advance.post("/sessions/:id/advance", zValidator("json", advanceSchema), async (c) => {
  const sessionId = c.req.param("id");
  const body = c.req.valid("json");

  // Load session
  const session = await getSession(sessionId);
  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Session "${sessionId}" not found`, status: 404 },
      404,
    );
  }

  if (session.status !== "active") {
    return c.json(
      { error: "SESSION_NOT_ACTIVE", message: `Session is "${session.status}"`, status: 409 },
      409,
    );
  }

  // Advance
  const result = await advanceStage(session, body);
  if (!result) {
    return c.json(
      { error: "INTERNAL_ERROR", message: "Failed to advance stage", status: 500 },
      500,
    );
  }

  return c.json(result);
});

export { advance };
