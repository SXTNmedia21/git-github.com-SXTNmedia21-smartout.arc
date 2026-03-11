"use client";

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientTools,
} from "@/components/voice-tools-context";
import { SCHEDULE_TOOL_DEFINITIONS } from "./schedule-tool-definitions";
import type { Shift, Absence, ShiftProposal } from "../_components/schedule-types";
import type { ScheduleEmployee } from "./use-employees";
import type { ScheduleComputed } from "./use-schedule-computed";

type ScheduleVoiceToolsInput = {
  weekStart: string;
  weekEnd: string;
  days: Array<{ id: string; label: string; isToday?: boolean; isHoliday?: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  uiActions?: {
    focusDay: (dateId: string) => void;
    openDayPlanner: (dateId: string) => void;
    closeDayPlanner: () => void;
  };
  mutations?: {
    createShift: (input: Record<string, unknown>) => Promise<unknown>;
    updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
    deleteShift: (id: string) => Promise<unknown>;
    publishShifts: (ids: string[]) => Promise<unknown>;
  };
  /** When provided, write tools create ghost proposals instead of real shifts */
  addProposal?: (proposal: ShiftProposal) => void;
};

// Tool definitions imported from @smartout/ai — single source of truth.
// Cast to mutable array for ClientTools compatibility.
const TOOL_DEFINITIONS: ClientToolDefinition[] = [...SCHEDULE_TOOL_DEFINITIONS];

// -- Day name resolution --------------------------------------------------

const DAY_NAMES: Record<string, number> = {
  monday: 0,
  mandag: 0,
  man: 0,
  tuesday: 1,
  tirsdag: 1,
  tir: 1,
  wednesday: 2,
  onsdag: 2,
  ons: 2,
  thursday: 3,
  torsdag: 3,
  tor: 3,
  friday: 4,
  fredag: 4,
  fre: 4,
  saturday: 5,
  lørdag: 5,
  lør: 5,
  sunday: 6,
  søndag: 6,
  søn: 6,
  today: -1,
  idag: -1,
  tomorrow: -2,
  imorgen: -2,
};

function resolveDateId(
  dayInput: string,
  days: Array<{ id: string; isToday?: boolean }>,
): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayInput)) return dayInput;

  const key = dayInput.toLowerCase().trim();
  const dayIndex = DAY_NAMES[key];

  if (dayIndex === -1) {
    return days.find((d) => d.isToday)?.id ?? days[0]?.id ?? null;
  }
  if (dayIndex === -2) {
    const todayIdx = days.findIndex((d) => d.isToday);
    return days[todayIdx + 1]?.id ?? null;
  }
  if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < days.length) {
    return days[dayIndex]?.id ?? null;
  }

  return null;
}

/**
 * Normalizes person names for tolerant voice matching.
 * Why: Voice input can produce variant spellings (e.g. Alexander/Aleksander)
 * and diacritics. We normalize to a comparable search form.
 */
function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/x/g, "ks")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds the best matching employee by tolerant name search.
 * Why: Human names are frequently misspelled in speech-to-text transcripts.
 */
function findEmployeeByName(
  employees: ScheduleEmployee[],
  rawQuery: string,
): ScheduleEmployee | null {
  const query = normalizeNameForMatch(rawQuery);
  if (!query) return null;

  // 1) Direct normalized contains/startsWith match.
  const direct = employees.find((employee) => {
    const normalizedName = normalizeNameForMatch(employee.name);
    return normalizedName.includes(query) || normalizedName.startsWith(query);
  });
  if (direct) return direct;

  // 2) Token overlap fallback ("alex bryn" should match full name).
  const queryTokens = query.split(" ").filter(Boolean);
  const tokenMatch = employees.find((employee) => {
    const normalizedName = normalizeNameForMatch(employee.name);
    return queryTokens.every((token) => normalizedName.includes(token));
  });

  return tokenMatch ?? null;
}

// -- Hook -----------------------------------------------------------------

