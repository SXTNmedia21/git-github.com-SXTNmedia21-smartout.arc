"use client";

// Full CRUD hook for payroll.break_rule.
// Fetches the complete row shape needed by the admin DataTable + Sheet editor.
// Supports two trigger types: 'after_duration' (X minutes after shift start) and
// 'time_of_day' (a fixed clock time). Conditional Zod refinements enforce that
// the correct trigger field is present for each type.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const TRIGGER_TYPES = ["after_duration", "time_of_day"] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const breakRuleSchema = z
  .object({
    name: z.string().min(1, "Navn er påkrevd"),
    trigger_type: z.enum(TRIGGER_TYPES),
    // trigger_minutes is required when trigger_type = 'after_duration'
    trigger_minutes: z.coerce.number().int().min(1).nullable().optional(),
    // trigger_time is required when trigger_type = 'time_of_day' (HH:MM string)
    trigger_time: z.string().nullable().optional(),
    duration_minutes: z.coerce.number().int().min(1, "Varighet er påkrevd"),
    min_shift_duration_minutes: z.coerce.number().int().min(0),
    is_paid: z.boolean(),
    // Arrays: empty = applies to all
    department_ids: z.array(z.string().uuid()),
    employee_group_ids: z.array(z.string().uuid()),
    // 0 = Sunday … 6 = Saturday; empty = all days
    weekdays: z.array(z.number().int().min(0).max(6)),
    is_active: z.boolean(),
    valid_from: z.string().nullable().optional(),
    valid_until: z.string().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.trigger_type === "after_duration" && !val.trigger_minutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Antall minutter er påkrevd",
        path: ["trigger_minutes"],
      });
    }
    if (val.trigger_type === "time_of_day" && !val.trigger_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tidspunkt er påkrevd",
        path: ["trigger_time"],
      });
    }
  });

export type BreakRuleInput = z.infer<typeof breakRuleSchema>;

// ─── Full row type (matches payroll.break_rule) ───────────────────────────────

export type BreakRuleRow = BreakRuleInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Lookup types for foreign-key pickers ─────────────────────────────────────

export type DepartmentOption = { department_id: string; name: string };
export type EmployeeGroupOption = { id: string; name: string };

// ─── Query Keys ──────────────────────────────────────────────────────────────

function breakRulesKey(workspaceId: string) {
  return ["settings", "break-rules", workspaceId] as const;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches all break rules (active and inactive) for the current workspace,
 * ordered by name. Used by the admin DataTable — not a dropdown feed.
 */
export function useBreakRules() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: breakRulesKey(wsId ?? "none"),
    queryFn: async (): Promise<BreakRuleRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("break_rule")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as BreakRuleRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches active departments for the workspace — used by the break rule form picker. */
export function useDepartmentOptions() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["settings", "departments-for-pickers", wsId ?? "none"],
    queryFn: async (): Promise<DepartmentOption[]> => {
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as DepartmentOption[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

/** Fetches active employee groups for the workspace — used by the break rule form picker. */
export function useEmployeeGroupOptions() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["settings", "employee-groups-for-pickers", wsId ?? "none"],
    queryFn: async (): Promise<EmployeeGroupOption[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("employee_group")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as EmployeeGroupOption[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

/** Inserts a new break rule for the current workspace. */
export function useCreateBreakRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: BreakRuleInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("break_rule")
        .insert({
          workspace_id: wsId!,
          ...values,
          // Keep only the relevant trigger field; null the other to satisfy DB constraints
          trigger_minutes:
            values.trigger_type === "after_duration" ? (values.trigger_minutes ?? null) : null,
          trigger_time:
            values.trigger_type === "time_of_day" ? (values.trigger_time ?? null) : null,
          valid_from: values.valid_from || null,
          valid_until: values.valid_until || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "break_rule created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            name: variables.name,
            trigger_type: variables.trigger_type,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: breakRulesKey(wsId!) });
      toast.success("Pauseregel opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing break rule by ID. */
export function useUpdateBreakRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BreakRuleInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("break_rule")
        .update({
          ...values,
          trigger_minutes:
            values.trigger_type === "after_duration" ? (values.trigger_minutes ?? null) : null,
          trigger_time:
            values.trigger_type === "time_of_day" ? (values.trigger_time ?? null) : null,
          valid_from: values.valid_from || null,
          valid_until: values.valid_until || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id, values }) => {
      void emit({
        event: "break_rule updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            break_rule_id: id,
            name: values.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: breakRulesKey(wsId!) });
      toast.success("Pauseregel oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a break rule by ID. */
export function useDeleteBreakRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("break_rule")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (_data, { id, name }) => {
      void emit({
        event: "break_rule deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            break_rule_id: id,
            name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: breakRulesKey(wsId!) });
      toast.success("Pauseregel slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}
