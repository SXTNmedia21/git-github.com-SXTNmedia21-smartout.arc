// ============================================
// ultravox.ts
// Adapter endpoints for Ultravox voice calls.
// Wraps core store/fetch/advance endpoints in Ultravox tool format.
// Advance returns X-Ultravox-Response-Type: new-stage header
// for seamless stage transitions during a voice call.
// Connected to: src/lib/ultravox.ts (API client + tool builder)
// Connected to: Ultravox Call Stages docs
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createSession, loadAuthorizedSession } from "../../core/session-manager.js";
import { advanceStage } from "../../core/stage-manager.js";
import { validateStoreData, writeToInbox } from "../../core/inbox-writer.js";
import { loadMission } from "../../core/session-manager.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { createUltravoxCall, buildUltravoxTools } from "../../lib/ultravox.js";
import { config } from "../../config.js";
import { emitGuardianEvent } from "../../core/guardian-bus.js";
import { evaluateSession } from "../../core/guardian-evaluator.js";
import type { AppVariables } from "../../types/app-env.js";
import type { AuthContext } from "../../types/auth.js";
import type { UltravoxNewStageResponse, UltravoxTool } from "../../types/ultravox.js";

const ultravox = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

// -- Create Call --

const createCallSchema = z.object({
  mission_id: z.string().min(1),
  workspace_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  profile_id: z.string().uuid().optional(),
  voice: z.string().optional(),
  language: z.string().optional(),
  first_speaker: z.enum(["user", "agent"]).optional(),
  context: z.record(z.unknown()).optional(),
  selected_tools: z.array(z.record(z.unknown())).optional(),
});

/**
 * POST /adapters/ultravox/create-call
 * Creates an Ultravox voice call with Stage Engine tools pre-configured.
 * Returns session_id, call_id, and join_url for the frontend.
 *
 * ADR-0151 Invariant I4 — workspace_id is server-derived. When the auth
 * context carries an authoritative workspaceId (JWT-backed BFF call), a
 * body.workspace_id that disagrees is rejected with 403. When auth is
 * API-key-only without a pinned workspaceId (onboarding path), the body
 * value is accepted because the BFF is the upstream trust boundary.
 */
ultravox.post("/adapters/ultravox/create-call", zValidator("json", createCallSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth");

  // Resolve effective workspaceId with ADR-0151 forgery guard.
  // authWorkspaceId is present when the BFF passed a JWT-backed auth context.
  const authWorkspaceId =
    typeof auth === "object" && auth !== null && "workspaceId" in auth
      ? (auth as { workspaceId?: string }).workspaceId
      : undefined;
  if (
    authWorkspaceId &&
    typeof body.workspace_id === "string" &&
    body.workspace_id.length > 0 &&
    body.workspace_id !== authWorkspaceId
  ) {
    return c.json({ error: "FORBIDDEN", message: "workspace_id mismatch", status: 403 }, 403);
  }
  const effectiveWorkspaceId = authWorkspaceId ?? body.workspace_id ?? undefined;

  // Start engine session
  const session = await createSession(
    {
      mission_id: body.mission_id,
      workspace_id: effectiveWorkspaceId,
      user_id: body.user_id,
      profile_id: body.profile_id,
      context: body.context,
      channel: "voice",
    },
    auth,
  );

  if (!session) {
    return c.json(
      { error: "NOT_FOUND", message: `Mission "${body.mission_id}" not found`, status: 404 },
      404,
    );
  }

  // Build Ultravox tools pointing back to this engine
  // Skip HTTP tools in local dev (Ultravox requires HTTPS for tool callbacks)
  // Client tools (with client: {}) always work — they run in the browser
  const apiKey = c.req.header("x-api-key") ?? "";
  const isLocalDev = config.ENGINE_URL.startsWith("http://");
  const httpTools = isLocalDev
    ? []
    : buildUltravoxTools(config.ENGINE_URL, session.session_id, apiKey);
  if (isLocalDev) {
    console.warn(
      "[ultravox] Local dev: skipping HTTP tools (no HTTPS). Client tools still active.",
    );
  }
  const clientTools = (body.selected_tools ?? []) as UltravoxTool[];
  const tools: UltravoxTool[] = [...httpTools, ...clientTools];

  // Create Ultravox call
  const firstSpeaker =
    body.first_speaker === "agent"
      ? ("FIRST_SPEAKER_AGENT" as const)
      : ("FIRST_SPEAKER_USER" as const);
  const call = await createUltravoxCall({
    systemPrompt: session.system_prompt,
    voice: body.voice,
    languageHint: body.language ?? "no",
    firstSpeaker,
    selectedTools: tools,
  });

  if (!call.ok) {
    return c.json(
      {
        error: call.error,
        message: "Failed to create Ultravox call",
        details: call.details,
        upstream_status: call.status,
        status: 500,
      },
      500,
    );
  }

  return c.json({
    session_id: session.session_id,
    call_id: call.data.callId,
    join_url: call.data.joinUrl,
  });
});

