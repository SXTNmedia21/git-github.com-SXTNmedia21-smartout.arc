// ============================================
// schedule-ui-context.tsx
// Lightweight React Context for ephemeral UI state only.
// No database persistence — selection, clipboard, modals.
// Connected to: schedule-types.ts (type definitions)
// ============================================
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DayClipboard, Shift } from "./schedule-types";

// ── State shape ──────────────────────────────────────────────

type ScheduleUIState = {
  selectedShiftId: string | null;
  selectedDayId: string | null;
  clipboard: DayClipboard | null;
  selectedDays: Set<string>;
  createShiftContext: { dateId?: string; employeeId?: string } | null;
  absencePopover: { employeeId: string; dateId: string } | null;
};

// ── Actions ──────────────────────────────────────────────────

type ScheduleUIActions = {
  setSelectedShift: (id: string | null) => void;
  setSelectedDay: (id: string | null) => void;
  setClipboard: (clipboard: DayClipboard | null) => void;
  toggleDaySelection: (dateId: string) => void;
  clearSelectedDays: () => void;
  setCreateShiftContext: (ctx: { dateId?: string; employeeId?: string } | null) => void;
  setAbsencePopover: (ctx: { employeeId: string; dateId: string } | null) => void;
  copyDay: (dateId: string, dateLabel: string, shifts: Shift[]) => void;
};

// ── Context value ────────────────────────────────────────────

type ScheduleUIContextValue = ScheduleUIState & ScheduleUIActions;

const ScheduleUIContext = createContext<ScheduleUIContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function ScheduleUIProvider({ children }: { children: ReactNode }) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [clipboard, setClipboardState] = useState<DayClipboard | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [createShiftContext, setCreateShiftContextState] = useState<{
    dateId?: string;
    employeeId?: string;
  } | null>(null);
  const [absencePopover, setAbsencePopoverState] = useState<{
    employeeId: string;
    dateId: string;
  } | null>(null);

  const setSelectedShift = useCallback((id: string | null) => {
    setSelectedShiftId(id);
  }, []);

  const setSelectedDay = useCallback((id: string | null) => {
    setSelectedDayId(id);
  }, []);

  const setClipboard = useCallback((cb: DayClipboard | null) => {
    setClipboardState(cb);
  }, []);

  const toggleDaySelection = useCallback((dateId: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateId)) {
        next.delete(dateId);
      } else {
        next.add(dateId);
      }
      return next;
    });
  }, []);

  const clearSelectedDays = useCallback(() => {
    setSelectedDays(new Set());
  }, []);

  const setCreateShiftContext = useCallback(
    (ctx: { dateId?: string; employeeId?: string } | null) => {
      setCreateShiftContextState(ctx);
    },
    [],
  );

  const setAbsencePopover = useCallback((ctx: { employeeId: string; dateId: string } | null) => {
    setAbsencePopoverState(ctx);
  }, []);

  const copyDay = useCallback((dateId: string, dateLabel: string, shifts: Shift[]) => {
    const strippedShifts = shifts.map(
      ({ id: _id, dateId: _dateId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }) => rest,
    );

    setClipboardState({
      sourceDate: dateId,
      sourceDateLabel: dateLabel,
      shifts: strippedShifts,
      absences: [],
    });
  }, []);

  const value = useMemo<ScheduleUIContextValue>(
    () => ({
      selectedShiftId,
      selectedDayId,
      clipboard,
      selectedDays,
      createShiftContext,
      absencePopover,
      setSelectedShift,
      setSelectedDay,
      setClipboard,
      toggleDaySelection,
      clearSelectedDays,
      setCreateShiftContext,
      setAbsencePopover,
      copyDay,
    }),
    [
      selectedShiftId,
      selectedDayId,
      clipboard,
      selectedDays,
      createShiftContext,
      absencePopover,
      setSelectedShift,
      setSelectedDay,
      setClipboard,
      toggleDaySelection,
      clearSelectedDays,
      setCreateShiftContext,
      setAbsencePopover,
      copyDay,
    ],
  );

  return <ScheduleUIContext.Provider value={value}>{children}</ScheduleUIContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────

export function useScheduleUI(): ScheduleUIContextValue {
  const context = useContext(ScheduleUIContext);
  if (!context) {
    throw new Error("useScheduleUI must be used within a ScheduleUIProvider");
  }
  return context;
}
