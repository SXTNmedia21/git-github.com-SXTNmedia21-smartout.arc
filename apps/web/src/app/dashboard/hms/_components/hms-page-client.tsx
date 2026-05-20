"use client";

import { useContext, useEffect, useRef } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { OversiktDashboard } from "./OversiktDashboard";
import { OversiktEmployee } from "./OversiktEmployee";
import { HmsToolsBridge } from "../_tools/hms-tools-bridge";

/**
 * HmsPageClient — client surface for /dashboard/hms.
 *
 * Conditionally renders admin vs employee dashboard based on the
 * `isAdminMode` client toggle from DashboardContext. Each variant owns
 * its own data fetching via TanStack hooks; server-side prefetch deferred
 * pending refactor of useGovernanceFiltered + useDeviations + useCompetenceData
 * to accept hydrated initial data.
 *
 * HmsToolsBridge is mounted here (not in layout.tsx) so it captures live
 * hook data without causing double-mount conflicts with the governance
 * bridge on /dashboard/hms/governance sub-route.
 *
 * Emits `hms.umbrella.viewed` once workspace + actor IDs are resolved (L-0177).
 */
export function HmsPageClient() {
  const { isAdminMode, workspaceData, profileId } = useContext(DashboardContext);

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `hms.umbrella.viewed` once workspace AND profile are resolved.
  // workspace_readiness_percent deferred — aggregate readiness requires
  // useGovernanceFiltered which lives inside OversiktDashboard; plumbing it up
  // here is out of scope (ADR-0115). Use 0 as initial snapshot value.
  // TODO: wire real readiness percent when useGovernanceFiltered is lifted to page level.
  const umbrellaViewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || umbrellaViewedRef.current) return;
    umbrellaViewedRef.current = true;
    void emit({
      event: "hms.umbrella.viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "HMS Umbrella",
        },
        data: { workspace_readiness_percent: 0 },
      },
    });
  }, [workspaceId, profileId]);

  return (
    <>
      <HmsToolsBridge />
      {isAdminMode ? <OversiktDashboard /> : <OversiktEmployee />}
    </>
  );
}
