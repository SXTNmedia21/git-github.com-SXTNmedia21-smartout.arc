"use client";

/**
 * hms-tools-bridge.tsx — registers Botsson tools for /dashboard/hms (root).
 *
 * Mounted inside HmsPageClient so it captures live state from the hooks
 * that power OversiktDashboard. Returns null — purely a side-effect component.
 * Tools are unregistered automatically on unmount (route change).
 *
 * Scope: "hms" — umbrella-level overview + cross-tab navigation.
 * NOT "governance" — that scope is registered separately in
 * apps/web/src/app/dashboard/governance/_tools/governance-tools-bridge.tsx.
 *
 * ADR-0238: HMS root is not a chat surface (owns_chat_surface=false).
 * BotssonShell operates in normal interactive mode.
 */

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useGovernanceFiltered } from "../_hooks/use-governance-filtered";
import { useDeviations } from "../_hooks/use-deviations";
import { useDriftInsights } from "../_hooks/use-drift-insights";
import { useHmsTools, type HmsTab } from "./use-hms-tools";

/** Tab href map — matches HmsSubNav. */
const TAB_HREFS: Record<HmsTab, string> = {
  oversikt: "/dashboard/hms",
  drift: "/dashboard/hms/drift",
  training: "/dashboard/hms/training",
  documents: "/dashboard/hms/documents",
  deviations: "/dashboard/hms/deviations",
  governance: "/dashboard/hms/governance",
};

export function HmsToolsBridge() {
  const router = useRouter();

  // Governance / protocol summary — same query as OversiktDashboard (TanStack cache shared, no extra fetch)
  const { stats, protocols } = useGovernanceFiltered("all");

  // Open deviations — same query as OversiktDashboard (TanStack cache shared)
  const { data: openDeviations } = useDeviations({ status: ["open", "acknowledged", "escalated"] });

  // Drift insights for today — same date key as DriftInsightStrip
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { insights: driftInsights } = useDriftInsights(today);

  // Count overdue protocols (those with expiredCount > 0)
  const overdueProtocolCount = useMemo(
    () => protocols.filter((p) => p.expiredCount > 0).length,
    [protocols],
  );

  const tools = useHmsTools({
    readinessPercent: stats.avgCompletion,
    totalProtocols: stats.total,
    overdueProtocolCount,
    upcomingReviewCount: 0, // Fetched inline in OversiktDashboard — not exposed from hook; surfaced as 0 at umbrella level
    openDeviations: openDeviations ?? [],
    driftInsights: driftInsights ?? null,
    uiActions: {
      navigateToTab: (tab: HmsTab) => {
        router.push(TAB_HREFS[tab]);
      },
    },
  });

  useRegisterTools("hms", tools);
  return null;
}
