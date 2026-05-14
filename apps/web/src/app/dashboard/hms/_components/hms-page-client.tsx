"use client";

import { useContext } from "react";
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
 */
export function HmsPageClient() {
  const { isAdminMode } = useContext(DashboardContext);

  return (
    <>
      <HmsToolsBridge />
      {isAdminMode ? <OversiktDashboard /> : <OversiktEmployee />}
    </>
  );
}
