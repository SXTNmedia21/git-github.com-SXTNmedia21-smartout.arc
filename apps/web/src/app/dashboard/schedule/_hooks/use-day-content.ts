"use client";

/**
 * TanStack Query hooks for day content: messages, tasks, bookings.
 * Three query+mutation sets in one file since they share the same lifecycle.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 * Connected to: schedule-types.ts (DayMessage, DayTask, DayBooking types)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import type { DayBooking, DayMessage, DayTask } from "../_components/schedule-types";
import { scheduleKeys } from "./schedule-keys";
import {
  fromDbDayBooking,
  fromDbDayMessage,
  fromDbDayTask,
  type DayTaskUpdatePatch,
  toDbDayBookingInsert,
  toDbDayMessageInsert,
  toDbDayTaskInsert,
  toDbDayTaskUpdate,
} from "./schedule-mappers";

// ══════════════════════════════════════════════════════════════
//  DAY MESSAGES
// ══════════════════════════════════════════════════════════════

// ── Query: Fetch messages for a week ─────────────────────────

export function useDayMessages(
  weekStart: string,
  weekEnd: string,
  options?: { enabled?: boolean },
) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.dayMessages(workspace.workspace_id, weekStart),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile daily content
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_day_message")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(fromDbDayMessage);
    },
  });
}

// ── Mutation: Create message ─────────────────────────────────

export function useCreateDayMessage(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayMessages(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (message: Omit<DayMessage, "createdAt">) => {
      const supabase = createClient();
      const dbRow = toDbDayMessageInsert(message, workspace.workspace_id);

      const { data, error } = await supabase
        .from("schedule_day_message")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return fromDbDayMessage(data);
    },

    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayMessage[]>(queryKey);

      queryClient.setQueryData<DayMessage[]>(queryKey, (old) => {
        const optimistic: DayMessage = {
          ...newMessage,
          createdAt: new Date().toISOString(),
        };
        return [optimistic, ...(old ?? [])];
      });

      return { previous };
    },

    onError: (_err, _newMessage, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette melding");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ── Mutation: Delete message ─────────────────────────────────

export function useDeleteDayMessage(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayMessages(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (messageId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_day_message")
        .delete()
        .eq("schedule_day_message_id", messageId);

      if (error) throw error;
    },

    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayMessage[]>(queryKey);

      queryClient.setQueryData<DayMessage[]>(queryKey, (old) =>
        (old ?? []).filter((msg) => msg.id !== messageId),
      );

      return { previous };
    },

    onError: (_err, _messageId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette melding");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  DAY TASKS
// ══════════════════════════════════════════════════════════════

// ── Query: Fetch tasks for a week ────────────────────────────

export function useDayTasks(weekStart: string, weekEnd: string, options?: { enabled?: boolean }) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.dayTasks(workspace.workspace_id, weekStart),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile daily content
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_day_task")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return data.map(fromDbDayTask);
    },
  });
}

// ── Mutation: Create task ────────────────────────────────────

export function useCreateDayTask(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayTasks(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (task: DayTask) => {
      const supabase = createClient();
      const dbRow = toDbDayTaskInsert(task, workspace.workspace_id);

      const { data, error } = await supabase
        .from("schedule_day_task")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return fromDbDayTask(data);
    },

    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayTask[]>(queryKey);

      queryClient.setQueryData<DayTask[]>(queryKey, (old) => [...(old ?? []), newTask]);

      return { previous };
    },

    onError: (_err, _newTask, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette oppgave");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ── Mutation: Update task status ─────────────────────────────

type UpdateDayTaskStatusInput = {
  id: string;
  patch: DayTaskUpdatePatch;
};

export function useUpdateDayTaskStatus(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayTasks(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateDayTaskStatusInput) => {
      const supabase = createClient();
      const dbPatch = toDbDayTaskUpdate(patch);

      const { data, error } = await supabase
        .from("schedule_day_task")
        .update(dbPatch)
        .eq("schedule_day_task_id", id)
        .select()
        .single();

      if (error) throw error;

      return fromDbDayTask(data);
    },

    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayTask[]>(queryKey);

      queryClient.setQueryData<DayTask[]>(queryKey, (old) =>
        (old ?? []).map((task) => {
          if (task.id !== id) return task;
          return {
            ...task,
            ...patch,
            assignedTo:
              patch.assignedTo === null ? undefined : (patch.assignedTo ?? task.assignedTo),
            completedAt:
              patch.completedAt === null ? undefined : (patch.completedAt ?? task.completedAt),
          };
        }),
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke oppdatere oppgave");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ── Mutation: Delete task ────────────────────────────────────

export function useDeleteDayTask(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayTasks(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (taskId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_day_task")
        .delete()
        .eq("schedule_day_task_id", taskId);

      if (error) throw error;
    },

    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayTask[]>(queryKey);

      queryClient.setQueryData<DayTask[]>(queryKey, (old) =>
        (old ?? []).filter((task) => task.id !== taskId),
      );

      return { previous };
    },

    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette oppgave");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  DAY BOOKINGS
// ══════════════════════════════════════════════════════════════

// ── Query: Fetch bookings for a week ─────────────────────────

export function useDayBookings(
  weekStart: string,
  weekEnd: string,
  options?: { enabled?: boolean },
) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.dayBookings(workspace.workspace_id, weekStart),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile daily content
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_day_booking")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("booking_time", { ascending: true });

      if (error) throw error;

      return data.map(fromDbDayBooking);
    },
  });
}

// ── Mutation: Create booking ─────────────────────────────────

export function useCreateDayBooking(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const queryKey = scheduleKeys.dayBookings(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (booking: DayBooking) => {
      const supabase = createClient();
      const dbRow = toDbDayBookingInsert(booking, workspace.workspace_id);

      const { data, error } = await supabase
        .from("schedule_day_booking")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return fromDbDayBooking(data);
    },

    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<DayBooking[]>(queryKey);

      queryClient.setQueryData<DayBooking[]>(queryKey, (old) => [...(old ?? []), newBooking]);

      return { previous };
    },

    onError: (_err, _newBooking, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette reservasjon");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
