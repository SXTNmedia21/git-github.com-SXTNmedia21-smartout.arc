/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * shift_swap capability family (ADR-0173 / ADR-0176).
 *
 * Mirrors `packages/ai/src/capabilities/shift-lifecycle/gate.ts` and
 * `packages/ai/src/capabilities/journey/gate.ts`. All shift_swap write
 * tools MUST call this before mutating any domain table via RPC
 * (initiate_shift_swap, respond_to_shift_swap, cancel_shift_swap).
 *
 * Fails CLOSED on RPC error — never default-allow. L-0066 / L-0097.
 *
 * Capability literals gated here (seeded by Task A migration):
 *   - shift_swap.request   (suggest / employee)
 *   - shift_swap.respond   (suggest / employee)
 *   - shift_swap.cancel    (confirm / employee — own only)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

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
  // @authority-gate-ungated — thunk-wrapper. All callers of callGateAction()
  // pass a statically-known `args.capability` literal from the shift_swap
  // capability set (shift_swap.request, shift_swap.respond, shift_swap.cancel).
  // Each literal has an engine_authority_config seed row — verified by the
  // ADR-0189 authority-seed-parity CI gate on the caller side.
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: args.capability,
    p_channel: args.channel,
    p_actor_profile_id: actorProfileId,
    p_action_type: args.actionType,
    p_approvers_present: args.approversPresent ?? [actorProfileId],
    ...(args.entityId ? { p_entity_id: args.entityId } : {}),
  });

  // Phase 1 (ADR-0099) RPC may not be deployed in the target environment.
  // Fail CLOSED — never default-allow on RPC error. L-0066 / L-0097.
  if (error) {
    return {
      allow: false,
      reason: `gate_action unavailable: ${error.message}`,
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: args.approversPresent ?? [actorProfileId],
      gateEvaluationId: null,
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const approversPresent = Array.isArray(row.approvers_present)
    ? (row.approvers_present as string[])
    : (args.approversPresent ?? [actorProfileId]);

  return {
    allow: row.allow === true,
    reason: (row.reason as string) ?? null,
    channelAllowed: row.channel_allowed !== false,
    downgradeTo: (row.downgrade_to as string) ?? null,
    minRoleRequired: (row.min_role_required as string) ?? null,
    requiresFourEyes: row.four_eyes_required === true,
    approversNeeded: Number(row.approvers_needed ?? 0),
    approversPresent,
    gateEvaluationId: (row.gate_evaluation_id as string) ?? null,
  };
}
