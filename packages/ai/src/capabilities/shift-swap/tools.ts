/**
 * Shift swap agent tools — chat-only per ADR-0078.
 *
 * Authority split:
 *   readOnlyTools: getSwapRequests, getSwapEligibility (no authority gate)
 *   suggestTools:  requestSwap, respondToSwap, cancelSwap (require authority)
 *
 * All swap state lives in engine_state.context JSONB (ADR-0067).
 * Mutations call SECURITY DEFINER RPCs — employees cannot UPDATE
 * schedule_shift directly.
 *
 * Authority gating (ADR-0099/0176/0189): every write tool calls `gate_action`
 * via `callGateAction` BEFORE the RPC. `actor_profile_id` is taken from
 * `ctx.profileId` (never user input — ADR-0151, ADR-0176 Invariant 3).
 * On deny the tool returns a structured `{ ok: false, reason, gate_reason }`
 * payload and never reaches the RPC.
 *
 * Pipeline integration (ADR-0340 T2): each mutating tool ALSO creates /
 * advances / terminates a `shift_swap_lifecycle` pipeline instance in
 * engine_state via T1 engine helpers, and acquires / releases pipeline locks
 * on schedule_shift. Pipeline stage events are emitted as additive log
 * events (PENDING T4 for full telemetry registry routing).
 *
 * Lock decision (ADR-0340 §Q-lock-both): BOTH requester and target shifts
 * are locked at stage_0_propose. This prevents a race condition where the
 * marketplace could claim the target shift mid-swap while the swap is
 * pending. Cost: two acquirePipelineLock calls inside the same exec
 * callback (ADR-0287 single-mutateWithGate invariant — two acquires in
 * one exec = atomic, compliant). The locks are released together at
 * termination (cancel / approve / fail).
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { callGateAction } from "./gate.js";
import {
  createPipelineInstance,
  advancePipelineInstance,
  terminatePipelineInstance,
  readPipelineInstance,
  acquirePipelineLock,
  releasePipelineLock,
  emitStageProposed,
  emitStageConsented,
  emitStageRejected,
  emitStageCancelled,
  emitStageOverridden,
  isTerminalStatus,
  PipelineLockHeldError,
  PipelineContextError,
  PIPELINE_PROCESS_IDS,
} from "../../engine/authority-pipeline/index.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";

// Dotted per-tool capability literals (ADR-0195). Seeded by T0 migration
// in engine_authority_config.
const CAPABILITY_REQUEST = "shift_swap.request";
const CAPABILITY_RESPOND = "shift_swap.respond";
const CAPABILITY_CANCEL = "shift_swap.cancel";
// T5: admin override — seeded by T0.5 migration (min_role=admin, autonomous).
const CAPABILITY_OVERRIDE = "shift_swap.override";

// Pipeline blueprint for shift swaps.
const SWAP_PROCESS_ID = PIPELINE_PROCESS_IDS[0]; // "shift_swap_lifecycle"

// ── Read-Only Tools ─────────────────────────────────────────────────────────

export const getSwapRequests = defineTool({
  name: "get_swap_requests",
  description:
    "Get pending shift swap requests for the current workspace. Shows all active swaps with their status.",
  capability: "shift_swap",
  schema: z.object({
    status_filter: z
      .enum(["all", "pending_recipient", "pending_manager"])
      .optional()
      .default("all")
      .describe("Filter swaps by status. Default: all active swaps."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const query = supabase
      .from("engine_state")
      .select("id, context, status, started_at, updated_at")
      .eq("process_id", "shift_swap")
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["active", "waiting"])
      .order("started_at", { ascending: false });

    const { data, error } = await query;

    if (error) return `Error loading swap requests: ${error.message}`;
    if (!data || data.length === 0) return "No pending swap requests found.";

    // Filter by context status if requested
    const filtered =
      params.status_filter === "all"
        ? data
        : data.filter(
            (row) => (row.context as Record<string, unknown>)?.status === params.status_filter,
          );

    if (filtered.length === 0) return `No swap requests with status '${params.status_filter}'.`;

    return JSON.stringify(
      filtered.map((row) => ({
        swap_id: row.id,
        context: row.context,
        started_at: row.started_at,
      })),
    );
  },
});

export const getSwapEligibility = defineTool({
  name: "get_swap_eligibility",
  description:
    "Check which colleagues are eligible for a shift swap with the specified shift. Returns eligible profiles and their compatible shifts.",
  capability: "shift_swap",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift ID to check swap eligibility for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Get the source shift details
    const { data: shift, error: shiftError } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, employee_id, shift_date, start_time, end_time, position_id, status",
      )
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (shiftError || !shift) return "Shift not found.";
    if (!shift.employee_id) return "Shift is unassigned — cannot swap.";

    // Get all published shifts in the same workspace for other employees
    const { data: eligibleShifts, error: eligibleError } = await supabase
      .from("schedule_shift")
      .select(
        "schedule_shift_id, employee_id, shift_date, start_time, end_time, work_hours, position_id, status",
      )
      .eq("workspace_id", ctx.workspaceId)
      .neq("employee_id", shift.employee_id)
      .in("status", ["published", "assigned"])
      .gte("shift_date", new Date().toISOString().split("T")[0]);

    if (eligibleError) return `Error loading eligible shifts: ${eligibleError.message}`;
    if (!eligibleShifts || eligibleShifts.length === 0) return "No eligible shifts found for swap.";

    // Group by employee — show each colleague with their available shifts
    const byEmployee = new Map<string, typeof eligibleShifts>();
    for (const s of eligibleShifts) {
      if (!s.employee_id) continue;
      const existing = byEmployee.get(s.employee_id) ?? [];
      existing.push(s);
      byEmployee.set(s.employee_id, existing);
    }

    const result = Array.from(byEmployee.entries()).map(([employeeId, shifts]) => ({
      employee_id: employeeId,
      shifts: shifts.map((s) => ({
        shift_id: s.schedule_shift_id,
        date: s.shift_date,
        start: s.start_time,
        end: s.end_time,
        position_id: s.position_id,
      })),
    }));

    return JSON.stringify(result);
  },
});

// ── Suggest Tools (require authority gate) ──────────────────────────────────

export const requestSwap = defineTool({
  name: "request_swap",
  description:
    "Initiate a shift swap request between the current employee and a colleague. Chat-only.",
  capability: "shift_swap",
  schema: z.object({
    requester_shift_id: z.string().uuid().describe("The shift ID being offered for swap"),
    target_profile_id: z.string().uuid().describe("The colleague's profile ID"),
    target_shift_id: z.string().uuid().describe("The colleague's shift ID to swap with"),
    reason: z.string().optional().describe("Optional reason for the swap request"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 / ADR-0288: chat-only channel guard (Layer 3 inline — preserved verbatim)
    if (ctx.channel && ctx.channel !== "chat") {
      return "Skiftbytte kan kun gjores via chat, ikke voice. Bytt til chat for a sende byttforesporselen.";
    }

    const supabase = ctx.supabaseAdmin;

    // ADR-0099 / ADR-0176 Invariant 3: authority gate BEFORE RPC.
    // actor_profile_id comes from ctx.profileId, never from tool params.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_REQUEST,
      channel: "chat",
      actionType: "request_swap",
      entityId: params.requester_shift_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        gate_reason: gate.reason,
      });
    }

    // ADR-0287 single-mutateWithGate: pipeline instance creation + lock
    // acquire (both shifts) + domain RPC call all happen in one atomic exec.
    // Lock both shifts to prevent marketplace from claiming target shift
    // while the swap is pending (ADR-0340 §Q-lock-both).
    const pipelineCtx = {
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
    };

    let swapId: string;
    let pipelineInstanceId: string;

    try {
      const mutResult = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_REQUEST,
        actionType: "request_swap",
        channel: "chat",
        targetId: params.requester_shift_id,
        exec: async (db) => {
          // 1. Create pipeline instance for this swap (stage_0_propose).
          const instance = await createPipelineInstance(
            db,
            pipelineCtx,
            SWAP_PROCESS_ID,
            params.requester_shift_id,
            {
              shiftId: params.requester_shift_id,
              sourceWorkspaceId: ctx.workspaceId,
              initiatorProfileId: ctx.profileId,
              targetShiftId: params.target_shift_id,
              targetProfileId: params.target_profile_id,
              lastGateEvaluationId: gate.gateEvaluationId,
            },
          );

          // 2. Acquire lock on requester's shift.
          await acquirePipelineLock(db, pipelineCtx, params.requester_shift_id, instance.id);

          // 3. Acquire lock on target shift (race prevention — ADR-0340 §Q-lock-both).
          await acquirePipelineLock(db, pipelineCtx, params.target_shift_id, instance.id);

          // 4. SECURITY DEFINER RPC — creates swap record + assigns engine_state.
          const { data, error } = await db.rpc("initiate_shift_swap", {
            p_requester_shift_id: params.requester_shift_id,
            p_target_profile_id: params.target_profile_id,
            p_target_shift_id: params.target_shift_id,
            p_reason: params.reason ?? null,
          });

          if (error) throw new Error(error.message);

          return { swapId: data as string, pipelineInstanceId: instance.id };
        },
      });

      swapId = mutResult.result.swapId;
      pipelineInstanceId = mutResult.result.pipelineInstanceId;
    } catch (err) {
      if (err instanceof PipelineLockHeldError) {
        return `Skiftet er allerede låst av en annen aktiv bytteprosess. Prøv igjen etter at den eksisterende prosessen er avsluttet.`;
      }
      if (err instanceof PipelineContextError) {
        return `Feil i pipeline-kontekst: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Feil ved opprettelse av byttforespørsel: ${msg}`;
    }

    // Legacy shift_swap.requested event — preserved verbatim (ADR-0340 §Preservation 1).
    await emit({
      event: "shift_swap.requested",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: swapId,
        data: {
          swap_id: swapId,
          requester_shift_id: params.requester_shift_id,
          target_shift_id: params.target_shift_id,
          target_profile_id: params.target_profile_id,
        },
      },
    });

    // Additive pipeline.stage_proposed event (PENDING T4 full registry routing).
    await emitStageProposed({
      processId: SWAP_PROCESS_ID,
      stage: "shift_swap_lifecycle.stage_0_propose",
      pipelineInstanceId,
      gateEvaluationId: gate.gateEvaluationId,
      shiftId: params.requester_shift_id,
      workspaceId: ctx.workspaceId,
      actorProfileId: ctx.profileId,
    });

    return JSON.stringify({
      success: true,
      swap_id: swapId,
      pipeline_instance_id: pipelineInstanceId,
      message: "Byttforespørsel sendt. Venter på svar fra kollega.",
    });
  },
});

export const respondToSwap = defineTool({
  name: "respond_to_swap",
  description: "Accept or reject a shift swap request as the target employee. Chat-only.",
  capability: "shift_swap",
  schema: z.object({
    swap_id: z.string().uuid().describe("The swap request ID (engine_state.id)"),
    accepted: z.boolean().describe("True to accept, false to reject"),
    reason: z.string().optional().describe("Optional reason (used when rejecting)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 / ADR-0288: chat-only channel guard (Layer 3 inline — preserved verbatim)
    if (ctx.channel && ctx.channel !== "chat") {
      return "Skiftbytte kan kun gjores via chat, ikke voice.";
    }

    const supabase = ctx.supabaseAdmin;

    // ADR-0099 / ADR-0176 Invariant 3: authority gate BEFORE RPC.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_RESPOND,
      channel: "chat",
      actionType: "respond_to_swap",
      entityId: params.swap_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        gate_reason: gate.reason,
      });
    }

    // Look up the pipeline instance for this swap so we know which instance
    // to advance or terminate. The swap_id is the engine_state.id from the
    // initiate_shift_swap RPC (set at stage_0_propose creation).
    const { data: pipelineRow, error: pipelineFetchError } = await supabase
      .from("engine_state")
      .select("id, current_step, context")
      .eq("id", params.swap_id)
      .in("process_id", [...PIPELINE_PROCESS_IDS])
      .eq("workspace_id", ctx.workspaceId)
      .single();

    // If no pipeline instance is found we still allow the RPC to run —
    // backward compat with swaps created before pipeline integration.
    const hasPipelineInstance = !pipelineFetchError && pipelineRow !== null;

    const pipelineCtx = {
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
    };

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_RESPOND,
        actionType: "respond_to_swap",
        channel: "chat",
        targetId: params.swap_id,
        exec: async (db) => {
          // Domain RPC (SECURITY DEFINER) — executed first, then pipeline advance.
          const { error } = await db.rpc("respond_to_shift_swap", {
            p_swap_id: params.swap_id,
            p_accepted: params.accepted,
            p_reason: params.reason ?? null,
          });
          if (error) throw new Error(error.message);

          // Advance or terminate pipeline instance if one exists.
          if (hasPipelineInstance) {
            if (params.accepted) {
              // Accept → advance to stage_1_consent (step 1).
              await advancePipelineInstance(
                db,
                pipelineCtx,
                pipelineRow.id,
                1,
                gate.gateEvaluationId,
              );
            } else {
              // Reject → terminal state; release locks.
              const ctx_data = (pipelineRow.context ?? {}) as Record<string, string>;
              const requesterShiftId = ctx_data.shiftId as string | undefined;
              const targetShiftId = ctx_data.targetShiftId as string | undefined;

              await terminatePipelineInstance(
                db,
                pipelineCtx,
                pipelineRow.id,
                { kind: "reject" },
                gate.gateEvaluationId,
              );

              // Release locks on both shifts (ADR-0340 §Q-lock-both).
              if (requesterShiftId) {
                await releasePipelineLock(db, pipelineCtx, requesterShiftId, pipelineRow.id);
              }
              if (targetShiftId) {
                await releasePipelineLock(db, pipelineCtx, targetShiftId, pipelineRow.id);
              }
            }
          }

          return { accepted: params.accepted };
        },
      });
    } catch (err) {
      if (err instanceof PipelineContextError) {
        return `Feil i pipeline-kontekst: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Feil ved svar pa byttforespørsel: ${msg}`;
    }

    // Legacy events — preserved verbatim (ADR-0340 §Preservation 1).
    if (params.accepted) {
      await emit({
        event: "shift_swap.accepted",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.swap_id,
          data: { swap_id: params.swap_id },
        },
      });
    } else {
      await emit({
        event: "shift_swap.rejected",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.swap_id,
          data: { swap_id: params.swap_id, rejected_by: ctx.profileId },
        },
      });
    }

    // Additive pipeline stage event (PENDING T4 full registry routing).
    if (hasPipelineInstance) {
      if (params.accepted) {
        await emitStageConsented({
          processId: SWAP_PROCESS_ID,
          stage: "shift_swap_lifecycle.stage_1_consent",
          pipelineInstanceId: pipelineRow.id,
          gateEvaluationId: gate.gateEvaluationId,
          shiftId: (pipelineRow.context as Record<string, string>).shiftId ?? params.swap_id,
          workspaceId: ctx.workspaceId,
          actorProfileId: ctx.profileId,
        });
      } else {
        await emitStageRejected({
          processId: SWAP_PROCESS_ID,
          stage: "shift_swap_lifecycle.stage_1_consent",
          pipelineInstanceId: pipelineRow.id,
          gateEvaluationId: gate.gateEvaluationId,
          shiftId: (pipelineRow.context as Record<string, string>).shiftId ?? params.swap_id,
          workspaceId: ctx.workspaceId,
          actorProfileId: ctx.profileId,
        });
      }
    }

    return params.accepted
      ? "Bytte akseptert. Venter nå på godkjenning fra leder."
      : "Bytte avvist.";
  },
});

export const cancelSwap = defineTool({
  name: "cancel_swap",
  description:
    "Cancel a pending shift swap request as the original requester. Only cancellable while status is pending_recipient or pending_manager. Chat-only.",
  capability: "shift_swap",
  schema: z.object({
    swap_id: z.string().uuid().describe("The swap request ID (engine_state.id) to cancel"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 / ADR-0288: chat-only channel guard (Layer 3 inline — preserved verbatim)
    if (ctx.channel && ctx.channel !== "chat") {
      return "Skiftbytte kan kun gjores via chat, ikke voice.";
    }

    const supabase = ctx.supabaseAdmin;

    // ADR-0099 / ADR-0176 Invariant 3: authority gate BEFORE RPC.
    // shift_swap.cancel is seeded at `confirm` level — stricter than request/respond.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_CANCEL,
      channel: "chat",
      actionType: "cancel_swap",
      entityId: params.swap_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        gate_reason: gate.reason,
      });
    }

    // Look up pipeline instance for this swap.
    const { data: pipelineRow, error: pipelineFetchError } = await supabase
      .from("engine_state")
      .select("id, current_step, context")
      .eq("id", params.swap_id)
      .in("process_id", [...PIPELINE_PROCESS_IDS])
      .eq("workspace_id", ctx.workspaceId)
      .single();

    const hasPipelineInstance = !pipelineFetchError && pipelineRow !== null;

    const pipelineCtx = {
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
    };

    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_CANCEL,
        actionType: "cancel_swap",
        channel: "chat",
        targetId: params.swap_id,
        exec: async (db) => {
          // Domain RPC (SECURITY DEFINER).
          const { error } = await db.rpc("cancel_shift_swap", {
            p_swap_id: params.swap_id,
          });
          if (error) throw new Error(error.message);

          // Terminate pipeline instance + release locks if one exists.
          if (hasPipelineInstance) {
            const ctx_data = (pipelineRow.context ?? {}) as Record<string, string>;
            const requesterShiftId = ctx_data.shiftId as string | undefined;
            const targetShiftId = ctx_data.targetShiftId as string | undefined;

            await terminatePipelineInstance(
              db,
              pipelineCtx,
              pipelineRow.id,
              { kind: "cancel" },
              gate.gateEvaluationId,
            );

            // Release locks on both shifts (ADR-0340 §Q-lock-both).
            if (requesterShiftId) {
              await releasePipelineLock(db, pipelineCtx, requesterShiftId, pipelineRow.id);
            }
            if (targetShiftId) {
              await releasePipelineLock(db, pipelineCtx, targetShiftId, pipelineRow.id);
            }
          }

          return { cancelled: true };
        },
      });
    } catch (err) {
      if (err instanceof PipelineContextError) {
        return `Feil i pipeline-kontekst: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Feil ved avbryting av byttforespørsel: ${msg}`;
    }

    // Legacy shift_swap.cancelled event — preserved verbatim (ADR-0340 §Preservation 1).
    await emit({
      event: "shift_swap.cancelled",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.swap_id,
        data: { swap_id: params.swap_id },
      },
    });

    // Additive pipeline.stage_cancelled event (PENDING T4 full registry routing).
    if (hasPipelineInstance) {
      await emitStageCancelled({
        processId: SWAP_PROCESS_ID,
        stage: "shift_swap_lifecycle.stage_0_propose",
        pipelineInstanceId: pipelineRow.id,
        gateEvaluationId: gate.gateEvaluationId,
        shiftId: (pipelineRow.context as Record<string, string>).shiftId ?? params.swap_id,
        workspaceId: ctx.workspaceId,
        actorProfileId: ctx.profileId,
      });
    }

    return "Byttforespørsel avbrutt.";
  },
});

// ── Admin Override Tool (T5) ─────────────────────────────────────────────────

/**
 * override_swap_pipeline — admin escalation that force-terminates a stuck
 * shift_swap_lifecycle pipeline instance.
 *
 * Authority: shift_swap.override (min_role=admin, level=autonomous).
 * Seeded by T0.5 migration (20260620100200_seed_pipeline_override_authority.sql).
 *
 * Laws honoured:
 *   ADR-0078 / ADR-0288 — chat-only (irreversible admin act, no voice)
 *   ADR-0099            — gate_action via mutateWithGate before any write
 *   ADR-0134            — emit pipeline.stage_overridden after successful write
 *   ADR-0151            — workspace_id + profileId server-derived (ctx), never params
 *   ADR-0240            — writes ONLY to engine_state (terminate) + schedule_shift
 *                         (releasePipelineLock) — no cross-namespace writes
 *   ADR-0287            — single mutateWithGate: terminate + release inside one exec
 *   ADR-0328            — override_reason ≥ 20 chars, friendly Norwegian error on fail
 *   L-0177              — fail-fast if pipeline not in this workspace
 *
 * Idempotency: if the instance is already in a terminal state (including
 *   "overridden"), the tool returns the existing state without re-emitting.
 */
