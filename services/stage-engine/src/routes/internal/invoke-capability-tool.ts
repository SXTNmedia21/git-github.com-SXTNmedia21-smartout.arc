// ============================================
// routes/internal/invoke-capability-tool.ts
//
// POST /internal/engine-dispatch/invoke-capability-tool
//
// HTTP bridge endpoint for the `invoke_capability_tool` engine-dispatch
// action-type (ADR-0424 §Transport). The Supabase Edge Function
// `engine-dispatch` is a Deno runtime that cannot import Node ESM packages
// (packages/ai). This endpoint runs Node-side so capability tool bodies +
// the resolver shim (#477) can execute where they live.
//
// Auth: x-api-key + scope guard (scopes contains "engine:invoke" OR "*").
//       JWT-authenticated callers are rejected — this is an internal EF path.
//
// Identity re-derivation (ADR-0151 §Cross-runtime extension):
//   workspace_id is re-derived from the engine_state row using engine_state_id.
//   The body's workspace_id is a sanity-check only — a mismatch is a 400
//   (forged identity attempt, same class as L-0177 silent-fallback).
//
// Gate placement (ADR-0424 §Gate placement):
//   gate_action() runs Node-side, immediately before tool.execute(). The EF
//   is a thin proxy; it receives gate_evaluation_id in the response body and
//   persists it into engine_state_step after the fetch returns.
//   Per ADR-0356: gate + emit + audit row on the same side as the mutation.
//
// Recursion guard:
//   depth === 0 is asserted as defense-in-depth (EF enforces recursion before
//   the fetch; Node endpoint verifies depth in body per L-0177 fail-fast).
//
// Telemetry:
//   Emits engine.action.invoked.invoke_capability_tool (4 destinations:
//   posthog + logger + activity_trail + engine_event) per ADR-0193 + ADR-0424.
//
// Connected to: src/index.ts (mounted as /internal/engine-dispatch)
// Connected to: packages/ai/src/engine/resolve-capability-tool.ts
// Connected to: packages/telemetry/src/registry.ts (event registration #478)
// ============================================

import { Hono } from "hono";
import { z } from "zod";
import { resolveCapabilityTool } from "@smartout/ai/engine/resolve-capability-tool";
import { supabaseAdmin } from "../../lib/supabase.js";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import { baseLogger } from "../../lib/logger.js";
import type { AuthContext } from "../../types/auth.js";
import type { AppVariables } from "../../types/app-env.js";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Scope guard ────────────────────────────────────────────────────────────

/**
 * Returns true when the auth context has permission to invoke capability tools.
 * Requires scope "engine:invoke" OR the wildcard "*" (dev shortcut).
 * JWT-authenticated callers have no scopes array — rejected.
 */
function hasScopeEngineInvoke(auth: AuthContext): boolean {
  const scopes = auth.scopes;
  if (!scopes) return false;
  return scopes.includes("engine:invoke") || scopes.includes("*");
}

// ── Request body schema ────────────────────────────────────────────────────

/**
 * Zod schema for the invoke-capability-tool request body.
 * Matches §Endpoint contract in ADR-0424 §Transport.
 */
const invokeCapabilityToolBodySchema = z.object({
  capability: z.string().min(1, "capability is required"),
  tool: z.string().min(1, "tool is required"),
  args: z.unknown(),
  workspace_id: z.string().min(1, "workspace_id is required"),
  // actor_profile_id REMOVED from body per ADR-0151 §Cross-runtime extension.
  // Node-side re-derives via deriveEngineStateContext() → state.assignee_id ||
  // "system". Body cannot supply or override the actor. Eliminates the
  // forgery-vector site flagged by harness invariants (check-server-derived-actor).
  channel: z.literal("system"),
  engine_process_id: z.string().min(1, "engine_process_id is required"),
  engine_state_id: z.string().min(1, "engine_state_id is required"),
  engine_state_step_id: z.string().min(1, "engine_state_step_id is required"),
  // gate_evaluation_id is NOT in the body per ADR-0424 §Gate placement:
  // Node-side gate runs here and RETURNS gate_evaluation_id.
  // ADR-0424 body spec includes gate_evaluation_id but §Gate placement
  // clarification says it is the outcome reference of the Node-side gate
  // (persisted by EF after fetch returns). The body field is contradictory.
  // Resolution: STEWARD WINS as chair (Node-side gate). We accept
  // gate_evaluation_id from body as optional (EF may omit, we ignore it).
  // FLAG: see PR body — §Contradiction note on gate_evaluation_id.
  gate_evaluation_id: z.string().optional(),
  depth: z.number().int().min(0, "depth must be >= 0"),
});

type InvokeCapabilityToolBody = z.infer<typeof invokeCapabilityToolBodySchema>;

// ── engine_state workspace re-derivation ───────────────────────────────────

type EngineStateContext = {
  workspace_id: string;
  actor_profile_id: string; // assignee_id || "system" (ADR-0281 platform-actor)
};

