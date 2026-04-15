"use client";

/**
 * Mutation hooks for Mal-modus (template-based scheduling).
 * Covers: fill week from template, publish/reset a week, assign/unassign employees.
 * Each hook emits telemetry on success and invalidates the shifts query.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { gridKeys } from "./grid-query-keys";
import { addDays } from "./grid-types";

// ══════════════════════════════════════════════════════════════
// Mutation: Fill week from template ("Fyll fra mal")
// ══════════════════════════════════════════════════════════════

type FillFromTemplateParams = {
  workspaceId: string;
  weekStart: string;
  templateId: string;
  departmentId: string;
  actorId: string;
};

/**
 * Fills the selected week with shifts based on the active template.
 * Only inserts missing slots — existing shifts for the same template_shift + date are preserved.
 */
export function useFillFromTemplate() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      weekStart,
      templateId,
      departmentId,
    }: FillFromTemplateParams) => {
      const weekEnd = addDays(weekStart, 6);

      // Step 1: Load template shift definitions (columns) for this template.
      // We fetch all fields needed for the schedule_shift insert — the Insert type
      // requires role, start_time, end_time, and day_category (non-optional DB columns).
      const { data: templateShifts, error: tsErr } = await supabase
        .from("schedule_template_shift")
        .select("schedule_template_shift_id, slot_count, role, start_time, end_time, day_category")
        .eq("template_id", templateId);

      if (tsErr) throw tsErr;
      if (!templateShifts || templateShifts.length === 0) return { insertedCount: 0 };

      const templateShiftIds = templateShifts.map((ts) => ts.schedule_template_shift_id);

      // Step 2: Fetch all existing shifts for this week that trace back to this template
      const { data: existingShifts, error: esErr } = await supabase
        .from("schedule_shift")
        .select("shift_date, template_shift_id")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .in("template_shift_id", templateShiftIds);

      if (esErr) throw esErr;

      // Count how many shifts already exist per (date, template_shift_id) pair
      const existingCounts = new Map<string, number>();
      for (const shift of existingShifts ?? []) {
        if (!shift.template_shift_id) continue;
        const key = `${shift.shift_date}::${shift.template_shift_id}`;
        existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
      }

      // Step 3: Calculate which slots are missing and build insert rows.
      // The DB requires role, start_time, end_time, day_category — copied from template shift.
      type ShiftInsert = {
        workspace_id: string;
        department_id: string;
        shift_date: string;
        template_shift_id: string;
        role: string;
        start_time: string;
        end_time: string;
        day_category: (typeof templateShifts)[number]["day_category"];
        status: "created";
      };

      const inserts: ShiftInsert[] = [];

      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        for (const ts of templateShifts) {
          const key = `${date}::${ts.schedule_template_shift_id}`;
          const already = existingCounts.get(key) ?? 0;
          const needed = (ts.slot_count ?? 1) - already;
          for (let slot = 0; slot < needed; slot++) {
            inserts.push({
              workspace_id: workspaceId,
              department_id: departmentId,
              shift_date: date,
              template_shift_id: ts.schedule_template_shift_id,
              role: ts.role,
              start_time: ts.start_time,
              end_time: ts.end_time,
              day_category: ts.day_category,
              status: "created",
            });
          }
        }
      }

      if (inserts.length === 0) return { insertedCount: 0 };

      const { error: insertErr } = await supabase.from("schedule_shift").insert(inserts);
      if (insertErr) throw insertErr;

      return { insertedCount: inserts.length };
    },

    onSuccess: ({ insertedCount }, { workspaceId, weekStart, templateId, actorId }) => {
      void emit({
        event: "template applied",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "template", entity_id: templateId },
          data: { shift_count: insertedCount, week_start: weekStart },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: gridKeys.shifts(workspaceId, weekStart, templateId),
      });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Publish week ("Publiser uke")
// ══════════════════════════════════════════════════════════════

type PublishWeekParams = {
  workspaceId: string;
  weekStart: string;
  templateId: string;
  departmentId: string;
  actorId: string;
};

/**
 * Publishes all draft (created/assigned) shifts for the selected week.
 * Published shifts are visible to employees in the mobile app.
 */
