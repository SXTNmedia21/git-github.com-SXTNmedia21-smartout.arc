"use client";

/**
 * struktur-panel.tsx
 *
 * Settings → Struktur tab content.
 * Hosts the four organisation sub-tabs (Oversikt, Avdelinger, Lokasjoner, Team).
 *
 * Data: useOrganisationStructure() (TanStack Query, deduplicates if org page is mounted).
 * Sub-tab state: local useState<OrgTab> — encoding into hash would conflict with
 *   settings top-level hash routing (OD-7).
 * Botsson tools: mounts OrganizationToolsBridge while rendered — keeps Botsson informed
 *   about org structure while the panel is active (ADR-0238 compliant —
 *   no domain chat surface; organisation has owns_chat_surface=false).
 *
 * Why import organisation components rather than moving files:
 *   SM-9 is "kun navigation" — zero file moves. DepartmentsTab, LocationsTab,
 *   TeamsTab, OverviewTab are stable leaf components that accept props. They are
 *   imported here and driven by useOrganisationStructure() rather than the
 *   page-level state machine in organization/page.tsx.
 *
 * References:
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2
 *   apps/web/src/app/dashboard/organization/_components/ (source components)
 */

import { useState, useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useOrganisationStructure } from "../_hooks/use-organisation-structure";
import { StrukturTabNav } from "./struktur-tab-nav";
import { OverviewTab } from "../../organization/_components/overview-tab";
import { DepartmentsTab } from "../../organization/_components/departments-tab";
import { LocationsTab } from "../../organization/_components/locations-tab";
import { TeamsTab } from "../../organization/_components/teams-tab";
import { OrganizationToolsBridge } from "../../organization/_tools/organization-tools-bridge";
import type { OrgTab } from "../../organization/_components/types";

type StrukturPanelProps = {
  /**
   * The sub-tab to open on mount. Passed from settings-tabs.tsx switch when
   * the user navigates directly to "avdelinger", "lokasjoner", or "team"
   * via the left-rail sidebar — preserves user intent without hash sub-encoding.
   */
  initialTab?: OrgTab;
};

export function StrukturPanel({ initialTab = "overview" }: StrukturPanelProps) {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<OrgTab>(initialTab);
  const { data, loading, refetch, workspaceId } = useOrganisationStructure();

  const {
    company,
    workspace,
    departments,
    locations,
    teams,
    profiles,
    positionCounts,
    zoneCounts,
    assetCounts,
    memberCounts,
    entityPolicyCounts,
    policyCountsByScope,
    positionsByDept,
    zonesByLocation,
    assetsByLocation,
    profileCount,
    setupChecklist,
    deptsWithoutPositions,
    locsWithoutZones,
  } = data;

  // refetch wrapper — DepartmentsTab/LocationsTab/TeamsTab expect () => Promise<void>
  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Botsson tool bridge — registers org tools while this panel is visible */}
      <OrganizationToolsBridge
        departments={departments}
        locations={locations}
        teams={teams}
        profileCount={profileCount}
        company={company}
        workspace={workspace}
        positionCounts={positionCounts}
        zoneCounts={zoneCounts}
        assetCounts={assetCounts}
        memberCounts={memberCounts}
        entityPolicyCounts={entityPolicyCounts}
        policyCountsByScope={policyCountsByScope}
        setupChecklist={setupChecklist}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Inner pill-nav — sub-tab switcher within the Struktur section */}
      <StrukturTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          departments: departments.length,
          locations: locations.length,
          teams: teams.length,
        }}
      />

      {/* Tab content area */}
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
            profiles={profiles}
            positionCounts={positionCounts}
            positionsByDept={positionsByDept}
            policyCounts={entityPolicyCounts}
            isDark={isDark}
            workspaceId={workspaceId ?? workspaceData?.workspace_id ?? ""}
            onRefresh={handleRefresh}
            loading={loading}
          />
        )}
        {activeTab === "locations" && (
          <LocationsTab
            locations={locations}
            zoneCounts={zoneCounts}
            assetCounts={assetCounts}
            policyCounts={entityPolicyCounts}
            zonesByLocation={zonesByLocation}
            assetsByLocation={assetsByLocation}
            isDark={isDark}
            workspaceId={workspaceId ?? workspaceData?.workspace_id ?? ""}
            onRefresh={handleRefresh}
            loading={loading}
          />
        )}
        {activeTab === "teams" && (
          <TeamsTab
            teams={teams}
            departments={departments}
            profiles={profiles}
            memberCounts={memberCounts}
            policyCounts={entityPolicyCounts}
            isDark={isDark}
            workspaceId={workspaceId ?? workspaceData?.workspace_id ?? ""}
            onRefresh={handleRefresh}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
