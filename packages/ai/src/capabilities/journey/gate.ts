/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * journey capability family (ADR-0173 / ADR-0176).
 *
 * Mirrors `packages/ai/src/capabilities/shift-lifecycle/gate.ts`. All
 * journey write tools MUST call this before mutating any domain table
 * (engine_state, engine_state_step, engine_missions, journey_version
 * transitions, etc.). The RPC:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * Why a per-capability gate.ts rather than a shared helper:
 *   The shift-lifecycle helper lives next to its tools so test doubles
 *   stay local; the journey family follows the same shape so it can
 *   diverge later (e.g. per-surface channel defaults for run_guided vs
 *   publish_mission) without editing unrelated capabilities.
 *
 * M5.1 (run_guided runtime) binds this: council red-line R5.1-3 —
 * skipping `gate_action` for an `autonomous` capability default is
 * CVE-class per L-0097.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

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
  // @authority-gate-ungated — thunk-wrapper. All callers of callGateAction()
  // pass a statically-known `args.capability` literal from the journey
  // capability set (journey.run_guided, journey.run_dev,
  // journey.publish_mission, journey.publish_guide). Each of those literals
  // has an engine_authority_config seed row — verified by the ADR-0189 CI
  // gate on the caller side. This marker silences the parity gate on the
  // wrapper definition itself (which cannot statically resolve `args.capability`)
  // without widening default-allow exposure.
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
  // Fail CLOSED — never default-allow on RPC error. The caller translates
  // this into `capability_disabled` for the user. L-0066 / L-0097.
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
