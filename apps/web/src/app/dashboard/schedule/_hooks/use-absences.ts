"use client";

/**
 * TanStack Query hooks for schedule_absence CRUD with optimistic updates.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 * Connected to: schedule-types.ts (Absence type)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import type { Absence } from "../_components/schedule-types";
import { scheduleKeys } from "./schedule-keys";
import { fromDbAbsence, toDbAbsenceInsert } from "./schedule-mappers";

// ══════════════════════════════════════════════════════════════
// Query: Fetch absences for a week
// ══════════════════════════════════════════════════════════════

export function useAbsences(weekStart: string, weekEnd: string) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.absences(workspace.workspace_id, weekStart),
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile absence data
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_absence")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(fromDbAbsence);
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Create absence
// ══════════════════════════════════════════════════════════════

export function useCreateAbsence(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.absences(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (absence: Omit<Absence, "status"> & { status?: Absence["status"] }) => {
      const supabase = createClient();
      const dbRow = toDbAbsenceInsert(absence, workspace.workspace_id);

      const { data, error } = await supabase
        .from("schedule_absence")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return fromDbAbsence(data);
    },

    onMutate: async (newAbsence) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Absence[]>(queryKey);

      queryClient.setQueryData<Absence[]>(queryKey, (old) => {
        const optimistic: Absence = {
          ...newAbsence,
          status: newAbsence.status ?? "pending",
        };
        return [...(old ?? []), optimistic];
      });

      return { previous };
    },

    onError: (_err, _newAbsence, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette fravær");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Delete absence
// ══════════════════════════════════════════════════════════════

export function useDeleteAbsence(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.absences(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (absenceId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_absence")
        .delete()
        .eq("schedule_absence_id", absenceId);

      if (error) throw error;
    },

    onMutate: async (absenceId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Absence[]>(queryKey);

      queryClient.setQueryData<Absence[]>(queryKey, (old) =>
        (old ?? []).filter((absence) => absence.id !== absenceId),
      );

      return { previous };
    },

    onError: (_err, _absenceId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette fravær");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
