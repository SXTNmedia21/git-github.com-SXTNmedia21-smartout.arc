/**
 * shift_lifecycle capability tools (Phase 5 per ADR-0095).
 *
 * Five-Layer Architecture:
 *   Execution (schedule_shift) → Reality (time_entry) → Interpretation
 *   (shift_hour_interpretation) → Derivation (shift_cost_snapshot) →
 *   Decision (shift_approval / daily_reconciliation).
 *
 * Write tools MUST call gate_action (ADR-0099) before mutating.
 * Capability names are DOTTED so engine_authority_config can gate per
 * action independently (shift_lifecycle.publish, .approve, .interpret,
 * .settle).
 *
 * Channels (ADR-0078): publish allows chat + system; approve allows
 * chat only (PII exposure); interpret + settle are system-only (internal
 * or admin-initiated from dashboard only).
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

type ShiftRow = {
  schedule_shift_id: string;
  workspace_id: string;
  employee_id: string | null;
  department_id: string | null;
  status: string;
};

const CAPABILITY_PUBLISH = "shift_lifecycle.publish";
const CAPABILITY_APPROVE = "shift_lifecycle.approve";
const CAPABILITY_INTERPRET = "shift_lifecycle.interpret";
const CAPABILITY_SETTLE = "shift_lifecycle.settle";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

async function loadShift(
  supabase: SupabaseClient,
  shiftId: string,
  workspaceId: string,
): Promise<{ shift: ShiftRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, workspace_id, employee_id, department_id, status")
    .eq("schedule_shift_id", shiftId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return { shift: null, error: error.message };
  if (!data) return { shift: null, error: "shift_not_found" };
  return { shift: data as ShiftRow, error: null };
}

// ── publish_shift ───────────────────────────────────────────────────
// Execution → cross-layer event. Moves shift to 'published' and emits
// `shift.published` (consumed by department_session_lifecycle + the
// shift_published_notify_v1 engine_process per Phase 4).
export const publishShift = defineTool({
  name: "publish_shift",
  description:
    "Publish a shift so the assigned employee can see it and punch in. Requires publish-level authority. Not allowed over voice.",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift to publish (schedule_shift_id)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel === "voice") {
      return "Publisering av skift kan ikke gjøres over stemme (ADR-0078).";
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_PUBLISH,
      channel,
      actionType: "publish_shift",
    });

    if (!gate.allow) {
      void emit({
        event: "shift_lifecycle published",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.shift_id,
          data: { shift_id: params.shift_id, gate_allowed: false, reason: gate.reason ?? "denied" },
        },
      });
      return JSON.stringify({ allowed: false, reason: gate.reason ?? "denied" });
    }

    const { shift, error: loadErr } = await loadShift(supabase, params.shift_id, ctx.workspaceId);
    if (loadErr) return `Kunne ikke laste skift: ${loadErr}`;
    if (!shift) return "Shift not found.";

    const { error: updateErr } = await supabase
      .from("schedule_shift")
      .update({ status: "published", is_published: true, updated_at: new Date().toISOString() })
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateErr) return `Feil ved publisering: ${updateErr.message}`;

    void emit({
      event: "shift_lifecycle published",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: { shift_id: params.shift_id, gate_allowed: true },
      },
    });

    // ADR-0100 / Phase 4: shift.published event triggers
    // department_session_lifecycle + shift_published_notify_v1.
    void emit({
      event: "shift published",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: {
          dates: [],
          department_ids: shift.department_id ? [shift.department_id] : [],
          shift_ids: [params.shift_id],
          shift_count: 1,
        },
      },
    });

    return JSON.stringify({ allowed: true, shift_id: params.shift_id, status: "published" });
  },
});

// ── approve_shift ───────────────────────────────────────────────────
// Decision layer (C1). Four-eyes may be required per ADR-0101; in that
// case the tool returns `four_eyes_pending` and does not mutate.
export const approveShift = defineTool({
  name: "approve_shift",
  description:
    "Approve a shift's interpreted hours, transitioning shift_approval from pending to approved. Chat-only. May require a second approver (four-eyes).",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift being approved (schedule_shift_id)"),
    approved_hours: z
      .number()
      .min(0)
      .max(24)
      .describe(
        "Final approved hours. Must match interpreted_hours unless edit_justification is set.",
      ),
    edit_justification: z
      .string()
      .optional()
      .describe(
        "Required if approved_hours differs from the interpreted value (override artifact per ADR-0097).",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel !== "chat") {
      return "Shift approval is only available over chat (ADR-0078).";
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_APPROVE,
      channel,
      actionType: "approve_shift",
    });

    // Four-eyes path (ADR-0101): return a pending response, do NOT mutate.
    if (!gate.allow && gate.reason === "four_eyes_required") {
      void emit({
        event: "shift_lifecycle approved",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.shift_id,
          data: {
            shift_id: params.shift_id,
            approved_hours: params.approved_hours,
            four_eyes_pending: true,
            gate_allowed: false,
            reason: "four_eyes_required",
          },
        },
      });
      return JSON.stringify({
        allowed: false,
        four_eyes_pending: true,
        reason: "four_eyes_required",
        approvers_needed: gate.approversNeeded,
        approvers_present: gate.approversPresent,
      });
    }

    if (!gate.allow) {
      void emit({
        event: "shift_lifecycle approved",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.shift_id,
          data: {
            shift_id: params.shift_id,
            approved_hours: params.approved_hours,
            four_eyes_pending: false,
            gate_allowed: false,
            reason: gate.reason ?? "denied",
          },
        },
      });
      return JSON.stringify({ allowed: false, reason: gate.reason ?? "denied" });
    }

    // Find the pending shift_approval row (created by queue_shift_approval in Phase 4).
    const { data: existing, error: findErr } = await supabase
      .from("shift_approval")
      .select("approval_id, status, calculated_hours")
      .eq("shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) return `Kunne ikke hente shift_approval: ${findErr.message}`;
    if (!existing) {
      return "Ingen pending shift_approval funnet — kjør interpret_shift først.";
    }

    const { error: updateErr } = await supabase
      .from("shift_approval")
      .update({
        status: "approved",
        approved_hours: params.approved_hours,
        approved_by: ctx.profileId,
        approved_at: new Date().toISOString(),
        edit_justification: params.edit_justification ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("approval_id", existing.approval_id);

    if (updateErr) return `Feil ved godkjenning: ${updateErr.message}`;

    void emit({
      event: "shift_lifecycle approved",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: {
          shift_id: params.shift_id,
          approval_id: existing.approval_id,
          approved_hours: params.approved_hours,
          four_eyes_pending: false,
          gate_allowed: true,
        },
      },
    });

    void emit({
      event: "shift hours_confirmed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: { shift_id: params.shift_id, status: "approved" },
      },
    });

    return JSON.stringify({
      allowed: true,
      approval_id: existing.approval_id,
      approved_hours: params.approved_hours,
      status: "approved",
    });
  },
});

// ── interpret_shift ─────────────────────────────────────────────────
// Interpretation layer. Typically invoked internally by engine-dispatch
// (call_rpc action in shift_lifecycle_v1 process). Exposed here for
// admin-initiated re-derivation after rule/data corrections.
export const interpretShift = defineTool({
  name: "interpret_shift",
  description:
    "Re-derive interpretation hours for a shift by calling derive_shift_hours. Produces an append-only shift_hour_interpretation row. System-only channel.",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift to interpret (schedule_shift_id)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel !== "system") {
      return "interpret_shift kan kun kalles fra system-kanal.";
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_INTERPRET,
      channel,
      actionType: "interpret_shift",
    });

    if (!gate.allow) {
      return JSON.stringify({ allowed: false, reason: gate.reason ?? "denied" });
    }

    const { data, error } = await supabase.rpc("derive_shift_hours", {
      p_shift_id: params.shift_id,
    });

    if (error) return `Feil ved derivering: ${error.message}`;
    const interpretationId = typeof data === "string" ? data : null;

    void emit({
      event: "shift_lifecycle interpreted",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: {
          shift_id: params.shift_id,
          interpretation_id: interpretationId ?? undefined,
        },
      },
    });

    return JSON.stringify({ allowed: true, interpretation_id: interpretationId });
  },
});

// ── settle_shift ────────────────────────────────────────────────────
// Derivation layer (C3). Idempotent: if the latest interpretation
// already has a cost snapshot, we return that snapshot rather than
// creating a duplicate.
export const settleShift = defineTool({
  name: "settle_shift",
  description:
    "Snapshot cost for a shift's latest interpretation via snapshot_shift_cost. Idempotent. Emits shift.settled for daily_close. System-only channel.",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift to settle (schedule_shift_id)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel !== "system") {
      return "settle_shift kan kun kalles fra system-kanal.";
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_SETTLE,
      channel,
      actionType: "settle_shift",
    });

    if (!gate.allow) {
      return JSON.stringify({ allowed: false, reason: gate.reason ?? "denied" });
    }

    // Find latest interpretation.
    const { data: latest, error: latestErr } = await supabase
      .from("shift_hour_interpretation")
      .select("interpretation_id, derivation_version")
      .eq("shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .order("derivation_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) return `Kunne ikke hente interpretation: ${latestErr.message}`;
    if (!latest) {
      return "Ingen shift_hour_interpretation funnet — kjør interpret_shift først.";
    }

    // Idempotency: if a cost snapshot already exists for this interpretation, reuse it.
    const { data: existingSnap } = await supabase
      .from("shift_cost_snapshot")
      .select("id")
      .eq("interpretation_id", latest.interpretation_id)
      .limit(1)
      .maybeSingle();

    if (existingSnap?.id) {
      void emit({
        event: "shift_lifecycle settled",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.shift_id,
          data: {
            shift_id: params.shift_id,
            snapshot_id: existingSnap.id,
            idempotent_hit: true,
          },
        },
      });
      return JSON.stringify({
        allowed: true,
        snapshot_id: existingSnap.id,
        idempotent: true,
      });
    }

    const { data: snapshotId, error: snapErr } = await supabase.rpc("snapshot_shift_cost", {
      p_interpretation_id: latest.interpretation_id,
    });

    if (snapErr) return `Feil ved snapshot: ${snapErr.message}`;
    const id = typeof snapshotId === "string" ? snapshotId : null;

    void emit({
      event: "shift_lifecycle settled",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity_type: "shift",
        entity_id: params.shift_id,
        data: {
          shift_id: params.shift_id,
          snapshot_id: id ?? undefined,
          idempotent_hit: false,
        },
      },
    });

    return JSON.stringify({ allowed: true, snapshot_id: id, idempotent: false });
  },
});
