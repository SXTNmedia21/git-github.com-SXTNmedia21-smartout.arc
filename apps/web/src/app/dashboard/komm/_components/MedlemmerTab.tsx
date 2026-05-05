"use client";

/**
 * MedlemmerTab — Channel member management.
 *
 * Visual pattern: Section card (rounded-2xl bg-card border) with thin dividers,
 * matching mobile-screens.jsx Section + Row pattern.
 *
 * Layout:
 *   - Heading "Medlemmer" (22px font-heading) + count chip (mono)
 *   - Search bar card (rounded-2xl, magnifier left, clear X)
 *   - Filter chip row: Alle / Admin / Representanter / Ansatte
 *     Active: bg-brand-orange/15 border-brand-orange ring-brand-orange/12 ring-2 (subtle, not solid)
 *   - Member rows in a single full-width Section card (divider between rows, last:border-b-0)
 *       LighthouseAvatar 36 (Initials) · name (font-semibold 14) · role pill below ·
 *       joined date mono right · role select + Trash2 hover button (admin only)
 *       Leader badge (dashed crown chip) next to name for managers/admins/owners
 *   - Add member card at end (bg-muted/40 dashed border) → combobox
 *   - Empty state: full card centered with Users icon
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import { Clock, Crown, Loader2, PlusCircle, Search, Users, UserMinus, X } from "lucide-react";
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

// Role pill colour classes
function rolePillClass(role: MemberRole): string {
  switch (role) {
    case "admin":
      return "bg-brand-orange/15 text-brand-orange";
    case "representative":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Initials avatar (no external image required)
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
        {/* Section heading with count chip */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 flex items-center gap-2 text-[20px] tracking-tight">
            {t("channel_settings.members_heading")}
            {members.length > 0 && (
              <span className="bg-muted text-muted-foreground ml-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-normal">
                {members.length}
              </span>
            )}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.members_lede", { count: members.length })}
          </p>
        </div>

        {/* Search bar card */}
        <div className="bg-card border-border mb-3 rounded-2xl border px-4 py-3">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("channel_settings.members_search_placeholder")}
              className="w-full bg-transparent py-1 pr-8 pl-6 text-sm focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-0 -translate-y-1/2 transition-colors"
                aria-label={t("channel_settings.members_search_clear")}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Filter chip row — subtle active state (bg-brand-orange/15, not solid) */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setRoleFilter(chip.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-[background-color,border-color,box-shadow] duration-[180ms] ease-out",
                roleFilter === chip.id
                  ? "bg-brand-orange/15 border-brand-orange text-foreground ring-brand-orange/12 ring-2"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {isError && (
          <div className="bg-card border-border mb-4 rounded-2xl border px-5 py-4">
            <div className="text-muted-foreground text-sm">
              {t("channel_settings.members_load_error")}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isError && filtered.length === 0 && (
          <div className="bg-card border-border mb-4 rounded-2xl border px-5 py-10 text-center">
            <div className="text-muted-foreground mb-2 flex justify-center">
              <Users className="h-8 w-8 opacity-40" aria-hidden="true" />
            </div>
            <div className="text-sm font-medium">
              {search || roleFilter !== "all"
                ? t("channel_settings.members_no_results")
                : t("channel_settings.members_empty")}
            </div>
          </div>
        )}

        {/* Member rows in single Section card (dividers between rows) */}
        {!isError && filtered.length > 0 && (
          <div className="bg-card border-border mb-4 rounded-2xl border">
            {filtered.map((member, idx) => {
              const isLeader =
                member.profile.role === "manager" ||
                member.profile.role === "admin" ||
                member.profile.role === "owner";
              const isLast = idx === filtered.length - 1;

              return (
                <div
                  key={member.profile_id}
                  className={cn(
                    "group hover:bg-muted/40 flex items-center gap-3.5 px-4 py-3 transition-[background-color] duration-[180ms] ease-out",
                    !isLast && "border-border border-b",
                    idx === 0 && "rounded-t-2xl",
                    isLast && "rounded-b-2xl",
                  )}
                >
                  {/* Avatar */}
                  <Initials name={member.profile.display_name} size={36} />

                  {/* Name + role */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-semibold tracking-[-0.005em]">
                        {member.profile.display_name ?? t("channel_settings.members_unknown")}
                      </span>
                      {/* Role pill */}
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium",
                          rolePillClass(member.role),
                        )}
                      >
                        {rolePillLabel(member.role, t)}
                      </span>
                      {/* Leader badge — dashed crown chip */}
                      {isLeader && (
                        <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 font-mono text-[11px]">
                          <Crown className="h-2.5 w-2.5" aria-hidden="true" />
                          {t("channel_settings.members_leader_badge")}
                        </span>
                      )}
                    </div>
                    {/* Joined date mono */}
                    {member.joined_at && (
                      <div className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                        {t("channel_settings.members_joined")}{" "}
                        {new Date(member.joined_at).toLocaleDateString("nb-NO")}
                      </div>
                    )}
                  </div>

                  {/* Admin controls — role select + remove (hover-reveal) */}
                  {isAdmin && (
                    <div className="flex items-center gap-2 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100">
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

                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        disabled={isPending}
                        aria-label={t("channel_settings.members_remove_aria", {
                          name: member.profile.display_name ?? "",
                        })}
                        className="text-muted-foreground hover:text-destructive rounded-lg p-1.5 transition-colors focus:outline-none"
                      >
                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add member card (admin only) — dashed border, bg-muted/40 */}
        {isAdmin && (
          <>
            {!showAddCombobox ? (
              <button
                type="button"
                onClick={() => setShowAddCombobox(true)}
                disabled={isPending}
                className="border-border hover:border-foreground/20 bg-muted/40 flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition-[border-color] duration-[180ms] ease-out"
              >
                <div className="bg-muted flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                  <PlusCircle className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {t("channel_settings.members_add_cta")}
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px]">
                    {eligibleToAdd.length} {t("channel_settings.members_add_eligible")}
                  </div>
                </div>
              </button>
            ) : (
              <div className="bg-card border-border rounded-2xl border p-5">
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
                <div className="max-h-48 space-y-1 overflow-y-auto">
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
                        <div className="text-muted-foreground font-mono text-[11px]">
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
          </>
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
