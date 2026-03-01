"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { OrgTabNav } from "./_components/org-tab-nav";
import { OverviewTab } from "./_components/overview-tab";
import { DepartmentsTab } from "./_components/departments-tab";
import { LocationsTab } from "./_components/locations-tab";
import { TeamsTab } from "./_components/teams-tab";
import type {
  OrgTab,
  CompanyRow,
  WorkspaceRow,
  DepartmentRow,
  LocationRow,
  TeamRow,
  PolicyRef,
  CountMap,
  PositionRow,
  SetupCheckItem,
} from "./_components/types";

export default function OrganizationPage() {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<OrgTab>("overview");
  const [loading, setLoading] = useState(true);

  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRef[]>([]);

  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [positionCounts, setPositionCounts] = useState<CountMap>({});
  const [zoneCounts, setZoneCounts] = useState<CountMap>({});
  const [assetCounts, setAssetCounts] = useState<CountMap>({});
  const [memberCounts, setMemberCounts] = useState<CountMap>({});
  const [profileCount, setProfileCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!workspaceData?.workspace_id || !workspaceData?.company_id) return;
    setLoading(true);
    const supabase = createClient();
    const wid = workspaceData.workspace_id;
    const cid = workspaceData.company_id;

    // Phase 1: Parallel fetch of all data
    const [
      companyRes,
      workspaceRes,
      deptsRes,
      locsRes,
      teamsRes,
      positionsRes,
      zonesRes,
      assetsRes,
      profilesRes,
      policiesRes,
    ] = await Promise.all([
      supabase.from("company").select("*").eq("company_id", cid).single(),
      supabase.from("workspace").select("*").eq("workspace_id", wid).single(),
      supabase.from("department").select("*").eq("workspace_id", wid).order("sort_order"),
      supabase.from("location").select("*").eq("workspace_id", wid).order("sort_order"),
      supabase.from("team").select("*").eq("workspace_id", wid),
      supabase
        .from("position")
        .select(
          "position_id, name, department_id, is_active, minimum_role, color, icon, sort_order",
        )
        .eq("workspace_id", wid),
      supabase.from("zone").select("zone_id, location_id").eq("workspace_id", wid),
      supabase.from("asset").select("asset_id, location_id").eq("workspace_id", wid),
      supabase
        .from("profile")
        .select("profile_id", { count: "exact", head: true })
        .eq("workspace_id", wid),
      supabase
        .from("policy")
        .select("policy_id, policy_scope, scope_ref_id")
        .eq("workspace_id", wid),
    ]);

    if (companyRes.data) setCompany(companyRes.data as CompanyRow);
    if (workspaceRes.data) setWorkspace(workspaceRes.data as WorkspaceRow);
    if (deptsRes.data) setDepartments(deptsRes.data as DepartmentRow[]);
    if (locsRes.data) setLocations(locsRes.data as LocationRow[]);
    if (policiesRes.data) setPolicies(policiesRes.data as PolicyRef[]);

    const fetchedTeams = (teamsRes.data ?? []) as TeamRow[];
    setTeams(fetchedTeams);

    // Store positions and build count map (active only for validation)
    const fetchedPositions = (positionsRes.data ?? []) as PositionRow[];
    setPositions(fetchedPositions);
    {
      const map: CountMap = {};
      for (const p of fetchedPositions) {
        if (p.is_active) {
          map[p.department_id] = (map[p.department_id] ?? 0) + 1;
        }
      }
      setPositionCounts(map);
    }

    // Build zone count map
    if (zonesRes.data) {
      const map: CountMap = {};
      for (const z of zonesRes.data) {
        const lid = (z as { location_id: string }).location_id;
        map[lid] = (map[lid] ?? 0) + 1;
      }
      setZoneCounts(map);
    }

    // Build asset count map
    if (assetsRes.data) {
      const map: CountMap = {};
      for (const a of assetsRes.data) {
        const lid = (a as { location_id: string }).location_id;
        map[lid] = (map[lid] ?? 0) + 1;
      }
      setAssetCounts(map);
    }

    setProfileCount(profilesRes.count ?? 0);

    // Phase 2: Team members (needs team IDs, no workspace_id column)
    const teamIds = fetchedTeams.map((t) => t.team_id);
    if (teamIds.length > 0) {
      const membersRes = await supabase
        .from("team_member")
        .select("team_member_id, team_id")
        .in("team_id", teamIds);

      if (membersRes.data) {
        const map: CountMap = {};
        for (const m of membersRes.data) {
          const tid = (m as { team_id: string }).team_id;
          map[tid] = (map[tid] ?? 0) + 1;
        }
        setMemberCounts(map);
      }
    }

    setLoading(false);
  }, [workspaceData?.workspace_id, workspaceData?.company_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute policy counts by scope and by entity
  const policyCountsByScope = policies.reduce<Record<string, number>>((acc, p) => {
    acc[p.policy_scope] = (acc[p.policy_scope] ?? 0) + 1;
    return acc;
  }, {});

  const entityPolicyCounts = policies.reduce<CountMap>((acc, p) => {
    if (p.scope_ref_id) {
      acc[p.scope_ref_id] = (acc[p.scope_ref_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  // Group positions by department
  const positionsByDept = useMemo(() => {
    const map: Record<string, PositionRow[]> = {};
    for (const p of positions) {
      const arr = map[p.department_id] ?? (map[p.department_id] = []);
      arr.push(p);
    }
    // Sort each group by sort_order
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return map;
  }, [positions]);

  // Setup checklist
  const activeDepts = departments.filter((d) => d.is_active);
  const deptsWithoutPositions = activeDepts.filter(
    (d) => (positionCounts[d.department_id] ?? 0) === 0,
  );
  const activeLocations = locations.filter((l) => l.is_active);
  const locsWithoutZones = activeLocations.filter((l) => (zoneCounts[l.location_id] ?? 0) === 0);

  const setupChecklist: SetupCheckItem[] = [
    {
      key: "dept",
      label: "Create at least one department",
      done: departments.length > 0,
      tab: "departments",
    },
    {
      key: "positions",
      label: "Define positions in each department",
      done: activeDepts.length > 0 && deptsWithoutPositions.length === 0,
      tab: "departments",
    },
    {
      key: "location",
      label: "Create at least one location",
      done: locations.length > 0,
      tab: "locations",
    },
    {
      key: "policy",
      label: "Attach at least one policy",
      done: policies.length > 0,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className={`text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
          >
            Organization
          </h1>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Company, workspace structure, and governance connections
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <OrgTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          departments: departments.length,
          locations: locations.length,
          teams: teams.length,
        }}
        isDark={isDark}
      />

      {/* Tab Content */}
      <div className="hide-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
        {activeTab === "overview" && (
          <OverviewTab
            company={company}
            workspace={workspace}
            stats={{
              departments: departments.length,
              locations: locations.length,
              teams: teams.length,
              profiles: profileCount,
            }}
            policyCountsByScope={policyCountsByScope}
            setupChecklist={setupChecklist}
            deptsWithoutPositions={deptsWithoutPositions.length}
            locsWithoutZones={locsWithoutZones.length}
            isDark={isDark}
            loading={loading}
            onTabChange={setActiveTab}
          />
        )}
        {activeTab === "departments" && (
          <DepartmentsTab
            departments={departments}
            positionCounts={positionCounts}
            positionsByDept={positionsByDept}
            policyCounts={entityPolicyCounts}
            isDark={isDark}
            workspaceId={workspaceData?.workspace_id ?? ""}
            onRefresh={fetchData}
            loading={loading}
          />
        )}
        {activeTab === "locations" && (
          <LocationsTab
            locations={locations}
            zoneCounts={zoneCounts}
            assetCounts={assetCounts}
            policyCounts={entityPolicyCounts}
            isDark={isDark}
            workspaceId={workspaceData?.workspace_id ?? ""}
            onRefresh={fetchData}
            loading={loading}
          />
        )}
        {activeTab === "teams" && (
          <TeamsTab
            teams={teams}
            departments={departments}
            memberCounts={memberCounts}
            policyCounts={entityPolicyCounts}
            isDark={isDark}
            workspaceId={workspaceData?.workspace_id ?? ""}
            onRefresh={fetchData}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
