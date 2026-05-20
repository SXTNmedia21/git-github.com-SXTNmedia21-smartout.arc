"use client";

/**
 * use-organisation-structure.ts
 *
 * Lifts the workspace structure data-fetch from /dashboard/organization/page.tsx
 * into a TanStack Query hook so the Struktur panel in Settings can consume it.
 *
 * Why a separate hook rather than importing from organization/:
 *   - organization/page.tsx is a client component, not a hook. Importing
 *     component state setters from a page is an antipattern.
 *   - TanStack Query deduplicates if organization/page.tsx is also mounted
 *     (same queryKey, same workspace_id). In practice the redirect means
 *     both are rarely simultaneously mounted.
 *
 * Returns the same data shape that organization/page.tsx computes locally.
 * Field names match to keep StrukturPanel's usage of DepartmentsTab,
 * LocationsTab, TeamsTab, OverviewTab compatible with zero changes to those
 * components.
 *
 * References:
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2 (Struktur in Settings)
 *   apps/web/src/app/dashboard/organization/page.tsx (source of truth for queries)
 */

import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type {
  CompanyRow,
  WorkspaceRow,
  DepartmentRow,
  LocationRow,
  TeamRow,
  PositionRow,
  ZoneRow,
  AssetRow,
  ProfileRow,
  PolicyRef,
  SetupCheckItem,
  CountMap,
} from "../../organization/_components/types";

export type OrgStructureData = {
  company: CompanyRow | null;
  workspace: WorkspaceRow | null;
  departments: DepartmentRow[];
  locations: LocationRow[];
  teams: TeamRow[];
  positions: PositionRow[];
  zones: ZoneRow[];
  assets: AssetRow[];
  profiles: ProfileRow[];
  policies: PolicyRef[];

  // Derived count maps
  positionCounts: CountMap;
  zoneCounts: CountMap;
  assetCounts: CountMap;
  memberCounts: CountMap;
  entityPolicyCounts: CountMap;
  policyCountsByScope: Record<string, number>;

  // Derived grouped maps
  positionsByDept: Record<string, PositionRow[]>;
  zonesByLocation: Record<string, ZoneRow[]>;
  assetsByLocation: Record<string, AssetRow[]>;

  // Derived counts
  profileCount: number;

  // Setup checklist
  setupChecklist: SetupCheckItem[];
  deptsWithoutPositions: DepartmentRow[];
  locsWithoutZones: LocationRow[];
};

type QueryResult = OrgStructureData;

