// packages/ai/src/capabilities/journey/tools.ts
//
// Journey capability — 4 tool skeletons (ADR-0173).
//
// SCOPE (S1.4):
// Each `execute()` body is INTENTIONALLY a skeleton:
//   1. ADR-0134 guard: reject empty workspaceId / profileId before any emit.
//   2. Generate run_id, emit exactly one `journey run_started` event
//      (FLAT + nested-entity payload shape registered in S1.1).
//   3. Return a skeleton JSON string — full logic lands M3 (run_dev Playwright),
//      M4 (publish_mission + publish_guide admin UI), M5 (run_guided Fjernkontroll).
//
// DO NOT expand these bodies without updating the S1.4 brief and re-opening
// the sub-sortie. Additional journey events (step_reached/completed/stuck/
// run_failed) fire from the surfaces that actually produce them, NOT here.
//
// Binding ADRs:
//   - 0078  voice forbidden for PII/critical (capability is chat-only at index.ts)
//   - 0134  mobile telemetry contract — workspace_id + actor_id MUST resolve
//           non-null/non-empty BEFORE emit(). Empty-string fallback is banned.
//   - 0173  exactly 4 capabilities, names frozen
//   - 0175  journey event registry — "journey run_started" is space-named
//
// Binding learnings:
//   - L-0094  phantom emit contracts (4th occurrence). Every `emit()` here
//             MUST have a matching registry row in packages/telemetry/src/registry.ts
//             (verified: see `"journey run_started"` at registry.ts:4737+).

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { JourneyIRSchema } from "@smartout/journey-ir";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

// Normalise session channel — unset means we're on an internal/system
// path (cron, engine-dispatch, test harness). Mirrors shift-lifecycle
// so gate_action treats both identically.
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

// Shared Zod schema — all four tools take a journey_version_id for M1
// skeletons. M3/M4/M5 extend per-tool as the real flows land.
const journeyVersionParam = z.object({
  journey_version_id: z.string().uuid().describe("Target journey_version UUID to run or publish"),
});

// ADR-0134 guard: shared message for merge-gate grep clarity.
const MISSING_CONTEXT = {
  ok: false as const,
  error: "missing_context" as const,
};

/**
 * journey.run_dev
 * Execute a JourneyIR locally against a dev build (Playwright) — dev surface.
 * M3 wires the full Playwright bridge. S1.4 skeleton only emits run_started.
 */
export const runDevTool = defineTool({
  name: "run_dev",
  description:
    "Execute a JourneyIR locally against a dev build (Playwright). Dev surface — emits journey run_started.",
  capability: "journey.run_dev",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // ADR-0134: workspace_id + actor_id must resolve non-null/non-empty
    // BEFORE emit. Empty-string fallback is banned (L-0066 / L-0097).
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "run_dev requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const runId = crypto.randomUUID();

    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.run_dev",
        surface: "dev",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_dev/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      run_id: runId,
      note: "S1.4 skeleton — full Playwright wiring lands in M3",
    });
  },
});

/**
 * journey.publish_mission
 * Publish a JourneyIR as a runtime mission (engine_missions row) — admin surface.
 * M4 wires the full publish flow. S1.4 skeleton only emits run_started.
 */
export const publishMissionTool = defineTool({
  name: "publish_mission",
  description:
    "Publish a JourneyIR as a runtime mission to engine_missions. Admin surface — emits journey run_started.",
  capability: "journey.publish_mission",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "publish_mission requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const runId = crypto.randomUUID();

    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.publish_mission",
        surface: "admin",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `publish_mission/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      run_id: runId,
      note: "S1.4 skeleton — engine_missions insert + mission publish lands in M4",
    });
  },
});

/**
 * journey.publish_guide
 * Publish a JourneyIR as a user-facing USER-GUIDE page — admin surface.
 * M4 wires docs generation. S1.4 skeleton only emits run_started.
 */
export const publishGuideTool = defineTool({
  name: "publish_guide",
  description:
    "Publish a JourneyIR as a user-facing USER-GUIDE page. Admin surface — emits journey run_started.",
  capability: "journey.publish_guide",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "publish_guide requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const runId = crypto.randomUUID();

    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.publish_guide",
        surface: "admin",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `publish_guide/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      run_id: runId,
      note: "S1.4 skeleton — USER-GUIDE generator wiring lands in M4",
    });
  },
});

/**
 * journey.run_guided — M5.1 web runtime
 *
 * Starts an agent-guided Fjernkontroll run on the web surface. Default
 * authority is `autonomous` (ADR-0173 / S1.3 seed), so this tool fires
 * direct via `tools` (not `suggestTools`) at `autonomous` level in
 * tool-selector.ts.
 *
 * Runtime contract (M5.1):
 *   1. MISSING_CONTEXT guard (ADR-0134) — workspace_id + actor_id non-empty
 *      BEFORE any emit or DB write. L-0066 / L-0097 / council R5.1-2.
 *   2. `gate_action` RPC (ADR-0099) — MANDATORY per council R5.1-3 even on
 *      an `autonomous` default, because the Wolf can flip the seed row and
 *      an unguarded autonomous tool is CVE-class. Deny → `capability_disabled`.
 *   3. Load journey_version + parent journey; validate ir_json via
 *      JourneyIRSchema (runtime can corrupt on legacy rows — fail cleanly).
 *   4. Insert engine_state row (process_id required) + one engine_state_step
 *      per IR step (status='pending'). L-0023 — this is RUNTIME state,
 *      separate from journey_event dev-tracking.
 *   5. Emit `journey run_started` (already in registry — ADR-0175).
 *
 * The Fjernkontroll UI (ADR-0177) subscribes to engine_event + engine_state
 * for live updates; `journey.stuck` is emitted by the Edge Function (M5.3),
 * NOT here.
 */
