/**
 * Gate helpers for the `org` capability (ADR-0367 BT2).
 *
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099).
 * All org mutation tools MUST call gateOrgAction before any DB write.
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateOrgArgs = {
  /** e.g. 'org.update_dept_areas' */
  actionType: string;
  channel: SessionChannel;
  approversPresent?: string[];
  /** UUID of the entity being acted on (department_id) */
  entityId?: string;
};

export type GateOrgResult = {
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
 * Call the gate_action RPC for the org capability.
 *
 * p_capability is always 'org' — the action discriminator is in actionType
 * (e.g. 'org.update_dept_areas').
 *
 * Returns GateOrgResult; caller must check result.allow before proceeding.
 */
export async function gateOrgAction(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateOrgArgs,
): Promise<GateOrgResult> {
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: "org",
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
