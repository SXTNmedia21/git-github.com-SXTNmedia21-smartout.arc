// ============================================
// schedule-context.tsx
// Central state management for the schedule module.
// Uses useReducer + React Context for local state.
// All UI interactions dispatch actions here.
// Connected to: schedule-types.ts (type definitions)
// Connected to: page.tsx (provider wrapper)
// ============================================
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import type {
  Absence,
  AbsenceType,
  DayBooking,
  DayClipboard,
  DayMessage,
  DayTask,
  OpenShift,
  Shift,
  ShiftHistoryEntry,
  ShiftTemplate,
  TaskStatus,
} from "./schedule-types";

// ── Helper: generate unique IDs ─────────────────────────────

/**
 * Generates a short unique ID for local state entities.
 * Not a real UUID — just needs to be unique within the session.
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns current ISO timestamp string.
 */
function now(): string {
  return new Date().toISOString();
}

// ── State shape ─────────────────────────────────────────────

export type ScheduleState = {
  shifts: Shift[];
  absences: Absence[];
  openShifts: OpenShift[];
  templates: ShiftTemplate[];
  dayMessages: DayMessage[];
  dayTasks: DayTask[];
  dayBookings: DayBooking[];
  shiftHistory: ShiftHistoryEntry[];
  /** Currently selected shift for detail modal */
  selectedShiftId: string | null;
  /** Currently selected day for day inspector */
  selectedDayId: string | null;
  /** Copy/paste clipboard */
  clipboard: DayClipboard | null;
  /** Batch-selected days (MODULE_03 §5) */
  selectedDays: Set<string>;
  /** Pre-fill context for new shift creation */
  createShiftContext: {
    dateId?: string;
    employeeId?: string;
  } | null;
  /** Absence popover state */
  absencePopover: {
    employeeId: string;
    dateId: string;
  } | null;
};

// ── Action types ────────────────────────────────────────────

export type ScheduleAction =
  // Shift CRUD
  | { type: "ADD_SHIFT"; payload: Omit<Shift, "id" | "createdAt" | "updatedAt"> }
  | { type: "UPDATE_SHIFT"; payload: { id: string; changes: Partial<Shift> } }
  | { type: "DELETE_SHIFT"; payload: { id: string } }
  | { type: "MOVE_SHIFT"; payload: { shiftId: string; toEmployeeId: string; toDateId: string } }
  | { type: "ASSIGN_SHIFT"; payload: { shiftId: string; employeeId: string } }
  // Shift lifecycle
  | { type: "PUBLISH_SHIFT"; payload: { shiftId: string } }
  | { type: "PUBLISH_DAY"; payload: { dateId: string } }
  | { type: "UNPUBLISH_DAY"; payload: { dateId: string } }
  | { type: "PUBLISH_SELECTED_DAYS" }
  // Day operations
  | { type: "COPY_DAY"; payload: { dateId: string; dateLabel: string } }
  | { type: "PASTE_DAY"; payload: { targetDateId: string } }
  | { type: "SELECT_DAY"; payload: { dateId: string } }
  | { type: "CLEAR_SELECTED_DAYS" }
  // Absence
  | { type: "ADD_ABSENCE"; payload: Omit<Absence, "id"> }
  | { type: "DELETE_ABSENCE"; payload: { id: string } }
  // Templates
  | {
      type: "SAVE_DAY_AS_TEMPLATE";
      payload: { dateId: string; name: string; department: string; includeAssignments: boolean };
    }
  | { type: "LOAD_TEMPLATE"; payload: { templateId: string; targetDateId: string } }
  | { type: "ADD_TEMPLATE"; payload: ShiftTemplate }
  | { type: "UPDATE_TEMPLATE"; payload: { id: string; changes: Partial<ShiftTemplate> } }
  | { type: "DELETE_TEMPLATE"; payload: { id: string } }
  // Open shifts
  | { type: "ADD_OPEN_SHIFT"; payload: Omit<OpenShift, "id"> }
  | { type: "DELETE_OPEN_SHIFT"; payload: { id: string } }
  | {
      type: "ASSIGN_OPEN_SHIFT";
      payload: { openShiftId: string; employeeId: string; dateId: string };
    }
  // Day content
  | { type: "ADD_MESSAGE"; payload: Omit<DayMessage, "id" | "createdAt"> }
  | { type: "DELETE_MESSAGE"; payload: { id: string } }
  | { type: "ADD_TASK"; payload: Omit<DayTask, "id"> }
  | { type: "UPDATE_TASK_STATUS"; payload: { id: string; status: TaskStatus } }
  | { type: "DELETE_TASK"; payload: { id: string } }
  | { type: "ADD_BOOKING"; payload: Omit<DayBooking, "id"> }
  // Bulk operations
  | { type: "PUBLISH_ALL_DRAFTS" }
  // UI state
  | { type: "SET_SELECTED_SHIFT"; payload: string | null }
  | { type: "SET_SELECTED_DAY"; payload: string | null }
  | { type: "SET_CREATE_SHIFT_CONTEXT"; payload: { dateId?: string; employeeId?: string } | null }
  | { type: "SET_ABSENCE_POPOVER"; payload: { employeeId: string; dateId: string } | null }
  | { type: "SET_CLIPBOARD"; payload: DayClipboard | null };

