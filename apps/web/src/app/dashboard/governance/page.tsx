"use client";

/**
 * /dashboard/governance — client redirect shell + Botsson bridge.
 *
 * The governance surface lives under /dashboard/hms (HMS umbrella with
 * HmsSubNav). This page immediately redirects the user there while
 * simultaneously mounting GovernanceToolsBridge so Botsson has governance
 * tools available during the brief window before HMS loads.
 *
 * Bridge data is sourced from the same TanStack Query hooks used by
 * OversiktDashboard — no extra fetches, cache shared workspace-wide.
 *
 * ADR-0238: no embedded domain chat surface on this route.
 * ADR-0151: workspace_id resolved server-side by actions, not passed from bridge.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useGovernanceFiltered } from "@/app/dashboard/hms/_hooks/use-governance-filtered";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { GovernanceToolsBridge } from "./_tools/governance-tools-bridge";
import type {
  GovernanceProtocolSummary,
  GovernanceDeviationSummary,
} from "./_tools/use-governance-tools";

export default function GovernancePage() {
  const router = useRouter();

  // Source live governance data from the same hooks HMS uses (cache hit, no extra fetch)
  const { protocols, stats } = useGovernanceFiltered("all");
  const { data: rawDeviations } = useDeviations({ status: ["open", "acknowledged", "escalated"] });

  // Derive bridge input shapes
  const mappedProtocols: GovernanceProtocolSummary[] = (protocols ?? []).map((p) => ({
    protocolId: p.protocolId,
    protocolName: p.protocolName,
    policyType: p.policyType,
    totalAssigned: p.totalAssigned,
    completedCount: p.completedCount,
    completionPercent: p.completionPercent,
    expiredCount: p.expiredCount,
    notStartedCount: p.notStartedCount ?? 0,
    inProgressCount: p.inProgressCount ?? 0,
    waivedCount: p.waivedCount ?? 0,
  }));

  const mappedDeviations: GovernanceDeviationSummary[] = (rawDeviations ?? []).map((d) => ({
    deviationId: d.deviationId,
    title: d.title,
    severity: d.severity,
    status: d.status,
    domain: d.domain,
    departmentName: d.departmentName,
    blocksDayApproval: d.blocksDayApproval ?? false,
    createdAt: d.createdAt,
  }));

  // Assign-sheet intent — bridge proposeAssignProtocol records the target protocol.
  // The real AssignProtocolSheet lives in GovernanceOverview under /dashboard/hms/governance.
  // We store intent and navigate so the user lands on the governance sub-tab.
  const assignIntentRef = useRef<string | null>(null);

  // Redirect to HMS overview immediately
  useEffect(() => {
    router.replace("/dashboard/hms");
  }, [router]);

  return (
    <>
      <GovernanceToolsBridge
        protocols={mappedProtocols}
        openDeviations={mappedDeviations}
        avgCompletion={stats.avgCompletion}
        overdueCount={stats.overdue}
        activeTab="oversikt"
        navigateTo={(href) => router.push(href)}
        openAssignSheet={(id) => {
          // Record assign intent and route to governance sub-tab where sheet lives
          assignIntentRef.current = id;
          router.push("/dashboard/hms/governance");
        }}
      />
    </>
  );
}
