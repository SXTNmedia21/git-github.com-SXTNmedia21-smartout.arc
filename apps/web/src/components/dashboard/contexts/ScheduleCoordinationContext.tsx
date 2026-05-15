"use client";

/**
 * ScheduleCoordinationContext — cross-route schedule state slice.
 *
 * Why: ADR-0113 + ADR-0032 — the dashboard header needs to reach INTO the
 * schedule route (to show draft count + publish-all button), and the
 * schedule route needs to expose its publish callback UPWARDS. That
 * bidirectional coupling lives here as a narrow context rather than
 * riding the giant DashboardContext.
 *
 * In a follow-up PR, the purely route-local fields (layout mode, view,
 * date offset, compact mode, period count) will migrate to a
 * ScheduleRouteContext scoped to /dashboard/schedule/**. This ADR-0113
 * PR keeps them here so the facade `useDashboard()` return shape stays
 * 1:1 with the old context — no consumer changes required.
 *
 * 2026-05-15: scheduleCompactMode (boolean) replaced by scheduleDensity
 * (4-tier enum: cozy | default | compact | pulse). Back-compat shim retained
 * for one commit — removed in the cleanup commit (Phase F).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ScheduleDensity } from "@/app/dashboard/schedule/_components/density-selector";
import { setScheduleDensityAction } from "@/app/dashboard/schedule/_actions/set-schedule-density";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceContextOptional } from "./WorkspaceContext";

export type ScheduleLayoutMode = "daily" | "weekly" | "monthly" | "list" | "grid";
export type ScheduleViewMode = "ansatt" | "jobb" | "team" | "lokasjon";

export type ScheduleCoordinationContextValue = {
  /** Current layout mode (daily/weekly/monthly/list/grid). */
  scheduleLayout: ScheduleLayoutMode;
  /**
   * Setter that ALSO converts `scheduleDateOffset` between week-based
   * and month-based units so we never jump months when toggling views.
   */
  setScheduleLayout: (val: ScheduleLayoutMode) => void;
  /** Current grouping mode (ansatt/jobb/team/lokasjon). */
  scheduleView: ScheduleViewMode;
  setScheduleView: (val: ScheduleViewMode) => void;
  /** Left sidebar collapse state — lives here because it auto-collapses on schedule routes. */
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  /** Weekly period count (1-4 weeks) for the "rullerende" layout. */
  weeklyPeriodCount: number;
  setWeeklyPeriodCount: (val: number) => void;
  /**
   * Date offset relative to today, measured in weeks for week-based
   * layouts and in months for monthly layout.
   */
  scheduleDateOffset: number;
  setScheduleDateOffset: Dispatch<SetStateAction<number>>;
  /**
   * Stable publish-all callback — always non-null. Internally reads a
   * ref so that if the schedule route has not registered a callback,
   * invoking this is a no-op. Keeping the type non-nullable lets
   * consumers wire it straight into `onClick` handlers.
   */
  onPublishAll: () => void;
  setOnPublishAll: (val: (() => void) | null) => void;
  /** Draft shift count surfaced in the header. */
  scheduleDraftCount: number;
  setScheduleDraftCount: (val: number) => void;
  /**
   * 4-tier schedule card density (cozy | default | compact | pulse).
   * Replaces the old boolean scheduleCompactMode.
   * Setter: optimistic UI update + fire-and-forget Server Action persistence.
   */
  scheduleDensity: ScheduleDensity;
  setScheduleDensity: (next: ScheduleDensity) => void;
  /**
   * @deprecated Use scheduleDensity === "compact" instead.
   * Back-compat shim — removed in Phase F cleanup commit.
   */
  scheduleCompactMode: boolean;
  /**
   * @deprecated Use setScheduleDensity instead.
   * Back-compat shim — removed in Phase F cleanup commit.
   */
  setScheduleCompactMode: (val: boolean) => void;
};

const ScheduleCoordinationContext = createContext<ScheduleCoordinationContextValue | null>(null);

