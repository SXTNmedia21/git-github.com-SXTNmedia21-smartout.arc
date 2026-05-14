"use client";

/**
 * page.tsx — Route entry point for /dashboard/shift-clock.
 *
 * Detects user role via DashboardContext:
 * - Employee (not admin) renders ShiftClockView (fullscreen punch clock)
 * - Admin/manager renders LeaderOverview (Task 11 placeholder)
 *
 * Mounts ShiftClockToolsBridge so Botsson (voice + chat) can read shift state
 * and propose clock actions (punch-in/out, break start/end, tab navigation).
 * The bridge calls useShiftClock() at page level — TanStack Query deduplicates
 * the fetch automatically so ShiftClockView retains its own internal hook.
 *
 * ADR-0133 mobile-critical: shift-clock is the primary D6 employee execute surface.
 */

import { useCallback, useContext, useMemo, useState } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ShiftClockView } from "./ShiftClockView";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useShiftClock } from "@/hooks/shift-clock/useShiftClock";
import { ShiftClockToolsBridge } from "./_tools/shift-clock-tools-bridge";
import type { ShiftClockUiActions } from "./_tools/use-shift-clock-tools";

/**
 * LeaderOverview placeholder — will be implemented in Task 11.
 * Shows a live dashboard of all active shifts for managers.
 */
function LeaderOverviewPlaceholder() {
  return (
    <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <h1 className="font-heading text-foreground text-2xl">Leder-oversikt</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Live oversikt over alle aktive vakter, manuelle stempling, og sanntidsdata. Implementeres i
        Task 11.
      </p>
    </div>
  );
}

export default function ShiftClockPage() {
  const { isAdminMode } = useContext(DashboardContext);

  // Lift shift state to page level so ShiftClockToolsBridge can read it.
  // TanStack Query deduplicates the fetch — ShiftClockView retains its own hook.
  const { state, isLoading, punchIn, punchOut, startBreak, endBreak } = useShiftClock();

  // Active tab is lifted here so the bridge can control it without a redundant
  // state in ShiftClockView. ShiftClockView receives it via props.
  const [activeTab, setActiveTabRaw] = useState<"tasks" | "chat" | "notes">("tasks");
  // Wide setter accepted by ShiftClockView (string) that narrows before updating state.
  const setActiveTab = useCallback(
    (tab: string) => {
      if (tab === "tasks" || tab === "chat" || tab === "notes") {
        setActiveTabRaw(tab);
      }
    },
    [],
  );

  // Stable wrapper callbacks — necessary because useShiftClock returns new function
  // references on each render and we need stable identities for uiActions.
  const stablePunchOut = useCallback(() => punchOut(), [punchOut]);
  const stableStartBreak = useCallback(() => startBreak(), [startBreak]);
  const stableEndBreak = useCallback(() => endBreak(), [endBreak]);

  // uiActions: stable object passed to the bridge so tools can trigger real
  // mutations instead of dispatching dead-drop CustomEvents (council B1 fix).
  const uiActions: ShiftClockUiActions = useMemo(
    () => ({
      punchIn,
      punchOut: stablePunchOut,
      startBreak: stableStartBreak,
      endBreak: stableEndBreak,
      // setActiveTab is the wide (string) version that validates before updating state.
      setActiveTab,
    }),
    [punchIn, stablePunchOut, stableStartBreak, stableEndBreak, setActiveTab],
  );

  // Show employee view for admins when the leader overview flag is off
  if (isAdminMode && !FEATURE_FLAGS.SHIFT_CLOCK_LEADER) {
    return (
      <>
        <ShiftClockToolsBridge loading={isLoading} state={state} uiActions={uiActions} />
        <ShiftClockView activeTab={activeTab} onTabChange={setActiveTab} />
      </>
    );
  }

  if (isAdminMode) {
    return <LeaderOverviewPlaceholder />;
  }

  return (
    <>
      <ShiftClockToolsBridge loading={isLoading} state={state} uiActions={uiActions} />
      <ShiftClockView activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}
