"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Star, Search, UserPlus, Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { TeamRow, ProfileRow } from "./types";
import { TEAM_TYPE_CONFIG } from "./constants";

type TeamMembersSheetProps = {
  team: TeamRow;
  allProfiles: ProfileRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  employee: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamMembersSheet({
  team,
  allProfiles,
  isDark,
  open,
  onOpenChange,
  onRefresh,
}: TeamMembersSheetProps) {
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(team.leader_profile_id);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("team_member")
      .select(
        "profile_id, profile:profile_id(profile_id, display_name, role, department_id, status, is_active)",
      )
      .eq("team_id", team.team_id);

    const profiles = (data ?? [])
      .map((row) => row.profile as unknown as ProfileRow | null) // SAFETY: Supabase join returns union type; runtime shape matches the cast
      .filter(Boolean) as ProfileRow[];
    setMembers(profiles);
    setLoading(false);
  }, [team.team_id]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      setLeaderId(team.leader_profile_id);
    }
  }, [open, fetchMembers, team.leader_profile_id]);

  async function addMember(profileId: string) {
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("team_member")
      .insert({ team_id: team.team_id, profile_id: profileId });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Member added");
      await fetchMembers();
      await onRefresh();
    }
    setAdding(false);
    setSearch("");
  }

  async function removeMember(profileId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("team_member")
      .delete()
      .eq("team_id", team.team_id)
      .eq("profile_id", profileId);
    if (error) {
      toast.error(error.message);
    } else {
      if (leaderId === profileId) {
        await supabase.from("team").update({ leader_profile_id: null }).eq("team_id", team.team_id);
        setLeaderId(null);
      }
      toast.success("Member removed");
      await fetchMembers();
      await onRefresh();
    }
  }

  async function setLeader(profileId: string | null) {
    const supabase = createClient();
    const { error } = await supabase
      .from("team")
      .update({ leader_profile_id: profileId })
      .eq("team_id", team.team_id);
    if (error) {
      toast.error(error.message);
    } else {
      setLeaderId(profileId);
      toast.success(profileId ? "Leader assigned" : "Leader removed");
      await onRefresh();
    }
  }

  const memberIds = new Set(members.map((m) => m.profile_id));
  const availableProfiles = allProfiles.filter((p) => !memberIds.has(p.profile_id) && p.is_active);
  const filteredAvailable = search.trim()
    ? availableProfiles.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()))
    : availableProfiles;

  const typeConfig = TEAM_TYPE_CONFIG[team.team_type] ?? TEAM_TYPE_CONFIG["custom"]!;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`flex w-full flex-col sm:max-w-md ${
          isDark
            ? "border-zinc-800 bg-zinc-950 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        }`}
      >
        {/* Color accent bar */}
        {team.color && (
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: team.color }} />
        )}

        <SheetHeader>
          <div className="flex items-center gap-3">
            {team.color && (
              <div
                className="h-3 w-3 rounded-full ring-2 ring-offset-1"
                style={{
                  backgroundColor: team.color,
                  ["--tw-ring-color" as string]: team.color,
                  ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
                }}
              />
            )}
            <SheetTitle className={isDark ? "text-white" : "text-zinc-900"}>{team.name}</SheetTitle>
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${typeConfig.border} ${typeConfig.bg} ${typeConfig.text}`}
            >
              {typeConfig.label}
            </span>
          </div>
          <SheetDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </SheetDescription>
        </SheetHeader>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          {/* Leader Section */}
          <div className="mb-6">
            <label
              className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              Leader
            </label>
            <div className="flex items-center gap-2">
              <select
                value={leaderId ?? ""}
                onChange={(e) => setLeader(e.target.value || null)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all focus:ring-1 focus:outline-none ${
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-white focus:border-orange-500/50 focus:ring-orange-500/50"
                    : "border-zinc-200 bg-zinc-50 text-zinc-900 focus:border-orange-500/50 focus:ring-orange-500/50"
                } appearance-none`}
              >
                <option value="">No leader assigned</option>
                {members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name} ({m.role})
                  </option>
                ))}
              </select>
              {leaderId && (
                <button
                  onClick={() => setLeader(null)}
                  className={`rounded-lg border p-2 transition-colors ${
                    isDark
                      ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                      : "border-zinc-200 text-zinc-400 hover:bg-zinc-100"
                  }`}
                  title="Clear leader"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="mb-6">
            <label
              className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              Members
            </label>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  className={`h-5 w-5 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                />
              </div>
            ) : members.length === 0 ? (
              <p
                className={`py-4 text-center text-sm italic ${
                  isDark ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                No members yet. Add profiles below.
              </p>
            ) : (
              <div className="space-y-1">
                {members.map((member) => {
                  const isLeader = member.profile_id === leaderId;
                  const roleColor = ROLE_COLORS[member.role] ?? ROLE_COLORS["employee"]!;

                  return (
                    <div
                      key={member.profile_id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                        isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-50"
                      }`}
                    >
                      {/* Initials circle */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {getInitials(member.display_name)}
                      </div>

                      {/* Name + role */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`truncate text-sm font-medium ${
                              isDark ? "text-zinc-200" : "text-zinc-800"
                            }`}
                          >
                            {member.display_name}
                          </span>
                          {isLeader && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${roleColor}`}
                        >
                          {member.role}
                        </span>
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeMember(member.profile_id)}
                        className={`shrink-0 rounded-md p-1 transition-colors ${
                          isDark
                            ? "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                            : "text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                        }`}
                        title="Remove member"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Member Section */}
          <div>
            <label
              className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              Add Member
            </label>

            <div
              className={`overflow-hidden rounded-lg border ${
                isDark ? "border-zinc-800" : "border-zinc-200"
              }`}
            >
              {/* Search input */}
              <div
                className={`flex items-center gap-2 border-b px-3 py-2 ${
                  isDark ? "border-zinc-800" : "border-zinc-200"
                }`}
              >
                <Search
                  className={`h-4 w-4 shrink-0 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search profiles..."
                  className={`w-full bg-transparent text-sm outline-none placeholder:text-zinc-500 ${
                    isDark ? "text-white" : "text-zinc-900"
                  }`}
                />
                {adding && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <p
                    className={`px-3 py-4 text-center text-xs ${
                      isDark ? "text-zinc-600" : "text-zinc-400"
                    }`}
                  >
                    {search.trim() ? "No matching profiles" : "All profiles are already members"}
                  </p>
                ) : (
                  filteredAvailable.map((profile) => {
                    const roleColor = ROLE_COLORS[profile.role] ?? ROLE_COLORS["employee"]!;

                    return (
                      <button
                        key={profile.profile_id}
                        onClick={() => addMember(profile.profile_id)}
                        disabled={adding}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                          isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-50"
                        }`}
                      >
                        <UserPlus
                          className={`h-4 w-4 shrink-0 ${
                            isDark ? "text-zinc-600" : "text-zinc-400"
                          }`}
                        />
                        <span
                          className={`flex-1 truncate text-sm ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {profile.display_name}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${roleColor}`}
                        >
                          {profile.role}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
