// ============================================
// schedule-toasts.tsx
// Toast notification feedback for all schedule mutations.
// Uses sonner (project standard) to show Norwegian feedback
// messages for every state change.
// Connected to: schedule-context.tsx (ScheduleAction types)
// Connected to: page.tsx (wrap dispatch calls)
// ============================================
"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSchedule } from "./schedule-context";
import type { ScheduleAction } from "./schedule-context";
import { dummyEmployees } from "./schedule-data";

/**
 * Maps action types to Norwegian toast messages.
 * Some messages are dynamic and need payload context.
 */
const TOAST_MESSAGES: Partial<Record<ScheduleAction["type"], string>> = {
  ADD_SHIFT: "Vakt opprettet",
  UPDATE_SHIFT: "Vakt oppdatert",
  DELETE_SHIFT: "Vakt slettet",
  PUBLISH_SHIFT: "Vakt publisert",
  UNPUBLISH_DAY: "Dag avpublisert",
  COPY_DAY: "Dag kopiert til utklippstavle",
  ADD_ABSENCE: "Fravær registrert",
  DELETE_ABSENCE: "Fravær slettet",
  ADD_TEMPLATE: "Mal opprettet",
  DELETE_TEMPLATE: "Mal slettet",
  ADD_OPEN_SHIFT: "Åpen vakt opprettet",
  ADD_MESSAGE: "Daginfo publisert",
  DELETE_MESSAGE: "Daginfo slettet",
  ADD_TASK: "Oppgave lagt til",
  DELETE_TASK: "Oppgave slettet",
  ADD_BOOKING: "Booking lagt til",
  CLEAR_SELECTED_DAYS: "Valg fjernet",
};

/**
 * Finds employee name by ID from the static employee list.
 */
function getEmployeeName(employeeId: string): string {
  return dummyEmployees.find((e) => e.id === employeeId)?.name ?? employeeId;
}

/**
 * Hook that wraps dispatch with toast notifications.
 * Returns a function with the same signature as dispatch
 * but shows appropriate toast feedback after each action.
 *
 * Usage:
 * ```tsx
 * const dispatchWithToast = useScheduleToast();
 * dispatchWithToast({ type: "ADD_SHIFT", payload: ... });
 * ```
 */
export function useScheduleToast() {
  const { state, dispatch } = useSchedule();

  const dispatchWithToast = useCallback(
    (action: ScheduleAction) => {
      dispatch(action);

      // Generate dynamic toast messages based on action type and payload
      switch (action.type) {
        case "MOVE_SHIFT": {
          const empName = getEmployeeName(action.payload.toEmployeeId);
          toast.success(`Vakt flyttet til ${empName}`);
          return;
        }

        case "ASSIGN_SHIFT": {
          const empName = getEmployeeName(action.payload.employeeId);
          toast.success(`Vakt tildelt ${empName}`);
          return;
        }

        case "PUBLISH_DAY": {
          const dayShifts = state.shifts.filter(
            (s) =>
              s.dateId === action.payload.dateId &&
              (s.status === "created" || s.status === "assigned"),
          );
          toast.success(`Dag publisert (${dayShifts.length} vakter)`);
          return;
        }

        case "PUBLISH_SELECTED_DAYS": {
          const count = state.selectedDays.size;
          toast.success(`${count} dager publisert`);
          return;
        }

        case "PASTE_DAY": {
          const clipShifts = state.clipboard?.shifts.length ?? 0;
          toast.success(`Dag limt inn (${clipShifts} vakter)`);
          return;
        }

        case "SAVE_DAY_AS_TEMPLATE": {
          toast.success(`Mal lagret: ${action.payload.name}`);
          return;
        }

        case "LOAD_TEMPLATE": {
          const template = state.templates.find((t) => t.id === action.payload.templateId);
          const shiftCount = template?.shifts.length ?? 0;
          toast.success(`Mal lastet inn (${shiftCount} vakter)`);
          return;
        }

        case "ASSIGN_OPEN_SHIFT": {
          const empName = getEmployeeName(action.payload.employeeId);
          toast.success(`Åpen vakt tildelt ${empName}`);
          return;
        }

        case "UPDATE_TASK_STATUS": {
          if (action.payload.status === "completed") {
            toast.success("Oppgave fullført");
          }
          return;
        }

        default: {
          // Use static message from the map
          const message = TOAST_MESSAGES[action.type];
          if (message) {
            toast.success(message);
          }
        }
      }
    },
    [dispatch, state],
  );

  return dispatchWithToast;
}