export function usePublishWeek() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ workspaceId, weekStart, departmentId }: PublishWeekParams) => {
      const weekEnd = addDays(weekStart, 6);

      const { data, error } = await supabase
        .from("schedule_shift")
        .update({ status: "published" })
        .eq("workspace_id", workspaceId)
        .eq("department_id", departmentId)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .in("status", ["created", "assigned"])
        .select("schedule_shift_id");

      if (error) throw error;

      const shiftIds = (data ?? []).map(
        (row: { schedule_shift_id: string }) => row.schedule_shift_id,
      );
      return { shiftCount: shiftIds.length, shiftIds };
    },

    onSuccess: (
      { shiftCount, shiftIds },
      { workspaceId, weekStart, templateId, actorId, departmentId },
    ) => {
      // Canonical event name is singular `shift published` per ADR-0095
      // (plural alias unwound in migration 20260507100200). The singular
      // schema expects dates/department_ids/shift_ids/shift_count, so we
      // adapt the batch result to that shape.
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) dates.push(addDays(weekStart, i));

      void emit({
        event: "shift published",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "template", entity_id: templateId },
          data: {
            dates,
            department_ids: [departmentId],
            shift_ids: shiftIds,
            shift_count: shiftCount,
          },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: gridKeys.shifts(workspaceId, weekStart, templateId),
      });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Reset week ("Tilbakestill uke")
// ══════════════════════════════════════════════════════════════

type ResetWeekParams = {
  workspaceId: string;
  weekStart: string;
  templateId: string;
  departmentId: string;
  actorId: string;
};

/**
 * Resets all shifts for the selected week to "unpublished".
 * Used to retract a published week so edits can be made before re-publishing.
 */
export function useResetWeek() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ workspaceId, weekStart, departmentId }: ResetWeekParams) => {
      const weekEnd = addDays(weekStart, 6);

      const { data, error } = await supabase
        .from("schedule_shift")
        .update({ status: "unpublished" })
        .eq("workspace_id", workspaceId)
        .eq("department_id", departmentId)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .select("schedule_shift_id");

      if (error) throw error;

      return { shiftCount: data?.length ?? 0 };
    },

    onSuccess: ({ shiftCount }, { workspaceId, weekStart, templateId, actorId }) => {
      void emit({
        event: "week reset",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "template", entity_id: templateId },
          data: { shift_count: shiftCount, week_start: weekStart },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: gridKeys.shifts(workspaceId, weekStart, templateId),
      });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Assign / unassign employee to a shift slot
// ══════════════════════════════════════════════════════════════

type AssignEmployeeParams = {
  shiftId: string;
  /** null to unassign */
  employeeId: string | null;
  workspaceId: string;
  weekStart: string;
  templateId: string;
  actorId: string;
};

/**
 * Assigns or unassigns an employee to/from a specific shift slot.
 * Assigning sets status → "assigned". Unassigning reverts to "created" with no employee.
 */
export function useAssignEmployee() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ shiftId, employeeId }: AssignEmployeeParams) => {
      const isAssigning = employeeId !== null;

      const patch = isAssigning
        ? { employee_id: employeeId, status: "assigned" as const }
        : { employee_id: null as string | null, status: "created" as const };

      const { error } = await supabase
        .from("schedule_shift")
        .update(patch)
        .eq("schedule_shift_id", shiftId);

      if (error) throw error;
    },

    onSuccess: (_data, { shiftId, employeeId, workspaceId, weekStart, templateId, actorId }) => {
      const isAssigning = employeeId !== null;

      void emit({
        event: isAssigning ? "shift assigned" : "shift unassigned",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "shift", entity_id: shiftId },
          data: { employee_id: employeeId ?? "" },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: gridKeys.shifts(workspaceId, weekStart, templateId),
      });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Create shift on-the-fly (build-first flow)
// ══════════════════════════════════════════════════════════════

type CreateGridShiftParams = {
  workspaceId: string;
  departmentId: string;
  shiftDate: string;
  shiftTypeId: string;
  employeeId: string;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  breakMinutes: number;
  weekStart: string;
  actorId: string;
};

/**
 * Creates a new schedule_shift directly in the grid — the "build first" flow.
 * Inserts a shift with the employee already assigned (status = "assigned").
 */
