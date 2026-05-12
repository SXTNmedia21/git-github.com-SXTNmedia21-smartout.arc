/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * `communication` capability.
 *
 * All communication mutation tools (currently `sendMessage`) MUST call this
 * before writing to channel_message. Enforces:
 *   - engine_authority_config evaluation per (workspace_id, capability).
 *   - Channel restriction per ADR-0078 / ADR-0163 voice-channel-guard.
 *     Distinct from the inner `isAiAllowedInChannel` policy layer (Layer 2):
 *     the gate is Layer 0 (authority), isAiAllowedInChannel is Layer 3
 *     (channel AI policy). Both MUST pass independently.
 *   - Four-eyes and downgrade-to-suggest flows per ADR-0099 / ADR-0196
 *     Invariant 13 (generalised to all capabilities by ADR-0287).
 *
 * Per-capability gate.ts files are intentional (ADR-0287): test doubles stay
 * local, action_type defaults can specialise, and each capability's gate
 * can diverge independently. All per-cap gate.ts files converge to a shared
 * `gatedMutation()` helper in a future unification step.
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * References:
 *   ADR-0099 — unified authority gate (gate_action RPC contract)
 *   ADR-0163 — channel allowedChannels + AI participation policy
 *   ADR-0287 — gate_action mandatory on all mutation capability tools
 *   L-0066   — default-allow capability authority = CVE-class trap
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
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
  // @authority-gate-ungated — thunk-wrapper. Callers pass a static `args.capability`
  // literal seeded by the communication capability authority seed migration.
  // This is the gate itself — not a bypass. ADR-0287 requires this call to
  // appear BEFORE any INSERT / UPDATE / DELETE in the wrapping execute().
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: args.capability,
    p_channel: args.channel,
    p_actor_profile_id: actorProfileId,
    p_action_type: args.actionType,
    p_approvers_present: args.approversPresent ?? [actorProfileId],
    ...(args.entityId ? { p_entity_id: args.entityId } : {}),
  });

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
