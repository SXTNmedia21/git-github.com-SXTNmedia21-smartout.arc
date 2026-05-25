/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099 §2) for the
 * training capability.
 *
 * Mirrors packages/ai/src/capabilities/guardian/gate.ts.
 *
 * All training read-side PII tools (getTeamReadiness — exposes display names
 * + completion percentages workspace-wide) MUST call this before returning
 * data. Per-employee read of own status (getMyTrainingStatus) is owner-
 * scoped and may skip the gate.
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * Closes cap-tools audit 2026-05-25 H-3 gap.
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
  // @authority-gate-ungated — thunk-wrapper. Callers pass static capability literals.
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
    // Fail closed — never default-allow on RPC error.
    return {
      allow: false,
      reason: `gate_action RPC error: ${error.message}`,
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: [],
      gateEvaluationId: null,
    };
  }

  return (
    (data as GateActionResult) ?? {
      allow: false,
      reason: "gate_action returned null",
      channelAllowed: false,
      downgradeTo: null,
      minRoleRequired: null,
      requiresFourEyes: false,
      approversNeeded: 0,
      approversPresent: [],
      gateEvaluationId: null,
    }
  );
}
