"use client";

// ============================================
// use-cockpit-first-screen.ts
// Composes the dashboard first-screen cockpit
// read model from existing live shifts, activity
// feed, and operations hooks with deterministic
// filtering and prioritization.
// ============================================

import { useMemo } from "react";
import type { CockpitEventEnvelope } from "@smartout/types";
import {
  useActivityFeed,
  type ActivityFeedFilters,
} from "@/app/dashboard/_hooks/use-activity-feed";
import { useLiveShifts, type LiveShiftEntry } from "@/app/dashboard/_hooks/use-live-shifts";
import {
  dedupeCockpitEvents,
  normalizeActivityTrailEvent,
} from "@/app/dashboard/_lib/cockpit/event-envelope";
import {
  prioritizeOperationalRisks,
  prioritizeStaffingRisks,
  type OperationalRisk,
  type StaffingRisk,
} from "@/app/dashboard/_lib/cockpit/risk-priority";
import {
  useOperationsData,
  type OperationsData,
} from "@/app/dashboard/operations/_hooks/use-operations-data";

export type UseCockpitFirstScreenOptions = {
  selectedRoles?: string[];
  feedLimit?: number;
  feedFilters?: ActivityFeedFilters;
};

export type CockpitFirstScreenReadModel = {
  staffingQueue: StaffingRisk[];
  operationalQueue: OperationalRisk[];
  onDutyEntries: LiveShiftEntry[];
  feed: CockpitEventEnvelope[];
  operations: OperationsData | undefined;
  isLoading: boolean;
  isError: boolean;
};

const DEFAULT_FEED_LIMIT = 50;
const DEFAULT_FEED_FILTERS: ActivityFeedFilters = {
  category: "all",
  timeRange: "today",
};

/**
 * Normalizes role text for stable comparisons across UI filter states.
 *
 * Why: Shift rows and filter chips can use inconsistent casing/whitespace.
 *
 * @param role - Role label from either a shift row or a selected filter.
 * @returns A canonical role key used for case-insensitive comparisons.
 */
function normalizeRole(role: string): string {
  return role.trim().toLocaleLowerCase("nb-NO");
}

/**
 * Filters on-duty entries by selected roles.
 *
 * Why: The first-screen read model should return only entries relevant to the
 * active role selection while preserving original ordering from live shifts.
 *
 * @param entries - On-duty candidate entries from live shifts.
 * @param selectedRoles - Active role filters from the cockpit UI state.
 * @returns Filtered entries matching the selected roles, or all entries.
 */
export function filterOnDutyByRole<T extends { role: string }>(
  entries: T[],
  selectedRoles: string[],
): T[] {
  if (selectedRoles.length === 0) {
    return entries;
  }

  const allowedRoles = new Set(selectedRoles.map(normalizeRole));
  return entries.filter((entry) => allowedRoles.has(normalizeRole(entry.role)));
}

/**
 * Converts one live shift row into a staffing risk record when applicable.
 *
 * Why: The risk prioritizer consumes a normalized risk shape, while live shift
 * rows are richer and include non-risk states such as clocked-in/on-break.
 *
 * @param entry - One row from the live shifts summary.
 * @param occurredAt - Timestamp used for deterministic ordering.
 * @returns A staffing risk row or null when the entry has no staffing risk.
 */
function toStaffingRisk(entry: LiveShiftEntry, occurredAt: string): StaffingRisk | null {
  if (entry.status === "late") {
    return {
      id: `shift-${entry.shiftId}`,
      severity: "critical",
      uncoveredShifts: 1,
      affectedTeams: 1,
      occurredAt,
    };
  }

  if (entry.status === "waiting") {
    return {
      id: `shift-${entry.shiftId}`,
      severity: "warning",
      uncoveredShifts: 1,
      affectedTeams: 1,
      occurredAt,
    };
  }

  return null;
}

/**
 * Builds operational risk rows from current operations aggregates.
 *
 * Why: The first-screen queue should expose only active operational pressure,
 * not static "all clear" placeholders that add feed noise.
 *
 * @param operations - Aggregated operations data for the current workspace day.
 * @param occurredAt - Timestamp used for deterministic ordering.
 * @returns Operational risk rows ready for prioritization.
 */
function toOperationalRisks(
  operations: OperationsData | undefined,
  occurredAt: string,
): OperationalRisk[] {
  if (!operations) {
    return [];
  }

  const risks: OperationalRisk[] = [];

  if (operations.overdueTasks > 0) {
    risks.push({
      id: "ops-overdue-tasks",
      severity: "critical",
      blockingDeviations: operations.overdueTasks,
      overdueTasks: operations.overdueTasks,
      occurredAt,
    });
  }

  if (operations.upcomingTasks > 0) {
    risks.push({
      id: "ops-upcoming-tasks",
      severity: "warning",
      blockingDeviations: 0,
      overdueTasks: operations.upcomingTasks,
      occurredAt,
    });
  }

  return risks;
}

/**
 * Composes the dashboard first-screen cockpit read model.
 *
 * Why: The UI needs one deterministic data contract spanning multiple existing
 * hooks without introducing new API surfaces or schema-level state.
 *
 * @param options - Optional role + feed controls for first-screen composition.
 * @returns Cockpit read model for staffing queue, operational queue, on-duty
 * entries, normalized feed, and consolidated loading/error state.
 */
export function useCockpitFirstScreen(options: UseCockpitFirstScreenOptions = {}) {
  const selectedRoles = options.selectedRoles ?? [];
  const feedLimit = options.feedLimit ?? DEFAULT_FEED_LIMIT;
  const feedFilters = options.feedFilters ?? DEFAULT_FEED_FILTERS;

  const operations = useOperationsData();
  const liveShifts = useLiveShifts();
  const activityFeed = useActivityFeed({
    limit: feedLimit,
    filters: feedFilters,
  });

  return useMemo<CockpitFirstScreenReadModel>(() => {
    const occurredAt = new Date().toISOString();
    const onDutyEntries = filterOnDutyByRole(liveShifts.data?.entries ?? [], selectedRoles);

    const staffingQueue = prioritizeStaffingRisks(
      onDutyEntries
        .map((entry) => toStaffingRisk(entry, occurredAt))
        .filter((risk): risk is StaffingRisk => risk !== null),
    );

    const operationalQueue = prioritizeOperationalRisks(
      toOperationalRisks(operations.data, occurredAt),
    );

    const feed = dedupeCockpitEvents(
      (activityFeed.data ?? []).map((row) => normalizeActivityTrailEvent(row)),
    );

    return {
      staffingQueue,
      operationalQueue,
      onDutyEntries,
      feed,
      operations: operations.data,
      isLoading: operations.isLoading || liveShifts.isLoading || activityFeed.isLoading,
      isError: operations.isError || liveShifts.isError || activityFeed.isError,
    };
  }, [
    activityFeed.data,
    activityFeed.isError,
    activityFeed.isLoading,
    liveShifts.data?.entries,
    liveShifts.isError,
    liveShifts.isLoading,
    operations.data,
    operations.isError,
    operations.isLoading,
    selectedRoles,
  ]);
}
