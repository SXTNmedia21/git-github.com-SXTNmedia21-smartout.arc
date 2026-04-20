"use server";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

/**
 * Resolves the active profile for the currently-authenticated user.
 * Server-side re-derivation per ADR-0151 — never trust profile_id from the
 * request body.
 */
export async function resolveCurrentProfile(): Promise<{
  profileId: string;
  workspaceId: string;
  role: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}

/**
 * Normalised return shape from `gate_action()` RPC. Matches the pattern
 * established in `apps/web/src/app/api/observer-requests/route.ts`.
 */
export type GateResult = {
  allow: boolean;
  reason: string | null;
  downgrade_to: string | null;
  min_role_required: string | null;
  channel_allowed: boolean;
  four_eyes_required: boolean;
  approvers_needed: number;
};

function normalizeGate(data: unknown): GateResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allow: row.allow === true,
    reason: (row.reason as string | null) ?? null,
    downgrade_to: (row.downgrade_to as string | null) ?? null,
    min_role_required: (row.min_role_required as string | null) ?? null,
    channel_allowed: row.channel_allowed !== false,
    four_eyes_required: row.four_eyes_required === true,
    approvers_needed: Number(row.approvers_needed ?? 0),
  };
}

/**
 * Call the `gate_action` RPC for canonical authority + channel enforcement
 * per ADR-0099. Server Actions treat `downgrade_to='suggest'` as denied
 * (Server Actions have no suggest-mode concept — they either execute or
 * return error). Default-allow still applies when no `engine_authority_config`
 * row exists for (workspace, capability) — seed rows via migration to
 * enforce role floors.
 */
export async function gateAction(args: {
  workspaceId: string;
  capability: string;
  channel: "chat" | "voice" | "system" | string;
  actorProfileId: string;
  actionType: string;
  entityId?: string;
}): Promise<
  | GateResult
  | {
      allow: false;
      reason: string;
      downgrade_to: null;
      min_role_required: null;
      channel_allowed: false;
      four_eyes_required: false;
      approvers_needed: 0;
    }
> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("gate_action", {
    p_workspace_id: args.workspaceId,
    p_capability: args.capability,
    p_channel: args.channel,
    p_actor_profile_id: args.actorProfileId,
    p_action_type: args.actionType,
    p_entity_id: args.entityId,
  });
  if (error) {
    return {
      allow: false,
      reason: `gate_action_rpc_error: ${error.message}`,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: false,
      four_eyes_required: false,
      approvers_needed: 0,
    };
  }
  return normalizeGate(data);
}
