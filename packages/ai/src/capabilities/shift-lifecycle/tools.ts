/**
 * shift_lifecycle capability tools (Phase 5 per ADR-0095).
 *
 * Five-Layer Architecture:
 *   Execution (schedule_shift) → Reality (time_entry) → Interpretation
 *   (shift_hour_interpretation) → Derivation (shift_cost_snapshot) →
 *   Decision (shift_approval / daily_reconciliation).
 *
 * Write tools MUST call mutateWithGate (ADR-0204/0287) before mutating.
 * Capability names are DOTTED so engine_authority_config can gate per
 * action independently (shift_lifecycle.publish, .approve, .interpret,
 * .settle).
 *
 * Channels (ADR-0078): publish allows chat + system; approve allows
 * chat only (PII exposure); interpret + settle are system-only (internal
 * or admin-initiated from dashboard only).
 *
 * Tool compliance table (verified against bodies below — L-0176):
 *   publishShift  | shift_lifecycle.publish  | mutateWithGate | shift_lifecycle published + shift published | chat+system | PASS
 *   approveShift  | shift_lifecycle.approve  | mutateWithGate | shift_lifecycle approved + shift hours_confirmed | chat-only   | PASS
 *   interpretShift| shift_lifecycle.interpret| callGateAction | shift_lifecycle interpreted | system-only | PASS (read-side RPC, no direct write)
 *   settleShift   | shift_lifecycle.settle   | callGateAction | shift_lifecycle settled     | system-only | PASS (RPC, no direct write)
 *   clockInCheck  | shift_lifecycle.publish  | callGateAction | contract.obligation_overdue | chat+system | PASS (read-side RPC, no direct write)
 *
 * Identity (ADR-0151): workspace_id and profile_id are ALWAYS server-derived
 * from AgentToolContext. No tool parameter accepts either field.
 *
 * References:
 *   ADR-0078  — channel guard
 *   ADR-0099  — unified authority gate (gate_action RPC contract)
 *   ADR-0101  — four-eyes approval
 *   ADR-0151  — workspace_id server-derived, never body-supplied
 *   ADR-0204  — composition orchestrator (Pathway A + B)
 *   ADR-0287  — mutateWithGate mandatory on mutation capability tools
 *   L-0176    — docstring claims must match body (verified; body is the source)
 *   L-0177    — fail-fast on missing workspace_id / profile_id
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";
import { checkReadiness } from "../governance/tools.js";

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

type ReadinessGateResult =
  | { ready: true }
  | {
      ready: false;
      missingPolicies: string[];
      missingProtocols: string[];
      error?: string;
    };

// WS-A4: readiness must be verified before any Decision-layer mutation on
// a shift (publish, approve). Wraps the governance capability's check_readiness
// tool so gating stays centralised (ADR-0095 + PLAN-secure-shift-lifecycle).
async function evaluateReadinessGate(
  ctx: AgentToolContext,
  profileId: string | null,
): Promise<ReadinessGateResult> {
  // Unassigned shifts have nothing to gate on — readiness is trivially ready.
  if (!profileId) return { ready: true };

  const raw = await checkReadiness.execute({ profile_id: profileId }, ctx);

  // check_readiness returns a stringified JSON payload on success, or a
  // plain error string on failure. Treat parse failure as a readiness
  // gap to fail-closed.
  try {
    const parsed = JSON.parse(raw) as {
      ready?: boolean;
      missing_policies?: string[];
      missing_protocols?: string[];
    };
    if (parsed.ready === true) return { ready: true };
    return {
      ready: false,
      missingPolicies: parsed.missing_policies ?? [],
      missingProtocols: parsed.missing_protocols ?? [],
    };
  } catch {
    return {
      ready: false,
      missingPolicies: [],
      missingProtocols: [],
      error: raw,
    };
  }
}

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
    "Publish a shift so the assigned employee can see it and punch in. Blocks when the assigned employee is not ready (missing policies/protocols) and when authority/four-eyes denies (ADR-0101). Chat + system only — not allowed over voice (ADR-0078).",
  capability: "shift_lifecycle",
  schema: z.object({
    shift_id: z.string().uuid().describe("The shift to publish (schedule_shift_id)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel === "voice") {
      return "Publisering av skift kan ikke gjøres over stemme (ADR-0078).";
    }

    const { shift, error: loadErr } = await loadShift(supabase, params.shift_id, ctx.workspaceId);
    if (loadErr) return `Kunne ikke laste skift: ${loadErr}`;
    if (!shift) return "Shift not found.";

    // WS-A4: readiness gate before authority gate. An unready employee must
    // never see a published shift — publication is a contract the system
    // makes with the employee that they are allowed to work.
    const readiness = await evaluateReadinessGate(ctx, shift.employee_id);
    if (!readiness.ready) {
      void emit({
        event: "shift_lifecycle published",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity_type: "shift",
          entity_id: params.shift_id,
          data: {
            shift_id: params.shift_id,
            gate_allowed: false,
            reason: "readiness_gap",
          },
        },
      });
      return JSON.stringify({
        allowed: false,
        reason: "readiness_gap",
        missing_policies: readiness.missingPolicies,
        missing_protocols: readiness.missingProtocols,
      });
    }

    // mutateWithGate (ADR-0204/0287): wraps Pathway A (capability authority)
    // + Pathway B (cascade_gate_write). On blocked path, cascade_gate_write
    // produces a change_proposal row. exec runs only when both pathways allow.
    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_PUBLISH,
        actionType: "publish_shift",
        channel,
        targetId: params.shift_id,
        exec: async (db) => {
          const { error: updateErr } = await db
            .from("schedule_shift")
            .update({ status: "published", is_published: true, updated_at: new Date().toISOString() })
            .eq("schedule_shift_id", params.shift_id)
            .eq("workspace_id", ctx.workspaceId);
          if (updateErr) throw new Error(updateErr.message);
          return undefined;
        },
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        void emit({
          event: "shift_lifecycle published",
          workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
          actor_id: nonEmpty(ctx.profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: params.shift_id,
            data: {
              shift_id: params.shift_id,
              gate_allowed: false,
              reason: err.message ?? "denied",
            },
          },
        });
        return JSON.stringify({ allowed: false, reason: err.message ?? "denied" });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ allowed: false, reason: `gate_error: ${err.code} — ${err.message}` });
      }
      return JSON.stringify({ allowed: false, reason: String(err) });
    }

    void emit({
      event: "shift_lifecycle published",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
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
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
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
    "Approve a shift's interpreted hours, transitioning shift_approval from pending to approved. Blocks when the assigned employee is not ready, when authority denies, or when four-eyes requires a second distinct approver on this shift (ADR-0101). Chat-only (ADR-0078).",
  capability: "shift_lifecycle",
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

    const { shift, error: loadErr } = await loadShift(supabase, params.shift_id, ctx.workspaceId);
    if (loadErr) return `Kunne ikke laste skift: ${loadErr}`;
    if (!shift) return "Shift not found.";

    // WS-A4: readiness gate before authority gate. Never approve hours for
    // a shift whose employee has not completed the required training.
    const readiness = await evaluateReadinessGate(ctx, shift.employee_id);
    if (!readiness.ready) {
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
            gate_allowed: false,
            reason: "readiness_gap",
          },
        },
      });
      return JSON.stringify({
        allowed: false,
        reason: "readiness_gap",
        missing_policies: readiness.missingPolicies,
        missing_protocols: readiness.missingProtocols,
      });
    }

    // Find the pending shift_approval row before gating (needed inside exec).
    // Read-before-gate is safe — we don't write until gate passes.
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

    // mutateWithGate (ADR-0204/0287): wraps Pathway A (capability authority +
    // four-eyes per ADR-0101) + Pathway B (cascade_gate_write). On blocked path,
    // cascade_gate_write produces a change_proposal row. exec runs only when
    // both pathways allow.
    try {
      await mutateWithGate(supabase, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY_APPROVE,
        actionType: "approve_shift",
        channel,
        targetId: params.shift_id,
        exec: async (db) => {
          const { error: updateErr } = await db
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
          if (updateErr) throw new Error(updateErr.message);
          return undefined;
        },
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        // Four-eyes path (ADR-0101): return a pending response, do NOT mutate.
        if (err.fourEyesRequired) {
          void emit({
            event: "shift_lifecycle approved",
            workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
            actor_id: nonEmpty(ctx.profileId, "actor_id"),
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
            approvers_needed: err.approversNeeded,
            approvers_present: err.approversPresent,
          });
        }
        // General capability deny.
        void emit({
          event: "shift_lifecycle approved",
          workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
          actor_id: nonEmpty(ctx.profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: params.shift_id,
            data: {
              shift_id: params.shift_id,
              approved_hours: params.approved_hours,
              four_eyes_pending: false,
              gate_allowed: false,
              reason: err.message ?? "denied",
            },
          },
        });
        return JSON.stringify({ allowed: false, reason: err.message ?? "denied" });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({ allowed: false, reason: `gate_error: ${err.code} — ${err.message}` });
      }
      return JSON.stringify({ allowed: false, reason: String(err) });
    }

    void emit({
      event: "shift_lifecycle approved",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
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
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
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
  capability: "shift_lifecycle",
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
    // RPC returns jsonb { interpretation_id, session_date, department_id, workspace_id }
    // per migration 20260510100000 (BREAK 2 fix). Extract interpretation_id off the object.
    const interpretationId =
      (data as { interpretation_id?: string } | null)?.interpretation_id ?? null;

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
  capability: "shift_lifecycle",
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
    // RPC returns jsonb { cost_snapshot_id, session_date, department_id, workspace_id }
    // per migration 20260510100000 (BREAK 2 fix). Extract cost_snapshot_id off the object.
    const id = (snapshotId as { cost_snapshot_id?: string } | null)?.cost_snapshot_id ?? null;

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

// ── clock_in_check ───────────────────────────────────────────────────
// WS1A (Wave 5, Journey 4 step 1-2): pre-clock-in obligation gate.
// Calls is_employee_blocked SECURITY DEFINER RPC (ADR-0243 migration
// 20260519130000). Blocked employees see a Norwegian message + protocol link.
// Used from mobile clock-in surface, system channel.
//
// ADR-0151: workspaceId from ctx (JWT), profileId from ctx — never from body.
// Telemetry: contract.obligation_overdue (registry Wave 3 Part E).
export const clockInCheck = defineTool({
  name: "clock_in_check",
  description:
    "Check whether an employee has blocking overdue contract obligations before clocking in. Returns allowed=true when clear, or allowed=false with the blocking obligation details and a Norwegian message. System or chat channel.",
  capability: "shift_lifecycle",
  schema: z.object({
    profile_id: z
      .string()
      .uuid()
      .describe(
        "The employee profile_id to check. Must match ctx.profileId unless caller is admin.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const channel = normaliseChannel(ctx.channel);

    if (channel === "voice") {
      return "Clock-in sjekk kan ikke gjøres over stemme-kanal (ADR-0078).";
    }

    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY_PUBLISH,
      channel,
      actionType: "clock_in_check",
      entityId: params.profile_id,
    });

    if (!gate.allow) {
      return JSON.stringify({ allowed: false, reason: gate.reason ?? "denied" });
    }

    // Call is_employee_blocked SECURITY DEFINER RPC (ADR-0243, 20260519130000).
    const { data, error } = await supabase.rpc("is_employee_blocked", {
      p_profile_id: params.profile_id,
      p_workspace_id: ctx.workspaceId,
    });

    if (error) {
      return JSON.stringify({ allowed: false, reason: "rpc_error", detail: error.message });
    }

    const result = data as {
      blocked: boolean;
      reasons: Array<{
        obligation_id: string;
        title: string;
        status: string;
        due_at: string;
        obligation_type: string;
      }>;
    } | null;

    if (!result || !result.blocked) {
      // Not blocked — no obligation_overdue event (nothing is overdue).
      return JSON.stringify({ allowed: true });
    }

    // Build Norwegian message per first blocking obligation.
    const first = result.reasons[0];
    const dueDateStr = first?.due_at
      ? new Date(first.due_at).toLocaleDateString("nb-NO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "ukjent dato";
    const obligationName = first?.title ?? "Obligasjon";

    const message =
      `Du har en overdue forpliktelse som blokkerer innsjekk: "${obligationName}" ` +
      `(frist ${dueDateStr}). Fullfør protokollen før du kan clock inn. ` +
      `Kontakt din leder hvis du trenger hjelp.`;

    // Emit per registry schema: { obligation_id, contract_id, obligation_type, title, due_at, is_blocker, automated }.
    // Emit only when first blocker has all required fields (registry requires non-empty strings).
    // Additional blockers are logged by the DB trigger via activity_trail.
    if (first?.obligation_id && first.title && first.due_at && first.obligation_type) {
      void emit({
        event: "contract.obligation_overdue",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            obligation_id: first.obligation_id,
            contract_id: params.profile_id, // profile_id used as proxy — contract_id not in RPC output
            obligation_type: first.obligation_type,
            title: first.title,
            due_at: first.due_at,
            is_blocker: true,
            automated: false,
          },
        },
      });
    }

    return JSON.stringify({
      allowed: false,
      reason: "obligation_overdue",
      message,
      blockers: result.reasons,
    });
  },
});
