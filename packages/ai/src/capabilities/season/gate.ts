/**
 * Thin wrapper around the Postgres `gate_action` RPC (ADR-0099) for the
 * season capability family (ADR-0201).
 *
 * Mirrors `packages/ai/src/capabilities/journey/gate.ts` and
 * `packages/ai/src/capabilities/shift-lifecycle/gate.ts`. All season write
 * tools (season.create, season.set_revenue, season.save_playbook) MUST
 * call this before mutating any domain table (season, season_budget,
 * day_factor, hour_factor).
 *
 * Read-only tools (season.get_readiness, season.learn_factors) do NOT
 * invoke the gate — ADR-0196 Invariant 13 scopes gate enforcement to
 * DB-writing capabilities only (schedule + helpdesk_query read tools
 * establish the precedent).
 *
 * Per-capability gate.ts rather than a shared helper:
 *   Mirrors journey's local gate for per-surface channel defaults (e.g.
 *   read tools' voice-safety vs mutations' chat/system-only posture).
 *   Keeps test doubles local.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateActionArgs = {
  capability: string;
  channel: SessionChannel;
  actionType: string;
  approversPresent?: string[];
  /** Optional entity id (e.g. season_id). Keeps ADR-0101 four-eyes scoped
   * per entity so one approval doesn't cover every season mutation. */
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
  // pass a statically-known `args.capability` literal from the season
  // capability set (season.create, season.set_revenue, season.save_playbook).
  // Each literal has an engine_authority_config seed row — verified by
  // ADR-0189 CI parity on the caller side. This marker silences the parity
  // gate on the wrapper definition itself (which cannot statically resolve
  // `args.capability`) without widening default-allow exposure.
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
  // this into `gate_denied` for the user. L-0066 / L-0097.
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
