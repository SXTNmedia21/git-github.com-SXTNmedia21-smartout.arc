// ============================================
// fetch.ts
// POST /sessions/:id/fetch — agent requests context or data.
// Supports four query types: context, inbox, stage, history.
// Connected to: src/core/session-manager.ts (session + stage lookup)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { loadAuthorizedSession, loadMission } from "../core/session-manager.js";
import { supabaseAdmin } from "../lib/supabase.js";
import type { AuthContext } from "../types/auth.js";

const fetchRoute = new Hono<{ Variables: { auth: AuthContext } }>();

const fetchSchema = z.object({
  query_type: z.enum(["context", "inbox", "stage", "history"]),
  filters: z
    .object({
      entity_type: z.string().optional(),
      stage_id: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /sessions/:id/fetch
 * Agent requests data. query_type determines what's returned:
 *   - context: identity + workspace info
 *   - inbox: stored data for this session
 *   - stage: current stage details
 *   - history: all collected_data across stages
 */
fetchRoute.post("/sessions/:id/fetch", zValidator("json", fetchSchema), async (c) => {
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

  let data: Record<string, unknown> = {};

  switch (body.query_type) {
    case "context":
      data = session.context as Record<string, unknown>;
      break;

    case "inbox": {
      let query = supabaseAdmin
        .from("engine_inbox")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (body.filters?.entity_type) {
        query = query.eq("entity_type", body.filters.entity_type);
      }
      if (body.filters?.stage_id) {
        query = query.eq("stage_id", body.filters.stage_id);
      }

      const { data: entries } = await query;
      data = { entries: entries ?? [] };
      break;
    }

    case "stage": {
      if (!session.current_stage_id) {
        data = { stage: null, message: "No current stage (free mode)" };
        break;
      }

      const result = await loadMission(session.mission_id!);
      if (result) {
        const currentStage = result.stages.find((s) => s.stage_id === session.current_stage_id);
        data = currentStage
          ? {
              stage_id: currentStage.stage_id,
              goal: currentStage.goal,
              instructions: currentStage.instructions,
              success_criteria: currentStage.success_criteria,
              emotion_hint: currentStage.emotion_hint,
            }
          : { stage: null };
      }
      break;
    }

    case "history":
      data = session.collected_data as Record<string, unknown>;
      break;
  }

  // Deliver pending Guardian whispers for context and stage queries
  if (body.query_type === "context" || body.query_type === "stage") {
    const whispers = (session.collected_data as Record<string, unknown>)?._whispers as
      | string[]
      | undefined;
    if (whispers && whispers.length > 0) {
      data._guardian_whispers = whispers;

      // Clear whispers after delivery (agent has seen them)
      const collected = { ...(session.collected_data as Record<string, unknown>) };
      delete collected._whispers;
      await supabaseAdmin
        .from("engine_sessions")
        .update({ collected_data: collected })
        .eq("id", sessionId);
    }
  }

  return c.json({ data });
});

export { fetchRoute };