async function fetchOrgStructure(workspaceId: string, companyId: string): Promise<QueryResult> {
  const supabase = createClient();
  const wid = workspaceId;
  const cid = companyId;

  // Phase 1: Parallel fetch of all data (mirrors organization/page.tsx fetchData)
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
        "position_id, name, slug, department_id, description, is_active, minimum_role, color, icon, sort_order",
      )
      .eq("workspace_id", wid),
    supabase.from("zone").select("*").eq("workspace_id", wid).order("sort_order"),
    supabase.from("asset").select("*").eq("workspace_id", wid).order("sort_order"),
    supabase
      .from("profile")
      .select("profile_id, display_name, role, department_id, status, is_active")
      .eq("workspace_id", wid)
      .eq("is_active", true),
    supabase.from("policy").select("policy_id, policy_scope, scope_ref_id").eq("workspace_id", wid),
  ]);

  const company = (companyRes.data as CompanyRow | null) ?? null;
  const workspace = (workspaceRes.data as WorkspaceRow | null) ?? null;
  const departments = (deptsRes.data ?? []) as DepartmentRow[];
  const locations = (locsRes.data ?? []) as LocationRow[];
  const policies = (policiesRes.data ?? []) as PolicyRef[];
  const fetchedTeams = (teamsRes.data ?? []) as TeamRow[];

  // Build position count map (active only)
  const fetchedPositions = (positionsRes.data ?? []) as PositionRow[];
  const positionCounts: CountMap = {};
  for (const p of fetchedPositions) {
    if (p.is_active) {
      positionCounts[p.department_id] = (positionCounts[p.department_id] ?? 0) + 1;
    }
  }

  // Build zone count map
  const fetchedZones = (zonesRes.data ?? []) as ZoneRow[];
  const zoneCounts: CountMap = {};
  for (const z of fetchedZones) {
    zoneCounts[z.location_id] = (zoneCounts[z.location_id] ?? 0) + 1;
  }

  // Build asset count map
  const fetchedAssets = (assetsRes.data ?? []) as AssetRow[];
  const assetCounts: CountMap = {};
  for (const a of fetchedAssets) {
    assetCounts[a.location_id] = (assetCounts[a.location_id] ?? 0) + 1;
  }

  const fetchedProfiles = (profilesRes.data ?? []) as ProfileRow[];

  // Phase 2: Team members (needs team IDs)
  const teamIds = fetchedTeams.map((t) => t.team_id);
  const memberCounts: CountMap = {};
  if (teamIds.length > 0) {
    const membersRes = await supabase
      .from("team_member")
      .select("team_member_id, team_id")
      .in("team_id", teamIds);
    if (membersRes.data) {
      for (const m of membersRes.data) {
        const tid = (m as { team_id: string }).team_id;
        memberCounts[tid] = (memberCounts[tid] ?? 0) + 1;
      }
    }
  }

  // Derived: policy counts by scope
  const policyCountsByScope: Record<string, number> = {};
  for (const p of policies) {
    policyCountsByScope[p.policy_scope] = (policyCountsByScope[p.policy_scope] ?? 0) + 1;
  }

  const entityPolicyCounts: CountMap = {};
  for (const p of policies) {
    if (p.scope_ref_id) {
      entityPolicyCounts[p.scope_ref_id] = (entityPolicyCounts[p.scope_ref_id] ?? 0) + 1;
    }
  }

  // Derived: grouped maps
  const positionsByDept: Record<string, PositionRow[]> = {};
  for (const p of fetchedPositions) {
    const arr = positionsByDept[p.department_id] ?? (positionsByDept[p.department_id] = []);
    arr.push(p);
  }
  for (const arr of Object.values(positionsByDept)) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  const zonesByLocation: Record<string, ZoneRow[]> = {};
  for (const z of fetchedZones) {
    const arr = zonesByLocation[z.location_id] ?? (zonesByLocation[z.location_id] = []);
    arr.push(z);
  }
  for (const arr of Object.values(zonesByLocation)) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

  const assetsByLocation: Record<string, AssetRow[]> = {};
  for (const a of fetchedAssets) {
    const arr = assetsByLocation[a.location_id] ?? (assetsByLocation[a.location_id] = []);
    arr.push(a);
  }
  for (const arr of Object.values(assetsByLocation)) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }

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

  return {
    company,
    workspace,
    departments,
    locations,
    teams: fetchedTeams,
    positions: fetchedPositions,
    zones: fetchedZones,
    assets: fetchedAssets,
    profiles: fetchedProfiles,
    policies,
    positionCounts,
    zoneCounts,
    assetCounts,
    memberCounts,
    entityPolicyCounts,
    policyCountsByScope,
    positionsByDept,
    zonesByLocation,
    assetsByLocation,
    profileCount: fetchedProfiles.length,
    setupChecklist,
    deptsWithoutPositions,
    locsWithoutZones,
  };
}

/**
 * useOrganisationStructure — TanStack Query hook for workspace structure data.
 *
 * Returns all D1-envelope data needed by StrukturPanel (Avdelinger, Lokasjoner, Team, Overview).
 * staleTime: 5 min — org structure rarely changes mid-session.
 */
export function useOrganisationStructure() {
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id;
  const companyId = workspaceData?.company_id;

  const query = useQuery({
    queryKey: ["organisation-structure", workspaceId],
    queryFn: () => fetchOrgStructure(workspaceId!, companyId!),
    enabled: !!workspaceId && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes — org structure rarely changes mid-session
  });

  // Stable empty fallback so destructuring is safe before data arrives
  const empty = useMemo<OrgStructureData>(
    () => ({
      company: null,
      workspace: null,
      departments: [],
      locations: [],
      teams: [],
      positions: [],
      zones: [],
      assets: [],
      profiles: [],
      policies: [],
      positionCounts: {},
      zoneCounts: {},
      assetCounts: {},
      memberCounts: {},
      entityPolicyCounts: {},
      policyCountsByScope: {},
      positionsByDept: {},
      zonesByLocation: {},
      assetsByLocation: {},
      profileCount: 0,
      setupChecklist: [],
      deptsWithoutPositions: [],
      locsWithoutZones: [],
    }),
    [],
  );

  return {
    data: query.data ?? empty,
    loading: query.isLoading,
    refetch: query.refetch,
    workspaceId: workspaceId ?? "",
  };
}
