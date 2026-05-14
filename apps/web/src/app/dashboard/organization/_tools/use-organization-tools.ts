"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-organization-tools.ts — Botsson tools for the /dashboard/organization surface.
 *
 * Seven tools — six read, one navigation:
 *
 *   getOrganizationOverview  — D1-envelope summary: counts, setup progress, subscription
 *   listDepartments          — all D1 departments with position + policy counts
 *   listLocations            — all D1 locations with zone + asset + policy counts
 *   listTeams                — all teams with member counts and department link
 *   getDepartmentDetail      — single department: positions, member count, policy count
 *   getSetupChecklist        — workspace setup completeness with action hints
 *   switchOrgTab             — navigate to a sub-tab (overview/departments/locations/teams)
 *
 * No write tools at root level — writes happen in sub-routes (departments/[id]/edit etc).
 *
 * Pattern: useGovernanceTools — dataRef refreshed every render, definitions stable
 * via useMemo([], []). workspace_id is resolved server-side per ADR-0151.
 *
 * Cascade vocabulary:
 *   D1 (Envelope) — department, location (permanent structural units)
 *   D2 (Resource) — team (seasonal membership overlay on D1 departments)
 */

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type {
  OrgTab,
  DepartmentRow,
  LocationRow,
  TeamRow,
  CountMap,
  SetupCheckItem,
  CompanyRow,
  WorkspaceRow,
} from "../_components/types";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

