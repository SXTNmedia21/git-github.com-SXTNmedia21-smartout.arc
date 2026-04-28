/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * tips capability family (ADR-0201 / ADR-0196).
 *
 * Mirrors `packages/ai/src/capabilities/availability/gate.ts` and
 * `packages/ai/src/capabilities/memory/gate.ts`. All tips write tools
 * MUST call this before any DB mutation. The RPC:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * ADR-0196 Invariant 13 — every capability mutation (including `suggest`
 * or `autonomous` defaults) MUST call callGateAction first. `autonomous`
 * is not a skip-the-gate license.
 *
 * Per-capability gate.ts (not shared helper): keeps test doubles local and
 * lets the tips family diverge later without editing unrelated capabilities.
 *
 * Fail-CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * Authority rows seeded in migration 20260428100007_tips_authority_seed.sql.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. pool_id or distribution_id).
   *  Keeps ADR-0101 four-eyes scoped per entity. */
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
  // pass a statically-known `args.capability` literal from the tips capability
  // set (tips.set_pot, tips.adjust_share, tips.approve_distribution,
  // tips.query_own_share). Each literal has an engine_authority_config seed
  // row — verified by scripts/authority-seed-parity.ts. This marker silences
  // the parity gate on the wrapper definition itself (which cannot statically
  // resolve `args.capability`) without widening default-allow exposure.
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: args.capability,
    p_channel: args.channel,
    p_actor_profile_id: actorProfileId,
    p_action_type: args.actionType,
    p_approvers_present: args.approversPresent ?? [actorProfileId],
    ...(args.entityId ? { p_entity_id: args.entityId } : {}),
  });

  // Fail CLOSED — never default-allow on RPC error.
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
