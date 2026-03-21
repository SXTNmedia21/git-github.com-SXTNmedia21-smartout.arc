"use client";

/**
 * TanStack Query hooks for schedule_template + schedule_template_shift CRUD.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 * Connected to: schedule-types.ts (ShiftTemplate, Shift types)
 *
 * Templates have a parent-child relationship:
 *   schedule_template → schedule_template_shift (1:N)
 *
 * useLoadTemplate reads template shifts and inserts them as real schedule_shift rows.
 */

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";

import type { Shift, ShiftTemplate } from "../_components/schedule-types";
import { scheduleKeys } from "./schedule-keys";
import {
  fromDbShift,
  fromDbTemplate,
  toDbShiftInsert,
  toDbTemplateInsert,
  toDbTemplateShiftInsert,
} from "./schedule-mappers";

type TemplateRow = Database["public"]["Tables"]["schedule_template"]["Row"];
type TemplateShiftRow = Database["public"]["Tables"]["schedule_template_shift"]["Row"];
type TemplateWithShifts = TemplateRow & { schedule_template_shift: TemplateShiftRow[] };

// ══════════════════════════════════════════════════════════════
// Query: Fetch all templates for workspace
// ══════════════════════════════════════════════════════════════

export function useTemplates(options?: { enabled?: boolean }) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.templates(workspace.workspace_id),
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_template")
        .select("*, schedule_template_shift(*)")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data as TemplateWithShifts[]).map((row) =>
        fromDbTemplate(row, row.schedule_template_shift),
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Save template (create header + shifts in sequence)
// ══════════════════════════════════════════════════════════════

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.templates(workspace.workspace_id);

  return useMutation({
    mutationFn: async (template: Omit<ShiftTemplate, "createdAt">) => {
      const supabase = createClient();

      // 1. Insert template header
      const dbTemplate = toDbTemplateInsert(template, workspace.workspace_id);
      const { error: templateError } = await supabase.from("schedule_template").insert(dbTemplate);

      if (templateError) throw templateError;

      // 2. Insert template shifts
      if (template.shifts.length > 0) {
        const dbShifts = template.shifts.map((shift) =>
          toDbTemplateShiftInsert(shift, template.id),
        );

        const { error: shiftsError } = await supabase
          .from("schedule_template_shift")
          .insert(dbShifts);

        if (shiftsError) throw shiftsError;
      }
    },

    onMutate: async (newTemplate) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShiftTemplate[]>(queryKey);

      queryClient.setQueryData<ShiftTemplate[]>(queryKey, (old) => {
        const optimistic: ShiftTemplate = {
          ...newTemplate,
          createdAt: new Date().toISOString(),
        };
        return [optimistic, ...(old ?? [])];
      });

      return { previous };
    },

    onSuccess: (_data, input) => {
      void emit({
        event: "template created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "template",
            entity_id: input.id,
          },
          data: {
            name: input.name ?? "",
            shift_count: input.shifts?.length ?? 0,
          },
        },
      });
    },

    onError: (_err, _newTemplate, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke lagre mal");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Update template metadata (not shifts)
// ══════════════════════════════════════════════════════════════

type UpdateTemplateInput = {
  id: string;
  patch: Partial<
    Pick<ShiftTemplate, "name" | "department" | "departmentId" | "includeAssignments">
  >;
};

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.templates(workspace.workspace_id);

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateTemplateInput) => {
      const supabase = createClient();

      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.department !== undefined) dbPatch.department = patch.department;
      if (patch.departmentId !== undefined) dbPatch.department_id = patch.departmentId;
      if (patch.includeAssignments !== undefined)
        dbPatch.include_assignments = patch.includeAssignments;

      const { error } = await supabase
        .from("schedule_template")
        .update(dbPatch)
        .eq("schedule_template_id", id);

      if (error) throw error;
    },

    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShiftTemplate[]>(queryKey);

      queryClient.setQueryData<ShiftTemplate[]>(queryKey, (old) =>
        (old ?? []).map((t) => {
          if (t.id !== id) return t;
          return { ...t, ...patch };
        }),
      );

      return { previous };
    },

    onSuccess: (_data, { id, patch }) => {
      void emit({
        event: "template updated",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "template",
            entity_id: id,
          },
          data: {
            name: patch.name ?? "",
          },
        },
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke oppdatere mal");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Delete template (cascade deletes shifts)
// ══════════════════════════════════════════════════════════════

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryKey = scheduleKeys.templates(workspace.workspace_id);

  return useMutation({
    mutationFn: async (templateId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("schedule_template")
        .delete()
        .eq("schedule_template_id", templateId);

      if (error) throw error;
    },

    onMutate: async (templateId) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShiftTemplate[]>(queryKey);

      queryClient.setQueryData<ShiftTemplate[]>(queryKey, (old) =>
        (old ?? []).filter((t) => t.id !== templateId),
      );

      return { previous };
    },

    onSuccess: (_data, templateId) => {
      void emit({
        event: "template deleted",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "template",
            entity_id: templateId,
          },
          data: {},
        },
      });
    },

    onError: (_err, _templateId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Kunne ikke slette mal");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Load template → insert as real shifts
// ══════════════════════════════════════════════════════════════

type LoadTemplateInput = {
  template: ShiftTemplate;
  /** Shifts to insert, already mapped with IDs and dateIds */
  shifts: Omit<Shift, "time" | "createdAt" | "updatedAt">[];
};

export function useLoadTemplate(weekStart: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const shiftsQueryKey = scheduleKeys.shifts(workspace.workspace_id, weekStart);

  return useMutation({
    mutationFn: async ({ shifts }: LoadTemplateInput) => {
      const supabase = createClient();

      const dbRows = shifts.map((shift) => toDbShiftInsert(shift, workspace.workspace_id));

      const { data, error } = await supabase.from("schedule_shift").insert(dbRows).select();

      if (error) throw error;

      return data.map(fromDbShift);
    },

    onMutate: async ({ shifts }) => {
      await queryClient.cancelQueries({ queryKey: shiftsQueryKey });

      const previous = queryClient.getQueryData<Shift[]>(shiftsQueryKey);

      queryClient.setQueryData<Shift[]>(shiftsQueryKey, (old) => {
        const optimisticShifts: Shift[] = shifts.map((s) => ({
          ...s,
          time: `${s.startTime} - ${s.endTime}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        return [...(old ?? []), ...optimisticShifts];
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(shiftsQueryKey, context.previous);
      }
      toast.error("Kunne ikke laste inn mal");
    },

    onSuccess: (data, { template }) => {
      void emit({
        event: "template loaded",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "template",
            entity_id: template.id,
          },
          data: {
            shift_count: data?.length ?? 0,
          },
        },
      });
      toast.success("Mal lastet inn");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shiftsQueryKey });
    },
  });
}
