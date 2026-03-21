"use client";

// Full CRUD hook set for payroll.supplement_rule.
// Supplement rules are the most complex payroll entity — a single wide table
// serves 6 distinct supplement types, each with type-specific columns.
// The hook filters by type and provides lookup hooks for multi-select fields
// (employee groups and shift types).
//
// DB schema: payroll.supplement_rule (wide table, one for all 6 types)
// supplement_type enum: 'normal' | 'week_based' | 'day_based' | 'manual' | 'holiday' | 'contract_rule'

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Enums & Constants ──────────────────────────────────────────────────────

export const SUPPLEMENT_TYPES = [
  "normal",
  "week_based",
  "day_based",
  "manual",
  "holiday",
  "contract_rule",
] as const;

export type SupplementType = (typeof SUPPLEMENT_TYPES)[number];

export const RATE_TYPES = ["fixed_per_hour", "percentage", "fixed_per_shift"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const START_TYPES = ["time_of_day", "after_shift_start"] as const;
export type StartType = (typeof START_TYPES)[number];

// Norwegian labels for supplement types — used in tabs and selectors
export const SUPPLEMENT_TYPE_LABELS: Record<SupplementType, string> = {
  normal: "Normalt tillegg",
  week_based: "Ukesbasert",
  day_based: "Dagbasert",
  manual: "Manuelt",
  holiday: "Helligdagstillegg",
  contract_rule: "Kontraktsregel",
};

export const RATE_TYPE_LABELS: Record<RateType, string> = {
  fixed_per_hour: "Fast per time",
  percentage: "Prosent",
  fixed_per_shift: "Fast per vakt",
};

// ─── Zod Schema ─────────────────────────────────────────────────────────────
// Validates the form input shape. Type-specific fields are nullable —
// the component shows/hides them based on the selected supplement_type.

export const supplementRuleSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  supplement_type: z.enum(SUPPLEMENT_TYPES),
  salary_code: z.string().nullable(),
  rate_type: z.enum(RATE_TYPES),
  rate_value: z.coerce.number().min(0, "Sats må være 0 eller høyere"),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),

  // Scope filters — empty array = applies to all
  employee_group_ids: z.array(z.string().uuid()),
  employee_types: z.array(z.string()),
  shift_type_ids: z.array(z.string().uuid()),

  // Boolean flags
  affected_by_breaks: z.boolean(),
  affects_salaried: z.boolean(),
  enforced_payment: z.boolean(),
  consider_midnight: z.boolean(),

  // Validity period
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),

  // Type 1 (Normal) fields
  start_type: z.enum(START_TYPES).nullable(),
  time_window_start: z.string().nullable(),
  time_window_end: z.string().nullable(),
  after_minutes: z.coerce.number().int().nullable(),
  weekdays: z.array(z.coerce.number().int()),

  // Shared: Type 1 (Normal) + Type 5 (Holiday)
  holiday_calendar_id: z.string().nullable(),

  // Type 2 (Week-based)
  weekly_threshold_hours: z.coerce.number().nullable(),
  weekly_max_hours: z.coerce.number().nullable(),

  // Type 3 (Day-based)
  daily_threshold_hours: z.coerce.number().nullable(),
  daily_max_hours: z.coerce.number().nullable(),

  // Type 4 (Manual)
  default_rate: z.coerce.number().nullable(),
  allow_rate_override: z.boolean(),

  // Type 6 (Contract)
  contract_rule_id: z.string().nullable(),
  evaluation_field: z.string().nullable(),
  threshold_value: z.coerce.number().nullable(),
});

export type SupplementRuleInput = z.infer<typeof supplementRuleSchema>;

// ─── Row type (matches payroll.supplement_rule) ─────────────────────────────

export type SupplementRuleRow = SupplementRuleInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Default form values ────────────────────────────────────────────────────
// Used by the Sheet when creating a new rule. Type-specific fields start null.

