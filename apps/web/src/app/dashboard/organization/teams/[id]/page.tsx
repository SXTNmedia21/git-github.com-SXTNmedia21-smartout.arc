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

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [team, setTeam] = useState<TeamRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [policies, setPolicies] = useState<
    Array<{
      policy_id: string;
      name: string;
      policy_type: string;
      enforcement_status: string;
      is_active: boolean;
    }>
  >([]);
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
        .select("policy_id, name, policy_type, enforcement_status, is_active")
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
    if (policiesRes.data)
      setPolicies(
        policiesRes.data as Array<{
          policy_id: string;
          name: string;
          policy_type: string;
          enforcement_status: string;
          is_active: boolean;
        }>,
      );

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
        <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 w-72 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-96 animate-pulse rounded-lg" />
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

  const cardBase =
    "rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/70";

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
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${team.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
              />
              {team.is_active ? "Active" : "Inactive"}
            </span>
            {leaderName && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {leaderName}
              </span>
            )}
          </>
        }
        actions={
          <button
            onClick={() => setEditTeamOpen(true)}
            className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
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
                    <h3 className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                      Description
                    </h3>
                    <p className="text-foreground text-sm">{team.description}</p>
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
                    value={policies.length}
                    isDark={isDark}
                  />
                </div>

                <div className={cardBase}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {deptName && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Department
                        </span>
                        <p className="text-foreground mt-1 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {deptName}
                        </p>
                      </div>
                    )}
                    {leaderName && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Leader
                        </span>
                        <p className="text-foreground mt-1 flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {leaderName}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Slug
                      </span>
                      <p className="text-foreground mt-1 font-mono">{team.slug}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Type
                      </span>
                      <p className="text-foreground mt-1">{typeConfig.label}</p>
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
                        className="border-border text-muted-foreground hover:bg-accent rounded-lg border p-2 transition-colors"
                        title="Clear leader"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Members list */}
                <div>
                  <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
                    Members ({members.length})
                  </label>
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                  ) : members.length === 0 ? (
                    <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
                      <Users className="text-muted-foreground mb-4 h-8 w-8" />
                      <p className="text-muted-foreground text-sm font-medium">
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
                            className="border-border bg-card hover:border-border/70 flex items-center gap-3 rounded-xl border p-3 transition-all"
                          >
                            <div className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                              {getInitials(member.display_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-foreground truncate text-sm font-bold">
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
                              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-md p-1.5 transition-colors"
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
                  <label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
                    Add Member
                  </label>
                  <div className="border-border overflow-hidden rounded-xl border">
                    <div className="border-border flex items-center gap-2 border-b px-3 py-2.5">
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
                    <div className="max-h-60 overflow-y-auto">
                      {filteredAvailable.length === 0 ? (
                        <p className="text-muted-foreground px-3 py-4 text-center text-xs">
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
                              className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50"
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
            ),
          },
          {
            value: "policies",
            label: "Policies",
            content:
              policies.length === 0 ? (
                <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16">
                  <FileText className="text-muted-foreground mb-4 h-10 w-10" />
                  <h3 className="text-foreground mb-1 text-base font-bold">
                    Ingen policyer tilordnet dette teamet
                  </h3>
                  <p className="text-muted-foreground max-w-sm text-center text-sm">
                    Policyer opprettes under Governance og tilordnes hit via omfang.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {policies.map((policy) => (
                    <div
                      key={policy.policy_id}
                      className="border-border bg-card flex items-center justify-between rounded-xl border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="text-muted-foreground h-4 w-4" />
                        <div>
                          <span className="text-foreground text-sm font-medium">{policy.name}</span>
                          <p className="text-muted-foreground text-xs">
                            {policy.policy_type} &middot; {policy.enforcement_status}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          policy.is_active
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-border bg-muted text-muted-foreground border"
                        }`}
                      >
                        {policy.is_active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>
                  ))}
                </div>
              ),
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <div className="space-y-6">
                <div className={cardBase}>
                  <h3 className="text-foreground mb-4 text-sm font-bold">Team Settings</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Name
                      </span>
                      <p className="text-foreground mt-1">{team.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Type
                      </span>
                      <p className="text-foreground mt-1">{typeConfig.label}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Color
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        {team.color ? (
                          <>
                            <div
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="text-muted-foreground font-mono text-xs">
                              {team.color}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">None</span>
                        )}
                      </div>
                    </div>
                    {deptName && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Department
                        </span>
                        <p className="text-foreground mt-1">{deptName}</p>
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
                      className="border-border bg-card text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
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
  isDark: _isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isDark: boolean;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {label}
        </span>
      </div>
      <span className="text-foreground text-2xl font-bold">{value}</span>
    </div>
  );
}