export const runGuidedTool = defineTool({
  name: "run_guided",
  description:
    "Agent-guided step-through for end users (Fjernkontroll). Runtime web surface — starts an engine_state run and emits journey run_started.",
  capability: "journey.run_guided",
  schema: journeyVersionParam,
  execute: async ({ journey_version_id }, ctx: AgentToolContext) => {
    // 1. ADR-0134 guard: workspace_id + actor_id must resolve
    // non-null/non-empty BEFORE emit or DB write. Council R5.1-2.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ...MISSING_CONTEXT,
        message: "run_guided requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    // 2. Council R5.1-3: gate_action is MANDATORY. `autonomous` default
    // is not a skip-the-gate license (L-0066/L-0097 — the Wolf can flip
    // the seed row). Fail CLOSED on any RPC error.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "journey.run_guided",
      channel,
      actionType: "run_guided",
      entityId: journey_version_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false as const,
        error: "capability_disabled" as const,
        reason: gate.reason ?? "denied",
      });
    }

    // 3. Load journey_version and its parent journey. `engine_process_id`
    // on the parent journey (20260308194427_journey_engine_process_link)
    // is the FK for engine_state.process_id — required column.
    const { data: versionRow, error: versionErr } = await supabase
      .from("journey_version")
      .select("journey_version_id, workspace_id, ir_json, journey_id")
      .eq("journey_version_id", journey_version_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (versionErr || !versionRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_version_not_found" as const,
        reason: versionErr?.message ?? "not_found",
      });
    }

    const { data: journeyRow, error: journeyErr } = await supabase
      .from("journey")
      .select("journey_id, engine_process_id")
      .eq("journey_id", versionRow.journey_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (journeyErr || !journeyRow) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_found" as const,
        reason: journeyErr?.message ?? "not_found",
      });
    }

    if (!journeyRow.engine_process_id) {
      // Journey has not been compiled to an engine_process blueprint yet.
      // engine_state.process_id is NOT NULL — we cannot start a runtime
      // run without a process row. M5 scope: surface the gap, don't
      // synthesise a stub process (that would live in M4 publish_mission).
      return JSON.stringify({
        ok: false as const,
        error: "journey_not_compiled" as const,
        reason: "journey.engine_process_id is null — compile the journey before running guided",
      });
    }

    // Validate IR shape. A corrupt ir_json would crash the Fjernkontroll
    // when it hydrates steps — fail here with a clean error instead.
    const parsed = JourneyIRSchema.safeParse(versionRow.ir_json);
    if (!parsed.success) {
      return JSON.stringify({
        ok: false as const,
        error: "journey_ir_invalid" as const,
        reason: parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    }

    const ir = parsed.data;

    // 4. Insert engine_state runtime row. L-0023: this is RUNTIME state;
    // journey_event (dev-tracking) is never touched from this path
    // (council R5.1-1).
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: journeyRow.engine_process_id,
        workspace_id: ctx.workspaceId,
        entity_type: "journey_run",
        entity_id: journey_version_id,
        assignee_id: ctx.profileId,
        status: "running",
        current_step: 0,
        context: {
          journey_version_id,
          capability: "journey.run_guided",
          surface: "runtime_web",
          ir_version: ir.version,
        },
      })
      .select("id")
      .single();

    if (stateErr || !stateRow) {
      return JSON.stringify({
        ok: false as const,
        error: "engine_state_insert_failed" as const,
        reason: stateErr?.message ?? "insert_failed",
      });
    }

    const runId = stateRow.id;

    // One engine_state_step per IR step, status='pending'. Step action_type
    // is whatever the IR declares — the Fjernkontroll renders per-step
    // rows keyed by step_order, and the runner (M5 follow-up) mutates
    // these on progression.
    const stepRows = ir.steps.map((step, idx) => ({
      state_id: runId,
      step_order: idx,
      action_type: step.action,
      action_payload: {
        key: step.key,
        title: step.title,
        assertion: step.assertion,
        ...(step.timeoutMs ? { timeout_ms: step.timeoutMs } : {}),
      },
      status: "pending",
    }));

    if (stepRows.length > 0) {
      const { error: stepErr } = await supabase.from("engine_state_step").insert(stepRows);
      if (stepErr) {
        // Best-effort cleanup so we don't leak a half-initialised run.
        await supabase.from("engine_state").delete().eq("id", runId);
        return JSON.stringify({
          ok: false as const,
          error: "engine_state_step_insert_failed" as const,
          reason: stepErr.message,
        });
      }
    }

    // 5. Emit registered event (council R5.1-5: no new event names).
    await emit({
      event: "journey run_started",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        journey_version_id,
        run_id: runId,
        actor_id: ctx.profileId,
        workspace_id: ctx.workspaceId,
        capability: "journey.run_guided",
        surface: "runtime_web",
        entity: {
          entity_type: "journey_run",
          entity_id: runId,
          entity_label: `run_guided/${journey_version_id}`,
        },
      },
    });

    return JSON.stringify({
      ok: true as const,
      run_id: runId,
      note: "runtime started",
    });
  },
});

export const allTools = [runDevTool, publishMissionTool, publishGuideTool, runGuidedTool] as const;