const ORG_TABS = ["overview", "departments", "locations", "teams"] as const;
type OrgTabId = (typeof ORG_TABS)[number];

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type OrganizationToolInput = {
  /** Current D1-layer departments for this workspace. */
  departments: DepartmentRow[];
  /** Current D1-layer locations for this workspace. */
  locations: LocationRow[];
  /** Teams (D2 resource overlay) for this workspace. */
  teams: TeamRow[];
  /** Active employee profile count. */
  profileCount: number;
  /** Active workspace plan + company identity. */
  company: CompanyRow | null;
  /** Workspace operational config (timezone, currency, max_profiles, etc). */
  workspace: WorkspaceRow | null;
  /** Position counts per department_id (active positions only). */
  positionCounts: CountMap;
  /** Zone counts per location_id. */
  zoneCounts: CountMap;
  /** Asset counts per location_id. */
  assetCounts: CountMap;
  /** Team member counts per team_id. */
  memberCounts: CountMap;
  /** Policy counts per entity id (department / location / team). */
  entityPolicyCounts: CountMap;
  /** Policy counts by scope key ("workspace" | "department" | "location" | "team"). */
  policyCountsByScope: Record<string, number>;
  /** Setup checklist items with completion state. */
  setupChecklist: SetupCheckItem[];
  /** Currently visible tab. */
  activeTab: OrgTab;
  /** Navigate to a different org tab. */
  onTabChange: (tab: OrgTab) => void;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function isValidTab(v: unknown): v is OrgTabId {
  return typeof v === "string" && (ORG_TABS as readonly string[]).includes(v);
}

function summarizeDepartment(
  dept: DepartmentRow,
  positionCounts: CountMap,
  entityPolicyCounts: CountMap,
  profileCountByDept: CountMap,
) {
  return {
    departmentId: dept.department_id,
    name: dept.name,
    isActive: dept.is_active,
    positionCount: positionCounts[dept.department_id] ?? 0,
    policyCount: entityPolicyCounts[dept.department_id] ?? 0,
    memberCount: profileCountByDept[dept.department_id] ?? 0,
    color: dept.color,
    icon: dept.icon,
  };
}

function summarizeLocation(
  loc: LocationRow,
  zoneCounts: CountMap,
  assetCounts: CountMap,
  entityPolicyCounts: CountMap,
) {
  return {
    locationId: loc.location_id,
    name: loc.name,
    locationType: loc.location_type,
    isActive: loc.is_active,
    zoneCount: zoneCounts[loc.location_id] ?? 0,
    assetCount: assetCounts[loc.location_id] ?? 0,
    policyCount: entityPolicyCounts[loc.location_id] ?? 0,
    capacity: loc.capacity,
    address: loc.address,
  };
}

function summarizeTeam(team: TeamRow, memberCounts: CountMap, entityPolicyCounts: CountMap) {
  return {
    teamId: team.team_id,
    name: team.name,
    teamType: team.team_type,
    isActive: team.is_active,
    departmentId: team.department_id,
    memberCount: memberCounts[team.team_id] ?? 0,
    policyCount: entityPolicyCounts[team.team_id] ?? 0,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useOrganizationTools(input: OrganizationToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOrganizationOverview",
          description:
            "Get the D1-envelope summary for this workspace — department count, location count, team count, active staff count, subscription plan/status, setup checklist progress, and current active tab. Call first when the user asks any open-ended question about the organization.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listDepartments",
          description:
            "List all D1-layer departments with their position count, member count, and policy count. Use when the user asks 'hvilke avdelinger har vi?', 'vis alle avdelinger', or wants to see department structure.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), only return active departments. Set false to include inactive.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listLocations",
          description:
            "List all D1-layer locations with zone count, asset count, and policy count. Use when the user asks 'hvilke lokaler har vi?', 'vis lokasjoner', or needs a venue/premises overview.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), only return active locations. Set false to include inactive.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listTeams",
          description:
            "List all teams with member count, team type, and linked department. Use when the user asks 'hvilke team finnes?', 'vis alle team', or wants a cross-department team overview.",
          dynamicParameters: [
            {
              name: "department_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional department_id to filter teams by department. Omit to list all teams.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDepartmentDetail",
          description:
            "Get detailed info for a single D1-layer department — position count, active member count, policy count, and department metadata. Use when the user asks about a specific department by name or id.",
          dynamicParameters: [
            {
              name: "department_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "UUID of the department. Get from listDepartments if unknown. Must be non-empty.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSetupChecklist",
          description:
            "Return the workspace setup checklist with completion state per item and overall progress %. Use when the user asks 'hva gjenstår i oppsettet?', 'er vi ferdig satt opp?', or wants to know what to configure next.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchOrgTab",
          description:
            "Navigate to a specific organization sub-tab. Use when the user says 'vis avdelinger', 'gå til team', 'åpne lokasjoner', or navigates within the organization page. Accepts: overview | departments | locations | teams.",
          dynamicParameters: [
            {
              name: "tab",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "'overview' | 'departments' | 'locations' | 'teams'",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getOrganizationOverview: () => {
        const d = dataRef.current;
        const totalPolicies = Object.values(d.policyCountsByScope).reduce((a, b) => a + b, 0);
        const doneCount = d.setupChecklist.filter((c) => c.done).length;
        const setupPercent =
          d.setupChecklist.length > 0
            ? Math.round((doneCount / d.setupChecklist.length) * 100)
            : 100;
        return JSON.stringify({
          workspaceName: d.workspace?.name ?? null,
          companyName: d.company?.name ?? null,
          subscriptionPlan: d.company?.subscription_plan ?? null,
          subscriptionStatus: d.company?.subscription_status ?? null,
          departments: d.departments.length,
          activeDepartments: d.departments.filter((x) => x.is_active).length,
          locations: d.locations.length,
          activeLocations: d.locations.filter((x) => x.is_active).length,
          teams: d.teams.length,
          activeStaff: d.profileCount,
          maxProfiles: d.workspace?.max_profiles ?? null,
          totalPolicies,
          policyCountsByScope: d.policyCountsByScope,
          setupProgress: { done: doneCount, total: d.setupChecklist.length, percent: setupPercent },
          activeTab: d.activeTab,
        });
      },

      listDepartments: (params) => {
        const d = dataRef.current;
        const activeOnly = params.active_only !== false; // default true
        const list = activeOnly ? d.departments.filter((x) => x.is_active) : [...d.departments];

        // Build profile counts per department
        const profileCountByDept: CountMap = {};
        // profileCount is a flat total — per-dept breakdown not available at overview level
        // Return what we have: positionCounts is per-dept and is meaningful
        return JSON.stringify({
          count: list.length,
          activeOnly,
          departments: list.map((dept) =>
            summarizeDepartment(dept, d.positionCounts, d.entityPolicyCounts, profileCountByDept),
          ),
        });
      },

      listLocations: (params) => {
        const d = dataRef.current;
        const activeOnly = params.active_only !== false; // default true
        const list = activeOnly ? d.locations.filter((x) => x.is_active) : [...d.locations];
        return JSON.stringify({
          count: list.length,
          activeOnly,
          locations: list.map((loc) =>
            summarizeLocation(loc, d.zoneCounts, d.assetCounts, d.entityPolicyCounts),
          ),
        });
      },

      listTeams: (params) => {
        const d = dataRef.current;
        const deptId =
          typeof params.department_id === "string" && params.department_id.trim() !== ""
            ? params.department_id
            : null;
        const list = deptId ? d.teams.filter((t) => t.department_id === deptId) : [...d.teams];
        return JSON.stringify({
          count: list.length,
          filteredByDepartment: deptId,
          teams: list.map((team) => summarizeTeam(team, d.memberCounts, d.entityPolicyCounts)),
        });
      },

      getDepartmentDetail: (params) => {
        const d = dataRef.current;
        const id = params.department_id;
        if (typeof id !== "string" || id.trim() === "") {
          return JSON.stringify({ error: "department_id er påkrevd." });
        }
        const dept = d.departments.find((x) => x.department_id === id);
        if (!dept) {
          return JSON.stringify({ error: `Fant ingen avdeling med id ${id}.` });
        }
        return JSON.stringify({
          department: summarizeDepartment(dept, d.positionCounts, d.entityPolicyCounts, {}),
        });
      },

      getSetupChecklist: () => {
        const d = dataRef.current;
        const doneCount = d.setupChecklist.filter((c) => c.done).length;
        const total = d.setupChecklist.length;
        const percent = total > 0 ? Math.round((doneCount / total) * 100) : 100;
        return JSON.stringify({
          progress: { done: doneCount, total, percent },
          allDone: doneCount === total,
          items: d.setupChecklist.map((item) => ({
            key: item.key,
            label: item.label,
            done: item.done,
            navigateTo: item.tab ?? null,
          })),
        });
      },

      switchOrgTab: (params) => {
        const d = dataRef.current;
        const tab = params.tab;
        if (!isValidTab(tab)) {
          return JSON.stringify({
            error: "tab må være overview | departments | locations | teams.",
          });
        }
        d.onTabChange(tab);
        return JSON.stringify({ ok: true, tab });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