export function ScheduleCoordinationProvider({
  children,
  initialDensity,
}: {
  children: ReactNode;
  /** Server-fetched density to avoid flash from default → persisted. Optional. */
  initialDensity?: ScheduleDensity;
}) {
  const [scheduleLayout, setScheduleLayoutRaw] = useState<ScheduleLayoutMode>("daily");
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>("ansatt");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [weeklyPeriodCount, setWeeklyPeriodCount] = useState(4);
  // Week-based layouts (daily/list/grid/weekly) and monthly each keep their own
  // offset. Round-trips between modes no longer drift the viewed date.
  const [weekBasedOffset, setWeekBasedOffset] = useState(0);
  const [monthlyOffset, setMonthlyOffset] = useState(0);
  // 4-tier density enum — replaces the old boolean scheduleCompactMode.
  const [scheduleDensityState, setScheduleDensityState] = useState<ScheduleDensity>(
    initialDensity ?? "default",
  );

  // E6: client-side hydration — when no initialDensity prop is provided (all-client
  // architecture: DashboardShell + page.tsx are "use client"), fetch the persisted
  // density from Supabase client on mount. Falls back to "default" on any error.
  // WorkspaceContext is mounted above ScheduleCoordinationProvider in DashboardShell.
  const workspace = useWorkspaceContextOptional();
  const hydrationFiredRef = useRef(false);
  useEffect(() => {
    // Skip: server already provided an initialDensity value
    if (initialDensity !== undefined) return;
    // Skip: already hydrated (guard against workspace reference churn)
    if (hydrationFiredRef.current) return;
    const profileId = workspace?.profileId;
    const workspaceId = workspace?.workspaceData?.workspace_id;
    // Skip: workspace not yet loaded (will re-run when workspace settles)
    if (!profileId || !workspaceId) return;

    hydrationFiredRef.current = true;
    const supabase = createClient();
    void supabase
      .from("user_view_preference")
      .select("preference_value")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .eq("surface", "schedule")
      .eq("preference_key", "density")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return; // new user — keep "default"
        const stored = data.preference_value;
        if (
          stored === "cozy" ||
          stored === "default" ||
          stored === "compact" ||
          stored === "pulse"
        ) {
          setScheduleDensityState(stored);
        }
      });
  }, [initialDensity, workspace]);

  /**
   * Density setter: optimistic UI update (immediate) + fire-and-forget Server Action
   * persistence. Errors are swallowed with a console.warn so the UI is never blocked
   * by a persistence failure — view-state is best-effort (plan §11 R3).
   */
  const setScheduleDensity = useCallback((next: ScheduleDensity) => {
    setScheduleDensityState(next); // optimistic
    void setScheduleDensityAction({ density: next }).catch((err: unknown) =>
      console.warn("[ScheduleCoordinationContext] Density persist failed", err),
    );
  }, []);

  // ── Back-compat shim (deprecated) ─────────────────────────────────────────
  // Removed in Phase F cleanup commit. Do NOT add new usages.
  const scheduleCompactMode = scheduleDensityState === "compact";
  const setScheduleCompactMode = useCallback(
    (val: boolean) => setScheduleDensity(val ? "compact" : "default"),
    [setScheduleDensity],
  );

  const onPublishAllRef = useRef<(() => void) | null>(null);
  const scheduleDraftCountRef = useRef(0);
  const [scheduleDraftCountDisplay, setScheduleDraftCountDisplay] = useState(0);

  // Layout ref lets the stable offset setter pick the right slot without being
  // recreated every time scheduleLayout changes.
  const scheduleLayoutRef = useRef(scheduleLayout);
  useEffect(() => {
    scheduleLayoutRef.current = scheduleLayout;
  }, [scheduleLayout]);

  const setScheduleLayout = useCallback((newLayout: ScheduleLayoutMode) => {
    setScheduleLayoutRaw(newLayout);
  }, []);

  const scheduleDateOffset = scheduleLayout === "monthly" ? monthlyOffset : weekBasedOffset;

  const setScheduleDateOffset = useCallback<Dispatch<SetStateAction<number>>>((updater) => {
    if (scheduleLayoutRef.current === "monthly") {
      setMonthlyOffset(updater);
    } else {
      setWeekBasedOffset(updater);
    }
  }, []);

  /** Stable setter that schedule page calls to register the publish callback. */
  const setOnPublishAll = useCallback((fn: (() => void) | null) => {
    onPublishAllRef.current = fn;
  }, []);
  /** Stable callback that reads ref at call-time (event handler), not render-time. */
  const onPublishAllStable = useCallback(() => {
    onPublishAllRef.current?.();
  }, []);
  /** Stable setter — writes to ref + state, avoids infinite loops via guard. */
  const setScheduleDraftCount = useCallback((count: number) => {
    if (scheduleDraftCountRef.current !== count) {
      scheduleDraftCountRef.current = count;
      setScheduleDraftCountDisplay(count);
    }
  }, []);

  const value = useMemo<ScheduleCoordinationContextValue>(
    () => ({
      scheduleLayout,
      setScheduleLayout,
      scheduleView,
      setScheduleView,
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      weeklyPeriodCount,
      setWeeklyPeriodCount,
      scheduleDateOffset,
      setScheduleDateOffset,
      onPublishAll: onPublishAllStable,
      setOnPublishAll,
      scheduleDraftCount: scheduleDraftCountDisplay,
      setScheduleDraftCount,
      // 4-tier density (new)
      scheduleDensity: scheduleDensityState,
      setScheduleDensity,
      // Back-compat shims (deprecated — Phase F removes)
      scheduleCompactMode,
      setScheduleCompactMode,
    }),
    [
      scheduleLayout,
      setScheduleLayout,
      scheduleView,
      isSidebarCollapsed,
      weeklyPeriodCount,
      scheduleDateOffset,
      onPublishAllStable,
      setOnPublishAll,
      scheduleDraftCountDisplay,
      setScheduleDraftCount,
      scheduleDensityState,
      setScheduleDensity,
      scheduleCompactMode,
      setScheduleCompactMode,
    ],
  );

  return (
    <ScheduleCoordinationContext.Provider value={value}>
      {children}
    </ScheduleCoordinationContext.Provider>
  );
}

export function useScheduleCoordinationContext(): ScheduleCoordinationContextValue {
  const ctx = useContext(ScheduleCoordinationContext);
  if (!ctx) {
    throw new Error(
      "useScheduleCoordinationContext must be used within <ScheduleCoordinationProvider>",
    );
  }
  return ctx;
}

export function useScheduleCoordinationContextOptional(): ScheduleCoordinationContextValue | null {
  return useContext(ScheduleCoordinationContext);
}
