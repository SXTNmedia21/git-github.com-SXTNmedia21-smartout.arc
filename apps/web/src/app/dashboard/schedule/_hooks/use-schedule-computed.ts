// ============================================
// use-schedule-computed.ts
// Pure computation hook — derives stats, coverage, and
// filtered lists from query data. No side effects.
// Connected to: schedule-types.ts (type definitions)
// Connected to: page.tsx (consumes query data)
// ============================================

import { useMemo } from "react";

import type {
  Absence,
  DayBooking,
  DayMessage,
  DayTask,
  Shift,
  ShiftTemplate,
} from "../_components/schedule-types";

// ── Exported stat types ──────────────────────────────────────

export type DayStats = {
  staffCount: number;
  shiftCount: number;
  estimatedCost: number;
  publishedCount: number;
  draftCount: number;
  absenceCount: number;
};

export type EmployeeStats = {
  totalHours: number;
  shiftCount: number;
  isOvertime: boolean;
  overtimeHours: number;
  contractedHours: number;
};

export type DayCoverage = {
  totalStaff: number;
  byTeam: Record<string, { target: number; current: number }>;
  hasGaps: boolean;
};

export type StatusSummary = {
  coverageRisks: number;
  overtimeRisks: number;
  complianceRisks: number;
  openShiftQueue: number;
  draftCount: number;
  publishedCount: number;
  activeCount: number;
  completedCount: number;
  absenceCount: number;
  publishedState: string;
};

// ── Constants ────────────────────────────────────────────────

const HOURLY_RATE = 250;
const CONTRACTED_HOURS = 37.5;
const AML_MAX_HOURS = 40;

/** Default team targets — placeholder until database has real targets */
const TEAM_TARGETS: Record<string, number> = {
  Kjøkken: 3,
  "Sal & Service": 2,
  Bar: 2,
  Drift: 1,
};

// ── Return type ──────────────────────────────────────────────

export type ScheduleComputed = {
  getShiftsForDay: (dateId: string) => Shift[];
  getShiftsForEmployee: (employeeId: string) => Shift[];
  getShiftsForCell: (employeeId: string, dateId: string) => Shift[];
  getAbsencesForCell: (employeeId: string, dateId: string) => Absence[];
  getDayStats: (dateId: string) => DayStats;
  getEmployeeStats: (employeeId: string) => EmployeeStats;
  getTemplatesForDepartment: (dept: string) => ShiftTemplate[];
  getMessagesForDay: (dateId: string) => DayMessage[];
  getTasksForDay: (dateId: string) => DayTask[];
  getBookingsForDay: (dateId: string) => DayBooking[];
  getCoverageForDay: (dateId: string) => DayCoverage;
  getStatusSummary: () => StatusSummary;
};

// ── Hook ─────────────────────────────────────────────────────

