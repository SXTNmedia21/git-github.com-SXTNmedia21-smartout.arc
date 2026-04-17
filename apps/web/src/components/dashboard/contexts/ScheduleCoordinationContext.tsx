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
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

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
  /** Compact-row mode toggle for dense schedules. */
  scheduleCompactMode: boolean;
  setScheduleCompactMode: (val: boolean) => void;
};

const ScheduleCoordinationContext = createContext<ScheduleCoordinationContextValue | null>(null);

export function ScheduleCoordinationProvider({ children }: { children: ReactNode }) {
  const [scheduleLayout, setScheduleLayoutRaw] = useState<ScheduleLayoutMode>("daily");
  const [scheduleView, setScheduleView] = useState<ScheduleViewMode>("ansatt");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [weeklyPeriodCount, setWeeklyPeriodCount] = useState(4);
  const [scheduleDateOffset, setScheduleDateOffset] = useState(0);
  const [scheduleCompactMode, setScheduleCompactMode] = useState(false);

  const onPublishAllRef = useRef<(() => void) | null>(null);
  const scheduleDraftCountRef = useRef(0);
  const [scheduleDraftCountDisplay, setScheduleDraftCountDisplay] = useState(0);

  /**
   * Converts scheduleDateOffset when switching between week-based and
   * month-based views. Without this, an offset of 4 (= 4 weeks ahead in
   * Ukeplan) would be misinterpreted as 4 months ahead in Måned — jumping
   * from April to August.
   */
  const setScheduleLayout = useCallback((newLayout: ScheduleLayoutMode) => {
    const isWeekBased = (l: ScheduleLayoutMode) =>
      l === "daily" || l === "list" || l === "grid" || l === "weekly";

    setScheduleLayoutRaw((prevLayout) => {
      // Read the current offset from state captured at call time via the updater pattern.
      // We use a functional update for offset too to stay consistent.
      if (isWeekBased(prevLayout) && newLayout === "monthly") {
        setScheduleDateOffset((prevOffset) => {
          const now = new Date();
          const targetMonday = new Date(now);
          targetMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + prevOffset * 7);
          const today = new Date();
          const monthDiff =
            (targetMonday.getFullYear() - today.getFullYear()) * 12 +
            (targetMonday.getMonth() - today.getMonth());
          return monthDiff;
        });
      } else if (prevLayout === "monthly" && isWeekBased(newLayout)) {
        setScheduleDateOffset((prevOffset) => {
          const target = new Date();
          target.setMonth(target.getMonth() + prevOffset, 1);
          target.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startOfCurrentWeek = new Date(today);
          startOfCurrentWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
          const diffMs = target.getTime() - startOfCurrentWeek.getTime();
          const weekDiff = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));
          return weekDiff;
        });
      }
      return newLayout;
    });
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
      scheduleCompactMode,
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
