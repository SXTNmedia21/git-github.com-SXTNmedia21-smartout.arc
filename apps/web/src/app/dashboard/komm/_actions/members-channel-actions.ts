"use server";

/**
 * members-channel-actions.ts — Server Actions for MedlemmerTab
 *
 * Covers: add member, remove member, change member role.
 * All writes require workspace-admin.
 *
 * Architecture notes:
 *   - Reads through JWT client for workspace-scope validation.
 *   - Writes through admin client to bypass channel_jwt_update narrowing.
 *   - ADR-0151: workspace_id resolved from JWT profile, not body.
 *   - L-0080 pattern: remove = set left_at timestamp (soft delete), not hard
 *     DELETE. Preserves message authorship + channel membership history.
 *   - Telemetry: channel.member_removed, channel.member_added,
 *     channel.member_role_changed on every mutation.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Database } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type ActionOk = { ok: true };
type ActionErr = { ok: false; error: string };
type ChannelMemberRole = Database["public"]["Enums"]["channel_member_role"];

// ── Shared auth helper ──────────────────────────────────────────────────────

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

// ── 1. addChannelMember ─────────────────────────────────────────────────────

const addMemberSchema = z.object({
  channel_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role: z.enum(["member", "admin", "representative"]).default("member"),
});

export async function addChannelMember(
  input: z.infer<typeof addMemberSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  // Validate channel belongs to this workspace
  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  // Validate target profile belongs to this workspace and is active
  const { data: targetProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, is_active, display_name")
    .eq("profile_id", parsed.data.profile_id)
    .maybeSingle();

  if (!targetProfile || !targetProfile.is_active) {
    return { ok: false, error: "Profile not found or not active." };
  }
  if (targetProfile.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Profile belongs to a different workspace." };
  }

  const admin = createAdminClient();

  // Upsert: if they left (left_at set), re-add them. If already a member,
  // update the role. onConflict on channel_id,profile_id.
  const { error: upsertErr } = await admin.from("channel_member").upsert(
    {
      channel_id: parsed.data.channel_id,
      workspace_id: ctx.workspaceId,
      profile_id: parsed.data.profile_id,
      role: parsed.data.role as ChannelMemberRole,
      left_at: null,
    },
    { onConflict: "channel_id,profile_id" },
  );

  if (upsertErr) return { ok: false, error: `Kunne ikke legge til medlem: ${upsertErr.message}` };

  await emit({
    event: "channel.member_added",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      added_profile_id: parsed.data.profile_id,
      role: parsed.data.role,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 2. removeChannelMember ──────────────────────────────────────────────────

const removeMemberSchema = z.object({
  channel_id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export async function removeChannelMember(
  input: z.infer<typeof removeMemberSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  const admin = createAdminClient();

  // L-0080 pattern: soft delete via left_at, never hard DELETE
  const { error: updateErr } = await admin
    .from("channel_member")
    .update({ left_at: new Date().toISOString() })
    .eq("channel_id", parsed.data.channel_id)
    .eq("profile_id", parsed.data.profile_id)
    .is("left_at", null);

  if (updateErr) return { ok: false, error: `Kunne ikke fjerne medlem: ${updateErr.message}` };

  await emit({
    event: "channel.member_removed",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      removed_profile_id: parsed.data.profile_id,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}

// ── 3. changeChannelMemberRole ──────────────────────────────────────────────

const changeMemberRoleSchema = z.object({
  channel_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  new_role: z.enum(["member", "admin", "representative"]),
});

export async function changeChannelMemberRole(
  input: z.infer<typeof changeMemberRoleSchema>,
): Promise<ActionOk | ActionErr> {
  const parsed = changeMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveAdminContext(supabase);
  if (!ctx.ok) return ctx;

  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, name")
    .eq("id", parsed.data.channel_id)
    .maybeSingle();

  if (!channel) return { ok: false, error: "Channel not found." };
  if (channel.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Channel belongs to a different workspace." };
  }

  // Fetch current role so we can detect no-ops and emit a meaningful diff
  const admin = createAdminClient();
  const { data: existingMember } = await admin
    .from("channel_member")
    .select("role")
    .eq("channel_id", parsed.data.channel_id)
    .eq("profile_id", parsed.data.profile_id)
    .is("left_at", null)
    .maybeSingle();

  if (!existingMember) {
    return { ok: false, error: "Member not found in this channel." };
  }

  const oldRole = existingMember.role;
  if (oldRole === parsed.data.new_role) return { ok: true }; // no-op

  const { error: updateErr } = await admin
    .from("channel_member")
    .update({ role: parsed.data.new_role as ChannelMemberRole })
    .eq("channel_id", parsed.data.channel_id)
    .eq("profile_id", parsed.data.profile_id)
    .is("left_at", null);

  if (updateErr) return { ok: false, error: `Kunne ikke endre rolle: ${updateErr.message}` };

  await emit({
    event: "channel.member_role_changed",
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.profileId, "actor_id"),
    entity: {
      entity_type: "channel",
      entity_id: parsed.data.channel_id,
      entity_label: channel.name ?? "channel",
    },
    properties: {
      channel_id: parsed.data.channel_id,
      target_profile_id: parsed.data.profile_id,
      old_role: oldRole,
      new_role: parsed.data.new_role,
    },
  });

  revalidatePath("/dashboard/komm");
  return { ok: true };
}
