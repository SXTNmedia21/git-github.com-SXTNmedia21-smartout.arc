/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * `contract_intake` capability family.
 *
 * Mirrors `packages/ai/src/capabilities/shift-lifecycle/gate.ts` — the
 * template every mutation-capable capability in the agent layer uses.
 *
 * All contract-intake write tools (`submit_field_group`, `decline_intake`)
 * MUST call this before mutating any domain table. The RPC:
 *   - Reads engine_authority_config (level + min_role + requires_four_eyes).
 *   - Reads engine_process.allowed_channels when the action is a process step.
 *   - Writes one audit row to gate_evaluation (single source of truth).
 *
 * Why a per-capability gate.ts rather than a shared helper:
 *   `shift-lifecycle/gate.ts` and `journey/gate.ts` both live next to
 *   their tools so test doubles stay local; contract-intake follows the
 *   same shape. Allows the capability to diverge later (e.g. tighter
 *   four-eyes posture for banking vs identity) without editing unrelated
 *   capabilities.
 *
 * Phase A1 (campaign/botsson-arena): closes the live ADR-0099 violation
 * where `submit_field_group` and `decline_intake` previously wrote PII
 * directly without authority evaluation. ADR-0196 Invariant 13 explicitly
 * requires every capability mutation — including `autonomous` or
 * `suggest` defaults — to call `callGateAction` first; `autonomous` is
 * not a skip-the-gate license.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. profile_id for PII intake, contract_id for
   * decline). Enables ADR-0101 four-eyes to scope approvals per entity. */
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
  /* @authority-gate-ungated — forwarder: capability is passed through from caller.
     Concrete capability literals are asserted by authority-seed-parity at the call site. */
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: args.capability,
    p_channel: args.channel,
    p_actor_profile_id: actorProfileId,
    p_action_type: args.actionType,
    p_approvers_present: args.approversPresent ?? [actorProfileId],
    ...(args.entityId ? { p_entity_id: args.entityId } : {}),
  });

  // Phase 1 (ADR-0099) RPC may not be deployed in every environment yet.
  // Fail closed for write tools — the caller translates this into a
  // user-visible deny with a clear reason.
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
