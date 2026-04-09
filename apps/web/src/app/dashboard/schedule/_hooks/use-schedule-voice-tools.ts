"use client";

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientTools,
} from "@/components/voice-tools-context";
import { SCHEDULE_TOOL_DEFINITIONS } from "./schedule-tool-definitions";
import { createClient } from "@smartout/supabase/client";
import { resolveEffectiveHours } from "@/lib/cascade/resolve-hours";
import type { DepartmentOperatingHoursRow, DepartmentHoursOverrideRow } from "@/lib/cascade/types";
import type { Shift, Absence, ShiftProposal } from "../_components/schedule-types";
import type { ScheduleEmployee } from "./use-employees";
import type { ScheduleComputed } from "./use-schedule-computed";

type ScheduleVoiceToolsInput = {
  weekStart: string;
  weekEnd: string;
  workspaceId?: string;
  days: Array<{ id: string; label: string; isToday?: boolean; isHoliday?: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  uiActions?: {
    focusDay: (dateId: string) => void;
    openDayPlanner: (dateId: string) => void;
    closeDayPlanner: () => void;
    switchScheduleView?: (view: string) => void;
    setTimePeriod?: (weeks: number) => void;
    setSelectedDate?: (date: string | null) => void;
    setFilterSituation?: (filter: string) => void;
  };
  mutations?: {
    createShift: (input: Record<string, unknown>) => Promise<unknown>;
    updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
    deleteShift: (id: string) => Promise<unknown>;
    publishShifts: (ids: string[]) => Promise<unknown>;
  };
  /** When provided, write tools create ghost proposals instead of real shifts */
  addProposal?: (proposal: ShiftProposal) => void;
  /** When provided, voice tools prompt for confirmation before creating proposals */
  requestConfirmation?: (title: string, description: string) => Promise<boolean>;
};

// Tool definitions imported from @smartout/ai — single source of truth.
// Cast to mutable array for ClientTools compatibility.
const TOOL_DEFINITIONS: ClientToolDefinition[] = [...SCHEDULE_TOOL_DEFINITIONS];
const AVG_BOOKING_REVENUE_PER_GUEST = 525;
const LABOR_BUDGET_TARGET_RATIO = 0.33;

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

/**
 * Detects backend temporal shift lock errors from mutation responses.
 * Why: voice should return human-readable refusal when shift is immutable.
 */
function isShiftLockedMutationError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("SHIFT_LOCKED_MUTATION");
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

    const getWeekOperationsSummary: ClientToolImplementation = () => {
      const d = dataRef.current;
      const statusSummary = d.computed.getStatusSummary();

      const weekDayStats = d.days.map((day) => d.computed.getDayStats(day.id));
      const totalShiftCount = weekDayStats.reduce((sum, stats) => sum + stats.shiftCount, 0);
      const totalDraftCount = weekDayStats.reduce((sum, stats) => sum + stats.draftCount, 0);
      const totalPublishedCount = weekDayStats.reduce(
        (sum, stats) => sum + stats.publishedCount,
        0,
      );
      const totalLaborCost = weekDayStats.reduce((sum, stats) => sum + stats.estimatedCost, 0);
      const totalAbsenceCount = weekDayStats.reduce((sum, stats) => sum + stats.absenceCount, 0);

      const totalBookingCount = d.days.reduce(
        (sum, day) => sum + d.computed.getBookingsForDay(day.id).length,
        0,
      );
      const totalBookedGuests = d.days.reduce(
        (sum, day) =>
          sum +
          d.computed
            .getBookingsForDay(day.id)
            .reduce((guestSum, booking) => guestSum + booking.guestCount, 0),
        0,
      );

      const estimatedRevenue = totalBookedGuests * AVG_BOOKING_REVENUE_PER_GUEST;
      const laborBudgetCap = Math.round(estimatedRevenue * LABOR_BUDGET_TARGET_RATIO);
      const budgetDelta = laborBudgetCap - totalLaborCost;

      const bookedShiftCount = d.shifts.filter((shift) => shift.employeeId !== null).length;
      const emptyShiftCount = Math.max(0, d.shifts.length - bookedShiftCount);
      const fillRate =
        d.shifts.length > 0 ? Number(((bookedShiftCount / d.shifts.length) * 100).toFixed(1)) : 0;

      const sickAbsenceCount = d.absences.filter((absence) => absence.type === "sick_leave").length;
      const vacationAbsenceCount = d.absences.filter(
        (absence) => absence.type === "vacation",
      ).length;

      return JSON.stringify({
        weekRange: {
          start: d.weekStart,
          end: d.weekEnd,
          displayedDays: d.days.length,
        },
        shifts: {
          total: totalShiftCount,
          filled: bookedShiftCount,
          empty: emptyShiftCount,
          openShiftQueue: statusSummary.openShiftQueue,
          fillRatePercent: fillRate,
          draft: totalDraftCount,
          published: totalPublishedCount,
        },
        labor: {
          estimatedCost: Math.round(totalLaborCost),
        },
        bookings: {
          total: totalBookingCount,
          guestCount: totalBookedGuests,
          estimatedRevenue,
        },
        budget: {
          laborBudgetCap,
          laborCost: Math.round(totalLaborCost),
          delta: Math.round(budgetDelta),
          status: budgetDelta >= 0 ? "within_budget" : "over_budget",
        },
        absences: {
          total: totalAbsenceCount,
          sickLeave: sickAbsenceCount,
          vacation: vacationAbsenceCount,
        },
        riskSignals: {
          coverage: statusSummary.coverageRisks,
          overtime: statusSummary.overtimeRisks,
          compliance: statusSummary.complianceRisks,
        },
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
        if (d.requestConfirmation) {
          const confirmed = await d.requestConfirmation(
            `Legg til ${employee.name} som ${role}`,
            `${dayLabel} ${startTime}–${endTime}. Forslaget vises som spøkelsesvakt i rutenettet.`,
          );
          if (!confirmed) {
            return JSON.stringify({ success: false, message: "Avslått av leder." });
          }
        }

        d.addProposal({
          id: `proposal-${crypto.randomUUID()}`,
          type: "create",
          employeeId: employee.id,
          employeeName: employee.name,
          dateId,
          role,
          startTime,
          endTime,
          workHours,
          dayCategory,
          indicator: "blue",
          breaks: 0,
          // templateShiftId left undefined — resolved in Phase B
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
        if (isShiftLockedMutationError(err)) {
          return JSON.stringify({
            error:
              "Kan ikke endre vakt: vakten er låst fordi den har startet eller datoen er passert.",
          });
        }
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
        if (isShiftLockedMutationError(err)) {
          return JSON.stringify({
            error:
              "Kan ikke slette vakt: vakten er låst fordi den har startet eller datoen er passert.",
          });
        }
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
        if (isShiftLockedMutationError(err)) {
          return JSON.stringify({
            error:
              "Kan ikke publisere vakter: en eller flere vakter er låst fordi de har startet eller datoen er passert.",
          });
        }
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

    // -- Reservation tool ---------------------------------------------

    const addReservationTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      const wsId = d.workspaceId;
      if (!wsId) return JSON.stringify({ error: "No workspace context" });

      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });

      const title = (params.title as string) ?? "";
      if (!title) return JSON.stringify({ error: "Booking title/name required" });

      const guestCount = Number(params.guestCount ?? 0);
      const bookingTime = (params.bookingTime as string) ?? "18:00";
      const contactPerson = (params.contactPerson as string) ?? null;
      const notes = (params.notes as string) ?? null;
      const isVip = (params.isVip as boolean) ?? false;
      const location = (params.location as string) ?? null;
      const menu = (params.menu as string) ?? null;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("schedule_day_booking")
          .insert({
            workspace_id: wsId,
            shift_date: dateId,
            title,
            guest_count: guestCount,
            booking_time: bookingTime,
            status: "confirmed",
            is_vip: isVip,
            contact_person: contactPerson,
            location,
            menu,
            notes,
          })
          .select("schedule_day_booking_id, title, booking_time, guest_count, location")
          .single();

        if (error) return JSON.stringify({ error: error.message });

        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
        const locMsg = location ? ` ${location}.` : "";
        return JSON.stringify({
          success: true,
          message: `Reservasjon lagt til: ${title}, ${guestCount} gjester kl ${bookingTime} på ${dayLabel}.${locMsg}${isVip ? " (VIP)" : ""}`,
          booking: data,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    // -- Update reservation tool ----------------------------------------

    const updateReservationTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      const wsId = d.workspaceId;
      if (!wsId) return JSON.stringify({ error: "No workspace context" });

      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });

      const titleQuery = (params.title as string) ?? "";
      if (!titleQuery) return JSON.stringify({ error: "Guest name required to find reservation" });

      try {
        const supabase = createClient();

        // Find the reservation by fuzzy title match on the given date
        const { data: bookings, error: findError } = await supabase
          .from("schedule_day_booking")
          .select(
            "schedule_day_booking_id, title, booking_time, guest_count, location, status, is_vip, notes, contact_person, menu",
          )
          .eq("workspace_id", wsId)
          .eq("shift_date", dateId)
          .order("booking_time", { ascending: true });

        if (findError) return JSON.stringify({ error: findError.message });
        if (!bookings || bookings.length === 0) {
          return JSON.stringify({ error: `Ingen reservasjoner funnet på ${dateId}` });
        }

        // Fuzzy match on title
        const query = titleQuery.toLowerCase().trim();
        const match =
          bookings.find((b) => b.title.toLowerCase().includes(query)) ??
          bookings.find((b) => b.title.toLowerCase().startsWith(query));

        if (!match) {
          const names = bookings.map((b) => b.title).join(", ");
          return JSON.stringify({
            error: `Ingen reservasjon matchet "${titleQuery}". Tilgjengelige: ${names}`,
          });
        }

        // Build update object
        const updates: Record<string, unknown> = {};
        if (params.guestCount !== undefined) updates.guest_count = Number(params.guestCount);
        if (params.bookingTime !== undefined) updates.booking_time = params.bookingTime;
        if (params.location !== undefined) updates.location = params.location;
        if (params.status !== undefined) updates.status = params.status;
        if (params.isVip !== undefined) updates.is_vip = params.isVip;
        if (params.notes !== undefined) updates.notes = params.notes;
        if (params.contactPerson !== undefined) updates.contact_person = params.contactPerson;
        if (params.menu !== undefined) updates.menu = params.menu;

        if (Object.keys(updates).length === 0) {
          return JSON.stringify({ error: "Ingen felter å oppdatere" });
        }

        const { error: updateError } = await supabase
          .from("schedule_day_booking")
          .update(updates)
          .eq("schedule_day_booking_id", match.schedule_day_booking_id);

        if (updateError) return JSON.stringify({ error: updateError.message });

        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
        const changes = Object.keys(updates).join(", ");
        return JSON.stringify({
          success: true,
          message: `Reservasjon "${match.title}" på ${dayLabel} oppdatert: ${changes}.`,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    // -- Session task tool ---------------------------------------------

    const addSessionTaskTool: ClientToolImplementation = async (params) => {
      const d = dataRef.current;
      const wsId = d.workspaceId;
      if (!wsId) return JSON.stringify({ error: "No workspace context" });

      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });

      const title = (params.title as string) ?? "";
      if (!title) return JSON.stringify({ error: "Task title required" });

      const description = (params.description as string) ?? null;
      const isComplianceRequired = (params.isComplianceRequired as boolean) ?? false;

      // Resolve employee assignment if provided
      let assignedTo: string | null = null;
      const assignName = (params.assignTo as string) ?? "";
      if (assignName) {
        const employee = findEmployeeByName(d.employees, assignName);
        if (employee) assignedTo = employee.id;
      }

      try {
        const supabase = createClient();

        // Find or create the department_session for this date
        // First, try to find an existing session
        const { data: existingSession } = await supabase
          .from("department_session")
          .select("department_session_id")
          .eq("workspace_id", wsId)
          .eq("session_date", dateId)
          .limit(1)
          .maybeSingle();

        let sessionId = existingSession?.department_session_id as string | null;

        if (!sessionId) {
          // No session exists yet — find the first department to create one
          const { data: dept } = await supabase
            .from("department")
            .select("department_id")
            .eq("workspace_id", wsId)
            .limit(1)
            .maybeSingle();

          if (!dept) return JSON.stringify({ error: "No department found in workspace" });

          // Fetch operating hours to populate planned_open/close
          const { data: weeklyHours } = await supabase
            .from("department_operating_hours")
            .select(
              "id, department_id, location_id, season_id, day_of_week, open_time, close_time, is_closed",
            )
            .eq("department_id", dept.department_id)
            .eq("workspace_id", wsId);

          const { data: overrides } = await supabase
            .from("department_hours_override")
            .select(
              "id, department_id, location_id, override_date, open_time, close_time, is_closed, reason",
            )
            .eq("department_id", dept.department_id)
            .eq("override_date", dateId);

          const effectiveHours = resolveEffectiveHours(
            dept.department_id,
            null,
            dateId,
            (weeklyHours ?? []) as DepartmentOperatingHoursRow[],
            (overrides ?? []) as DepartmentHoursOverrideRow[],
          );

          const { data: newSession, error: sessionError } = await supabase
            .from("department_session")
            .insert({
              workspace_id: wsId,
              department_id: dept.department_id,
              session_date: dateId,
              status: "upcoming",
              planned_open: effectiveHours.isOpen ? effectiveHours.openTime : null,
              planned_close: effectiveHours.isOpen ? effectiveHours.closeTime : null,
            })
            .select("department_session_id")
            .single();

          if (sessionError) return JSON.stringify({ error: `Session: ${sessionError.message}` });
          sessionId = newSession.department_session_id as string;
        }

        // Create the session task
        const { data: task, error } = await supabase
          .from("session_task")
          .insert({
            workspace_id: wsId,
            department_session_id: sessionId,
            title,
            description,
            status: "pending",
            assigned_to: assignedTo,
            is_compliance_required: isComplianceRequired,
          })
          .select("id, title, status")
          .single();

        if (error) return JSON.stringify({ error: error.message });

        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
        const assignMsg = assignedTo
          ? ` Tildelt ${d.employees.find((e) => e.id === assignedTo)?.name ?? "ukjent"}.`
          : "";
        return JSON.stringify({
          success: true,
          message: `Dagsoppgave lagt til på ${dayLabel}: "${title}".${assignMsg}${isComplianceRequired ? " (Compliance)" : ""}`,
          task,
        });
      } catch (err) {
        return JSON.stringify({
          error: `Failed: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    };

    // -- View switching tool implementations ---------------------------

    const switchScheduleViewTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const view = (params.view as string) ?? "ansatt";
      const valid = ["ansatt", "jobb", "team", "lokasjon"];
      if (!valid.includes(view)) {
        return JSON.stringify({ error: `Ugyldig visning "${view}". Bruk: ${valid.join(", ")}` });
      }
      if (!d.uiActions?.switchScheduleView) {
        return JSON.stringify({ error: "View switching not available" });
      }
      d.uiActions.switchScheduleView(view);
      const labels: Record<string, string> = {
        ansatt: "ansatt",
        jobb: "jobbroller",
        team: "team",
        lokasjon: "lokasjon",
      };
      return JSON.stringify({
        success: true,
        message: `Byttet til ${labels[view] ?? view}-visning.`,
      });
    };

    const setTimePeriodTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const weeks = Number(params.weeks ?? 4);
      const valid = [1, 2, 4, 8];
      if (!valid.includes(weeks)) {
        return JSON.stringify({ error: `Ugyldig periode. Bruk: ${valid.join(", ")} uker` });
      }
      if (!d.uiActions?.setTimePeriod) {
        return JSON.stringify({ error: "Time period switching not available" });
      }
      d.uiActions.setTimePeriod(weeks);
      const labels: Record<number, string> = {
        1: "1 uke",
        2: "2 uker",
        4: "manedsoversikt (4 uker)",
        8: "2 maneder",
      };
      return JSON.stringify({
        success: true,
        message: `Viser ${labels[weeks] ?? weeks + " uker"}.`,
      });
    };

    const showSingleDayTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) {
        return JSON.stringify({ error: `Kunne ikke finne dag "${dayInput}"` });
      }
      if (!d.uiActions?.setSelectedDate) {
        return JSON.stringify({ error: "Day selection not available" });
      }
      d.uiActions.setSelectedDate(dateId);
      if (d.uiActions.focusDay) d.uiActions.focusDay(dateId);
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
      return JSON.stringify({ success: true, message: `Viser ${dayLabel}.` });
    };

    const filterScheduleTool: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const filter = (params.filter as string) ?? "Alle";
      if (!d.uiActions?.setFilterSituation) {
        return JSON.stringify({ error: "Filtering not available" });
      }
      d.uiActions.setFilterSituation(filter);
      return JSON.stringify({
        success: true,
        message: filter === "Alle" ? "Filter fjernet — viser alle." : `Filtrert pa: ${filter}.`,
      });
    };

    // -- Combine definitions and implementations ----------------------

    const allDefinitions = [...TOOL_DEFINITIONS];
    const allImplementations: Record<string, ClientToolImplementation> = {
      getScheduleState,
      getShiftsForDay,
      getEmployeeSchedule,
      getCoverage,
      getWeekOperationsSummary,
      createShift: createShiftTool,
      updateShift: updateShiftTool,
      deleteShift: deleteShiftTool,
      publishShifts: publishShiftsTool,
      focusDay: focusDayTool,
      openDayPlanner: openDayPlannerTool,
      closeDayPlanner: closeDayPlannerTool,
      addReservation: addReservationTool,
      updateReservation: updateReservationTool,
      addSessionTask: addSessionTaskTool,
      switchScheduleView: switchScheduleViewTool,
      setTimePeriod: setTimePeriodTool,
      showSingleDay: showSingleDayTool,
      filterSchedule: filterScheduleTool,
    };

    return {
      definitions: allDefinitions,
      implementations: allImplementations,
    };
  }, []); // Empty deps -- implementations use refs, so they never need to be recreated
}
