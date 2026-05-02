"use server";

/**
 * channel-permissions.ts — Server-side permission assertion helper.
 *
 * `assertChannelPermission` is the single server-side enforcement point for
 * channel-settings mutations. It mirrors the UX tiers in
 * `useChannelPermissions` but is the authoritative gate — UX gates are hints,
 * this is law.
 *
 * Usage in server actions:
 *   const ctx = await assertChannelPermission(channelId, 'canRename');
 *   if (!ctx.ok) return ctx; // { ok: false, error: string }
 *
 * Resolution order (same as client hook):
 *   1. company_member.role (owner / admin / member)
 *   2. profile.role (employee / manager / admin / owner)
 *   3. channel_member.role (admin / representative / member) — channel-scoped
 *
 * ADR-0151: workspace_id is NEVER resolved from the request body.
 */

import { createClient } from "@smartout/supabase/server";
import type { ChannelPermissions } from "../_hooks/use-channel-permissions";

type PermissionKey = keyof ChannelPermissions;

type PermissionOk = { ok: true; profileId: string; workspaceId: string };
type PermissionErr = { ok: false; error: string };

/**
 * Assert that the authenticated user holds the given permission on `channelId`.
 * Returns a context object on success or a typed error on failure.
 */
export async function assertChannelPermission(
  channelId: string,
  capability: PermissionKey,
): Promise<PermissionOk | PermissionErr> {
  const supabase = await createClient();

  // ── 1. Authenticated user ─────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget." };

  // ── 2. Active profile (workspace_id from JWT — never from body) ───────────
  const { data: profileRow } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role, status")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profileRow) return { ok: false, error: "Ingen aktiv profil funnet." };

  const { profile_id: profileId, workspace_id: workspaceId } = profileRow;
  const profileRole = profileRow.role ?? "employee";
  const profileStatus = profileRow.status ?? "active";
  const isTrainee = profileStatus === "trainee";
  const isProfileAdmin = profileRole === "admin" || profileRole === "owner";

  // ── 3. Company-member role ────────────────────────────────────────────────
  const { data: wsRow } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!wsRow?.company_id) return { ok: false, error: "Workspace har ikke tilknyttet bedrift." };

  const { data: memberRow } = await supabase
    .from("company_member")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", wsRow.company_id)
    .maybeSingle();

  const companyRole = memberRow?.role ?? "member";
  const isOwner = companyRole === "owner";
  const isCompanyAdmin = companyRole === "admin";
  const isAdmin = isOwner || isCompanyAdmin || isProfileAdmin;

  // ── 4. Channel membership ─────────────────────────────────────────────────
  const { data: chanMemberRow } = await supabase
    .from("channel_member")
    .select("role")
    .eq("channel_id", channelId)
    .eq("profile_id", profileId)
    .is("left_at", null)
    .maybeSingle();

  const channelRole = chanMemberRow?.role ?? null;
  const isChannelAdmin = channelRole === "admin";
  const isChannelMember = channelRole !== null;
  const managerTier = isAdmin || isChannelAdmin;
  const memberTier = isAdmin || isChannelMember;

  // ── 5. Capability gate ────────────────────────────────────────────────────
  // Trainees (non-admin) are fully blocked on write operations
  if (isTrainee && !isAdmin) {
    return { ok: false, error: "Trainee-profiler har ikke tilgang til kanalinnstillinger." };
  }

  const permissionMap: Record<PermissionKey, boolean> = {
    canViewSettings: memberTier,
    canRename: managerTier,
    canDescribe: managerTier,
    canArchive: isAdmin,
    canDelete: isOwner,
    canAddMembers: managerTier,
    canRemoveMembers: managerTier,
    canChangeRoles: isAdmin,
    canEditAiPolicy: isAdmin,
    canEditRetention: isAdmin,
    canSetLegalHold: isAdmin,
  };

  const allowed = permissionMap[capability] ?? false;
  if (!allowed) {
    const requiredLabel: Record<PermissionKey, string> = {
      canViewSettings: "member",
      canRename: "channel-admin",
      canDescribe: "channel-admin",
      canArchive: "admin",
      canDelete: "owner",
      canAddMembers: "channel-admin",
      canRemoveMembers: "channel-admin",
      canChangeRoles: "admin",
      canEditAiPolicy: "admin",
      canEditRetention: "admin",
      canSetLegalHold: "admin",
    };
    return {
      ok: false,
      error: `Krever ${requiredLabel[capability]}-tilgang.`,
    };
  }

  return { ok: true, profileId, workspaceId };
}
