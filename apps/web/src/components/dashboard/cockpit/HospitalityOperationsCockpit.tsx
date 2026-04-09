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
import type { CockpitEventEnvelope } from "@smartout/types";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { CockpitActionRail } from "./CockpitActionRail";
import { CockpitActivityFeed } from "./CockpitActivityFeed";
import { CockpitOnDutyProgress } from "./CockpitOnDutyProgress";
import { CockpitRiskQueues } from "./CockpitRiskQueues";
import { CockpitTopStrip } from "./CockpitTopStrip";
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
  const { openDrawer } = useEntityDrawer();
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

  const handleEventPress = useCallback(
    (event: CockpitEventEnvelope) => {
      const ref = event.entityRef;
      if (!ref) return;

      const drawerTypes = new Set([
        "shift",
        "department_session",
        "cascade_task",
        "profile",
        "department",
        "team",
      ]);
      if (drawerTypes.has(ref.type)) {
        openDrawer(
          ref.type as
            | "shift"
            | "department_session"
            | "cascade_task"
            | "profile"
            | "department"
            | "team",
          ref.id,
        );
      }
    },
    [openDrawer],
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
    <div data-testid="hospitality-operations-cockpit" className="dashboard-enter space-y-6 pb-8">
      <CockpitTopStrip
        isLoading={model.isLoading}
        onDutyCount={summary.onDutyCount}
        criticalCount={summary.criticalCount}
        warningCount={summary.warningCount}
        eventCount={summary.eventCount}
        lastUpdatedAt={model.feed[0]?.occurredAt ?? null}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* ── DRIFT — today's operations ── */}
          <section className="border-border/30 bg-card/30 space-y-4 rounded-2xl border p-5 backdrop-blur-sm">
            <h2 className="text-muted-foreground/60 text-[10px] font-bold tracking-[0.15em] uppercase">
              Drift
            </h2>
            <CockpitRiskQueues
              staffingQueue={model.staffingQueue}
              operationalQueue={model.operationalQueue}
              isLoading={model.isLoading}
              onStaffingPress={handleStaffingPress}
              onOperationalPress={handleOperationalPress}
            />
            <CockpitOnDutyProgress entries={model.onDutyEntries} isLoading={model.isLoading} />
            <CockpitActivityFeed
              feed={model.feed}
              isLoading={model.isLoading}
              onEventPress={handleEventPress}
            />
          </section>

          {/* ── FORBEREDELSE — next 7 days ── */}
          <section className="border-border/30 bg-card/30 space-y-4 rounded-2xl border p-5 backdrop-blur-sm">
            <CockpitPrepStrip />
          </section>
        </div>

        {/* ── ACTION RAIL — always visible ── */}
        <div className="xl:sticky xl:top-4 xl:col-span-1 xl:self-start">
          <div className="border-border/30 bg-card/30 rounded-2xl border p-4 backdrop-blur-sm">
            <h2 className="text-muted-foreground/60 mb-4 text-[10px] font-bold tracking-[0.15em] uppercase">
              Krever handling
            </h2>
            <CockpitActionRail
              staffingQueue={model.staffingQueue}
              operationalQueue={model.operationalQueue}
              onDutyEntries={model.onDutyEntries}
              isLoading={model.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
