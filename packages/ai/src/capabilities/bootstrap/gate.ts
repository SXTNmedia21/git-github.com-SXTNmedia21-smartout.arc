/**
 * Gate helpers for the `bootstrap` capability (ADR-0407 Phase 1).
 *
 * Wraps the standard gate_action RPC for bootstrap tools.
 * All bootstrap mutation tools MUST call gateBootstrapAction before any DB write.
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * profile_id for write operations is ALWAYS sourced from AgentToolContext.profileId
 * (server-derived by the harness) — never accepted from request body (ADR-0151).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateBootstrapArgs = {
  /** e.g. 'bootstrap.close_bootstrap_gate' | 'bootstrap.skip_bootstrap_gate' */
  actionType: string;
  channel: SessionChannel;
  approversPresent?: string[];
};

export type GateBootstrapResult = {
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

/**
 * Call the gate_action RPC for the bootstrap capability.
 *
 * p_capability is always 'bootstrap' — the action discriminator is in actionType
 * (e.g. 'bootstrap.close_bootstrap_gate', 'bootstrap.skip_bootstrap_gate').
 *
 * Returns GateBootstrapResult; caller must check result.allow before proceeding.
 */
export async function gateBootstrapAction(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateBootstrapArgs,
): Promise<GateBootstrapResult> {
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: "bootstrap",
    p_channel: args.channel,
    p_actor_profile_id: actorProfileId,
    p_action_type: args.actionType,
    p_approvers_present: args.approversPresent ?? [actorProfileId],
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
