"use client";

// ============================================
// schedule-voice-tools-bridge.tsx
// Registers schedule voice tools inside the shared voice tools context.
// Exists to keep schedule/page.tsx free from inline registration lifecycle code.
// Connected to: use-schedule-voice-tools.ts and voice-tools-context.tsx.
// ============================================

import { useEffect } from "react";

import { useVoiceTools } from "@/components/voice-tools-context";

import { useScheduleVoiceTools } from "../_hooks/use-schedule-voice-tools";
import type { ScheduleComputed } from "../_hooks/use-schedule-computed";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import type { Absence, Shift } from "./schedule-types";

type UseDeleteShift = ReturnType<typeof import("../_hooks/use-shifts").useDeleteShift>;
type UsePublishShifts = ReturnType<typeof import("../_hooks/use-shifts").usePublishShifts>;
type UseCreateShift = ReturnType<typeof import("../_hooks/use-shifts").useCreateShift>;
type UseUpdateShift = ReturnType<typeof import("../_hooks/use-shifts").useUpdateShift>;

type ScheduleVoiceToolsBridgeProps = {
  weekStart: string;
  weekEnd: string;
  enrichedDays: Array<{ id: string; label: string; isToday?: boolean; isHoliday?: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  focusDayInUI: (dateId: string, openPlanner: boolean) => void;
  setSelectedDate: (date: string | null) => void;
  createShift: UseCreateShift;
  updateShift: UseUpdateShift;
  deleteShift: UseDeleteShift;
  publishShifts: UsePublishShifts;
};

/**
 * Bridges schedule module data/mutations into voice tool registration.
 * Why: avoids duplicated setup in page-level component composition.
 * Returns: null (side-effect registration only).
 */
export function ScheduleVoiceToolsBridge({
  weekStart,
  weekEnd,
  enrichedDays,
  shifts,
  absences,
  employees,
  computed,
  focusDayInUI,
  setSelectedDate,
  createShift,
  updateShift,
  deleteShift,
  publishShifts,
}: ScheduleVoiceToolsBridgeProps) {
  const { setClientTools } = useVoiceTools();

  const voiceTools = useScheduleVoiceTools({
    weekStart,
    weekEnd,
    days: enrichedDays,
    shifts,
    absences,
    employees,
    computed,
    uiActions: {
      focusDay: (dateId: string) => focusDayInUI(dateId, false),
      openDayPlanner: (dateId: string) => focusDayInUI(dateId, true),
      closeDayPlanner: () => setSelectedDate(null),
    },
    mutations: {
      createShift: (input) =>
        createShift.mutateAsync(input as Parameters<typeof createShift.mutateAsync>[0]),
      updateShift: (input) => updateShift.mutateAsync(input),
      deleteShift: (id) => deleteShift.mutateAsync(id),
      publishShifts: (ids) => publishShifts.mutateAsync(ids),
    },
  });

  useEffect(() => {
    setClientTools(voiceTools);
    return () => setClientTools(null);
  }, [voiceTools, setClientTools]);

  return null;
}
