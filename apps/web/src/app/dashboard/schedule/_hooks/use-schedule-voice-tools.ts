"use client";

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientTools,
} from "@/components/voice-tools-context";
import type { Shift, Absence } from "../_components/schedule-types";
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
  mutations?: {
    createShift: (input: Record<string, unknown>) => Promise<unknown>;
    updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
    deleteShift: (id: string) => Promise<unknown>;
    publishShifts: (ids: string[]) => Promise<unknown>;
  };
};

// -- Tool definitions (Ultravox format) -----------------------------------

const TOOL_DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "getScheduleState",
      description:
        "Get the current schedule overview: which week is displayed, how many shifts, employees, coverage gaps, and draft/published counts. Call this first to understand what the manager is looking at.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getShiftsForDay",
      description:
        "Get all shifts for a specific day. Returns employee names, times, roles, and status (draft/published). Use day name like 'monday' or date like '2026-03-03'.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "Day name (monday, tuesday, etc.) or date (YYYY-MM-DD). Day names are relative to the currently displayed week.",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getEmployeeSchedule",
      description:
        "Get one employee's shifts and absences for the current week. Search by name (partial match).",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Employee name or partial name to search for",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getCoverage",
      description:
        "Get staffing coverage for a specific day or the whole week. Shows gaps, overtime risks, and team coverage. If no day specified, returns week summary.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "Optional: day name or date. If omitted, returns full week coverage summary.",
          },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "createShift",
      description:
        "Create a new shift. Requires employee name, day, start time, and end time. Role is optional.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee name (partial match)" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day name or date (YYYY-MM-DD)" },
          required: true,
        },
        {
          name: "startTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Start time in HH:MM format (e.g. '08:00')" },
          required: true,
        },
        {
          name: "endTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "End time in HH:MM format (e.g. '16:00')" },
          required: true,
        },
        {
          name: "role",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Job role (e.g. 'Kokk', 'Servitoer'). Optional." },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "updateShift",
      description:
        "Update an existing shift. Find it by employee name + day, then change time, role, or notes.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee whose shift to update" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day of the shift" },
          required: true,
        },
        {
          name: "startTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New start time (HH:MM). Optional." },
        },
        {
          name: "endTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New end time (HH:MM). Optional." },
        },
        {
          name: "role",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New role. Optional." },
        },
        {
          name: "notes",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Shift notes. Optional." },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "deleteShift",
      description:
        "Delete a shift. Find it by employee name + day. If multiple shifts, specify the time to disambiguate.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee whose shift to delete" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day of the shift" },
          required: true,
        },
        {
          name: "time",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Start time to disambiguate if multiple shifts (HH:MM). Optional.",
          },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "publishShifts",
      description:
        "Publish draft shifts. Specify a day to publish all drafts for that day, or 'all' to publish everything.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Day name, date, or 'all' to publish all draft shifts in the current week",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
];

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

// -- Hook -----------------------------------------------------------------

export function useScheduleVoiceTools(input: ScheduleVoiceToolsInput): ClientTools {
  const dataRef = useRef(input);
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
      const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();

      const employee = d.employees.find(
        (e) =>
          e.name.toLowerCase().includes(nameQuery) || e.name.toLowerCase().startsWith(nameQuery),
      );

      if (!employee) {
        const names = d.employees.map((e) => e.name).join(", ");
        return JSON.stringify({
          error: `No employee matching "${nameQuery}". Available: ${names}`,
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
      if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

      const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
      const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
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
          dayCategory: "morning",
          indicator: "blue",
          isPublished: false,
          breaks: 0,
        });

        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
        return JSON.stringify({
          success: true,
          message: `Shift created for ${employee.name} on ${dayLabel} ${startTime}-${endTime} as ${role}`,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed to create shift: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const updateShiftTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

      const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
      const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
      }

      const dateId = resolveDateId((params.day as string) ?? "", d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
      }

      const cellShifts = d.computed.getShiftsForCell(employee.id, dateId);
      if (cellShifts.length === 0) {
        return JSON.stringify({ error: `No shift found for ${employee.name} on ${dateId}` });
      }

      const shift = cellShifts[0]!;
      const patch: Record<string, unknown> = {};
      if (params.startTime) patch.startTime = params.startTime;
      if (params.endTime) patch.endTime = params.endTime;
      if (params.role) patch.role = params.role;
      if (params.notes) patch.notes = params.notes;

      if (patch.startTime || patch.endTime) {
        const st = (patch.startTime as string) ?? shift.startTime;
        const et = (patch.endTime as string) ?? shift.endTime;
        const [sh, sm] = st.split(":").map(Number);
        const [eh, em] = et.split(":").map(Number);
        patch.workHours = Math.max(0, eh! * 60 + em! - (sh! * 60 + sm!)) / 60;
      }

      try {
        await d.mutations.updateShift({ id: shift.id, patch });
        return JSON.stringify({
          success: true,
          message: `Updated shift for ${employee.name}: ${JSON.stringify(patch)}`,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed to update: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    const deleteShiftTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

      const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
      const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
      if (!employee) {
        return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
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
    };

    return {
      definitions: allDefinitions,
      implementations: allImplementations,
    };
  }, []); // Empty deps -- implementations use refs, so they never need to be recreated
}
