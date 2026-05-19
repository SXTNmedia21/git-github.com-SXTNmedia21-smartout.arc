/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099), backed
 * by the ADR-0204 composition orchestrator.
 *
 * All shift_swap write tools MUST call this before mutating any domain table
 * via RPC (initiate_shift_swap, respond_to_shift_swap, cancel_shift_swap).
 *
 * Pre-migration (direct-RPC): called supabase.rpc("gate_action") directly.
 *
 * SS-4 (ADR-0340 P0.3 fold): the body now delegates to `gatedMutation()` —
 * the ADR-0204 composition orchestrator — rather than calling
 * `supabase.rpc("gate_action", ...)` directly. This mirrors
 * `packages/ai/src/capabilities/shift-lifecycle/gate.ts` lines 39+73.
 *
 * The wrapper signature + return shape are preserved so `tools.ts`
 * consumers are unchanged; an internal adapter maps
 * `ComposedGateOutcome` → the legacy `GateActionResult` shape.
 *
 * Pathway B (cascade data-rule) runs as part of the orchestrator call
 * with a sentinel `entity_type` engineered NOT to match any
 * framework_trigger, so the cascade step short-circuits to `applied`
 * with reason `no-active-framework` / `no-trigger-match` and NEVER
 * materialises a change_proposal. Two `gate_evaluation` audit rows are
 * written per call (correlated via `correlation_id` + `parent_evaluation_id`).
 * The real domain write remains the caller's responsibility — tools.ts
 * runs its own RPC call after callGateAction() returns.
 *
 * Feature flag: `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`. Default
 * flips TRUE on SS-4. When explicitly set to `false` the orchestrator
 * throws `not_implemented:`; this wrapper catches it and returns a
 * fail-closed `gate_action unavailable: <reason>` deny so capability tools
 * translate it into a user-visible error (rollback-safe kill switch).
 *
 * Fails CLOSED on RPC error — never default-allow. L-0066 / L-0097.
 *
 * Capability literals gated here (seeded by T0 migration):
 *   - shift_swap.request   (suggest / employee)
 *   - shift_swap.respond   (suggest / employee)
 *   - shift_swap.cancel    (confirm / employee — own only)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";
import { gatedMutation, type ComposedGateOutcome } from "../../gate/gatedMutation.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. swap_id). Keeps ADR-0101 four-eyes scoped
   *  per entity so one approval doesn't cover every swap. */
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
      // Sentinel Pathway B entity_type — engineered NEVER to match any
      // framework_trigger row. Pathway B short-circuits `applied`; no
      // change_proposal is materialised. SS-5 replaces this with the
      // tool's real entity_type + real proposed_data when the domain
      // write itself moves into the orchestrator's execute callback.
      entity_type: `__authority_shadow_${args.capability}__`,
      action: "create",
      proposed_data: {},
      current_data: null,
      approvers_present: args.approversPresent,
      // Shadow-style no-op execute. Legacy callers perform their own
      // domain write AFTER callGateAction() returns — this wrapper only
      // owns the authority decision. SS-5 eliminates this seam.
      execute: async () => ({ ok: true as const }),
    });
  } catch (err) {
    // Orchestrator feature flag OFF → throws `not_implemented:`. Treat
    // as a fail-closed RPC-unavailable deny so capability tools surface
    // the same "gate unreachable" UX they would for a real RPC error.
    // This is the rollback-safe kill switch.
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
//
// Preserves the legacy tool-facing shape while sourcing the decision
// from the ADR-0204 orchestrator. Five outcome branches map as follows:
//
//   ok:true (no proposal)        → allow=true  (authority passed; data-rule applied)
//   ok:true + proposal_id        → allow=true  (authority passed; cascade created a
//                                              proposal, but the sentinel guarantees
//                                              this never happens in SS-4 — defensive
//                                              mapping only, logged for observability)
//   ok:false, capability, !downgraded → allow=false  (hard capability deny)
//   ok:false, capability, downgraded  → allow=false + downgradeTo=<shadow.downgrade_to>
//   ok:false, data_rule          → allow=true  (Pathway A allowed; Pathway B blocked.
//                                              Sentinel shouldn't hit this in SS-4,
//                                              but defensive: preserve legacy
//                                              behaviour that the tool writes anyway
//                                              under the wrapper's original
//                                              authority-only contract.)
//   ok:false, not_implemented    → allow=false + reason="gate_action unavailable: ..."
// ─────────────────────────────────────────────────────────────────────

function adaptOutcome(outcome: ComposedGateOutcome, fallbackApprovers: string[]): GateActionResult {
  // Applied / proposed — both are `ok:true` from the orchestrator.
  if (outcome.ok === true) {
    if (outcome.proposal_id) {
      console.warn(
        `[gate-adapter:shift-swap] unexpected proposal_id=${outcome.proposal_id} for sentinel entity_type; treating authority as allowed`,
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

  // Deny path — three shapes.
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
    // Pathway A allowed; Pathway B blocked. With the SS-4 sentinel
    // this shouldn't occur, but if it does we honour the wrapper's
    // original contract (authority-only) and return allow=true so the
    // tool's own write proceeds — matching pre-migration behaviour.
    console.warn(
      `[gate-adapter:shift-swap] data_rule deny on sentinel entity_type — wrapper returns allow=true per legacy contract. reason=${outcome.reason}`,
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

  // denied_by === "capability" — surface four-eyes + downgrade.
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
