"use client";

// ============================================
// schedule-voice-tools-bridge.tsx
// Registers schedule voice tools inside the shared voice tools context.
// Exists to keep schedule/page.tsx free from inline registration lifecycle code.
// Connected to: use-schedule-voice-tools.ts and voice-tools-context.tsx.
// ============================================

import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";

import { useScheduleVoiceTools } from "../_hooks/use-schedule-voice-tools";
import { AgentConfirmationDialog } from "./agent-confirmation-dialog";
import { useAgentProposals } from "./agent-proposals-context";
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
  workspaceId?: string;
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
  workspaceId,
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
  const { addProposal, pendingConfirmation, resolveConfirmation, requestConfirmation } =
    useAgentProposals();

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
    },
    mutations: {
      createShift: (input) =>
        createShift.mutateAsync(input as Parameters<typeof createShift.mutateAsync>[0]),
      updateShift: (input) => updateShift.mutateAsync(input),
      deleteShift: (id) => deleteShift.mutateAsync(id),
      publishShifts: (ids) => publishShifts.mutateAsync(ids),
    },
    // Ghost mode — all create/update go through proposals
    addProposal,
    requestConfirmation,
  });

  // Register into WalkAi tool registry — Emma gets schedule tools when on this page
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
