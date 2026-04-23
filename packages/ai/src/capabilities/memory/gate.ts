/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * `memory` capability, backed by the ADR-0204 composition orchestrator.
 *
 * All memory write tools (currently `save_memory`) MUST call this before
 * mutating engine_memory. Legacy semantics preserved:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * Per-capability gate.ts files are intentional: test doubles stay local,
 * and each capability may diverge later. All four per-cap gate.ts
 * disappear together in SS-5 when tools.ts moves to call `gatedMutation()`
 * directly.
 *
 * SS-1 (Council 2026-04-23, ADR-0203 + ADR-0204): closed the phantom-
 * capability landmine where `tools.ts` previously called `gate_action`
 * inline and dropped `four_eyes_required`, `approvers_needed`,
 * `approvers_present`, and `gate_evaluation_id`. If a workspace had set
 * `memory.requires_four_eyes=true`, the inline call silently denied with
 * prose — no approver flow, no retry — violating ADR-0196 Invariant 11.
 *
 * ADR-0196 Invariant 13 — every capability mutation (including `suggest`
 * or `autonomous` defaults) MUST call `callGateAction` first. `autonomous`
 * is not a skip-the-gate license.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): the body delegates to
 * `gatedMutation()` rather than calling `supabase.rpc("gate_action", ...)`
 * directly. Wrapper signature + return shape preserved; internal adapter
 * maps `ComposedGateOutcome` → `GateActionResult`. See
 * shift-lifecycle/gate.ts for the full contract.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";
import { gatedMutation, type ComposedGateOutcome } from "../../gate/gatedMutation.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. profile_id for personal memories). Enables
   *  ADR-0101 four-eyes to scope approvals per entity so one approval
   *  doesn't blanket every profile's memory writes. */
  entityId?: string;
};

export type GateActionResult = {
  allow: boolean;
  reason: string | null;
  channelAllowed: boolean;
  downgradeTo: string | null;
  minRoleRequired: string | null;
  requiresFourEyes: boolean;
  approversNeeded: number;
  approversPresent: string[];
  gateEvaluationId: string | null;
};

export async function callGateAction(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateActionArgs,
): Promise<GateActionResult> {
  const fallbackApprovers = args.approversPresent ?? [actorProfileId];

  let outcome: ComposedGateOutcome;
  try {
    outcome = await gatedMutation(supabaseAdmin, {
      workspace_id: workspaceId,
      actor_profile_id: actorProfileId,
      capability: args.capability,
      channel: args.channel,
      action_type: args.actionType,
      entity_id: args.entityId ?? null,
      // Sentinel Pathway B entity_type — cannot match any
      // framework_trigger row. Pathway B short-circuits `applied`.
      entity_type: `__authority_shadow_${args.capability}__`,
      action: "create",
      proposed_data: {},
      current_data: null,
      approvers_present: args.approversPresent,
      execute: async () => ({ ok: true as const }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      allow: false,
      reason: `gate_action unavailable: ${message}`,
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: fallbackApprovers,
      gateEvaluationId: null,
    };
  }

  return adaptOutcome(outcome, fallbackApprovers);
}

// ─────────────────────────────────────────────────────────────────────
// Adapter — identical to shift-lifecycle/gate.ts. Unified in SS-5.
// ─────────────────────────────────────────────────────────────────────

function adaptOutcome(outcome: ComposedGateOutcome, fallbackApprovers: string[]): GateActionResult {
  if (outcome.ok === true) {
    if (outcome.proposal_id) {
      console.warn(
        `[gate-adapter] unexpected proposal_id=${outcome.proposal_id} for sentinel entity_type; treating authority as allowed`,
      );
    }
    return {
      allow: true,
      reason: outcome.reason ?? null,
      channelAllowed: true,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: fallbackApprovers,
      gateEvaluationId: outcome.gate_evaluation_id || null,
    };
  }

  if (outcome.denied_by === "not_implemented") {
    return {
      allow: false,
      reason: `gate_action unavailable: ${outcome.reason}`,
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: fallbackApprovers,
      gateEvaluationId: outcome.gate_evaluation_id ?? null,
    };
  }

  if (outcome.denied_by === "data_rule") {
    console.warn(
      `[gate-adapter] data_rule deny on sentinel entity_type — wrapper returns allow=true per legacy contract. reason=${outcome.reason}`,
    );
    return {
      allow: true,
      reason: null,
      channelAllowed: true,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: fallbackApprovers,
      gateEvaluationId: outcome.gate_evaluation_id ?? null,
    };
  }

  // denied_by === "capability"
  const downgradeTo =
    outcome.downgraded === true && typeof outcome.downgrade_to === "string"
      ? outcome.downgrade_to
      : null;

  return {
    allow: false,
    reason: outcome.reason,
    channelAllowed: true,
    downgradeTo,
    minRoleRequired: null,
    requiresFourEyes: outcome.four_eyes_required === true,
    approversNeeded: outcome.approvers_needed ?? 0,
    approversPresent: outcome.approvers_present ?? fallbackApprovers,
    gateEvaluationId: outcome.gate_evaluation_id ?? null,
  };
}