// -- Store (Ultravox tool format) --

const uvStoreSchema = z.object({
  entity_type: z.string().min(1),
  data: z.record(z.unknown()),
});

/**
 * POST /adapters/ultravox/store
 * Ultravox tool wrapper for store. Session ID from query param.
 */
ultravox.post("/adapters/ultravox/store", zValidator("json", uvStoreSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const auth = c.get("auth");
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
      { error: "SESSION_NOT_ACTIVE", message: "Session is not active", status: 409 },
      409,
    );
  }

  const validationError = validateStoreData(body.entity_type, body.data as Record<string, unknown>);
  if (validationError) {
    return c.json({ error: "VALIDATION_ERROR", message: validationError, status: 400 }, 400);
  }

  const entry = await writeToInbox({
    sessionId,
    stageId: session.current_stage_id ?? "unknown",
    workspaceId: session.workspace_id,
    entityType: body.entity_type,
    data: body.data as Record<string, unknown>,
  });

  if (!entry) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to store data", status: 500 }, 500);
  }

  if (session.workspace_id) {
    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: session.workspace_id,
      event_type: "data.collected",
      actor: "agent",
      summary: `Voice data collected: ${body.entity_type}`,
      data: { entity_type: body.entity_type },
    });
  }

  // Fire-and-forget guardian evaluation after voice data collected
  evaluateSession(sessionId).catch((err) => console.error("Guardian eval after voice store:", err));

  // Return plain text — Ultravox tool result
  return c.text(`Stored ${body.entity_type} successfully. Continue the conversation.`);
});

// -- Fetch (Ultravox tool format) --

const uvFetchSchema = z.object({
  query_type: z.enum(["context", "inbox", "stage", "history"]),
});

/**
 * POST /adapters/ultravox/fetch
 * Ultravox tool wrapper for fetch. Returns data as text for the agent.
 */
ultravox.post("/adapters/ultravox/fetch", zValidator("json", uvFetchSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const auth = c.get("auth");
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

  // Simplified fetch — returns JSON as text for the agent to parse
  let data: unknown;

  switch (body.query_type) {
    case "context":
      data = session.context;
      break;
    case "history":
      data = session.collected_data;
      break;
    case "inbox": {
      const { data: entries } = await supabaseAdmin
        .from("engine_inbox")
        .select("entity_type, data, stage_id, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      data = entries ?? [];
      break;
    }
    case "stage": {
      if (session.current_stage_id) {
        const result = await loadMission(session.mission_id!);
        const stage = result?.stages.find((s) => s.stage_id === session.current_stage_id);
        data = stage
          ? { stage_id: stage.stage_id, goal: stage.goal, instructions: stage.instructions }
          : null;
      } else {
        data = null;
      }
      break;
    }
  }

  return c.text(JSON.stringify(data, null, 2));
});

// -- Advance (Ultravox new-stage format) --

const uvAdvanceSchema = z.object({
  result: z.record(z.unknown()).optional(),
  next_stage_id: z.string().optional(),
});

/**
 * POST /adapters/ultravox/advance
 * Advances to the next stage and returns Ultravox new-stage response.
 * Sets X-Ultravox-Response-Type: new-stage header for seamless transition.
 */
ultravox.post("/adapters/ultravox/advance", zValidator("json", uvAdvanceSchema), async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json(
      { error: "VALIDATION_ERROR", message: "session_id query param required", status: 400 },
      400,
    );
  }

  const body = c.req.valid("json");
  const auth = c.get("auth");
  const loadResult = await loadAuthorizedSession(sessionId, auth);

  if (!loadResult.ok) {
    return c.json(
      {
        error: loadResult.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
        message: loadResult.message,
        status: loadResult.status,
      },
      loadResult.status,
    );
  }

  const session = loadResult.session;
  if (session.status !== "active") {
    return c.json(
      { error: "SESSION_NOT_ACTIVE", message: "Session is not active", status: 409 },
      409,
    );
  }

  const result = await advanceStage(session, body);
  if (!result) {
    return c.json({ error: "INTERNAL_ERROR", message: "Failed to advance", status: 500 }, 500);
  }

  // Guardian events already emitted inside advanceStage() — no duplicate emit here.

  // If mission complete, return text result (no new stage)
  if (result.complete) {
    return c.text(
      `Mission complete! Summary: ${result.summary ?? "All stages finished."}. Thank the person and say goodbye.`,
    );
  }

  // Return Ultravox new-stage response
  const newStageResponse: UltravoxNewStageResponse = {
    systemPrompt: result.system_prompt!,
    toolResultText: `Stage transition: now in "${result.new_stage!.stage_id}". Goal: ${result.new_stage!.goal}`,
  };

  c.header("X-Ultravox-Response-Type", "new-stage");
  return c.json(newStageResponse);
});

export { ultravox };
