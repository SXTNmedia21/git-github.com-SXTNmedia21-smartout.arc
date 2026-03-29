"use client";

/**
 * InteractiveDashboard — Action-oriented bento grid dashboard.
 *
 * Replaces the passive tactical+strategic views with a unified,
 * mode-switching command center. Composes all interactive sub-components
 * into a responsive CSS grid that swaps layout slots between operative
 * (live shift management) and preparatory (workforce planning) modes.
 */

import { useContext, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "../DashboardShell";
import { useDashboardMode } from "@/app/dashboard/_hooks/use-dashboard-mode";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { DashboardMetricStrip } from "./DashboardMetricStrip";
import { TaskSwiper } from "./TaskSwiper";
import { PrepActionCards } from "./PrepActionCards";
import { OnDutyStrip } from "./OnDutyStrip";
import { StaffingCoverageBar } from "./StaffingCoverageBar";
import { ActivityFeed } from "./ActivityFeed";
import { QuickBroadcast } from "./QuickBroadcast";
import { KpiPillGrid } from "./KpiPillGrid";

// ─── Animation constants ────────────────────────────────────────────────────

/** Ambient spring — Nordic Split spec: stiffness 40, damping 22, mass 2.2 */
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

/** Slot crossfade — exit 250ms opacity, enter 500ms with y slide */
const SLOT_ENTER = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: AMBIENT_SPRING,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25 },
  },
};

// ─── Grid layout constants ──────────────────────────────────────────────────

const GRID_COLUMNS = "6fr 3fr 3fr";

const GRID_AREAS_OPERATIVE = `"swiper  onduty  feed" "bcast   kpi     feed"`;
const GRID_AREAS_PREPARATORY = `"prep    coverage feed" "bcast   kpi      feed"`;

// ─── Main component ──────────────────────────────────────────────────────────

export function InteractiveDashboard() {
  const { t } = useTranslation("dashboard");
  const { profileId } = useContext(DashboardContext);

  const { mode, autoMode, override, setOverride } = useDashboardMode();

  const model = useCockpitFirstScreen({
    feedLimit: 24,
    feedFilters: { category: "all", timeRange: "today" },
  });

  // Derive metric strip counters from the cockpit read model
  const onDutyCount = model.onDutyEntries.length;
  const lateCount = model.onDutyEntries.filter((e) => e.status === "late").length;
  const deviationCount = model.operationalQueue.reduce(
    (sum, r) => sum + (r.blockingDeviations ?? 0),
    0,
  );
  const tasksDueCount = model.operationalQueue.reduce(
    (sum, r) => sum + (r.overdueTasks ?? 0) + (r.upcomingTasks ?? 0),
    0,
  );

  // Preparatory counters — derived from staffing queue and feed
  const gaps7d = model.staffingQueue.reduce((sum, r) => sum + (r.uncoveredShifts ?? 0), 0);
  const unsignedContracts = 0; // TODO: wire from action items hook when available
  const expiringTraining = 0; // TODO: wire from training readiness hook
  const budgetVariance = "0%"; // TODO: wire from budget hook

  // lastUpdatedAt — most recent feed entry timestamp
  const lastUpdatedAt = useMemo(() => {
    if (model.feed.length === 0) return null;
    return model.feed[0]?.occurredAt ?? null;
  }, [model.feed]);

  // Idle state detection — operative mode with nothing actionable
  const isIdle =
    mode === "operative" &&
    !model.isLoading &&
    model.staffingQueue.length === 0 &&
    model.operationalQueue.length === 0 &&
    lateCount === 0;

  const gridAreas = mode === "operative" ? GRID_AREAS_OPERATIVE : GRID_AREAS_PREPARATORY;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      {/* Metric Strip — always on top */}
      <DashboardMetricStrip
        mode={mode}
        override={override}
        autoMode={autoMode}
        onOverrideChange={setOverride}
        isLoading={model.isLoading}
        lastUpdatedAt={lastUpdatedAt}
        onDutyCount={onDutyCount}
        lateCount={lateCount}
        deviationCount={deviationCount}
        tasksDueCount={tasksDueCount}
        gaps7d={gaps7d}
        unsignedContracts={unsignedContracts}
        expiringTraining={expiringTraining}
        budgetVariance={budgetVariance}
      />

      {/* Bento Grid */}
      <div
        className="relative grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          gridTemplateRows: "auto 1fr",
          gridTemplateAreas: gridAreas,
        }}
      >
        {/* Slot: swiper (operative) OR prep (preparatory) */}
        <div style={{ gridArea: mode === "operative" ? "swiper" : "prep" }}>
          <AnimatePresence mode="wait">
            {mode === "operative" ? (
              <motion.div key="swiper" {...SLOT_ENTER}>
                <TaskSwiper />
              </motion.div>
            ) : (
              <motion.div key="prep" {...SLOT_ENTER}>
                <PrepActionCards profileId={profileId ?? ""} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Slot: onduty (operative) OR coverage (preparatory) */}
        <div style={{ gridArea: mode === "operative" ? "onduty" : "coverage" }}>
          <AnimatePresence mode="wait">
            {mode === "operative" ? (
              <motion.div key="onduty" {...SLOT_ENTER}>
                <OnDutyStrip />
              </motion.div>
            ) : (
              <motion.div key="coverage" {...SLOT_ENTER}>
                <StaffingCoverageBar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Feed — shared across modes, full height */}
        <div style={{ gridArea: "feed" }} className="min-h-0 overflow-hidden">
          <ActivityFeed />
        </div>

        {/* Broadcast — shared across modes */}
        <div style={{ gridArea: "bcast" }}>
          <QuickBroadcast profileId={profileId ?? ""} />
        </div>

        {/* KPI — mode-specific content */}
        <div style={{ gridArea: "kpi" }}>
          <KpiPillGrid mode={mode} isLoading={model.isLoading} />
        </div>

        {/* Idle overlay — "Alt i orden" badge when operative with nothing actionable */}
        {isIdle && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="bg-success/10 border-success/20 flex items-center gap-2 rounded-full border px-5 py-2.5">
              <CheckCircle className="text-success h-5 w-5" />
              <span className="text-success text-sm font-medium">
                {t("interactive.all_clear")}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
