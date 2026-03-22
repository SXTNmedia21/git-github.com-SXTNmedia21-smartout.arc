"use client";

/**
 * TanStack Query hooks for schedule_shift CRUD with optimistic updates.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 * Connected to: schedule-types.ts (Shift type)
 */

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import type { Shift } from "../_components/schedule-types";
import { scheduleKeys } from "./schedule-keys";
import { fromDbShift, toDbShiftInsert, toDbShiftUpdate } from "./schedule-mappers";

// ══════════════════════════════════════════════════════════════
// Query: Fetch shifts for a week
// ══════════════════════════════════════════════════════════════

export function useShifts(weekStart: string, weekEnd: string) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.shifts(workspace.workspace_id, weekStart),
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile shift data
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_shift")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("start_time", { ascending: true });

      if (error) throw error;

      return data.map(fromDbShift);
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Create shift
// ══════════════════════════════════════════════════════════════

export function useCreateShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (shift: Omit<Shift, "time" | "createdAt" | "updatedAt">) => {
      const supabase = createClient();
      const dbRow = toDbShiftInsert(shift, workspace.workspace_id);

      const { data, error } = await supabase.from("schedule_shift").insert(dbRow).select().single();

      if (error) throw error;

      return fromDbShift(data);
    },

    onMutate: async (newShift) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      queryClient.setQueryData<Shift[]>(queryKey, (old) => {
        const optimistic: Shift = {
          ...newShift,
          time: `${newShift.startTime} - ${newShift.endTime}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [...(old ?? []), optimistic];
      });

      return { previous };
    },

    onSuccess: (data) => {
      void emit({
        event: "shift created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "shift",
            entity_id: data.id,
            entity_label: `${data.dateId} ${data.startTime}-${data.endTime}`,
          },
          data: {
            assigned_to: data.employeeId ?? "",
            date: data.dateId,
            start_time: data.startTime,
            end_time: data.endTime,
          },
        },
      });
    },

    onError: (_err, _newShift, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke opprette vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Update shift
// ══════════════════════════════════════════════════════════════

type UpdateShiftInput = {
  id: string;
  patch: Partial<Omit<Shift, "id" | "time" | "createdAt" | "updatedAt">>;
};

export function useUpdateShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateShiftInput) => {
      const supabase = createClient();
      const dbPatch = toDbShiftUpdate(patch);

      const { data, error } = await supabase
        .from("schedule_shift")
        .update(dbPatch)
        .eq("schedule_shift_id", id)
        .select()
        .single();

      if (error) throw error;

      return fromDbShift(data);
    },

    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).map((shift) => {
          if (shift.id !== id) return shift;
          const updated = { ...shift, ...patch, updatedAt: new Date().toISOString() };
          // Recompute display time if start/end changed
          if (patch.startTime || patch.endTime) {
            updated.time = `${updated.startTime} - ${updated.endTime}`;
          }
          return updated;
        }),
      );

      return { previous };
    },

    onSuccess: (data, { id, patch }) => {
      void emit({
        event: "shift updated",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift", entity_id: id },
          changes: Object.fromEntries(
            Object.entries(patch).map(([k, v]) => [k, { before: undefined, after: v }]),
          ),
        },
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke oppdatere vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Delete shift
// ══════════════════════════════════════════════════════════════

export function useDeleteShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (shiftId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_shift")
        .delete()
        .eq("schedule_shift_id", shiftId);

      if (error) throw error;
    },

    onMutate: async (shiftId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).filter((shift) => shift.id !== shiftId),
      );

      return { previous };
    },

    onSuccess: (_data, shiftId, context) => {
      const deleted = context?.previous?.find((s) => s.id === shiftId);
      void emit({
        event: "shift deleted",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift", entity_id: shiftId },
          data: {
            assigned_to: deleted?.employeeId ?? "",
            date: deleted?.dateId ?? "",
            start_time: deleted?.startTime ?? "",
            end_time: deleted?.endTime ?? "",
          },
        },
      });
    },

    onError: (_err, _shiftId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Move shift (change employee and/or date)
// ══════════════════════════════════════════════════════════════

type MoveShiftInput = {
  id: string;
  employeeId: string | null;
  dateId: string;
};

export function useMoveShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async ({ id, employeeId, dateId }: MoveShiftInput) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_shift")
        .update({ employee_id: employeeId, shift_date: dateId })
        .eq("schedule_shift_id", id)
        .select()
        .single();

      if (error) throw error;

      return fromDbShift(data);
    },

    onMutate: async ({ id, employeeId, dateId }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).map((shift) => {
          if (shift.id !== id) return shift;
          return {
            ...shift,
            employeeId,
            dateId,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      return { previous };
    },

    onSuccess: (data, { id, employeeId, dateId }) => {
      void emit({
        event: "shift updated",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift", entity_id: id },
          changes: {
            employeeId: { before: undefined, after: employeeId },
            dateId: { before: undefined, after: dateId },
          },
        },
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke flytte vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Batch publish shifts
// ══════════════════════════════════════════════════════════════

export function usePublishShifts(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_shift")
        .update({ status: "published", is_published: true })
        .in("schedule_shift_id", shiftIds);

      if (error) throw error;
    },

    onMutate: async (shiftIds) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      const idsSet = new Set(shiftIds);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).map((shift) => {
          if (!idsSet.has(shift.id)) return shift;
          return {
            ...shift,
            status: "published" as const,
            isPublished: true,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      return { previous };
    },

    onSuccess: (_data, shiftIds, context) => {
      const publishedShifts = context?.previous?.filter((s) => shiftIds.includes(s.id)) ?? [];
      const dates = [...new Set(publishedShifts.map((s) => s.dateId))];
      const departmentIds = [
        ...new Set(publishedShifts.map((s) => s.departmentId).filter(Boolean)),
      ] as string[];

      void emit({
        event: "shift published",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "shift",
            entity_id: shiftIds[0] ?? "",
            entity_label: `${shiftIds.length} shifts`,
          },
          data: {
            dates,
            department_ids: departmentIds,
            shift_ids: shiftIds,
            shift_count: shiftIds.length,
          },
        },
      });
    },

    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke publisere vakter");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Paste day (batch insert shifts from clipboard)
// ══════════════════════════════════════════════════════════════

type PasteDayInput = {
  targetDateId: string;
  shifts: Omit<Shift, "id" | "dateId" | "createdAt" | "updatedAt">[];
};

export function usePasteDay(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const workspaceId = workspace.workspace_id;
  const queryKey = scheduleKeys.shifts(workspaceId, weekStart);

  return useMutation({
    mutationFn: async ({ targetDateId, shifts }: PasteDayInput) => {
      const supabase = createClient();

      const inserts = shifts.map((shift) =>
        toDbShiftInsert(
          {
            ...shift,
            id: crypto.randomUUID(),
            dateId: targetDateId,
          },
          workspaceId,
        ),
      );

      const { data, error } = await supabase.from("schedule_shift").insert(inserts).select();

      if (error) throw error;

      return data.map(fromDbShift);
    },

    onMutate: async ({ targetDateId, shifts }: PasteDayInput) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      const optimisticShifts: Shift[] = shifts.map((s, i) => ({
        ...s,
        id: `paste_${Date.now()}_${i}`,
        dateId: targetDateId,
        time: `${s.startTime} - ${s.endTime}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      queryClient.setQueryData<Shift[]>(queryKey, (old) => [...(old ?? []), ...optimisticShifts]);

      return { previous };
    },

    onSuccess: (data, { targetDateId }) => {
      for (const shift of data) {
        void emit({
          event: "shift created",
          workspace_id: workspaceId,
          actor_id: profileId ?? "",
          properties: {
            entity: {
              entity_type: "shift",
              entity_id: shift.id,
              entity_label: `${targetDateId} ${shift.startTime}-${shift.endTime}`,
            },
            data: {
              assigned_to: shift.employeeId ?? "",
              date: targetDateId,
              start_time: shift.startTime,
              end_time: shift.endTime,
            },
          },
        });
      }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke lime inn vakter");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Batch unpublish shifts
// ══════════════════════════════════════════════════════════════

export function useUnpublishShifts(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_shift")
        .update({ status: "unpublished", is_published: false })
        .in("schedule_shift_id", shiftIds);

      if (error) throw error;
    },

    onMutate: async (shiftIds) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      const idsSet = new Set(shiftIds);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).map((shift) => {
          if (!idsSet.has(shift.id)) return shift;
          return {
            ...shift,
            status: "unpublished" as const,
            isPublished: false,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      return { previous };
    },

    onSuccess: (_data, shiftIds) => {
      for (const shiftId of shiftIds) {
        void emit({
          event: "shift updated",
          workspace_id: workspace.workspace_id,
          actor_id: profileId ?? "",
          properties: {
            entity: { entity_type: "shift", entity_id: shiftId },
            changes: {
              status: { before: "published", after: "unpublished" },
              is_published: { before: true, after: false },
            },
          },
        });
      }
    },

    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke avpublisere vakter");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Complete a shift (mark as completed after work is done)
// ══════════════════════════════════════════════════════════════

export function useCompleteShift(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const workspaceId = workspace.workspace_id;
  const queryKey = scheduleKeys.shifts(workspaceId, weekStart);

  return useMutation({
    mutationFn: async (shiftId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_shift")
        .update({ status: "completed" })
        .eq("schedule_shift_id", shiftId);

      if (error) throw error;
    },

    onMutate: async (shiftId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Shift[]>(queryKey);

      queryClient.setQueryData<Shift[]>(queryKey, (old) =>
        (old ?? []).map((shift) =>
          shift.id === shiftId
            ? { ...shift, status: "completed" as const, updatedAt: new Date().toISOString() }
            : shift,
        ),
      );

      return { previous };
    },

    onSuccess: (_data, shiftId, context) => {
      const completedShift = context?.previous?.find((s) => s.id === shiftId);

      void emit({
        event: "shift completed",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift", entity_id: shiftId },
          data: {
            shift_ids: [shiftId],
            department_id: completedShift?.departmentId ?? "",
          },
        },
      });
    },

    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke fullføre vakt");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