export function getDefaultValues(type: SupplementType): SupplementRuleInput {
  return {
    name: "",
    supplement_type: type,
    salary_code: null,
    rate_type: "fixed_per_hour",
    rate_value: 0,
    is_active: true,
    sort_order: 0,
    employee_group_ids: [],
    employee_types: [],
    shift_type_ids: [],
    affected_by_breaks: true,
    affects_salaried: false,
    enforced_payment: false,
    consider_midnight: false,
    valid_from: null,
    valid_until: null,
    start_type: type === "normal" ? "time_of_day" : null,
    time_window_start: null,
    time_window_end: null,
    after_minutes: null,
    weekdays: [],
    holiday_calendar_id: null,
    weekly_threshold_hours: null,
    weekly_max_hours: null,
    daily_threshold_hours: null,
    daily_max_hours: null,
    default_rate: null,
    allow_rate_override: false,
    contract_rule_id: null,
    evaluation_field: null,
    threshold_value: null,
  };
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

function rulesKey(workspaceId: string) {
  return ["settings", "supplement-rules", workspaceId] as const;
}

function employeeGroupOptionsKey(workspaceId: string) {
  return ["settings", "employee-group-options", workspaceId] as const;
}

function shiftTypeOptionsKey(workspaceId: string) {
  return ["settings", "shift-type-options", workspaceId] as const;
}

function salaryCodeOptionsKey(workspaceId: string) {
  return ["settings", "salary-code-options-supplement", workspaceId] as const;
}

// ─── Lookup types ───────────────────────────────────────────────────────────

export type EmployeeGroupOption = { id: string; name: string };
export type ShiftTypeOption = { id: string; name: string };
export type SalaryCodeOption = { id: string; code: string; name: string };

// ─── Read hooks ─────────────────────────────────────────────────────────────

/**
 * Fetches ALL supplement rules for the workspace, ordered by sort_order then name.
 * Optional type filter is applied client-side so one query serves all tabs.
 */
export function useSupplementRules(type?: SupplementType) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: rulesKey(wsId ?? "none"),
    queryFn: async (): Promise<SupplementRuleRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("supplement_rule")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SupplementRuleRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  // Client-side filter by type — avoids separate queries per tab
  const filtered = type
    ? (query.data ?? []).filter((r) => r.supplement_type === type)
    : (query.data ?? []);

  return { ...query, data: filtered };
}

/**
 * Active employee groups for multi-select checkboxes.
 * Empty selection = rule applies to all groups.
 */
export function useEmployeeGroupOptions() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: employeeGroupOptionsKey(wsId ?? "none"),
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

/**
 * Active shift types for multi-select checkboxes.
 * Empty selection = rule applies to all shift types.
 */
export function useShiftTypeOptions() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: shiftTypeOptionsKey(wsId ?? "none"),
    queryFn: async (): Promise<ShiftTypeOption[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .select("id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as ShiftTypeOption[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Active salary codes for the salary_code select in the Sheet.
 */
export function useSalaryCodeOptions() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: salaryCodeOptionsKey(wsId ?? "none"),
    queryFn: async (): Promise<SalaryCodeOption[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .select("id, code, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SalaryCodeOption[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Mutation hooks ─────────────────────────────────────────────────────────

/** Inserts a new supplement rule for the current workspace. */
export function useCreateSupplementRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SupplementRuleInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase enum types require cast
      const payload: Record<string, unknown> = {
        workspace_id: wsId!,
        ...values,
        salary_code: values.salary_code || null,
        valid_from: values.valid_from || null,
        valid_until: values.valid_until || null,
        holiday_calendar_id: values.holiday_calendar_id || null,
        contract_rule_id: values.contract_rule_id || null,
        evaluation_field: values.evaluation_field || null,
      };

      const { error } = await supabase
        .schema("payroll")
        .from("supplement_rule")
        // Cast needed: Zod infers string literals, Supabase expects DB enum references
        .insert(payload as never);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "supplement_rule created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            name: variables.name,
            supplement_type: variables.supplement_type,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: rulesKey(wsId!) });
      toast.success("Tilleggsregel opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing supplement rule by ID. */
export function useUpdateSupplementRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SupplementRuleInput }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase enum types require cast
      const payload: Record<string, unknown> = {
        ...values,
        salary_code: values.salary_code || null,
        valid_from: values.valid_from || null,
        valid_until: values.valid_until || null,
        holiday_calendar_id: values.holiday_calendar_id || null,
        contract_rule_id: values.contract_rule_id || null,
        evaluation_field: values.evaluation_field || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .schema("payroll")
        .from("supplement_rule")
        // Cast needed: Zod infers string literals, Supabase expects DB enum references
        .update(payload as never)
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id, values }) => {
      void emit({
        event: "supplement_rule updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            supplement_rule_id: id,
            name: values.name,
            supplement_type: values.supplement_type,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: rulesKey(wsId!) });
      toast.success("Tilleggsregel oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a supplement rule by ID. */
export function useDeleteSupplementRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("supplement_rule")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (_data, { id, name }) => {
      void emit({
        event: "supplement_rule deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            supplement_rule_id: id,
            name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: rulesKey(wsId!) });
      toast.success("Tilleggsregel slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}
