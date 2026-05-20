"use client";

/**
 * page.tsx — /dashboard/organization/teams
 *
 * Teams list view. Fetches all D2-resource teams for the workspace, builds
 * TeamSummary objects (member count, leader name, department link) and passes
 * them to the TeamsTab component for display.
 *
 * Botsson harness bridge is mounted here — tools register when the page mounts
 * and unregister on route change (via useRegisterTools lifecycle).
 *
 * proposeCreateTeam tool fires a "botsson:open-create-team-dialog" CustomEvent
 * that this page listens to — opens the Create dialog in TeamsTab.
 *
 * Cascade notes:
 *   D2 (Resource) — team is a workspace membership overlay on D1 departments.
 *   team.leader_profile_id is NOT a role — it is a team attribute only.
 *
 * ADR-0151: workspace_id is resolved from DashboardContext (auth-derived).
 * ADR-0238: no domain chat surface on this route.
 */

import { useContext, useEffect, useCallback, useMemo, useRef, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { TeamsTab } from "../_components/teams-tab";
import { TeamsToolsBridge } from "./_tools/teams-tools-bridge";
import type { TeamRow, DepartmentRow, ProfileRow, CountMap } from "../_components/types";
import type { TeamSummary } from "./_tools/use-teams-tools";

export default function TeamsPage() {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<CountMap>({});
  const [policyCounts, setPolicyCounts] = useState<CountMap>({});

  // Callback ref for programmatic dialog open (proposeCreateTeam tool → CustomEvent)
  const openDialogRef = useRef<(() => void) | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const supabase = createClient();

    const [teamsRes, deptsRes, profilesRes, membersRes, policiesRes] = await Promise.all([
      supabase.from("team").select("*").eq("workspace_id", workspaceId).order("name"),
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
      supabase.from("team_member").select("team_id, profile_id").eq("workspace_id", workspaceId),
      supabase
        .from("policy")
        .select("policy_id, scope_ref_id")
        .eq("workspace_id", workspaceId)
        .eq("policy_scope", "team"),
    ]);

    const fetchedTeams = (teamsRes.data ?? []) as TeamRow[];
    const fetchedDepts = (deptsRes.data ?? []) as DepartmentRow[];
    const fetchedProfiles = (profilesRes.data ?? []) as ProfileRow[];

    // Build member counts per team_id
    const mCounts: CountMap = {};
    for (const row of membersRes.data ?? []) {
      const r = row as { team_id: string; profile_id: string };
      mCounts[r.team_id] = (mCounts[r.team_id] ?? 0) + 1;
    }

    // Build policy counts per team_id (scope_ref_id = team_id for team-scoped policies)
    const pCounts: CountMap = {};
    for (const row of policiesRes.data ?? []) {
      const r = row as { policy_id: string; scope_ref_id: string | null };
      if (r.scope_ref_id) {
        pCounts[r.scope_ref_id] = (pCounts[r.scope_ref_id] ?? 0) + 1;
      }
    }

    setTeams(fetchedTeams);
    setDepartments(fetchedDepts);
    setProfiles(fetchedProfiles);
    setMemberCounts(mCounts);
    setPolicyCounts(pCounts);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Listen for proposeCreateTeam CustomEvent dispatched by Botsson tool
  useEffect(() => {
    function handleOpenDialog() {
      openDialogRef.current?.();
    }
    window.addEventListener("botsson:open-create-team-dialog", handleOpenDialog);
    return () => window.removeEventListener("botsson:open-create-team-dialog", handleOpenDialog);
  }, []);

  // Build TeamSummary[] for the harness bridge — stable derivation from fetched state
  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.department_id, d.name])),
    [departments],
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.profile_id, p.display_name])),
    [profiles],
  );

  const teamSummaries = useMemo<TeamSummary[]>(
    () =>
      teams.map((t) => ({
        teamId: t.team_id,
        name: t.name,
        slug: t.slug,
        teamType: t.team_type,
        isActive: t.is_active,
        departmentId: t.department_id,
        departmentName: t.department_id ? (deptMap.get(t.department_id) ?? null) : null,
        hasLeader: t.leader_profile_id !== null,
        leaderName: t.leader_profile_id ? (profileMap.get(t.leader_profile_id) ?? null) : null,
        memberCount: memberCounts[t.team_id] ?? 0,
        policyCount: policyCounts[t.team_id] ?? 0,
        description: t.description,
        color: t.color,
      })),
    [teams, deptMap, profileMap, memberCounts, policyCounts],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-1">
      {/* Harness bridge — registers Botsson tools for this surface */}
      <TeamsToolsBridge loading={loading} teams={teamSummaries} />

      <TeamsTab
        teams={teams}
        departments={departments}
        profiles={profiles}
        memberCounts={memberCounts}
        policyCounts={policyCounts}
        isDark={isDark}
        workspaceId={workspaceId}
        onRefresh={fetchData}
        loading={loading}
      />
    </div>
  );
}
