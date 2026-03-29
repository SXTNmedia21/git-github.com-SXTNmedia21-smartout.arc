"use client";

/**
 * InteractiveDashboard — Action-oriented bento grid dashboard.
 *
 * Replaces the passive tactical+strategic views with a unified,
 * mode-switching command center. Composes all interactive sub-components
 * into a responsive CSS grid that swaps layout slots between operative
 * (live shift management) and preparatory (workforce planning) modes.
 */

import { useContext, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
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

/** Instant slot crossfade for prefers-reduced-motion */
const SLOT_ENTER_REDUCED = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

// ─── Grid layout constants ──────────────────────────────────────────────────

const GRID_COLUMNS = "6fr 3fr 3fr";

const GRID_AREAS_OPERATIVE = `"swiper  onduty  feed" "bcast   kpi     feed"`;
const GRID_AREAS_PREPARATORY = `"prep    coverage feed" "bcast   kpi      feed"`;

// ─── Main component ──────────────────────────────────────────────────────────

export function InteractiveDashboard() {
  const { t } = useTranslation("dashboard");
  const { profileId } = useContext(DashboardContext);
  const prefersReduced = useReducedMotion() ?? false;

  // Activity feed panel is collapsible on tablet — hidden by default
  const [feedVisible, setFeedVisible] = useState(false);

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
  const slotEnter = prefersReduced ? SLOT_ENTER_REDUCED : SLOT_ENTER;

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

      {/*
       * Bento Grid — responsive layout:
       *
       * Mobile (<768px / default):   single-column stack, activity feed collapsed
       * Tablet (768-1279px / md):    two columns, feed collapsible via toggle button
       * Desktop (≥1280px / xl):      three-column CSS grid-template-areas
       *
       * The CSS grid-template-areas only applies at xl+. Below xl we hide the
       * grid-area style and let Tailwind's responsive column classes take over.
       */}

      {/* Desktop grid (xl+) — exact same 3-column bento layout as before */}
      <div
        className="relative hidden min-h-0 flex-1 gap-3 xl:grid"
        style={{
          gridTemplateColumns: GRID_COLUMNS,
          gridTemplateRows: "auto 1fr",
          gridTemplateAreas: gridAreas,
        }}
      >
        <div style={{ gridArea: mode === "operative" ? "swiper" : "prep" }}>
          <AnimatePresence mode="wait">
            {mode === "operative" ? (
              <motion.div key="swiper" {...slotEnter}>
                <TaskSwiper />
              </motion.div>
            ) : (
              <motion.div key="prep" {...slotEnter}>
                <PrepActionCards profileId={profileId ?? ""} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ gridArea: mode === "operative" ? "onduty" : "coverage" }}>
          <AnimatePresence mode="wait">
            {mode === "operative" ? (
              <motion.div key="onduty" {...slotEnter}>
                <OnDutyStrip />
              </motion.div>
            ) : (
              <motion.div key="coverage" {...slotEnter}>
                <StaffingCoverageBar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ gridArea: "feed" }} className="min-h-0 overflow-hidden">
          <ActivityFeed />
        </div>

        <div style={{ gridArea: "bcast" }}>
          <QuickBroadcast profileId={profileId ?? ""} />
        </div>

        <div style={{ gridArea: "kpi" }}>
          <KpiPillGrid mode={mode} isLoading={model.isLoading} />
        </div>

        {isIdle && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="bg-success/10 border-success/20 flex items-center gap-2 rounded-full border px-5 py-2.5">
              <CheckCircle className="text-success h-5 w-5" />
              <span className="text-success text-sm font-medium">{t("interactive.all_clear")}</span>
            </div>
          </div>
        )}
      </div>

      {/*
       * Tablet + Mobile layout (below xl) — single-column stack with responsive
       * two-column row at md+ for on-duty/KPIs side by side.
       */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto xl:hidden">
        {/* Row 1: task swiper OR prep cards — full width */}
        <AnimatePresence mode="wait">
          {mode === "operative" ? (
            <motion.div key="swiper-mobile" {...slotEnter}>
              <TaskSwiper />
            </motion.div>
          ) : (
            <motion.div key="prep-mobile" {...slotEnter}>
              <PrepActionCards profileId={profileId ?? ""} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 2: broadcast — full width */}
        <QuickBroadcast profileId={profileId ?? ""} />

        {/* Row 3: on-duty + KPI pills side by side at md+, stacked at mobile */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <AnimatePresence mode="wait">
              {mode === "operative" ? (
                <motion.div key="onduty-mobile" {...slotEnter}>
                  <div className="bg-card border-border rounded-xl border p-3">
                    <OnDutyStrip />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="coverage-mobile" {...slotEnter}>
                  <div className="bg-card border-border rounded-xl border p-3">
                    <StaffingCoverageBar />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* KPI pills — horizontal scroll on mobile */}
          <div className="overflow-x-auto">
            <KpiPillGrid mode={mode} isLoading={model.isLoading} />
          </div>
        </div>

        {/* Row 4: activity feed — collapsible on tablet/mobile */}
        <div>
          <button
            type="button"
            onClick={() => setFeedVisible((v) => !v)}
            className="text-muted-foreground hover:text-foreground mb-1 flex w-full items-center justify-between text-sm font-semibold md:hidden"
            aria-expanded={feedVisible}
          >
            <span>{t("interactive.feed_title")}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${feedVisible ? "rotate-180" : ""}`}
            />
          </button>

          {/* Always visible at md+, toggle-controlled at mobile */}
          <div className={`hidden md:block ${feedVisible ? "" : ""}`}>
            <div className="bg-card border-border h-64 overflow-hidden rounded-xl border p-3">
              <ActivityFeed />
            </div>
          </div>
          <div className={`md:hidden ${feedVisible ? "block" : "hidden"}`}>
            <div className="bg-card border-border h-64 overflow-hidden rounded-xl border p-3">
              <ActivityFeed />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
