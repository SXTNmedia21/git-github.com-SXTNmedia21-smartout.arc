/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * journey capability family (ADR-0173 / ADR-0176), backed by the
 * ADR-0204 composition orchestrator.
 *
 * All journey write tools MUST call this before mutating any domain
 * table (engine_state, engine_state_step, engine_missions, journey_version
 * transitions, etc.). Legacy semantics preserved:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * Why a per-capability gate.ts rather than a shared helper:
 *   The shift-lifecycle helper lives next to its tools so test doubles
 *   stay local; the journey family follows the same shape. All four
 *   per-cap gate.ts files disappear together in SS-5.
 *
 * M5.1 (run_guided runtime) binds this: council red-line R5.1-3 —
 * skipping `gate_action` for an `autonomous` capability default is
 * CVE-class per L-0097.
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
  /** Optional entity id (e.g. journey_version_id). Keeps ADR-0101
   * four-eyes scoped per entity so one approval doesn't cover every run. */
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
    // @authority-gate-ungated — thunk-wrapper. All callers of callGateAction()
    // pass a statically-known `args.capability` literal from the journey
    // capability set (journey.run_guided, journey.run_dev,
    // journey.publish_mission, journey.publish_guide). Each of those literals
    // has an engine_authority_config seed row — verified by the ADR-0189 CI
    // gate on the caller side.
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
    // Fail CLOSED — never default-allow on orchestrator error. The
    // caller translates this into `capability_disabled` for the user.
    // L-0066 / L-0097.
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
