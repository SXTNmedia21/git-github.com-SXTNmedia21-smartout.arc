/**
 * useCreateShift — Enqueues a new schedule_shift to the offline sync queue.
 *
 * Shift creation goes through the sync queue so managers can create shifts
 * even without connectivity — the shift will sync when the connection is restored.
 *
 * Optimistically invalidates the shift list cache so the new shift appears.
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit, nonEmpty } from "@smartout/telemetry";

export type DayCategory = "regular" | "weekend" | "holiday" | "night";

export type CreateShiftPayload = {
  shift_date: string;
  start_time: string;
  end_time: string;
  day_category: DayCategory;
  role: string;
  workspace_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  notes?: string | null;
  breaks?: number | null;
  status?: string;
};

type UseCreateShiftReturn = {
  createShift: (payload: CreateShiftPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useCreateShift(): UseCreateShiftReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const createShift = useCallback(
    async (payload: CreateShiftPayload): Promise<string> => {
      setIsSubmitting(true);

      try {
        // Resolve BEFORE enqueue so broken attribution fails fast (ADR-0134)
        const { profileId } = await getProfileContext();
        const shiftId = randomUUID();

        const rowId = await enqueue("create_shift", {
          schedule_shift_id: shiftId,
          shift_date: payload.shift_date,
          start_time: payload.start_time,
          end_time: payload.end_time,
          day_category: payload.day_category,
          role: payload.role,
          workspace_id: payload.workspace_id,
          employee_id: payload.employee_id ?? null,
          department_id: payload.department_id ?? null,
          notes: payload.notes ?? null,
          breaks: payload.breaks ?? null,
          status: payload.status ?? "draft",
        });

        /* Invalidate shift list so it re-fetches with the new shift */
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        void emit({
          event: "shift created",
          workspace_id: nonEmpty(payload.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: shiftId,
            data: {
              assigned_to: payload.employee_id ?? "",
              date: payload.shift_date,
              start_time: payload.start_time,
              end_time: payload.end_time,
            },
          },
        });

        return rowId;
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { createShift, isSubmitting };
}