export function useCreateGridShift() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: CreateGridShiftParams) => {
      const dayOfWeek = new Date(params.shiftDate + "T00:00:00").getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const startHour = Number.parseInt(params.startTime.split(":")[0] ?? "8", 10);

      // Derive day_category from start time and weekend status
      let dayCategory: "morning" | "midday" | "afternoon" | "evening" | "night" | "weekend";
      if (isWeekend) {
        dayCategory = "weekend";
      } else if (startHour < 6) {
        dayCategory = "night";
      } else if (startHour < 11) {
        dayCategory = "morning";
      } else if (startHour < 14) {
        dayCategory = "midday";
      } else if (startHour < 17) {
        dayCategory = "afternoon";
      } else {
        dayCategory = "evening";
      }

      const { data, error } = await supabase
        .from("schedule_shift")
        .insert({
          workspace_id: params.workspaceId,
          department_id: params.departmentId,
          shift_date: params.shiftDate,
          shift_type_id: params.shiftTypeId,
          employee_id: params.employeeId,
          role: params.role,
          start_time: params.startTime,
          end_time: params.endTime,
          work_hours: params.workHours,
          breaks: params.breakMinutes,
          day_category: dayCategory,
          status: "assigned",
        })
        .select("schedule_shift_id")
        .single();

      if (error) throw error;
      return { shiftId: data.schedule_shift_id };
    },

    onSuccess: ({ shiftId }, params) => {
      void emit({
        event: "shift assigned",
        workspace_id: params.workspaceId,
        actor_id: params.actorId,
        properties: {
          entity: { entity_type: "shift", entity_id: shiftId },
          data: { employee_id: params.employeeId },
        },
      });

      // Invalidate all week-shift queries for this workspace + week — the departmentIds
      // segment varies ("Alle avdelinger" = joined IDs, single dept = single ID), so we
      // use a prefix match on the first 3 segments of the key.
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as string[];
          return (
            key[0] === "schedule" &&
            key[1] === "grid-week-shifts" &&
            key[2] === params.workspaceId &&
            key[3] === params.weekStart
          );
        },
      });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Remove a shift from the grid
// ══════════════════════════════════════════════════════════════

type RemoveGridShiftParams = {
  shiftId: string;
  workspaceId: string;
  weekStart: string;
  departmentId: string;
  actorId: string;
};

// ══════════════════════════════════════════════════════════════
// Mutation: Reassign a shift's type (drag from "Ikke tildelt" to a column)
// ══════════════════════════════════════════════════════════════

type ReassignShiftTypeParams = {
  shiftId: string;
  shiftTypeId: string;
  departmentId: string;
  role: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workspaceId: string;
  weekStart: string;
  actorId: string;
};

/**
 * Updates a shift's shift_type_id, role, and default times when dragged
 * from the "Ikke tildelt" column to a specific shift type column.
 */
export function useReassignShiftType() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (params: ReassignShiftTypeParams) => {
      const { error } = await supabase
        .from("schedule_shift")
        .update({
          shift_type_id: params.shiftTypeId,
          department_id: params.departmentId,
          role: params.role,
          start_time: params.startTime,
          end_time: params.endTime,
          break_minutes: params.breakMinutes,
        })
        .eq("schedule_shift_id", params.shiftId);

      if (error) throw error;
    },

    onSuccess: (_data, params) => {
      void emit({
        event: "shift updated",
        workspace_id: params.workspaceId,
        actor_id: params.actorId,
        properties: {
          entity: { entity_type: "shift", entity_id: params.shiftId },
          changes: {
            shift_type_id: { before: "unassigned", after: params.shiftTypeId },
            role: { before: "unknown", after: params.role },
          },
        },
      });

      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as string[];
          return (
            key[0] === "schedule" && key[1] === "grid-week-shifts" && key[2] === params.workspaceId
          );
        },
      });
    },
  });
}

/**
 * Deletes a schedule_shift row. Used when the user removes an employee from a slot.
 */
export function useRemoveGridShift() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ shiftId }: RemoveGridShiftParams) => {
      const { error } = await supabase
        .from("schedule_shift")
        .delete()
        .eq("schedule_shift_id", shiftId);

      if (error) throw error;
    },

    onSuccess: (_data, params) => {
      void emit({
        event: "shift unassigned",
        workspace_id: params.workspaceId,
        actor_id: params.actorId,
        properties: {
          entity: { entity_type: "shift", entity_id: params.shiftId },
          data: { employee_id: "" },
        },
      });

      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey as string[];
          return (
            key[0] === "schedule" &&
            key[1] === "grid-week-shifts" &&
            key[2] === params.workspaceId &&
            key[3] === params.weekStart
          );
        },
      });
    },
  });
}
