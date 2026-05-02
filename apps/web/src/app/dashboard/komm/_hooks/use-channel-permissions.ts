"use client";

/**
 * useChannelPermissions — Fine-grained permission tiers for channel settings.
 *
 * Resolves five tiers using a combination of:
 *   - company_member.role (owner / admin / member) — workspace-level authority
 *   - profile.role (employee / manager / admin / owner) — workspace-level label
 *   - profile.status (trainee / active / ...) — readiness tier
 *   - channel_member.role (admin / representative / member) — channel-scoped role
 *
 * Tiers:
 *   Owner   — company_member.role === 'owner'
 *   Admin   — company_member.role === 'admin' OR profile.role === 'admin'
 *   Manager — channel_member.role === 'admin' (channel-level) — can manage members
 *   Member  — any active profile in the channel
 *   Trainee — profile.status === 'trainee'
 *
 * This is a UX-only signal. All server actions enforce their own authz independently.
 * See `apps/web/src/app/dashboard/komm/_actions/channel-permissions.ts` for the
 * server-side assertChannelPermission helper.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

// ── Permission shape ─────────────────────────────────────────────────────────

export type ChannelPermissions = {
  /** Everyone sees the settings cog; trainees see nothing */
  canViewSettings: boolean;
  /** Channel name */
  canRename: boolean;
  /** Channel description */
  canDescribe: boolean;
  /** Soft-archive channel — admin+ only */
  canArchive: boolean;
  /** Hard-delete channel — owner only */
  canDelete: boolean;
  /** Add members to the channel */
  canAddMembers: boolean;
  /** Remove members from the channel */
  canRemoveMembers: boolean;
  /** Change a member's channel-role (admin / rep / member) */
  canChangeRoles: boolean;
  /** Edit AI participation + voice toggles */
  canEditAiPolicy: boolean;
  /** Edit retention presets + auto-archive */
  canEditRetention: boolean;
  /** Set / clear legal hold — admin+ only */
  canSetLegalHold: boolean;
};

/** Returned while the query is still loading — safe no-permission defaults */
const LOADING_PERMISSIONS: ChannelPermissions = {
  canViewSettings: false,
  canRename: false,
  canDescribe: false,
  canArchive: false,
  canDelete: false,
  canAddMembers: false,
  canRemoveMembers: false,
  canChangeRoles: false,
  canEditAiPolicy: false,
  canEditRetention: false,
  canSetLegalHold: false,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChannelPermissions(channelId: string, profileId: string): ChannelPermissions {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const companyId = workspace.company_id;

  const { data } = useQuery({
    queryKey: ["channel-permissions", workspaceId, channelId, profileId],
    enabled: Boolean(channelId && profileId && companyId),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<ChannelPermissions> => {
      const supabase = createClient();

      // 1. Resolve authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return LOADING_PERMISSIONS;
      if (!companyId) return LOADING_PERMISSIONS;
      const resolvedCompanyId: string = companyId;

      // Parallel: 3 independent role lookups (company_member, profile, channel_member).
      // Reduces 3 sequential round-trips to 1 max-latency. Auth check (step 1) was
      // already done above; remaining queries don't depend on each other.
      const [memberRes, profileRes, channelMemberRes] = await Promise.all([
        supabase
          .from("company_member")
          .select("role")
          .eq("user_id", user.id)
          .eq("company_id", resolvedCompanyId)
          .maybeSingle(),
        supabase
          .from("profile")
          .select("role, status")
          .eq("profile_id", profileId)
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        supabase
          .from("channel_member")
          .select("role")
          .eq("channel_id", channelId)
          .eq("profile_id", profileId)
          .is("left_at", null)
          .maybeSingle(),
      ]);

      const companyRole = memberRes.data?.role ?? "member";
      const isOwner = companyRole === "owner";
      const isCompanyAdmin = companyRole === "admin";

      const profileRole = profileRes.data?.role ?? "employee";
      const profileStatus = profileRes.data?.status ?? "active";
      const isProfileAdmin = profileRole === "admin" || profileRole === "owner";
      const isTrainee = profileStatus === "trainee";

      const isAdmin = isOwner || isCompanyAdmin || isProfileAdmin;

      const channelRole = channelMemberRes.data?.role ?? null;
      const isChannelAdmin = channelRole === "admin";
      const isChannelMember = channelRole !== null;

      // 5. Resolve tiers
      const managerTier = isAdmin || isChannelAdmin; // admin+ OR channel-admin
      const memberTier = isAdmin || isChannelMember;

      if (isTrainee && !isAdmin) {
        // Trainees: read-only, no settings cog
        return {
          ...LOADING_PERMISSIONS,
          canViewSettings: false, // hide cog entirely
        };
      }

      return {
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
        canSetLegalHold: isAdmin, // admin+ (owner OR company-admin OR profile-admin)
      };
    },
  });

  return data ?? LOADING_PERMISSIONS;
}
