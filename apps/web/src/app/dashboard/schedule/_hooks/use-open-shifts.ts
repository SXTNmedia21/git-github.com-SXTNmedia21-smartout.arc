"use client";

/**
 * TanStack Query hooks for schedule_open_shift CRUD with optimistic updates.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 * Connected to: schedule-types.ts (OpenShift, Shift types)
 *
 * useAssignOpenShift deletes the open shift AND creates a real shift — touches both tables.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import type { OpenShift, Shift } from "../_components/schedule-types";
import { scheduleKeys } from "./schedule-keys";
import {
  fromDbOpenShift,
  fromDbShift,
  toDbOpenShiftInsert,
  toDbShiftInsert,
} from "./schedule-mappers";

// ══════════════════════════════════════════════════════════════
// Query: Fetch open shifts for workspace
// ══════════════════════════════════════════════════════════════

export function useOpenShifts() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.openShifts(workspace.workspace_id),
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_open_shift")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(fromDbOpenShift);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Create open shift
// ══════════════════════════════════════════════════════════════

export function useCreateOpenShift() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.openShifts(workspace.workspace_id);

  return useMutation({
    mutationFn: async (openShift: Omit<OpenShift, "time">) => {
      const supabase = createClient();
      const dbRow = toDbOpenShiftInsert(openShift, workspace.workspace_id);

      const { data, error } = await supabase
        .from("schedule_open_shift")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return fromDbOpenShift(data);
    },

    onMutate: async (newOpenShift) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<OpenShift[]>(queryKey);

      queryClient.setQueryData<OpenShift[]>(queryKey, (old) => {
        const optimistic: OpenShift = {
          ...newOpenShift,
          time: `${newOpenShift.startTime} - ${newOpenShift.endTime}`,
        };
        return [optimistic, ...(old ?? [])];
      });

      return { previous };
    },

    onError: (_err, _newOpenShift, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette åpen vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Delete open shift
// ══════════════════════════════════════════════════════════════

export function useDeleteOpenShift() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.openShifts(workspace.workspace_id);

  return useMutation({
    mutationFn: async (openShiftId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_open_shift")
        .delete()
        .eq("schedule_open_shift_id", openShiftId);

      if (error) throw error;
    },

    onMutate: async (openShiftId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<OpenShift[]>(queryKey);

      queryClient.setQueryData<OpenShift[]>(queryKey, (old) =>
        (old ?? []).filter((os) => os.id !== openShiftId),
      );

      return { previous };
    },

    onError: (_err, _openShiftId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette åpen vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Assign open shift → delete open shift + create real shift
// ══════════════════════════════════════════════════════════════

type AssignOpenShiftInput = {
  openShiftId: string;
  /** The real shift to create from the open shift */
  shift: Omit<Shift, "time" | "createdAt" | "updatedAt">;
};

export function useAssignOpenShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const openShiftsKey = scheduleKeys.openShifts(workspace.workspace_id);
  const shiftsKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async ({ openShiftId, shift }: AssignOpenShiftInput) => {
      const supabase = createClient();

      // 1. Delete the open shift
      const { error: deleteError } = await supabase
        .from("schedule_open_shift")
        .delete()
        .eq("schedule_open_shift_id", openShiftId);

      if (deleteError) throw deleteError;

      // 2. Create the real shift
      const dbRow = toDbShiftInsert(shift, workspace.workspace_id);

      const { data, error: insertError } = await supabase
        .from("schedule_shift")
        .insert(dbRow)
        .select()
        .single();

      if (insertError) throw insertError;

      return fromDbShift(data);
    },

    onMutate: async ({ openShiftId, shift }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: openShiftsKey }),
        queryClient.cancelQueries({ queryKey: shiftsKey }),
      ]);

      const previousOpenShifts = queryClient.getQueryData<OpenShift[]>(openShiftsKey);
      const previousShifts = queryClient.getQueryData<Shift[]>(shiftsKey);

      // Remove from open shifts
      queryClient.setQueryData<OpenShift[]>(openShiftsKey, (old) =>
        (old ?? []).filter((os) => os.id !== openShiftId),
      );

      // Add to real shifts
      queryClient.setQueryData<Shift[]>(shiftsKey, (old) => {
        const optimistic: Shift = {
          ...shift,
          time: `${shift.startTime} - ${shift.endTime}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [...(old ?? []), optimistic];
      });

      return { previousOpenShifts, previousShifts };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousOpenShifts) {
        queryClient.setQueryData(openShiftsKey, context.previousOpenShifts);
      }
      if (context?.previousShifts) {
        queryClient.setQueryData(shiftsKey, context.previousShifts);
      }
      toast.error("Kunne ikke tildele åpen vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: openShiftsKey });
      queryClient.invalidateQueries({ queryKey: shiftsKey });
    },
  });
}
