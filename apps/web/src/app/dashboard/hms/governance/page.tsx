"use client";

// HMS → Governance sub-page
// Renders the governance admin tools (policy overview, protocol completion,
// employee assignments) under the HMS umbrella, plus maintenance procedure
// checklists (cleaning checklists) below.
// HmsSubNav is rendered by the HMS layout — do NOT add it here.

import { GovernanceOverview } from "@/app/dashboard/governance/_components/GovernanceOverview";
import { useGovernanceOverview } from "@/app/dashboard/_hooks/use-governance-overview";
import { MaintenanceProcedureForm } from "./_components/MaintenanceProcedureForm";
import { HmsGovernanceToolsBridge } from "./_tools/hms-governance-tools-bridge";
import { RoutineForm } from "@/app/dashboard/governance/_components/RoutineForm";

export default function HmsGovernancePage() {
  const { data: protocols, isLoading } = useGovernanceOverview();

  if (isLoading) {
    return (
      <>
        <HmsGovernanceToolsBridge loading={true} protocols={[]} />
        <div className="text-muted-foreground p-6 text-sm">Laster governance-data...</div>
      </>
    );
  }

  return (
    <>
      <HmsGovernanceToolsBridge loading={false} protocols={protocols ?? []} />
      <div className="space-y-8">
        {/* Authoring toolbar — content creation actions at the top of the page */}
        <div className="flex flex-wrap items-center gap-3">
          <RoutineForm />
        </div>
        <GovernanceOverview protocols={protocols ?? []} />
        <MaintenanceProcedureForm />
      </div>
    </>
  );
}