export function useScheduleVoiceTools(input: ScheduleVoiceToolsInput): ClientTools {
  const dataRef = useRef(input);
  // Intentionally no deps — keeps ref fresh on every render so stable tool
  // implementations (created once via useMemo) always read the latest data.
  useEffect(() => {
    dataRef.current = input;
  });

  return useMemo(() => {
    // -- Read tool implementations ------------------------------------

    const getScheduleState: ClientToolImplementation = () => {
      const d = dataRef.current;
      const summary = d.computed.getStatusSummary();
      return JSON.stringify({
        weekStart: d.weekStart,
        weekEnd: d.weekEnd,
        days: d.days.map((day) => ({
          id: day.id,
          label: day.label,
          isToday: day.isToday,
          isHoliday: day.isHoliday,
        })),
        totalEmployees: d.employees.length,
        totalShifts: d.shifts.length,
        totalAbsences: d.absences.length,
        draftCount: summary.draftCount,
        publishedCount: summary.publishedCount,
        coverageRisks: summary.coverageRisks,
        overtimeRisks: summary.overtimeRisks,
        openShiftQueue: summary.openShiftQueue,
        employees: d.employees.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          team: e.team,
        })),
      });
    };

    const getShiftsForDay: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) {
        return JSON.stringify({
          error: `Could not resolve day "${dayInput}". Available: ${d.days.map((day) => day.label).join(", ")}`,
        });
      }

      const dayShifts = d.computed.getShiftsForDay(dateId);
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
      const employeeMap = new Map(d.employees.map((e) => [e.id, e]));

      return JSON.stringify({
        day: dayLabel,
        dateId,
        shiftCount: dayShifts.length,
        shifts: dayShifts.map((s) => ({
          id: s.id,
          employee: s.employeeId
            ? (employeeMap.get(s.employeeId)?.name ?? "Ukjent")
            : "Ikke tildelt",
          employeeId: s.employeeId,
          time: s.time,
          role: s.role,
          zone: s.zone,
          status: s.isPublished ? "published" : "draft",
          workHours: s.workHours,
          notes: s.notes,
        })),
      });
    };

    const getEmployeeSchedule: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const rawNameQuery = (params.employeeName as string) ?? "";
      const employee = findEmployeeByName(d.employees, rawNameQuery);

      if (!employee) {
        const names = d.employees.map((e) => e.name).join(", ");
        return JSON.stringify({
          error: `No employee matching "${rawNameQuery}". Available: ${names}`,
        });
      }

      const empShifts = d.computed.getShiftsForEmployee(employee.id);
      const empStats = d.computed.getEmployeeStats(employee.id);
      const empAbsences = d.absences.filter((a) => a.employeeId === employee.id);

      return JSON.stringify({
        employee: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
          team: employee.team,
        },
        stats: empStats,
        shifts: empShifts.map((s) => ({
          id: s.id,
          dateId: s.dateId,
          day: d.days.find((day) => day.id === s.dateId)?.label ?? s.dateId,
          time: s.time,
          role: s.role,
          status: s.isPublished ? "published" : "draft",
          workHours: s.workHours,
        })),
        absences: empAbsences.map((a) => ({
          dateId: a.dateId,
          type: a.type,
          status: a.status,
        })),
      });
    };

    const getCoverage: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = params.day as string | undefined;

      if (dayInput) {
        const dateId = resolveDateId(dayInput, d.days);
        if (!dateId) {
          return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
        }
        const coverage = d.computed.getCoverageForDay(dateId);
        const stats = d.computed.getDayStats(dateId);
        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;

        return JSON.stringify({
          day: dayLabel,
          dateId,
          totalStaff: coverage.totalStaff,
          shiftCount: stats.shiftCount,
          estimatedCost: stats.estimatedCost,
          draftCount: stats.draftCount,
          publishedCount: stats.publishedCount,
          absenceCount: stats.absenceCount,
          hasGaps: coverage.hasGaps,
          teamCoverage: coverage.byTeam,
        });
      }

      const summary = d.computed.getStatusSummary();
      const daySummaries = d.days.map((day) => {
        const coverage = d.computed.getCoverageForDay(day.id);
        const stats = d.computed.getDayStats(day.id);
        return {
          day: day.label,
          dateId: day.id,
          staff: coverage.totalStaff,
          shifts: stats.shiftCount,
          cost: stats.estimatedCost,
          hasGaps: coverage.hasGaps,
          drafts: stats.draftCount,
        };
      });

      return JSON.stringify({
        weekSummary: summary,
        days: daySummaries,
      });
    };

    // -- Write tool implementations -----------------------------------

    const createShiftTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;

      const rawNameQuery = (params.employeeName as string) ?? "";
      const employee = findEmployeeByName(d.employees, rawNameQuery);
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${rawNameQuery}"` });
      }

      const dateId = resolveDateId((params.day as string) ?? "", d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
      }

      const startTime = (params.startTime as string) ?? "08:00";
      const endTime = (params.endTime as string) ?? "16:00";
      const role = (params.role as string) ?? employee.jobTitle ?? "";

      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const workHours = Math.max(0, eh! * 60 + em! - (sh! * 60 + sm!)) / 60;
      const dayCategory = sh! < 11 ? "morning" : sh! < 17 ? "afternoon" : "evening";
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;

      // Ghost mode — create proposal instead of real shift
      if (d.addProposal) {
        d.addProposal({
          id: `proposal-${crypto.randomUUID()}`,
          type: "create",
          employeeId: employee.id,
          dateId,
          role,
          startTime,
          endTime,
          workHours,
          dayCategory,
          indicator: "blue",
          breaks: 0,
        });

        return JSON.stringify({
          success: true,
          ghost: true,
          message: `Forslag: ${employee.name} på ${dayLabel} ${startTime}–${endTime} som ${role}. Venter på godkjenning.`,
        });
      }

      // Direct mode — no proposal context, create real shift
      if (!d.mutations?.createShift) return JSON.stringify({ error: "Mutations not available" });

      try {
        await d.mutations.createShift({
          id: crypto.randomUUID(),
          employeeId: employee.id,
          dateId,
          role,
          startTime,
          endTime,
          workHours,
          status: "created",
          dayCategory,
          indicator: "blue",
          isPublished: false,
          breaks: 0,
        });

        return JSON.stringify({
          success: true,
          message: `Shift created for ${employee.name} on ${dayLabel} ${startTime}-${endTime} as ${role}`,
        });
      } catch (err: unknown) {
        return JSON.stringify({
          error: `Failed to create shift: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const updateShiftTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;

      const rawNameQuery = (params.employeeName as string) ?? "";
      const employee = findEmployeeByName(d.employees, rawNameQuery);
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${rawNameQuery}"` });
      }

      const dateId = resolveDateId((params.day as string) ?? "", d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
      }

      const cellShifts = d.computed.getShiftsForCell(employee.id, dateId);
      if (cellShifts.length === 0) {
        return JSON.stringify({ error: `No shift found for ${employee.name} on ${dateId}` });
      }

      let shift = cellShifts[0]!;
      if (cellShifts.length > 1 && params.time) {
        const match = cellShifts.find((s) => s.startTime === params.time);
        if (match) shift = match;
      }
      const patch: Record<string, unknown> = {};
      if (params.startTime) patch.startTime = params.startTime;
      if (params.endTime) patch.endTime = params.endTime;
      if (params.role) patch.role = params.role;
      if (params.notes) patch.notes = params.notes;

      if (patch.startTime || patch.endTime) {
        const st = (patch.startTime as string) ?? shift.startTime;
        const et = (patch.endTime as string) ?? shift.endTime;
        const [sHour, sMin] = st.split(":").map(Number);
        const [eHour, eMin] = et.split(":").map(Number);
        patch.workHours = Math.max(0, eHour! * 60 + eMin! - (sHour! * 60 + sMin!)) / 60;
      }

      // Ghost mode — create update proposal
      if (d.addProposal) {
        d.addProposal({
          id: `proposal-${crypto.randomUUID()}`,
          type: "update",
          shiftId: shift.id,
          employeeId: employee.id,
          dateId,
          patch,
        });

        return JSON.stringify({
          success: true,
          ghost: true,
          message: `Endringsforslag for ${employee.name}: ${Object.keys(patch).join(", ")}. Venter på godkjenning.`,
        });
      }

      // Direct mode
      if (!d.mutations?.updateShift) return JSON.stringify({ error: "Mutations not available" });

      try {
        await d.mutations.updateShift({ id: shift.id, patch });
        return JSON.stringify({
          success: true,
          message: `Updated shift for ${employee.name}: ${JSON.stringify(patch)}`,
        });
      } catch (err: unknown) {
        return JSON.stringify({
          error: `Failed to update: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const deleteShiftTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

      const rawNameQuery = (params.employeeName as string) ?? "";
      const employee = findEmployeeByName(d.employees, rawNameQuery);
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${rawNameQuery}"` });
      }

      const dateId = resolveDateId((params.day as string) ?? "", d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
      }

      const cellShifts = d.computed.getShiftsForCell(employee.id, dateId);
      if (cellShifts.length === 0) {
        return JSON.stringify({ error: `No shift found for ${employee.name} on ${dateId}` });
      }

      let shift = cellShifts[0]!;
      if (params.time && cellShifts.length > 1) {
        const match = cellShifts.find((s) => s.startTime === params.time);
        if (match) shift = match;
      }

      try {
        await d.mutations.deleteShift(shift.id);
        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
        return JSON.stringify({
          success: true,
          message: `Deleted ${employee.name}'s shift on ${dayLabel} (${shift.time})`,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed to delete: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const publishShiftsTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

      const dayInput = (params.day as string) ?? "all";
      let draftShifts: typeof d.shifts;

      if (dayInput.toLowerCase() === "all" || dayInput.toLowerCase() === "alle") {
        draftShifts = d.shifts.filter((s) => !s.isPublished);
      } else {
        const dateId = resolveDateId(dayInput, d.days);
        if (!dateId) {
          return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
        }
        draftShifts = d.computed.getShiftsForDay(dateId).filter((s) => !s.isPublished);
      }

      if (draftShifts.length === 0) {
        return JSON.stringify({ message: "No draft shifts to publish" });
      }

      try {
        await d.mutations.publishShifts(draftShifts.map((s) => s.id));
        return JSON.stringify({
          success: true,
          message: `Published ${draftShifts.length} shift(s)`,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed to publish: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const focusDayTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
      }
      if (!d.uiActions) {
        return JSON.stringify({ error: "UI actions are not available on this page" });
      }

      d.uiActions.focusDay(dateId);
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
      return JSON.stringify({
        success: true,
        message: `Focused and highlighted ${dayLabel}`,
        dateId,
      });
    };

    const openDayPlannerTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
      }
      if (!d.uiActions) {
        return JSON.stringify({ error: "UI actions are not available on this page" });
      }

      d.uiActions.openDayPlanner(dateId);
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
      return JSON.stringify({
        success: true,
        message: `Opened day planner for ${dayLabel}`,
        dateId,
      });
    };

    const closeDayPlannerTool: ClientToolImplementation = () => {
      const d = dataRef.current;
      if (!d.uiActions) {
        return JSON.stringify({ error: "UI actions are not available on this page" });
      }
      d.uiActions.closeDayPlanner();
      return JSON.stringify({ success: true, message: "Closed day planner" });
    };

    // -- Combine definitions and implementations ----------------------

    const allDefinitions = [...TOOL_DEFINITIONS];
    const allImplementations: Record<string, ClientToolImplementation> = {
      getScheduleState,
      getShiftsForDay,
      getEmployeeSchedule,
      getCoverage,
      createShift: createShiftTool,
      updateShift: updateShiftTool,
      deleteShift: deleteShiftTool,
      publishShifts: publishShiftsTool,
      focusDay: focusDayTool,
      openDayPlanner: openDayPlannerTool,
      closeDayPlanner: closeDayPlannerTool,
    };

    return {
      definitions: allDefinitions,
      implementations: allImplementations,
    };
  }, []); // Empty deps -- implementations use refs, so they never need to be recreated
}
