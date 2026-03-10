// ============================================
// use-day-session-data.ts
// Composes the schedule day-panel data into one integrated snapshot.
// Exists to keep the day panel on a single read contract.
// Connected to: DaySessionProvider.tsx and use-schedule-computed.ts
// ============================================
"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@smartout/supabase/client";

import type { DaySessionEvidenceDraft, EmployeeReadinessSummary } from "./day-session-model";
import { buildDaySessionSnapshot, collectDaySessionProfileIds } from "./day-session-model";
import { useAbsences } from "./use-absences";
import { useDayBookings, useDayMessages, useDayTasks } from "./use-day-content";
import { useEmployees } from "./use-employees";
import { useOpenShifts } from "./use-open-shifts";
import { useScheduleComputed } from "./use-schedule-computed";
import { scheduleKeys } from "./schedule-keys";
import { useShifts } from "./use-shifts";
import { useTemplates } from "./use-templates";
import { useWeekRange } from "./use-week-range";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Fetches readiness summaries for the selected day assignees.
 *
 * Why: the day panel only needs a compact per-profile warning signal, not the
 * full protocol catalog.
 *
 * Returns: a query with one readiness summary per requested profile.
 */
function useDaySessionReadiness(profileIds: string[], enabled: boolean, dateId: string | null) {
  const { workspace } = useWorkspace();
  const normalizedProfileIds = useMemo(() => [...profileIds].sort(), [profileIds]);

  return useQuery({
    queryKey: scheduleKeys.daySessionReadiness(
      workspace.workspace_id,
      dateId ?? "none",
      normalizedProfileIds,
    ),
    enabled: enabled && normalizedProfileIds.length > 0 && !!dateId,
    queryFn: async (): Promise<Map<string, EmployeeReadinessSummary>> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select("profile_id, status, profile!inner(workspace_id)")
        .eq("profile.workspace_id", workspace.workspace_id)
        .in("profile_id", normalizedProfileIds);

      if (error) {
        throw error;
      }

      const readinessByProfile = new Map<string, EmployeeReadinessSummary>();
      for (const profileId of normalizedProfileIds) {
        readinessByProfile.set(profileId, {
          profileId,
          readinessPercent: 100,
          completedAssignments: 0,
          pendingAssignments: 0,
          expiredAssignments: 0,
        });
      }

      for (const assignment of data ?? []) {
        const current = readinessByProfile.get(assignment.profile_id);
        if (!current) {
          continue;
        }

        if (assignment.status === "completed") {
          current.completedAssignments += 1;
        } else if (assignment.status === "expired") {
          current.expiredAssignments += 1;
        } else {
          current.pendingAssignments += 1;
        }
      }

      for (const readiness of readinessByProfile.values()) {
        const totalAssignments =
          readiness.completedAssignments +
          readiness.pendingAssignments +
          readiness.expiredAssignments;
        readiness.readinessPercent =
          totalAssignments > 0
            ? Math.round((readiness.completedAssignments / totalAssignments) * 100)
            : 100;
      }

      return readinessByProfile;
    },
  });
}

/**
 * Builds the complete read model for the schedule day panel.
 *
 * Why: tabs and panel chrome should consume one shared data shape instead of
 * each component issuing its own raw query fan-out.
 *
 * Returns: the integrated day-session data needed by the panel.
 */
export function useDaySessionData(
  dateId: string | null,
  evidenceDrafts: Record<string, DaySessionEvidenceDraft>,
) {
  const { weekStart, weekEnd } = useWeekRange();
  const shiftsQuery = useShifts(weekStart, weekEnd);
  const absencesQuery = useAbsences(weekStart, weekEnd);
  const openShiftsQuery = useOpenShifts({ enabled: !!dateId });
  const templatesQuery = useTemplates({ enabled: !!dateId });
  const dayMessagesQuery = useDayMessages(weekStart, weekEnd, { enabled: !!dateId });
  const dayTasksQuery = useDayTasks(weekStart, weekEnd, { enabled: !!dateId });
  const dayBookingsQuery = useDayBookings(weekStart, weekEnd, { enabled: !!dateId });
  const employeesQuery = useEmployees();

  const shifts = shiftsQuery.data ?? [];
  const absences = absencesQuery.data ?? [];
  const openShifts = openShiftsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const dayMessages = dayMessagesQuery.data ?? [];
  const dayTasks = dayTasksQuery.data ?? [];
  const dayBookings = dayBookingsQuery.data ?? [];
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const computed = useScheduleComputed(
    shifts,
    absences,
    openShifts.length,
    templates,
    dayMessages,
    dayTasks,
    dayBookings,
  );

  const dayShifts = useMemo(
    () => (dateId ? computed.getShiftsForDay(dateId) : []),
    [computed, dateId],
  );
  const dayTasksForDate = useMemo(
    () => (dateId ? computed.getTasksForDay(dateId) : []),
    [computed, dateId],
  );
  const dayBookingsForDate = useMemo(
    () => (dateId ? computed.getBookingsForDay(dateId) : []),
    [computed, dateId],
  );
  const dayMessagesForDate = useMemo(
    () => (dateId ? computed.getMessagesForDay(dateId) : []),
    [computed, dateId],
  );
  const dayStats = useMemo(
    () => (dateId ? computed.getDayStats(dateId) : null),
    [computed, dateId],
  );

  const employeesById = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const dayEmployeeIds = useMemo(() => {
    return collectDaySessionProfileIds(dayShifts, dayTasksForDate);
  }, [dayShifts, dayTasksForDate]);

  const dayEmployees = useMemo(() => {
    return dayEmployeeIds
      .map((profileId) => employeesById.get(profileId))
      .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee));
  }, [dayEmployeeIds, employeesById]);

  const readinessQuery = useDaySessionReadiness(dayEmployeeIds, !!dateId, dateId);
  const readinessByProfile = useMemo(
    () => readinessQuery.data ?? new Map<string, EmployeeReadinessSummary>(),
    [readinessQuery.data],
  );

  const snapshot = useMemo(() => {
    if (!dateId) {
      return null;
    }

    return buildDaySessionSnapshot({
      dateId,
      shifts: dayShifts,
      tasks: dayTasksForDate,
      readinessByProfile,
      evidenceDrafts,
    });
  }, [dateId, dayShifts, dayTasksForDate, readinessByProfile, evidenceDrafts]);

  const isLoading =
    shiftsQuery.isLoading ||
    absencesQuery.isLoading ||
    openShiftsQuery.isLoading ||
    templatesQuery.isLoading ||
    dayMessagesQuery.isLoading ||
    dayTasksQuery.isLoading ||
    dayBookingsQuery.isLoading ||
    employeesQuery.isLoading ||
    readinessQuery.isLoading;

  const error =
    shiftsQuery.error ??
    absencesQuery.error ??
    openShiftsQuery.error ??
    templatesQuery.error ??
    dayMessagesQuery.error ??
    dayTasksQuery.error ??
    dayBookingsQuery.error ??
    employeesQuery.error ??
    readinessQuery.error ??
    null;

  return {
    weekStart,
    weekEnd,
    snapshot,
    computed,
    dayStats,
    shifts,
    dayShifts,
    dayTasks: dayTasksForDate,
    dayBookings: dayBookingsForDate,
    dayMessages: dayMessagesForDate,
    employees,
    employeesById,
    dayEmployees,
    readinessByProfile,
    isLoading,
    error,
  };
}
