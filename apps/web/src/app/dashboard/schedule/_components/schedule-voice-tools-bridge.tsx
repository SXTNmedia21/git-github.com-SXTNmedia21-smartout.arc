"use client";

// ============================================
// schedule-voice-tools-bridge.tsx
// Registers schedule voice tools inside the shared voice tools context.
// Exists to keep schedule/page.tsx free from inline registration lifecycle code.
// Connected to: use-schedule-voice-tools.ts and voice-tools-context.tsx.
// ============================================

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";

import { useScheduleVoiceTools } from "../_hooks/use-schedule-voice-tools";
import { AgentConfirmationDialog } from "./agent-confirmation-dialog";
import { useAgentProposals } from "./agent-proposals-context";
import type { ScheduleComputed } from "../_hooks/use-schedule-computed";
import type { ScheduleEmployee } from "../_hooks/use-employees";
import type { Absence, Shift } from "./schedule-types";

type ScheduleVoiceToolsBridgeProps = {
  weekStart: string;
  weekEnd: string;
  workspaceId?: string;
  enrichedDays: Array<{ id: string; label: string; isToday?: boolean; isHoliday?: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  focusDayInUI: (dateId: string, openPlanner: boolean) => void;
  setSelectedDate: (date: string | null) => void;
  switchScheduleView?: (view: string) => void;
  setTimePeriod?: (weeks: number) => void;
  setFilterSituation?: (filter: string) => void;
  navigateToDate?: (weekOffset: number) => void;
  switchLayout?: (layout: string) => void;
};

/**
 * Bridges schedule module data/mutations into voice tool registration.
 * Why: avoids duplicated setup in page-level component composition.
 * Returns: null (side-effect registration only).
 */
export function ScheduleVoiceToolsBridge({
  weekStart,
  weekEnd,
  workspaceId,
  enrichedDays,
  shifts,
  absences,
  employees,
  computed,
  focusDayInUI,
  setSelectedDate,
  switchScheduleView,
  setTimePeriod,
  setFilterSituation,
  navigateToDate,
  switchLayout,
}: ScheduleVoiceToolsBridgeProps) {
  const { addProposal, pendingConfirmation, resolveConfirmation } = useAgentProposals();

  const voiceTools = useScheduleVoiceTools({
    weekStart,
    weekEnd,
    workspaceId,
    days: enrichedDays,
    shifts,
    absences,
    employees,
    computed,
    uiActions: {
      focusDay: (dateId: string) => focusDayInUI(dateId, false),
      openDayPlanner: (dateId: string) => focusDayInUI(dateId, true),
      closeDayPlanner: () => setSelectedDate(null),
      switchScheduleView,
      setTimePeriod,
      setSelectedDate,
      setFilterSituation,
      navigateToDate,
      switchLayout,
    },
    // All write ops go through proposals — Botsson never mutates shifts directly
    addProposal,
  });

  // Register into Botsson tool registry — Emma gets schedule tools when on this page
  useRegisterTools("schedule", voiceTools);

  return (
    <AgentConfirmationDialog
      open={!!pendingConfirmation}
      title={pendingConfirmation?.title ?? ""}
      description={pendingConfirmation?.description ?? ""}
      onConfirm={() => resolveConfirmation(true)}
      onCancel={() => resolveConfirmation(false)}
    />
  );
}
