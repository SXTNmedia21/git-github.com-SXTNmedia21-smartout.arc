"use client";

/**
 * Mutation hooks for Mal-modus (template-based scheduling).
 * Covers: fill week from template, publish/reset a week, assign/unassign employees.
 * Each hook emits telemetry on success and invalidates the shifts query.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { malKeys } from "./mal-query-keys";

// ══════════════════════════════════════════════════════════════
// Shared
// ══════════════════════════════════════════════════════════════

/** Add N days to a YYYY-MM-DD date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
        queryKey: malKeys.shifts(workspaceId, weekStart, templateId),
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

      return { shiftCount: data?.length ?? 0 };
    },

    onSuccess: ({ shiftCount }, { workspaceId, weekStart, templateId, actorId }) => {
      void emit({
        event: "shifts published",
        workspace_id: workspaceId,
        actor_id: actorId,
        properties: {
          entity: { entity_type: "template", entity_id: templateId },
          data: { shift_count: shiftCount, week_start: weekStart },
        },
      });

      void queryClient.invalidateQueries({
        queryKey: malKeys.shifts(workspaceId, weekStart, templateId),
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
        queryKey: malKeys.shifts(workspaceId, weekStart, templateId),
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
        queryKey: malKeys.shifts(workspaceId, weekStart, templateId),
      });
    },
  });
}