export const overrideSwapPipeline = defineTool({
  name: "override_swap_pipeline",
  description:
    "Admin override: force-terminate a stuck shift swap pipeline instance. Requires admin role. Chat-only. Provide a clear reason (minimum 20 characters).",
  capability: "shift_swap",
  schema: z.object({
    pipeline_instance_id: z
      .string()
      .uuid()
      .describe("engine_state.id of the shift_swap_lifecycle instance to override"),
    override_reason: z
      .string()
      .min(20)
      .describe("Reason for the override — minimum 20 characters (ADR-0328)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288 / ADR-0340 §Q5: chat-only — admin override is an irreversible act.
    if (ctx.channel && ctx.channel !== "chat") {
      return "Administrasjonsoverstyrelser må gjøres via chat, ikke stemme. Bytt til chat for å fortsette.";
    }

    // ADR-0328: friendly Norwegian validation error before any DB call.
    if (params.override_reason.trim().length < 20) {
      return "Begrunnelsen er for kort. Minst 20 tegn kreves for å dokumentere en overstyring (ADR-0328).";
    }

    const supabase = ctx.supabaseAdmin;
    const pipelineCtx = { workspaceId: ctx.workspaceId, profileId: ctx.profileId };

    // 1. Load pipeline instance — fail-fast on not-found or workspace mismatch (L-0177 / ADR-0151).
    let instance;
    try {
      instance = await readPipelineInstance(supabase, pipelineCtx, params.pipeline_instance_id);
    } catch (err) {
      if (err instanceof PipelineContextError) {
        return `Pipeline-instansen ble ikke funnet eller tilhører et annet arbeidsområde: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Feil ved lasting av pipeline-instans: ${msg}`;
    }

    // 2. Idempotency: already terminal → return existing state without re-emit.
    if (isTerminalStatus(instance.status)) {
      return JSON.stringify({
        ok: true,
        pipeline_instance_id: instance.id,
        overridden_from_status: instance.status,
        message:
          instance.status === "overridden"
            ? "Pipeline-instansen er allerede overstyrt."
            : `Pipeline-instansen er allerede i terminal tilstand '${instance.status}'. Ingen overstyring nødvendig.`,
      });
    }

    // Capture pre-override status for the response + event payload.
    const overriddenFromStatus = instance.status;

    // Resolve locked shift IDs from pipeline context for lock release.
    const ctxData = (instance.context ?? {}) as Record<string, string>;
    const primaryShiftId = ctxData.shiftId as string | undefined;
    const targetShiftId = ctxData.targetShiftId as string | undefined;

    // 3. mutateWithGate: single atomic exec — terminate + release locks (ADR-0287).
    let gateEvaluationId: string;
    let correlationId: string;

    try {
      const mutResult = await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_OVERRIDE,
        actionType: "shift_swap.override",
        channel: "chat",
        targetId: params.pipeline_instance_id,
        exec: async (db) => {
          // Write 1: Terminate pipeline instance → status='overridden'.
          await terminatePipelineInstance(
            db,
            pipelineCtx,
            params.pipeline_instance_id,
            { kind: "override" },
            null, // gateEvaluationId not yet available inside exec — context patched post-call
          );

          // Write 2 + 3: Release pipeline locks on both shifts (ADR-0340 §Q-lock-both).
          // Both acquires happen in requestSwap, so both must be released on override.
          if (primaryShiftId) {
            await releasePipelineLock(db, pipelineCtx, primaryShiftId, params.pipeline_instance_id);
          }
          if (targetShiftId) {
            await releasePipelineLock(db, pipelineCtx, targetShiftId, params.pipeline_instance_id);
          }

          return { overriddenFromStatus };
        },
      });

      gateEvaluationId = mutResult.gateEvaluationId;
      correlationId = mutResult.correlationId;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({
          ok: false,
          reason: "authority_denied",
          gate_reason: err.message,
        });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ ok: false, reason: err.code, gate_reason: err.message });
      }
      if (err instanceof PipelineContextError) {
        return `Feil i pipeline-kontekst ved overstyring: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Feil ved overstyring av pipeline: ${msg}`;
    }

    // 4. ADR-0134: emit pipeline.stage_overridden AFTER all writes succeeded.
    await emitStageOverridden({
      processId: SWAP_PROCESS_ID,
      stage: "shift_swap_lifecycle.override",
      pipelineInstanceId: params.pipeline_instance_id,
      gateEvaluationId,
      shiftId: primaryShiftId ?? params.pipeline_instance_id,
      workspaceId: ctx.workspaceId,
      actorProfileId: ctx.profileId,
    });

    return JSON.stringify({
      ok: true,
      pipeline_instance_id: params.pipeline_instance_id,
      overridden_from_status: overriddenFromStatus,
      gate_evaluation_id: gateEvaluationId,
      correlation_id: correlationId,
    });
  },
});
