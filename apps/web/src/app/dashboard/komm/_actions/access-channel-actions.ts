"use server";

/**
 * access-channel-actions.ts — Server Action for channel access scope materialisation.
 *
 * After CreateChannel creates the channel, this action expands the AccessScope
 * into concrete channel_member rows.
 *
 * Scope kinds:
 *   - workspace: no-op — channel is visible workspace-wide by default RLS
 *   - departments: expand profiles via profile.department_id, upsert channel_member
 *   - teams: expand profiles via team_member.profile_id, upsert channel_member
 *   - people: directly upsert listed profile_ids
 *
 * Architecture:
 *   - ADR-0151: workspace_id resolved from JWT profile, never from request body
 *   - Admin client for writes (bypasses channel_jwt_update RLS narrowing)
 *   - Zod validation on input
 *   - Telemetry: channel.access_scope_set on every non-workspace mutation
 */

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type ActionOk = { ok: true; member_count: number };
type ActionErr = { ok: false; error: string };

// ── Zod schema ───────────────────────────────────────────────────────────────

const AccessScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace") }),
  z.object({ kind: z.literal("departments"), department_ids: z.array(z.string().uuid()) }),
  z.object({ kind: z.literal("teams"), team_ids: z.array(z.string().uuid()) }),
  z.object({ kind: z.literal("people"), profile_ids: z.array(z.string().uuid()) }),
]);

const SetChannelAccessScopeSchema = z.object({
  channel_id: z.string().uuid(),
  scope: AccessScopeSchema,
});

// ── Auth helper ───────────────────────────────────────────────────────────────

async function resolveAdminContext(
  supabase: Client,
): Promise<
  | { ok: true; profileId: string; workspaceId: string; companyId: string; userId: string }
  | { ok: false; error: string }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return { ok: false, error: "No active profile." };

  const { data: workspaceRow } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", profile.workspace_id)
    .single();

  if (!workspaceRow?.company_id) {
    return { ok: false, error: "Workspace has no company." };
  }

  const { data: member } = await supabase
    .from("company_member")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", workspaceRow.company_id)
    .maybeSingle();

  const isAdmin = member?.role === "owner" || member?.role === "admin";
  if (!isAdmin) return { ok: false, error: "Admin privileges required." };

  return {
    ok: true,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    companyId: workspaceRow.company_id,
    userId: user.id,
  };
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function upsertMembers(
  admin: Client,
  channelId: string,
  workspaceId: string,
  profileIds: string[],
): Promise<number> {
  if (profileIds.length === 0) return 0;

  const rows = profileIds.map((profile_id) => ({
    channel_id: channelId,
    workspace_id: workspaceId,
    profile_id,
    role: "member" as const,
  }));

  await admin.from("channel_member").upsert(rows, {
    onConflict: "channel_id,profile_id",
    ignoreDuplicates: true,
  });

  return rows.length;
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function setChannelAccessScope(input: unknown): Promise<ActionOk | ActionErr> {
  const parsed = SetChannelAccessScopeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { channel_id, scope } = parsed.data;

  // workspace scope = no-op: channel is already visible to all workspace members via RLS
  if (scope.kind === "workspace") {
    return { ok: true, member_count: 0 };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const admin = createAdminClient();

  let profileIds: string[] = [];

  if (scope.kind === "people") {
    profileIds = scope.profile_ids;
  } else if (scope.kind === "departments") {
    // Expand: all active profiles in selected departments within this workspace
    const { data: profiles } = await admin
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", ctx.workspaceId)
      .in("department_id", scope.department_ids)
      .in("status", ["active", "trainee"]);
    profileIds = (profiles ?? []).map((p) => p.profile_id);
  } else if (scope.kind === "teams") {
    // Expand: all profiles in selected teams via team_member join
    const { data: teamMembers } = await admin
      .from("team_member")
      .select("profile_id")
      .in("team_id", scope.team_ids)
      .is("left_at", null);
    profileIds = [...new Set((teamMembers ?? []).map((tm) => tm.profile_id))];
  }

  const memberCount = await upsertMembers(admin, channel_id, ctx.workspaceId, profileIds);

  await emit({
    event: "channel.access_scope_set",
    actor_id: nonEmpty(ctx.profileId, "profile_id"),
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    entity: { entity_type: "channel", entity_id: channel_id },
    properties: {
      channel_id,
      scope_kind: scope.kind,
      member_count: memberCount,
    },
  });

  return { ok: true, member_count: memberCount };
}
