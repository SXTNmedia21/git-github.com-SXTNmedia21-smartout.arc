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
  employee: "bg-muted text-muted-foreground border-border",
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
        className="border-border bg-background text-foreground flex w-full flex-col sm:max-w-md"
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
            <SheetTitle className="text-foreground">{team.name}</SheetTitle>
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${typeConfig.border} ${typeConfig.bg} ${typeConfig.text}`}
            >
              {typeConfig.label}
            </span>
          </div>
          <SheetDescription className="text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"}
          </SheetDescription>
        </SheetHeader>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          {/* Leader Section */}
          <div className="mb-6">
            <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Leader
            </label>
            <div className="flex items-center gap-2">
              <select
                value={leaderId ?? ""}
                onChange={(e) => setLeader(e.target.value || null)}
                className="border-border bg-card text-foreground flex-1 appearance-none rounded-lg border px-3 py-2 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
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
                  className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border p-2 transition-colors"
                  title="Clear leader"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Members List */}
          <div className="mb-6">
            <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Members
            </label>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm italic">
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
                      className="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                    >
                      {/* Initials circle */}
                      <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {getInitials(member.display_name)}
                      </div>

                      {/* Name + role */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground truncate text-sm font-medium">
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
                        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-md p-1 transition-colors"
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
            <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
              Add Member
            </label>

            <div className="border-border overflow-hidden rounded-lg border">
              {/* Search input */}
              <div className="border-border flex items-center gap-2 border-b px-3 py-2">
                <Search className="text-muted-foreground h-4 w-4 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search profiles..."
                  className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
                />
                {adding && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
              </div>

              {/* Results */}
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-center text-xs">
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
                        className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="text-foreground flex-1 truncate text-sm">
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
