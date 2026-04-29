"use client";

/**
 * MedlemmerTab — Channel member management.
 *
 * Admin view: role change (inline Select), remove button, add member combobox.
 * Non-admin view: read-only list.
 *
 * Visual shape follows SkrankeTab:
 *   - Search input + filter chips
 *   - Member rows: initials avatar + name + role pill + last-active mono
 *   - Inline role change via Select
 *   - Remove per-row with consequence tooltip
 *   - Footer "Legg til" combobox (grouped by department)
 *   - Sticky footer: Cancel / Save buttons
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import { Clock, Loader2, Search, Star, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useChannelMembers } from "../_hooks/use-channel-members";
import { useWorkspace } from "@/lib/workspace-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import {
  addChannelMember,
  removeChannelMember,
  changeChannelMemberRole,
} from "../_actions/members-channel-actions";
import type { ChannelMemberWithProfile } from "../_hooks/channel-types";
import type { Database } from "@smartout/supabase";

type MemberRole = Database["public"]["Enums"]["channel_member_role"];

type MedlemmerTabProps = {
  channelId: string;
  channelName: string;
  onSettled?: () => void;
  onCancel?: () => void;
};

type RoleFilter = "all" | "admin" | "representative" | "member";

// Role → display label
function rolePillLabel(role: MemberRole, t: (k: string) => string): string {
  switch (role) {
    case "admin":
      return t("channel_settings.members_role_admin");
    case "representative":
      return t("channel_settings.members_role_representative");
    default:
      return t("channel_settings.members_role_member");
  }
}

// Simple initials avatar (no external image required for members not in
// the reps list — they might not have avatar_url set)
function Initials({ name, size = 36 }: { name: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground flex flex-shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

// Fetch all active workspace profiles for the "add member" combobox
function useWorkspaceProfiles() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-profiles", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, role")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });
}

export function MedlemmerTab({
  channelId,
  channelName: _channelName,
  onSettled,
  onCancel,
}: MedlemmerTabProps) {
  const { t } = useTranslation("helpdesk");
  const queryClient = useQueryClient();
  const { data: isAdmin } = useWorkspaceAdmin();
  const { workspace } = useWorkspace();
  const { data: members = [], isError } = useChannelMembers(channelId);
  const { data: allProfiles = [] } = useWorkspaceProfiles();

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("all");
  const [isPending, startTransition] = React.useTransition();

  // Add member combobox state
  const [showAddCombobox, setShowAddCombobox] = React.useState(false);
  const [addSearch, setAddSearch] = React.useState("");

  const memberIds = new Set(members.map((m) => m.profile_id));

  // Eligible profiles to add (not already a member)
  const eligibleToAdd = allProfiles.filter(
    (p) =>
      !memberIds.has(p.profile_id) &&
      (addSearch === "" || (p.display_name ?? "").toLowerCase().includes(addSearch.toLowerCase())),
  );

  const filtered = members.filter((m) => {
    const nameMatch =
      search === "" || (m.profile.display_name ?? "").toLowerCase().includes(search.toLowerCase());
    const roleMatch = roleFilter === "all" || m.role === roleFilter;
    return nameMatch && roleMatch;
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["channel-members", workspace.workspace_id, channelId],
    });
  };

  const handleRemove = (member: ChannelMemberWithProfile) => {
    startTransition(async () => {
      const result = await removeChannelMember({
        channel_id: channelId,
        profile_id: member.profile_id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.members_removed"));
      invalidate();
      onSettled?.();
    });
  };

  const handleRoleChange = (member: ChannelMemberWithProfile, newRole: MemberRole) => {
    startTransition(async () => {
      const result = await changeChannelMemberRole({
        channel_id: channelId,
        profile_id: member.profile_id,
        new_role: newRole,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.members_role_changed"));
      invalidate();
      onSettled?.();
    });
  };

  const handleAdd = (profileId: string) => {
    startTransition(async () => {
      const result = await addChannelMember({
        channel_id: channelId,
        profile_id: profileId,
        role: "member",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.members_added"));
      setAddSearch("");
      setShowAddCombobox(false);
      invalidate();
      onSettled?.();
    });
  };

  const filterChips: Array<{ id: RoleFilter; label: string }> = [
    { id: "all", label: t("channel_settings.members_filter_all") },
    { id: "admin", label: t("channel_settings.members_filter_admin") },
    { id: "representative", label: t("channel_settings.members_filter_rep") },
    { id: "member", label: t("channel_settings.members_filter_member") },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-5">
          <div className="font-heading mb-1 text-[22px] tracking-tight">
            {t("channel_settings.members_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.members_lede", { count: members.length })}
          </p>
        </div>

        {/* Search + filter row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("channel_settings.members_search_placeholder")}
              className="border-border bg-background focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setRoleFilter(chip.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  roleFilter === chip.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Member list */}
        <div className="bg-card border-border mb-4 rounded-2xl border">
          {isError && (
            <div className="text-muted-foreground px-5 py-4 text-sm">
              {t("channel_settings.members_load_error")}
            </div>
          )}
          {!isError && filtered.length === 0 && (
            <div className="text-muted-foreground px-5 py-8 text-center text-sm">
              {search || roleFilter !== "all"
                ? t("channel_settings.members_no_results")
                : t("channel_settings.members_empty")}
            </div>
          )}
          {filtered.map((member, idx) => (
            <div
              key={member.profile_id}
              className={cn(
                "flex items-center gap-3 px-5 py-3.5",
                idx < filtered.length - 1 && "border-border border-b",
              )}
            >
              <Initials name={member.profile.display_name} size={36} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {member.profile.display_name ?? t("channel_settings.members_unknown")}
                  </span>
                  {/* Leader badge — shown if profile role is manager/admin/owner */}
                  {(member.profile.role === "manager" ||
                    member.profile.role === "admin" ||
                    member.profile.role === "owner") && (
                    <Star
                      className="text-muted-foreground h-3 w-3 flex-shrink-0"
                      aria-label={t("channel_settings.members_leader_badge")}
                    />
                  )}
                </div>
                <div className="text-muted-foreground font-mono text-xs">
                  {rolePillLabel(member.role, t)}
                  {member.joined_at &&
                    ` · ${new Date(member.joined_at).toLocaleDateString("nb-NO")}`}
                </div>
              </div>

              {/* Inline role change (admin only) */}
              {isAdmin && (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member, e.target.value as MemberRole)}
                  disabled={isPending}
                  className="border-border bg-background text-muted-foreground hover:text-foreground rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none"
                  aria-label={t("channel_settings.members_role_change_aria")}
                >
                  <option value="member">{t("channel_settings.members_role_member")}</option>
                  <option value="admin">{t("channel_settings.members_role_admin")}</option>
                  <option value="representative">
                    {t("channel_settings.members_role_representative")}
                  </option>
                </select>
              )}

              {/* Remove button (admin only) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleRemove(member)}
                  disabled={isPending}
                  aria-label={t("channel_settings.members_remove_aria", {
                    name: member.profile.display_name ?? "",
                  })}
                  className="text-muted-foreground hover:text-destructive ml-1 rounded p-1 transition-colors focus:outline-none"
                >
                  <UserMinus className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add member section (admin only) */}
        {isAdmin && (
          <div>
            {!showAddCombobox ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddCombobox(true)}
                disabled={isPending}
                className="gap-2"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("channel_settings.members_add_cta")}
              </Button>
            ) : (
              <div className="bg-card border-border rounded-2xl border p-4">
                <div className="mb-3 text-sm font-semibold">
                  {t("channel_settings.members_add_heading")}
                </div>
                <div className="relative mb-3">
                  <Search
                    className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder={t("channel_settings.members_add_search_placeholder")}
                    className="border-border bg-background focus:ring-ring w-full rounded-xl border py-2 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {eligibleToAdd.length === 0 && (
                    <div className="text-muted-foreground py-3 text-center text-sm">
                      {t("channel_settings.members_add_empty")}
                    </div>
                  )}
                  {eligibleToAdd.map((profile) => (
                    <button
                      key={profile.profile_id}
                      type="button"
                      onClick={() => handleAdd(profile.profile_id)}
                      disabled={isPending}
                      className="hover:bg-muted flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                    >
                      <Initials name={profile.display_name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {profile.display_name ?? t("channel_settings.members_unknown")}
                        </div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {profile.role}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddCombobox(false);
                      setAddSearch("");
                    }}
                  >
                    {t("skranke_tab.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="border-border bg-background/60 flex items-center justify-between border-t px-8 py-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {t("channel_settings.members_footer_hint")}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t("skranke_tab.cancel")}
          </Button>
          {isPending && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("skranke_tab.save_pending")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
