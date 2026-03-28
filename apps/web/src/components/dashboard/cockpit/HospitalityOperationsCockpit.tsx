"use client";

// ============================================
// HospitalityOperationsCockpit.tsx
// Composes the V1 hospitality first-screen
// cockpit into five focused action slices.
// Exists to deliver low-cognitive-load, action-
// first operations awareness on tactical view.
// ============================================

import { useMemo } from "react";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { CockpitActionRail } from "./CockpitActionRail";
import { CockpitActivityFeed } from "./CockpitActivityFeed";
import { CockpitOnDutyProgress } from "./CockpitOnDutyProgress";
import { CockpitRiskQueues } from "./CockpitRiskQueues";
import { CockpitTopStrip } from "./CockpitTopStrip";

/**
 * Returns summary counters derived from first-screen read model output.
 *
 * Why: Slice components should receive compact props and avoid duplicated counting logic.
 *
 * @param args - Inputs from cockpit read-model output.
 * @returns Aggregated counters used by the top-strip slice.
 */
function buildTopStripSummary(args: {
  staffingSeverity: Array<"critical" | "warning" | "info">;
  operationalSeverity: Array<"critical" | "warning" | "info">;
  onDutyCount: number;
  eventCount: number;
}) {
  const allRiskSeverity = [...args.staffingSeverity, ...args.operationalSeverity];
  const criticalCount = allRiskSeverity.filter((severity) => severity === "critical").length;
  const warningCount = allRiskSeverity.filter((severity) => severity === "warning").length;

  return {
    onDutyCount: args.onDutyCount,
    criticalCount,
    warningCount,
    eventCount: args.eventCount,
  };
}

/**
 * Renders the V1 hospitality operations cockpit with exactly five slices.
 *
 * Why: Tactical dashboard needs a dedicated first-screen for immediate operations decisions.
 *
 * @returns First-screen cockpit layout composed from the existing read-model hook.
 */
export function HospitalityOperationsCockpit() {
  const model = useCockpitFirstScreen({
    feedLimit: 24,
    feedFilters: { category: "all", timeRange: "today" },
  });

  const summary = useMemo(
    () =>
      buildTopStripSummary({
        staffingSeverity: model.staffingQueue.map((risk) => risk.severity),
        operationalSeverity: model.operationalQueue.map((risk) => risk.severity),
        onDutyCount: model.onDutyEntries.length,
        eventCount: model.feed.length,
      }),
    [model.feed.length, model.onDutyEntries.length, model.operationalQueue, model.staffingQueue],
  );

  return (
    <div data-testid="hospitality-operations-cockpit" className="dashboard-enter space-y-4 pb-8">
      <CockpitTopStrip
        isLoading={model.isLoading}
        onDutyCount={summary.onDutyCount}
        criticalCount={summary.criticalCount}
        warningCount={summary.warningCount}
        eventCount={summary.eventCount}
        lastUpdatedAt={model.feed[0]?.occurredAt ?? null}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <CockpitRiskQueues
            staffingQueue={model.staffingQueue}
            operationalQueue={model.operationalQueue}
            isLoading={model.isLoading}
          />
          <CockpitOnDutyProgress entries={model.onDutyEntries} isLoading={model.isLoading} />
          <CockpitActivityFeed feed={model.feed} isLoading={model.isLoading} />
        </div>

        <div className="xl:col-span-1">
          <CockpitActionRail
            staffingQueue={model.staffingQueue}
            operationalQueue={model.operationalQueue}
            onDutyEntries={model.onDutyEntries}
            isLoading={model.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
