/**
 * Gate helpers for the `task` capability (ADR-0298 Sortie 3).
 *
 * Mirrors packages/ai/src/capabilities/personal/gate.ts.
 * All task mutation tools MUST call gateTaskAction before any DB write.
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * Additional helper: resolveAssigneeWorkspaceMembership
 *   Used by task.create_session + task.create_day_ad_hoc to verify that
 *   a supplied assignee_profile_id belongs to the same workspace as the
 *   acting manager (ADR-0151 / L-0177 — fail-fast on mismatch, no silent fallback).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionChannel } from "../types.js";

export type GateTaskArgs = {
  /** e.g. 'task.create_personal' | 'task.create_session' | 'task.complete' | 'task.cancel_personal' */
  actionType: string;
  channel: SessionChannel;
  approversPresent?: string[];
  /** UUID of the entity being acted on (task id for complete/cancel) */
  entityId?: string;
};

export type GateTaskResult = {
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
 * Call the gate_action RPC for the task capability.
 *
 * p_capability is always 'task' — the action discriminator is in actionType
 * (e.g. 'task.create_personal', 'task.complete').
 *
 * Returns GateTaskResult; caller must check result.allow before proceeding.
 */
export async function gateTaskAction(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  actorProfileId: string,
  args: GateTaskArgs,
): Promise<GateTaskResult> {
  const { data, error } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: "task",
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

/**
 * Verify that a proposed assignee_profile_id belongs to the same workspace as the actor.
 *
 * Returns true when the assignee is an active profile in the workspace.
 * Returns false when the assignee is absent or belongs to a different workspace.
 *
 * Fail-fast contract (L-0177): callers must return an explicit error when this returns
 * false — never silently fall back to self-assign or allow a cross-workspace write.
 *
 * Used by task.create_session and task.create_day_ad_hoc.
 */
export async function resolveAssigneeWorkspaceMembership(
  supabaseAdmin: SupabaseClient,
  assigneeProfileId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profile")
    .select("profile_id")
    .eq("profile_id", assigneeProfileId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    // DB error — fail closed (same as gate fail-closed pattern).
    return false;
  }

  return data !== null;
}
