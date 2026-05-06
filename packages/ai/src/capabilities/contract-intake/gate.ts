/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * `contract_intake` capability family, backed by the ADR-0204
 * composition orchestrator.
 *
 * All contract-intake write tools (`submit_field_group`, `decline_intake`)
 * MUST call this before mutating any domain table. Legacy semantics
 * preserved:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * Why a per-capability gate.ts rather than a shared helper:
 *   `shift-lifecycle/gate.ts` and `journey/gate.ts` both live next to
 *   their tools so test doubles stay local; contract-intake follows the
 *   same shape. All four are deleted together in SS-5.
 *
 * Phase A1 (campaign/botsson-arena): closes the live ADR-0099 violation
 * where `submit_field_group` and `decline_intake` previously wrote PII
 * directly without authority evaluation. ADR-0196 Invariant 13 explicitly
 * requires every capability mutation — including `autonomous` or
 * `suggest` defaults — to call `callGateAction` first; `autonomous` is
 * not a skip-the-gate license.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): the body delegates to
 * `gatedMutation()` — the composition orchestrator — rather than calling
 * `supabase.rpc("gate_action", ...)` directly. Wrapper signature +
 * return shape preserved so `tools.ts` consumers are unchanged; internal
 * adapter maps `ComposedGateOutcome` → `GateActionResult`. See
 * shift-lifecycle/gate.ts for the full contract — the implementation is
 * identical across the four per-cap gate.ts files and will be unified
 * in SS-5 when tools.ts moves to call `gatedMutation()` directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";
import { gatedMutation, type ComposedGateOutcome } from "../../gate/gatedMutation.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. profile_id for PII intake, contract_id for
   * decline). Enables ADR-0101 four-eyes to scope approvals per entity. */
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
      // No-op execute — tools.ts performs its own domain write AFTER
      // callGateAction returns. SS-5 moves the write into execute and
      // deletes this wrapper.
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
