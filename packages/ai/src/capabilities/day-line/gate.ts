/**
 * packages/ai/src/capabilities/day-line/gate.ts
 *
 * Gate helpers for the `day-line` capability (ADR-0367).
 *
 * All day-line mutation tools MUST call gateDayLineAction before any DB write.
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097 / ADR-0099).
 *
 * L-0177: workspace_id + actor_profile_id are always server-derived from
 * AgentToolContext. No fallback to body-supplied identity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateDayLineArgs = {
  /** e.g. 'day-line.create' | 'day-line.add_item' | 'day-line.instantiate_template' | 'day-line.update_hours' */
  actionType: string;
  channel: SessionChannel;
  approversPresent?: string[];
  /** UUID of the entity being acted on (day_line_id for update/add operations). Null on create (pre-insert). */
  entityId?: string;
};

export type GateDayLineResult = {
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
 * Call the gate_action RPC for the day-line capability.
 *
 * p_capability is always 'day-line' — the action discriminator is in actionType.
 * Returns GateDayLineResult; caller must check result.allow before proceeding.
 */
export async function gateDayLineAction(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateDayLineArgs,
): Promise<GateDayLineResult> {
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: "day-line",
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
