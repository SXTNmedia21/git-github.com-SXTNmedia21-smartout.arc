"use client";

// HMS → Governance sub-page
// Renders the governance admin tools (policy overview, protocol completion,
// employee assignments) under the HMS umbrella.

import { GovernanceOverview } from "@/app/dashboard/governance/_components/GovernanceOverview";
import { HmsSubNav } from "../_components/HmsSubNav";
import { useGovernanceOverview } from "@/app/dashboard/_hooks/use-governance-overview";

export default function HmsGovernancePage() {
  const { data: protocols, isLoading } = useGovernanceOverview();

  return (
    <div className="flex flex-col gap-6 p-6">
      <HmsSubNav />
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Laster governance-data...</div>
      ) : (
        <GovernanceOverview protocols={protocols ?? []} />
      )}
    </div>
  );
}
