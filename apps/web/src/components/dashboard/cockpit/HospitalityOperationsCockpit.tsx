"use client";

// ============================================
// HospitalityOperationsCockpit.tsx
// Composes the V1 hospitality first-screen
// cockpit into five focused action slices.
// Exists to deliver low-cognitive-load, action-
// first operations awareness on tactical view.
// ============================================

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
// useEntityDrawer removed — activity feed panel removed from cockpit
import { CockpitActionRail } from "./CockpitActionRail";
import { CockpitOnDutyProgress } from "./CockpitOnDutyProgress";
import { CockpitRiskQueues } from "./CockpitRiskQueues";
import { CockpitPrepStrip } from "./CockpitPrepStrip";

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
  const router = useRouter();

  const handleStaffingPress = useCallback(
    (_riskId: string) => router.push("/dashboard/schedule"),
    [router],
  );

  const handleOperationalPress = useCallback(
    (_riskId: string) => {
      /* Operational risk IDs are department-based — open operations page for now.
         When individual deviation/task IDs are available, open the entity drawer instead. */
      router.push("/dashboard/operations");
    },
    [router],
  );

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
    <div
      data-testid="hospitality-operations-cockpit"
      className="dashboard-enter grid h-full grid-cols-1 gap-2 overflow-hidden xl:grid-cols-3"
    >
      {/* ── LEFT: Drift + Forberedelse stacked ── */}
      <div className="flex min-h-0 flex-col gap-3 xl:col-span-2">
        {/* Drift — bemanning + risiko */}
        <section className="border-border/30 bg-card/30 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border backdrop-blur-sm">
          <div className="border-border/20 flex items-center justify-between border-b px-4 pt-3 pb-2">
            <h2 className="text-muted-foreground/60 text-[10px] font-bold tracking-[0.15em] uppercase">
              Drift
            </h2>
            <span className="text-muted-foreground/40 text-[10px] tabular-nums">
              {summary.onDutyCount} pa jobb · {summary.criticalCount + summary.warningCount} varsler
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            <CockpitRiskQueues
              staffingQueue={model.staffingQueue}
              operationalQueue={model.operationalQueue}
              isLoading={model.isLoading}
              onStaffingPress={handleStaffingPress}
              onOperationalPress={handleOperationalPress}
            />
            <CockpitOnDutyProgress entries={model.onDutyEntries} isLoading={model.isLoading} />
          </div>
        </section>

        {/* Forberedelse — 7-dags horisont */}
        <section className="border-border/30 bg-card/30 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-sm">
          <div className="border-border/20 flex items-center justify-between border-b px-4 pt-3 pb-2">
            <h2 className="text-muted-foreground/60 text-[10px] font-bold tracking-[0.15em] uppercase">
              Forberedelse
            </h2>
          </div>
          <div className="p-3">
            <CockpitPrepStrip />
          </div>
        </section>
      </div>

      {/* ── RIGHT: Krever handling (full height) ── */}
      <section className="border-border/30 bg-card/30 flex min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-sm">
        <div className="border-border/20 flex items-center justify-between border-b px-4 pt-3 pb-2">
          <h2 className="text-muted-foreground/60 text-[10px] font-bold tracking-[0.15em] uppercase">
            Krever handling
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <CockpitActionRail
            staffingQueue={model.staffingQueue}
            operationalQueue={model.operationalQueue}
            onDutyEntries={model.onDutyEntries}
            isLoading={model.isLoading}
          />
        </div>
      </section>
    </div>
  );
}