// ── History helper ──────────────────────────────────────────

/**
 * Creates a history entry for shift audit trail.
 */
function createHistoryEntry(
  shiftId: string,
  eventType: ShiftHistoryEntry["eventType"],
  field?: string,
  oldValue?: string,
  newValue?: string,
): ShiftHistoryEntry {
  return {
    id: generateId("hist"),
    shiftId,
    eventType,
    field,
    oldValue,
    newValue,
    timestamp: now(),
    actor: "System",
  };
}

// ── Reducer ─────────────────────────────────────────────────

/**
 * Central reducer handling all schedule state mutations.
 * Every shift mutation also records a history entry.
 */
function scheduleReducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  const timestamp = now();

  switch (action.type) {
    // ── Shift CRUD ────────────────────────────────────────

    case "ADD_SHIFT": {
      const id = generateId("shift");
      const newShift: Shift = {
        ...action.payload,
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const history = createHistoryEntry(id, "created");
      return {
        ...state,
        shifts: [...state.shifts, newShift],
        shiftHistory: [...state.shiftHistory, history],
        // Close creation context after adding
        createShiftContext: null,
      };
    }

    case "UPDATE_SHIFT": {
      const { id, changes } = action.payload;
      const oldShift = state.shifts.find((s) => s.id === id);
      if (!oldShift) return state;

      // Build history entries for each changed field
      const historyEntries: ShiftHistoryEntry[] = [];
      for (const [key, value] of Object.entries(changes)) {
        const oldValue = String(oldShift[key as keyof Shift] ?? "");
        const newValue = String(value ?? "");
        if (oldValue !== newValue) {
          historyEntries.push(createHistoryEntry(id, "updated", key, oldValue, newValue));
        }
      }

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === id ? { ...s, ...changes, updatedAt: timestamp } : s,
        ),
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    case "DELETE_SHIFT": {
      const history = createHistoryEntry(action.payload.id, "deleted");
      return {
        ...state,
        shifts: state.shifts.filter((s) => s.id !== action.payload.id),
        shiftHistory: [...state.shiftHistory, history],
        selectedShiftId: state.selectedShiftId === action.payload.id ? null : state.selectedShiftId,
      };
    }

    case "MOVE_SHIFT": {
      const { shiftId, toEmployeeId, toDateId } = action.payload;
      const oldShift = state.shifts.find((s) => s.id === shiftId);
      if (!oldShift) return state;

      const history = createHistoryEntry(
        shiftId,
        "moved",
        "location",
        `${oldShift.employeeId}::${oldShift.dateId}`,
        `${toEmployeeId}::${toDateId}`,
      );

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === shiftId
            ? { ...s, employeeId: toEmployeeId, dateId: toDateId, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, history],
      };
    }

    case "ASSIGN_SHIFT": {
      const { shiftId, employeeId } = action.payload;
      const history = createHistoryEntry(shiftId, "assigned", "employeeId", "", employeeId);

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === shiftId
            ? {
                ...s,
                employeeId,
                status: s.status === "created" ? "assigned" : s.status,
                updatedAt: timestamp,
              }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, history],
      };
    }

    // ── Shift lifecycle ───────────────────────────────────

    case "PUBLISH_SHIFT": {
      const { shiftId } = action.payload;
      const history = createHistoryEntry(shiftId, "status_changed", "status", "", "published");

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === shiftId
            ? { ...s, status: "published", isPublished: true, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, history],
      };
    }

    case "PUBLISH_DAY": {
      const { dateId } = action.payload;
      const affectedShifts = state.shifts.filter(
        (s) => s.dateId === dateId && (s.status === "created" || s.status === "assigned"),
      );

      const historyEntries = affectedShifts.map((s) =>
        createHistoryEntry(s.id, "status_changed", "status", s.status, "published"),
      );

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.dateId === dateId && (s.status === "created" || s.status === "assigned")
            ? { ...s, status: "published", isPublished: true, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    case "UNPUBLISH_DAY": {
      const { dateId } = action.payload;
      const affectedShifts = state.shifts.filter(
        (s) => s.dateId === dateId && s.status === "published",
      );

      const historyEntries = affectedShifts.map((s) =>
        createHistoryEntry(s.id, "status_changed", "status", "published", "unpublished"),
      );

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.dateId === dateId && s.status === "published"
            ? { ...s, status: "unpublished", isPublished: false, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    case "PUBLISH_SELECTED_DAYS": {
      const dateIds = state.selectedDays;
      const affectedShifts = state.shifts.filter(
        (s) => dateIds.has(s.dateId) && (s.status === "created" || s.status === "assigned"),
      );

      const historyEntries = affectedShifts.map((s) =>
        createHistoryEntry(s.id, "status_changed", "status", s.status, "published"),
      );

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          dateIds.has(s.dateId) && (s.status === "created" || s.status === "assigned")
            ? { ...s, status: "published", isPublished: true, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, ...historyEntries],
        selectedDays: new Set(),
      };
    }

    case "PUBLISH_ALL_DRAFTS": {
      const draftShifts = state.shifts.filter(
        (s) => s.status === "created" || s.status === "assigned",
      );

      const historyEntries = draftShifts.map((s) =>
        createHistoryEntry(s.id, "status_changed", "status", s.status, "published"),
      );

      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.status === "created" || s.status === "assigned"
            ? { ...s, status: "published", isPublished: true, updatedAt: timestamp }
            : s,
        ),
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    // ── Day operations ────────────────────────────────────

    case "COPY_DAY": {
      const { dateId, dateLabel } = action.payload;
      const dayShifts = state.shifts.filter((s) => s.dateId === dateId);
      const dayAbsences = state.absences.filter((a) => a.dateId === dateId);

      const clipboard: DayClipboard = {
        sourceDate: dateId,
        sourceDateLabel: dateLabel,
        shifts: dayShifts.map(
          ({ id: _id, dateId: _dateId, createdAt: _c, updatedAt: _u, ...rest }) => rest,
        ),
        absences: dayAbsences.map(({ id: _id, dateId: _dateId, ...rest }) => rest),
      };

      return { ...state, clipboard };
    }

    case "PASTE_DAY": {
      if (!state.clipboard) return state;
      const { targetDateId } = action.payload;

      const newShifts: Shift[] = state.clipboard.shifts.map((s) => ({
        ...s,
        id: generateId("shift"),
        dateId: targetDateId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      const newAbsences: Absence[] = state.clipboard.absences.map((a) => ({
        ...a,
        id: generateId("abs"),
        dateId: targetDateId,
      }));

      const historyEntries = newShifts.map((s) => createHistoryEntry(s.id, "created"));

      return {
        ...state,
        shifts: [...state.shifts, ...newShifts],
        absences: [...state.absences, ...newAbsences],
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    case "SELECT_DAY": {
      const newSelected = new Set(state.selectedDays);
      if (newSelected.has(action.payload.dateId)) {
        newSelected.delete(action.payload.dateId);
      } else {
        newSelected.add(action.payload.dateId);
      }
      return { ...state, selectedDays: newSelected };
    }

    case "CLEAR_SELECTED_DAYS":
      return { ...state, selectedDays: new Set() };

    // ── Absence ───────────────────────────────────────────

    case "ADD_ABSENCE": {
      const absence: Absence = {
        ...action.payload,
        id: generateId("abs"),
      };

      // Remove conflicting shifts for this employee on this date
      const conflictingShiftIds = state.shifts
        .filter((s) => s.employeeId === absence.employeeId && s.dateId === absence.dateId)
        .map((s) => s.id);

      const conflictHistory = conflictingShiftIds.map((id) =>
        createHistoryEntry(id, "deleted", "reason", "", "absence_conflict"),
      );

      return {
        ...state,
        absences: [...state.absences, absence],
        shifts: state.shifts.filter((s) => !conflictingShiftIds.includes(s.id)),
        shiftHistory: [...state.shiftHistory, ...conflictHistory],
        absencePopover: null,
      };
    }

    case "DELETE_ABSENCE":
      return {
        ...state,
        absences: state.absences.filter((a) => a.id !== action.payload.id),
      };

    // ── Templates ─────────────────────────────────────────

    case "SAVE_DAY_AS_TEMPLATE": {
      const { dateId, name, department, includeAssignments } = action.payload;
      const dayShifts = state.shifts.filter((s) => s.dateId === dateId);

      const templateShifts = dayShifts.map(
        ({ id: _id, dateId: _dateId, createdAt: _c, updatedAt: _u, isPublished: _p, ...rest }) => ({
          ...rest,
          // Clear employee if not including assignments
          employeeId: includeAssignments ? rest.employeeId : null,
          status: "created" as const,
        }),
      );

      const template: ShiftTemplate = {
        id: generateId("tmpl"),
        name,
        department,
        shifts: templateShifts,
        includeAssignments,
        createdBy: "System",
        createdAt: timestamp,
      };

      return { ...state, templates: [...state.templates, template] };
    }

    case "LOAD_TEMPLATE": {
      const { templateId, targetDateId } = action.payload;
      const template = state.templates.find((t) => t.id === templateId);
      if (!template) return state;

      const newShifts: Shift[] = template.shifts.map((s) => ({
        ...s,
        id: generateId("shift"),
        dateId: targetDateId,
        isPublished: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      const historyEntries = newShifts.map((s) => createHistoryEntry(s.id, "created"));

      return {
        ...state,
        shifts: [...state.shifts, ...newShifts],
        shiftHistory: [...state.shiftHistory, ...historyEntries],
      };
    }

    case "ADD_TEMPLATE":
      return { ...state, templates: [...state.templates, action.payload] };

    case "UPDATE_TEMPLATE": {
      const { id, changes } = action.payload;
      return {
        ...state,
        templates: state.templates.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      };
    }

    case "DELETE_TEMPLATE":
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.payload.id),
      };

    // ── Open shifts ───────────────────────────────────────

    case "ADD_OPEN_SHIFT": {
      const openShift: OpenShift = {
        ...action.payload,
        id: generateId("open"),
      };
      return { ...state, openShifts: [...state.openShifts, openShift] };
    }

    case "DELETE_OPEN_SHIFT":
      return {
        ...state,
        openShifts: state.openShifts.filter((o) => o.id !== action.payload.id),
      };

    case "ASSIGN_OPEN_SHIFT": {
      const { openShiftId, employeeId, dateId } = action.payload;
      const openShift = state.openShifts.find((o) => o.id === openShiftId);
      if (!openShift) return state;

      const shiftId = generateId("shift");
      const newShift: Shift = {
        id: shiftId,
        employeeId,
        dateId,
        role: openShift.role ?? openShift.title,
        time: openShift.time,
        startTime: openShift.startTime,
        endTime: openShift.endTime,
        workHours: calculateWorkHours(openShift.startTime, openShift.endTime, 0),
        status: "assigned",
        dayCategory: openShift.dayCategory ?? "morning",
        indicator: "orange",
        isPublished: false,
        breaks: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const history = createHistoryEntry(shiftId, "created");

      return {
        ...state,
        shifts: [...state.shifts, newShift],
        openShifts: state.openShifts.filter((o) => o.id !== openShiftId),
        shiftHistory: [...state.shiftHistory, history],
      };
    }

    // ── Day content ───────────────────────────────────────

    case "ADD_MESSAGE": {
      const message: DayMessage = {
        ...action.payload,
        id: generateId("msg"),
        createdAt: timestamp,
      };
      return { ...state, dayMessages: [...state.dayMessages, message] };
    }

    case "DELETE_MESSAGE":
      return {
        ...state,
        dayMessages: state.dayMessages.filter((m) => m.id !== action.payload.id),
      };

    case "ADD_TASK": {
      const task: DayTask = {
        ...action.payload,
        id: generateId("task"),
      };
      return { ...state, dayTasks: [...state.dayTasks, task] };
    }

    case "UPDATE_TASK_STATUS": {
      const { id, status } = action.payload;
      return {
        ...state,
        dayTasks: state.dayTasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                completedAt: status === "completed" ? timestamp : undefined,
              }
            : t,
        ),
      };
    }

    case "DELETE_TASK":
      return {
        ...state,
        dayTasks: state.dayTasks.filter((t) => t.id !== action.payload.id),
      };

    case "ADD_BOOKING": {
      const booking: DayBooking = {
        ...action.payload,
        id: generateId("book"),
      };
      return { ...state, dayBookings: [...state.dayBookings, booking] };
    }

    // ── UI state ──────────────────────────────────────────

    case "SET_SELECTED_SHIFT":
      return { ...state, selectedShiftId: action.payload };

    case "SET_SELECTED_DAY":
      return { ...state, selectedDayId: action.payload };

    case "SET_CREATE_SHIFT_CONTEXT":
      return { ...state, createShiftContext: action.payload };

    case "SET_ABSENCE_POPOVER":
      return { ...state, absencePopover: action.payload };

    case "SET_CLIPBOARD":
      return { ...state, clipboard: action.payload };

    default:
      return state;
  }
}

// ── Work hours calculation ──────────────────────────────────

/**
 * Calculates work hours from start and end time strings.
 * Handles overnight shifts (end < start).
 *
 * @param startTime - "HH:MM" format
 * @param endTime - "HH:MM" format
 * @param breakMinutes - break duration in minutes
 * @returns work hours as decimal number
 */
function calculateWorkHours(startTime: string, endTime: string, breakMinutes: number): number {
  const startParts = startTime.split(":").map(Number);
  const endParts = endTime.split(":").map(Number);

  let startMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
  let endMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);

  // Handle overnight shifts
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

// ── Computed values ─────────────────────────────────────────

/** Hourly rate placeholder for cost estimation (NOK) */
const HOURLY_RATE = 250;
/** Standard contracted hours per week */
const CONTRACTED_HOURS = 37.5;
/** AML (Norwegian labor law) max hours per week */
const AML_MAX_HOURS = 40;

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

/**
 * Builds all computed getter functions from state.
 * Memoized per call — consumers should use useSchedule().
 */
function buildComputed(state: ScheduleState) {
  const getShiftsForDay = (dateId: string): Shift[] =>
    state.shifts.filter((s) => s.dateId === dateId);

  const getShiftsForEmployee = (employeeId: string): Shift[] =>
    state.shifts.filter((s) => s.employeeId === employeeId);

  const getShiftsForCell = (employeeId: string, dateId: string): Shift[] =>
    state.shifts.filter((s) => s.employeeId === employeeId && s.dateId === dateId);

  const getAbsencesForCell = (employeeId: string, dateId: string): Absence[] =>
    state.absences.filter((a) => a.employeeId === employeeId && a.dateId === dateId);

  const getDayStats = (dateId: string): DayStats => {
    const dayShifts = getShiftsForDay(dateId);
    const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
    const dayAbsences = state.absences.filter((a) => a.dateId === dateId);

    return {
      staffCount: uniqueEmployees.size,
      shiftCount: dayShifts.length,
      estimatedCost: dayShifts.reduce((sum, s) => sum + s.workHours * HOURLY_RATE, 0),
      publishedCount: dayShifts.filter((s) => s.isPublished).length,
      draftCount: dayShifts.filter((s) => s.status === "created" || s.status === "assigned").length,
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
    state.templates.filter((t) => t.department === dept);

  const getMessagesForDay = (dateId: string): DayMessage[] =>
    state.dayMessages.filter((m) => m.dateId === dateId);

  const getTasksForDay = (dateId: string): DayTask[] =>
    state.dayTasks.filter((t) => t.dateId === dateId);

  const getBookingsForDay = (dateId: string): DayBooking[] =>
    state.dayBookings.filter((b) => b.dateId === dateId);

  const getHistoryForShift = (shiftId: string): ShiftHistoryEntry[] =>
    state.shiftHistory
      .filter((h) => h.shiftId === shiftId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  /** Default team targets — placeholder until database has real targets */
  const TEAM_TARGETS: Record<string, number> = {
    Kjøkken: 3,
    "Sal & Service": 2,
    Bar: 2,
    Drift: 1,
  };

  const getCoverageForDay = (dateId: string): DayCoverage => {
    const dayShifts = getShiftsForDay(dateId);
    const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));

    // Build team coverage from shifts (needs employee→team mapping)
    // For now, count shifts per indicator as proxy for team
    const byTeam: Record<string, { target: number; current: number }> = {};
    let hasGaps = false;

    for (const [team, target] of Object.entries(TEAM_TARGETS)) {
      // Count unique employees on this day who belong to this team
      // We can't know team from shift alone in local state, so use target as baseline
      const current = Math.min(target, dayShifts.length > 0 ? Math.ceil(dayShifts.length / 3) : 0);
      byTeam[team] = { target, current };
      if (current < target) hasGaps = true;
    }

    return { totalStaff: uniqueEmployees.size, byTeam, hasGaps };
  };

  const getStatusSummary = (): StatusSummary => {
    const draftCount = state.shifts.filter(
      (s) => s.status === "created" || s.status === "assigned",
    ).length;
    const publishedCount = state.shifts.filter((s) => s.status === "published").length;
    const activeCount = state.shifts.filter((s) => s.status === "active").length;
    const completedCount = state.shifts.filter((s) => s.status === "completed").length;

    // Count unique days and check coverage per day
    const uniqueDays = new Set(state.shifts.map((s) => s.dateId));
    let coverageRisks = 0;
    for (const dateId of uniqueDays) {
      const coverage = getCoverageForDay(dateId);
      if (coverage.hasGaps) coverageRisks++;
    }

    // Count employees with overtime
    const employeeHours = new Map<string, number>();
    for (const shift of state.shifts) {
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
      openShiftQueue: state.openShifts.length,
      draftCount,
      publishedCount,
      activeCount,
      completedCount,
      absenceCount: state.absences.length,
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
    getHistoryForShift,
    getCoverageForDay,
    getStatusSummary,
  };
}

export type ScheduleComputed = ReturnType<typeof buildComputed>;

// ── Context ─────────────────────────────────────────────────

type ScheduleContextValue = {
  state: ScheduleState;
  dispatch: React.Dispatch<ScheduleAction>;
  computed: ScheduleComputed;
};

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

// ── Initial state builder ───────────────────────────────────

/**
 * Parses time range string "HH:MM-HH:MM" into start/end components.
 */
function parseTimeRange(time: string): { startTime: string; endTime: string } {
  const parts = time.split("-").map((s) => s.trim());
  return { startTime: parts[0] ?? "00:00", endTime: parts[1] ?? "00:00" };
}

/**
 * Determines day category from start time.
 * Simplified heuristic — real implementation should use time + day of week.
 */
function inferDayCategory(
  startTime: string,
): "morning" | "midday" | "afternoon" | "evening" | "night" {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Maps old-style status strings to new ShiftStatus.
 * The existing dummy data uses: draft, published, active, completed
 */
function mapLegacyStatus(
  status?: string,
): "created" | "assigned" | "published" | "active" | "completed" {
  switch (status) {
    case "draft":
      return "created";
    case "published":
      return "published";
    case "active":
      return "active";
    case "completed":
      return "completed";
    default:
      return "created";
  }
}

/**
 * Maps legacy AbsenceType strings (Norwegian) to the enum values.
 */
function mapLegacyAbsenceType(absenceType?: string): AbsenceType {
  switch (absenceType) {
    case "Sykdom":
      return "sick_leave";
    case "Ferie":
      return "vacation";
    case "Foreldreperm":
      return "parental_leave";
    case "Ulønnet":
      return "unpaid_leave";
    case "Militær":
      return "military";
    case "Opplæring":
      return "training";
    case "Velferd":
      return "welfare";
    default:
      return "sick_leave";
  }
}

type LegacyShift = {
  id: string;
  employeeId: string;
  dateId: string;
  role?: string;
  time?: string;
  status?: string;
  indicator?: string;
  zone?: string;
  type?: string;
  absenceType?: string;
  reason?: string;
};

/**
 * Builds initial state from legacy dummy data arrays.
 * Separates absences from shifts (MODULE_03 §7).
 */
export function buildInitialState(legacyShifts: LegacyShift[]): ScheduleState {
  const shifts: Shift[] = [];
  const absences: Absence[] = [];
  const ts = now();

  for (const legacy of legacyShifts) {
    if (legacy.type === "absence") {
      // Convert to proper Absence entity
      absences.push({
        id: generateId("abs"),
        employeeId: legacy.employeeId,
        dateId: legacy.dateId,
        type: mapLegacyAbsenceType(legacy.absenceType),
        reason: legacy.reason,
        startDate: ts,
        endDate: ts,
        isFullDay: true,
        status: "approved",
      });
    } else {
      // Convert to proper Shift entity
      const { startTime, endTime } = legacy.time
        ? parseTimeRange(legacy.time)
        : { startTime: "00:00", endTime: "00:00" };
      const mappedStatus = mapLegacyStatus(legacy.status);

      shifts.push({
        id: legacy.id,
        employeeId: legacy.employeeId,
        dateId: legacy.dateId,
        role: legacy.role ?? "",
        time: legacy.time ?? "",
        startTime,
        endTime,
        workHours: calculateWorkHours(startTime, endTime, 0),
        status: mappedStatus,
        dayCategory: inferDayCategory(startTime),
        zone: legacy.zone,
        indicator: legacy.indicator ?? "blue",
        isPublished:
          mappedStatus === "published" || mappedStatus === "active" || mappedStatus === "completed",
        breaks: 0,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }

  // Seed templates from existing hardcoded data
  const seedTemplates: ShiftTemplate[] = [
    {
      id: "tmpl_1",
      name: "Åpningsvakt",
      department: "Kjøkken",
      shifts: [
        {
          employeeId: null,
          role: "Kokk",
          time: "06:00 - 14:00",
          startTime: "06:00",
          endTime: "14:00",
          workHours: 8,
          status: "created",
          dayCategory: "morning",
          indicator: "orange",
          breaks: 30,
        },
      ],
      includeAssignments: false,
      createdBy: "System",
      createdAt: ts,
    },
    {
      id: "tmpl_2",
      name: "Stengevakt",
      department: "Sal & Service",
      shifts: [
        {
          employeeId: null,
          role: "Servitør",
          time: "16:00 - 00:00",
          startTime: "16:00",
          endTime: "00:00",
          workHours: 8,
          status: "created",
          dayCategory: "evening",
          indicator: "purple",
          breaks: 30,
        },
      ],
      includeAssignments: false,
      createdBy: "System",
      createdAt: ts,
    },
    {
      id: "tmpl_3",
      name: "Kjøkkensjef",
      department: "Kjøkken",
      shifts: [
        {
          employeeId: null,
          role: "Sous Chef",
          time: "08:00 - 16:00",
          startTime: "08:00",
          endTime: "16:00",
          workHours: 8,
          status: "created",
          dayCategory: "morning",
          indicator: "blue",
          breaks: 30,
        },
      ],
      includeAssignments: false,
      createdBy: "System",
      createdAt: ts,
    },
  ];

  // Seed open shifts from legacy data
  const seedOpenShifts: OpenShift[] = [
    {
      id: "open-1",
      title: "Ekstra Servitør",
      time: "17:00-23:00",
      startTime: "17:00",
      endTime: "23:00",
      department: "Sal & Service",
      role: "Servitør",
      dayCategory: "evening",
    },
    {
      id: "open-2",
      title: "Vaskevakt",
      time: "22:00-02:00",
      startTime: "22:00",
      endTime: "02:00",
      department: "Drift",
      role: "Oppvask",
      dayCategory: "night",
    },
  ];

  // Seed day messages
  const seedMessages: DayMessage[] = [
    {
      id: "msg_1",
      dateId: "d1",
      title: "Viktig beskjed",
      content: "Leveranse av fersk fisk kl 10. Husk å sjekke kvalitet.",
      audience: "all",
      visibility: "all_day",
      author: "Ingrid Haugen",
      isAlert: false,
      createdAt: ts,
    },
    {
      id: "msg_2",
      dateId: "d2",
      title: "OBS: Allergener",
      content: "Bord 12 har nøtteallergi. Dobbeltsjekk alle retter.",
      audience: "Kjøkken",
      visibility: "all_day",
      author: "Lars Erik Johansen",
      isAlert: true,
      createdAt: ts,
    },
  ];

  // Seed day tasks
  const seedTasks: DayTask[] = [
    {
      id: "task_1",
      dateId: "d1",
      label: "Sjekk frysetemperatur",
      status: "completed",
      category: "routine",
      completedAt: ts,
      highlight: false,
    },
    {
      id: "task_2",
      dateId: "d1",
      label: "Bestill vin til helgen",
      status: "pending",
      category: "delegated",
      assignedTo: "Ingrid Haugen",
      highlight: true,
    },
    {
      id: "task_3",
      dateId: "d2",
      label: "Varetelling kjøl",
      status: "in_progress",
      category: "routine",
      highlight: false,
    },
  ];

  // Seed bookings
  const seedBookings: DayBooking[] = [
    {
      id: "book_1",
      dateId: "d6",
      title: "Johansen Julebord",
      guestCount: 45,
      menu: "3-retters julemeny",
      time: "18:00",
      location: "Festsalen",
      status: "confirmed",
      isVip: true,
      contactPerson: "Per Johansen",
      notes: "Allergier: 2x glutenfri, 1x laktosefri",
    },
    {
      id: "book_2",
      dateId: "d6",
      title: "Firmafest TechCorp",
      guestCount: 20,
      menu: "Buffet deluxe",
      time: "19:30",
      location: "Lounge",
      status: "pending",
      isVip: false,
      contactPerson: "Lise Berg",
    },
  ];

  return {
    shifts,
    absences,
    openShifts: seedOpenShifts,
    templates: seedTemplates,
    dayMessages: seedMessages,
    dayTasks: seedTasks,
    dayBookings: seedBookings,
    shiftHistory: [],
    selectedShiftId: null,
    selectedDayId: null,
    clipboard: null,
    selectedDays: new Set(),
    createShiftContext: null,
    absencePopover: null,
  };
}

// ── Provider ────────────────────────────────────────────────

type ScheduleProviderProps = {
  children: ReactNode;
  legacyShifts: LegacyShift[];
};

/**
 * Wraps the schedule page with state context.
 * Pass legacyShifts from schedule-data.ts to seed initial state.
 */
export function ScheduleProvider({ children, legacyShifts }: ScheduleProviderProps) {
  const [initialState] = React.useState(() => buildInitialState(legacyShifts));
  const [state, dispatch] = useReducer(scheduleReducer, initialState);

  const computed = useMemo(() => buildComputed(state), [state]);

  const value = useMemo<ScheduleContextValue>(
    () => ({ state, dispatch, computed }),
    [state, dispatch, computed],
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────

/**
 * Access schedule state, dispatch, and computed getters.
 * Must be used within a ScheduleProvider.
 */
export function useSchedule(): ScheduleContextValue {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}

/**
 * Helper hook: creates a stable dispatch wrapper for common toast patterns.
 * Returns the dispatch result info to enable toast feedback.
 */
export function useScheduleDispatch() {
  const { dispatch } = useSchedule();

  const dispatchWithInfo = useCallback(
    (action: ScheduleAction): { actionType: string } => {
      dispatch(action);
      return { actionType: action.type };
    },
    [dispatch],
  );

  return dispatchWithInfo;
}