export function useScheduleComputed(
  shifts: Shift[],
  absences: Absence[],
  openShiftCount: number,
  templates: ShiftTemplate[],
  dayMessages: DayMessage[],
  dayTasks: DayTask[],
  dayBookings: DayBooking[],
): ScheduleComputed {
  return useMemo(() => {
    const getShiftsForDay = (dateId: string): Shift[] => shifts.filter((s) => s.dateId === dateId);

    const getShiftsForEmployee = (employeeId: string): Shift[] =>
      shifts.filter((s) => s.employeeId === employeeId);

    const getShiftsForCell = (employeeId: string, dateId: string): Shift[] =>
      shifts.filter((s) => s.employeeId === employeeId && s.dateId === dateId);

    const getAbsencesForCell = (employeeId: string, dateId: string): Absence[] =>
      absences.filter((a) => a.employeeId === employeeId && a.dateId === dateId);

    const getDayStats = (dateId: string): DayStats => {
      const dayShifts = getShiftsForDay(dateId);
      const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
      const dayAbsences = absences.filter((a) => a.dateId === dateId);

      return {
        staffCount: uniqueEmployees.size,
        shiftCount: dayShifts.length,
        estimatedCost: dayShifts.reduce((sum, s) => sum + s.workHours * HOURLY_RATE, 0),
        publishedCount: dayShifts.filter((s) => s.isPublished).length,
        draftCount: dayShifts.filter((s) => s.status === "created" || s.status === "assigned")
          .length,
        absenceCount: dayAbsences.length,
      };
    };

    const getEmployeeStats = (employeeId: string): EmployeeStats => {
      const empShifts = getShiftsForEmployee(employeeId);
      const totalHours = empShifts.reduce((sum, s) => sum + s.workHours, 0);

      return {
        totalHours,
        shiftCount: empShifts.length,
        isOvertime: totalHours > CONTRACTED_HOURS,
        overtimeHours: Math.max(0, totalHours - CONTRACTED_HOURS),
        contractedHours: CONTRACTED_HOURS,
      };
    };

    const getTemplatesForDepartment = (dept: string): ShiftTemplate[] =>
      templates.filter((t) => t.department === dept);

    const getMessagesForDay = (dateId: string): DayMessage[] =>
      dayMessages.filter((m) => m.dateId === dateId);

    const getTasksForDay = (dateId: string): DayTask[] =>
      dayTasks.filter((t) => t.dateId === dateId);

    const getBookingsForDay = (dateId: string): DayBooking[] =>
      dayBookings.filter((b) => b.dateId === dateId);

    const getCoverageForDay = (dateId: string): DayCoverage => {
      const dayShifts = getShiftsForDay(dateId);
      const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));

      // Build team coverage from shifts (needs employee->team mapping)
      // For now, count shifts per indicator as proxy for team
      const byTeam: Record<string, { target: number; current: number }> = {};
      let hasGaps = false;

      for (const [team, target] of Object.entries(TEAM_TARGETS)) {
        // Count unique employees on this day who belong to this team
        // We can't know team from shift alone in local state, so use target as baseline
        const current = Math.min(
          target,
          dayShifts.length > 0 ? Math.ceil(dayShifts.length / 3) : 0,
        );
        byTeam[team] = { target, current };
        if (current < target) hasGaps = true;
      }

      return { totalStaff: uniqueEmployees.size, byTeam, hasGaps };
    };

    const getStatusSummary = (): StatusSummary => {
      const draftCount = shifts.filter(
        (s) => s.status === "created" || s.status === "assigned",
      ).length;
      const publishedCount = shifts.filter((s) => s.status === "published").length;
      const activeCount = shifts.filter((s) => s.status === "active").length;
      const completedCount = shifts.filter((s) => s.status === "completed").length;

      // Count unique days and check coverage per day
      const uniqueDays = new Set(shifts.map((s) => s.dateId));
      let coverageRisks = 0;
      for (const dateId of uniqueDays) {
        const coverage = getCoverageForDay(dateId);
        if (coverage.hasGaps) coverageRisks++;
      }

      // Count employees with overtime
      const employeeHours = new Map<string, number>();
      for (const shift of shifts) {
        if (shift.employeeId) {
          const current = employeeHours.get(shift.employeeId) ?? 0;
          employeeHours.set(shift.employeeId, current + shift.workHours);
        }
      }

      let overtimeRisks = 0;
      let complianceRisks = 0;
      for (const hours of employeeHours.values()) {
        if (hours > CONTRACTED_HOURS) overtimeRisks++;
        if (hours > AML_MAX_HOURS) complianceRisks++;
      }

      return {
        coverageRisks,
        overtimeRisks,
        complianceRisks,
        openShiftQueue: openShiftCount,
        draftCount,
        publishedCount,
        activeCount,
        completedCount,
        absenceCount: absences.length,
        publishedState: draftCount > 0 ? "Draft endringer" : "Publisert",
      };
    };

    return {
      getShiftsForDay,
      getShiftsForEmployee,
      getShiftsForCell,
      getAbsencesForCell,
      getDayStats,
      getEmployeeStats,
      getTemplatesForDepartment,
      getMessagesForDay,
      getTasksForDay,
      getBookingsForDay,
      getCoverageForDay,
      getStatusSummary,
    };
  }, [shifts, absences, openShiftCount, templates, dayMessages, dayTasks, dayBookings]);
}
