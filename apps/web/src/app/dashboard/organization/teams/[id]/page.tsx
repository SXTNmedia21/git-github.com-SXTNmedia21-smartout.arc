"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Pencil,
  Users,
  FileText,
  Building2,
  X,
  Star,
  Search,
  UserPlus,
  Loader2,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "../../_components/EntityDetailLayout";
import { EditTeamDialog } from "../../_components/EditTeamDialog";
import { TEAM_TYPE_CONFIG } from "../../_components/constants";
import type { TeamRow, DepartmentRow, ProfileRow } from "../../_components/types";

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

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [policyCount, setPolicyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);

  // Dialog state
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!workspaceId || !params.id) return;
    setLoading(true);
    const supabase = createClient();

    const [teamRes, deptsRes, profilesRes, policiesRes] = await Promise.all([
      supabase
        .from("team")
        .select("*")
        .eq("team_id", params.id)
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("department")
        .select(
          "department_id, name, slug, description, color, icon, sort_order, manager_profile_id, is_active",
        )
        .eq("workspace_id", workspaceId),
      supabase
        .from("profile")
        .select("profile_id, display_name, role, department_id, status, is_active")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true),
      supabase
        .from("policy")
        .select("policy_id")
        .eq("workspace_id", workspaceId)
        .eq("policy_scope", "team")
        .eq("scope_ref_id", params.id),
    ]);

    if (teamRes.data) {
      const t = teamRes.data as TeamRow;
      setTeam(t);
      setLeaderId(t.leader_profile_id);
    }
    if (deptsRes.data) setDepartments(deptsRes.data as DepartmentRow[]);
    if (profilesRes.data) setAllProfiles(profilesRes.data as ProfileRow[]);
    if (policiesRes.data) setPolicyCount(policiesRes.data.length);

    setLoading(false);
  }, [workspaceId, params.id]);

  const fetchMembers = useCallback(async () => {
    if (!params.id) return;
    setMembersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("team_member")
      .select(
        "profile_id, profile:profile_id(profile_id, display_name, role, department_id, status, is_active)",
      )
      .eq("team_id", params.id);

    const profiles = (data ?? [])
      .map((row) => row.profile as unknown as ProfileRow | null) // SAFETY: Supabase join returns union type; runtime shape matches the cast
      .filter(Boolean) as ProfileRow[];
    setMembers(profiles);
    setMembersLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchData();
    fetchMembers();
  }, [fetchData, fetchMembers]);

  const deptName = useMemo(() => {
    if (!team?.department_id) return null;
    return departments.find((d) => d.department_id === team.department_id)?.name;
  }, [team?.department_id, departments]);

  const leaderName = useMemo(() => {
    if (!leaderId) return null;
    return (
      members.find((m) => m.profile_id === leaderId)?.display_name ??
      allProfiles.find((p) => p.profile_id === leaderId)?.display_name
    );
  }, [leaderId, members, allProfiles]);

  async function addMember(profileId: string) {
    if (!team) return;
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
    }
    setAdding(false);
    setSearch("");
  }

  async function removeMember(profileId: string) {
    if (!team) return;
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
    }
  }

  async function setLeader(profileId: string | null) {
    if (!team) return;
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
    }
  }

  async function toggleTeamActive() {
    if (!team) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("team")
      .update({ is_active: !team.is_active })
      .eq("team_id", team.team_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(team.is_active ? `"${team.name}" deactivated` : `"${team.name}" reactivated`);
      await fetchData();
    }
  }

  if (loading || !team) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-1">
        <div
          className={`h-8 w-48 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
        <div
          className={`h-12 w-72 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
        <div
          className={`h-10 w-96 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
      </div>
    );
  }

  const teamFallback = TEAM_TYPE_CONFIG["custom"]!;
  const typeConfig = TEAM_TYPE_CONFIG[team.team_type] ?? teamFallback;

  const memberIds = new Set(members.map((m) => m.profile_id));
  const availableProfiles = allProfiles.filter((p) => !memberIds.has(p.profile_id) && p.is_active);
  const filteredAvailable = search.trim()
    ? availableProfiles.filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()))
    : availableProfiles;

  const cardBase = `rounded-2xl border p-5 transition-all ${
    isDark
      ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
      : "border-zinc-200 bg-white hover:border-zinc-300"
  }`;

  return (
    <>
      <EntityDetailLayout
        breadcrumbs={[
          { label: "Organization", href: "/dashboard/organization" },
          { label: "Teams", href: "/dashboard/organization" },
          { label: team.name },
        ]}
        name={team.name}
        color={team.color}
        badges={
          <>
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${typeConfig.border} ${typeConfig.bg} ${typeConfig.text}`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${
                team.is_active
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : isDark
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${team.is_active ? "bg-emerald-500" : "bg-zinc-500"}`}
              />
              {team.is_active ? "Active" : "Inactive"}
            </span>
            {leaderName && (
              <span
                className={`flex items-center gap-1.5 text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {leaderName}
              </span>
            )}
          </>
        }
        actions={
          <button
            onClick={() => setEditTeamOpen(true)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        }
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="space-y-6">
                {team.description && (
                  <div className={cardBase}>
                    <h3
                      className={`mb-2 text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      Description
                    </h3>
                    <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                      {team.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    icon={<Users className="h-4 w-4" />}
                    label="Members"
                    value={members.length}
                    isDark={isDark}
                  />
                  <StatCard
                    icon={<FileText className="h-4 w-4" />}
                    label="Policies"
                    value={policyCount}
                    isDark={isDark}
                  />
                </div>

                <div className={cardBase}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {deptName && (
                      <div>
                        <span
                          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                        >
                          Department
                        </span>
                        <p
                          className={`mt-1 flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                          {deptName}
                        </p>
                      </div>
                    )}
                    {leaderName && (
                      <div>
                        <span
                          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                        >
                          Leader
                        </span>
                        <p
                          className={`mt-1 flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {leaderName}
                        </p>
                      </div>
                    )}
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Slug
                      </span>
                      <p className={`mt-1 font-mono ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {team.slug}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Type
                      </span>
                      <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {typeConfig.label}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            value: "members",
            label: "Members",
            content: (
              <div className="space-y-6">
                {/* Leader picker */}
                <div>
                  <label
                    className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    Leader
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={leaderId ?? ""}
                      onChange={(e) => setLeader(e.target.value || null)}
                      className={`flex-1 appearance-none rounded-lg border px-3 py-2 text-sm transition-all focus:ring-1 focus:outline-none ${
                        isDark
                          ? "border-zinc-800 bg-zinc-900 text-white focus:border-orange-500/50 focus:ring-orange-500/50"
                          : "border-zinc-200 bg-zinc-50 text-zinc-900 focus:border-orange-500/50 focus:ring-orange-500/50"
                      }`}
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

                {/* Members list */}
                <div>
                  <label
                    className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    Members ({members.length})
                  </label>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        className={`h-5 w-5 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      />
                    </div>
                  ) : members.length === 0 ? (
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
                        isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <Users
                        className={`mb-4 h-8 w-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      />
                      <p
                        className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                      >
                        No members yet. Add profiles below.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {members.map((member) => {
                        const isLeader = member.profile_id === leaderId;
                        const roleColor = ROLE_COLORS[member.role] ?? ROLE_COLORS["employee"]!;
                        return (
                          <div
                            key={member.profile_id}
                            className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                              isDark
                                ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
                                : "border-zinc-200 bg-white hover:border-zinc-300"
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {getInitials(member.display_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`truncate text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
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
                            <button
                              onClick={() => removeMember(member.profile_id)}
                              className={`shrink-0 rounded-md p-1.5 transition-colors ${
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

                {/* Add member section */}
                <div>
                  <label
                    className={`mb-2 block text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    Add Member
                  </label>
                  <div
                    className={`overflow-hidden rounded-xl border ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                  >
                    <div
                      className={`flex items-center gap-2 border-b px-3 py-2.5 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                    >
                      <Search
                        className={`h-4 w-4 shrink-0 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search profiles..."
                        className={`w-full bg-transparent text-sm outline-none placeholder:text-zinc-500 ${isDark ? "text-white" : "text-zinc-900"}`}
                      />
                      {adding && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredAvailable.length === 0 ? (
                        <p
                          className={`px-3 py-4 text-center text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                        >
                          {search.trim()
                            ? "No matching profiles"
                            : "All profiles are already members"}
                        </p>
                      ) : (
                        filteredAvailable.map((profile) => {
                          const roleColor = ROLE_COLORS[profile.role] ?? ROLE_COLORS["employee"]!;
                          return (
                            <button
                              key={profile.profile_id}
                              onClick={() => addMember(profile.profile_id)}
                              disabled={adding}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                                isDark ? "hover:bg-zinc-900" : "hover:bg-zinc-50"
                              }`}
                            >
                              <UserPlus
                                className={`h-4 w-4 shrink-0 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                              />
                              <span
                                className={`flex-1 truncate text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
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
            ),
          },
          {
            value: "policies",
            label: "Policies",
            content: (
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 ${
                  isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <FileText
                  className={`mb-4 h-10 w-10 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                />
                <h3
                  className={`mb-1 text-base font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  Policies coming soon
                </h3>
                <p
                  className={`max-w-sm text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Team-scoped policies will be managed here in a future release.
                </p>
              </div>
            ),
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <div className="space-y-6">
                <div className={cardBase}>
                  <h3
                    className={`mb-4 text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                  >
                    Team Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Name
                      </span>
                      <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {team.name}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Type
                      </span>
                      <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                        {typeConfig.label}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Color
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        {team.color ? (
                          <>
                            <div
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span
                              className={`font-mono text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                            >
                              {team.color}
                            </span>
                          </>
                        ) : (
                          <span
                            className={`text-xs italic ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                          >
                            None
                          </span>
                        )}
                      </div>
                    </div>
                    {deptName && (
                      <div>
                        <span
                          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                        >
                          Department
                        </span>
                        <p className={`mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                          {deptName}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => setEditTeamOpen(true)}
                      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Team
                    </button>
                    <button
                      onClick={toggleTeamActive}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                        isDark
                          ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {team.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Edit Team Dialog */}
      {editTeamOpen && (
        <EditTeamDialog
          team={team}
          departments={departments}
          isDark={isDark}
          open={editTeamOpen}
          onOpenChange={setEditTeamOpen}
          onSave={fetchData}
        />
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>{icon}</span>
        <span
          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {label}
        </span>
      </div>
      <span className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        {value}
      </span>
    </div>
  );
}
