/**
 * Shift swap agent tools — chat-only per ADR-0078.
 *
 * Authority split:
 *   readOnlyTools: getSwapRequests, getSwapEligibility (no authority gate)
 *   suggestTools:  requestSwap, respondToSwap, cancelSwap (require authority)
 *
 * All swap state lives in engine_state.context JSONB (ADR-0067).
 * Mutations call SECURITY DEFINER RPCs — employees cannot UPDATE schedule_shift directly.
 *
 * Authority gating (ADR-0099/0176/0189): every write tool calls `gate_action`
 * via `callGateAction` BEFORE the RPC. `actor_profile_id` is taken from
 * `ctx.profileId` (never user input — ADR-0151, ADR-0176 Invariant 3).
 * On deny the tool returns a structured `{ ok: false, reason, gate_reason }`
 * payload and never reaches the RPC.
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { callGateAction } from "./gate.js";

// Dotted per-tool capability literals (ADR-0195). Seeded by Task A migration
// in engine_authority_config.
const CAPABILITY_REQUEST = "shift_swap.request";
const CAPABILITY_RESPOND = "shift_swap.respond";
const CAPABILITY_CANCEL = "shift_swap.cancel";

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
    // ADR-0078: chat-only channel guard
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

    const { data, error } = await supabase.rpc("initiate_shift_swap", {
      p_requester_shift_id: params.requester_shift_id,
      p_target_profile_id: params.target_profile_id,
      p_target_shift_id: params.target_shift_id,
      p_reason: params.reason ?? null,
    });

    if (error) return `Feil ved opprettelse av byttforespørsel: ${error.message}`;

    const swapId = data as string;

    // ADR-0175 / L-0094: emit AFTER RPC success, before returning to agent.
    // Dotted event per ADR-0164.
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

    return JSON.stringify({
      success: true,
      swap_id: swapId,
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
    // ADR-0078: chat-only channel guard
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

    const { error } = await supabase.rpc("respond_to_shift_swap", {
      p_swap_id: params.swap_id,
      p_accepted: params.accepted,
      p_reason: params.reason ?? null,
    });

    if (error) return `Feil ved svar pa byttforespørsel: ${error.message}`;

    // ADR-0175 / L-0094: emit AFTER RPC success. Dotted event per ADR-0164.
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
    // ADR-0078: chat-only channel guard
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

    const { error } = await supabase.rpc("cancel_shift_swap", {
      p_swap_id: params.swap_id,
    });

    if (error) return `Feil ved avbryting av byttforespørsel: ${error.message}`;

    // ADR-0175 / L-0094: emit AFTER RPC success. Dotted event per ADR-0164.
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

    return "Byttforespørsel avbrutt.";
  },
});
