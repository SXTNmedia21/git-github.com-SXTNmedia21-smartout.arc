/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099), backed
 * by the ADR-0204 composition orchestrator.
 *
 * All onboarding write tools MUST call this before mutating any domain
 * table. Mirrors shift-lifecycle/gate.ts:29 verbatim — same orchestrator
 * delegation pattern, same legacy GateActionResult shape.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): body delegates to `gatedMutation()`
 * rather than calling `supabase.rpc("gate_action", ...)` directly. The
 * wrapper signature + return shape are preserved so `tools.ts` consumers
 * are unchanged.
 *
 * Sentinel entity_type is `__authority_shadow_onboarding__` — engineered
 * NOT to match any framework_trigger, so Pathway B short-circuits to
 * `applied` with reason `no-trigger-match` and NEVER materialises a
 * change_proposal (same guarantee as shift-lifecycle). SS-5 moves the
 * domain write INTO the orchestrator's execute callback.
 *
 * Capability actions (ADR-0275 R4):
 *   - onboarding.update_business
 *   - onboarding.update_season
 *   - onboarding.add_departments
 *   - onboarding.add_locations
 *   - onboarding.add_zones
 *   - onboarding.add_procedures
 *   - onboarding.scrape_website        (read-only, no gate needed — included for completeness)
 *   - onboarding.search_company        (read-only bridge, no gate needed)
 *   - onboarding.identify_company      (read-only bridge, no gate needed)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";
import { gatedMutation, type ComposedGateOutcome } from "../../gate/gatedMutation.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id — enables per-entity four-eyes scoping. */
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
      entity_type: `__authority_shadow_${args.capability}__`,
      action: "create",
      proposed_data: {},
      current_data: null,
      approvers_present: args.approversPresent,
      execute: async () => ({ ok: true as const }),
    });
  } catch (err) {
    // Orchestrator feature flag OFF → throws `not_implemented:`. Treat
    // as a fail-closed deny so capability tools surface a user-visible
    // "gate unavailable" error (same kill-switch as shift-lifecycle).
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
// Adapter: ComposedGateOutcome → GateActionResult
// ─────────────────────────────────────────────────────────────────────

function adaptOutcome(outcome: ComposedGateOutcome, fallbackApprovers: string[]): GateActionResult {
  if (outcome.ok === true) {
    if (outcome.proposal_id) {
      console.warn(
        `[gate-adapter:onboarding] unexpected proposal_id=${outcome.proposal_id} for sentinel entity_type; treating authority as allowed`,
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
      `[gate-adapter:onboarding] data_rule deny on sentinel entity_type — wrapper returns allow=true per legacy contract. reason=${outcome.reason}`,
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