/**
 * Re-derives workspace_id AND actor_profile_id from the engine_state row.
 * Per ADR-0151 §Cross-runtime extension: Node-side must re-derive from a
 * trusted source (the engine_state row) rather than trusting body values.
 *
 * Actor resolution per ADR-0281: assignee_id || "system" (cron-spawned states
 * have NULL assignee — system-bot is the canonical platform actor).
 */
async function deriveEngineStateContext(engineStateId: string): Promise<EngineStateContext | null> {
  const { data, error } = await (supabaseAdmin as SupabaseClient)
    .from("engine_state")
    .select("workspace_id, assignee_id")
    .eq("id", engineStateId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as { workspace_id: string; assignee_id: string | null };
  return {
    workspace_id: row.workspace_id,
    actor_profile_id: row.assignee_id ?? "system",
  };
}

// ── Route definition ────────────────────────────────────────────────────────

const invokeCapabilityToolRouter = new Hono<{ Variables: AppVariables & { auth: AuthContext } }>();

invokeCapabilityToolRouter.post("/invoke-capability-tool", async (c) => {
  const startTs = Date.now();

  // ── 1. Scope guard ───────────────────────────────────────────────────────
  // Auth middleware has already validated the x-api-key and set auth context.
  // We enforce scope "engine:invoke" here as an additional guard per ADR-0424.
  const auth = c.get("auth");
  if (!auth || !hasScopeEngineInvoke(auth)) {
    return c.json(
      {
        ok: false,
        error: "SCOPE_INSUFFICIENT",
        message: "Requires scope engine:invoke",
      },
      401,
    );
  }

  // ── 2. Parse + validate body ─────────────────────────────────────────────
  let body: InvokeCapabilityToolBody;
  try {
    const raw = await c.req.json();
    const parsed = invokeCapabilityToolBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "BODY_INVALID",
          message: parsed.error.message,
        },
        400,
      );
    }
    body = parsed.data;
  } catch {
    return c.json(
      {
        ok: false,
        error: "BODY_PARSE_ERROR",
        message: "Request body is not valid JSON",
      },
      400,
    );
  }

  // ── 3. Depth assertion (defense-in-depth, ADR-0424 §Recursion + L-0177) ─
  // EF enforces recursion before the fetch; Node endpoint verifies body depth
  // as redundant defense (fail-closed per L-0177 — cross-runtime boundary
  // defense, not single-point trust).
  if (body.depth !== 0) {
    baseLogger.warn(
      { depth: body.depth, engine_state_id: body.engine_state_id },
      "[invoke-cap-tool] depth !== 0 rejected",
    );
    return c.json(
      {
        ok: false,
        error: "DEPTH_EXCEEDED",
        message: "depth must be 0 — nested invoke_capability_tool calls are forbidden",
      },
      400,
    );
  }

  // ── 4. Re-derive workspace_id + actor_profile_id from engine_state row ───
  // (ADR-0151 §Cross-runtime extension — actor MUST be server-derived)
  const derivedCtx = await deriveEngineStateContext(body.engine_state_id);
  if (!derivedCtx) {
    baseLogger.warn(
      { engine_state_id: body.engine_state_id },
      "[invoke-cap-tool] engine_state row not found — failing closed",
    );
    return c.json(
      {
        ok: false,
        error: "ENGINE_STATE_NOT_FOUND",
        message: `engine_state row not found for id: ${body.engine_state_id}`,
      },
      400,
    );
  }

  // Mismatch between body workspace_id and derived = forged identity attempt (L-0177)
  if (body.workspace_id !== derivedCtx.workspace_id) {
    baseLogger.error(
      {
        body_workspace_id: body.workspace_id,
        derived_workspace_id: derivedCtx.workspace_id,
        engine_state_id: body.engine_state_id,
      },
      "[invoke-cap-tool] SECURITY: workspace_id mismatch — potential identity forgery",
    );
    return c.json(
      {
        ok: false,
        error: "WORKSPACE_MISMATCH",
        message: "workspace_id in body does not match engine_state row — request rejected",
      },
      400,
    );
  }

  // From here, derived values are trusted. Body workspace_id was a hint;
  // actor_profile_id was never in the body — derived from engine_state.assignee_id.
  const workspaceId = derivedCtx.workspace_id;
  const actorProfileId = derivedCtx.actor_profile_id;

  // ── 5. Resolve capability tool (ADR-0173 frozen-4 boundaries) ────────────
  // resolveCapabilityTool returns null for unknown capability or tool.
  // Fail-fast per L-0177 — never silently no-op on unknown tool.
  const resolved = resolveCapabilityTool(body.capability, body.tool);
  if (!resolved) {
    baseLogger.warn(
      { capability: body.capability, tool: body.tool },
      "[invoke-cap-tool] capability/tool not found",
    );
    return c.json(
      {
        ok: false,
        error: "TOOL_NOT_FOUND",
        message: `Unknown capability "${body.capability}" or tool "${body.tool}"`,
      },
      404,
    );
  }

  // ── 6. Gate action (ADR-0099 + ADR-0356 + ADR-0424 §Gate placement) ──────
  // Gate runs Node-side immediately before execute(). The EF is a thin proxy;
  // gate_evaluation_id is returned in the response for the EF to persist.
  const { data: gateResult, error: gateError } = await (supabaseAdmin as SupabaseClient).rpc(
    "gate_action",
    {
      p_workspace_id: workspaceId,
      p_capability: body.capability,
      p_channel: "system",
      p_actor_profile_id: actorProfileId,
      p_action_type: "invoke_capability_tool",
    },
  );

  if (gateError) {
    baseLogger.error(
      { error: gateError.message, capability: body.capability },
      "[invoke-cap-tool] gate_action RPC failed",
    );
    return c.json(
      {
        ok: false,
        error: "GATE_ERROR",
        message: `gate_action failed: ${gateError.message}`,
      },
      500,
    );
  }

  const gate = gateResult as {
    allow: boolean;
    downgrade_to: string | null;
    reason: string | null;
    gate_evaluation_id: string;
  };

  if (!gate.allow) {
    const durationMs = Date.now() - startTs;
    baseLogger.info(
      {
        capability: body.capability,
        tool: body.tool,
        reason: gate.reason,
        engine_state_id: body.engine_state_id,
      },
      "[invoke-cap-tool] gate denied",
    );

    // Emit denied telemetry (ADR-0193 + ADR-0424 §Telemetry split)
    try {
      await emit({
        event: "engine.action.invoked.invoke_capability_tool",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_profile_id"),
        properties: {
          data: {
            engine_state_id: body.engine_state_id,
            engine_process_id: body.engine_process_id,
            step_index: 0,
            capability_name: body.capability,
            tool_name: body.tool,
            gate_action_id: gate.gate_evaluation_id ?? null,
            delegated_via: `engine_process:${body.engine_process_id}:${body.engine_state_step_id}`,
            tool_status: "denied",
            tool_error: gate.reason ?? "gate denied",
            duration_ms: durationMs,
          },
        },
      });
    } catch (emitErr) {
      baseLogger.warn({ err: emitErr }, "[invoke-cap-tool] telemetry emit failed (denied)");
    }

    return c.json(
      {
        ok: false,
        error: "GATE_DENIED",
        message: gate.reason ?? "capability not permitted",
        gate_evaluation_id: gate.gate_evaluation_id,
        duration_ms: durationMs,
      },
      200, // 200 per contract — the tool invocation path succeeded; the capability denied
    );
  }

  // ── 7. Build AgentToolContext and invoke tool ─────────────────────────────
  // supabaseAdmin is Node-side service-role client — NEVER trust EF-supplied JWT
  // for service-role operations (ADR-0151 + ADR-0265).
  const ctx: AgentToolContext = {
    workspaceId: nonEmpty(workspaceId, "workspaceId"),
    profileId: nonEmpty(actorProfileId, "profileId"),
    sessionId: body.engine_state_id, // engine_state_id serves as session context
    supabaseAdmin: supabaseAdmin as SupabaseClient,
    channel: "system",
    processId: body.engine_process_id,
    engineStateId: body.engine_state_id,
  };

  const toolResult = await resolved.execute(body.args, ctx);
  const durationMs = Date.now() - startTs;

  const toolStatus = toolResult.ok ? "success" : "error";

  // ── 8. Emit telemetry (ADR-0193 + ADR-0424 §Telemetry split) ─────────────
  try {
    await emit({
      event: "engine.action.invoked.invoke_capability_tool",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_profile_id"),
      properties: {
        data: {
          engine_state_id: body.engine_state_id,
          engine_process_id: body.engine_process_id,
          step_index: 0,
          capability_name: body.capability,
          tool_name: body.tool,
          gate_action_id: gate.gate_evaluation_id ?? null,
          delegated_via: `engine_process:${body.engine_process_id}:${body.engine_state_step_id}`,
          tool_status: toolStatus,
          tool_error: toolResult.ok ? null : toolResult.error,
          duration_ms: durationMs,
        },
      },
    });
  } catch (emitErr) {
    baseLogger.warn({ err: emitErr }, "[invoke-cap-tool] telemetry emit failed");
  }

  if (!toolResult.ok) {
    baseLogger.error(
      {
        capability: body.capability,
        tool: body.tool,
        error: toolResult.error,
        engine_state_id: body.engine_state_id,
        duration_ms: durationMs,
      },
      "[invoke-cap-tool] tool execute() returned error",
    );
    return c.json(
      {
        ok: false,
        error: toolResult.error,
        gate_evaluation_id: gate.gate_evaluation_id,
        duration_ms: durationMs,
      },
      500,
    );
  }

  baseLogger.info(
    {
      capability: body.capability,
      tool: body.tool,
      engine_state_id: body.engine_state_id,
      duration_ms: durationMs,
    },
    "[invoke-cap-tool] tool invoked successfully",
  );

  // ── 9. Return success with gate_evaluation_id ─────────────────────────────
  // EF receives gate_evaluation_id and persists it into engine_state_step row.
  return c.json({
    ok: true,
    result: toolResult.result,
    gate_evaluation_id: gate.gate_evaluation_id,
    duration_ms: durationMs,
  });
});

export { invokeCapabilityToolRouter };
