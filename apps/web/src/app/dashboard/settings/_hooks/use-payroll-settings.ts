"use client";

// Fetches and persists workspace-level payroll configuration.
// All payroll tables live in the `payroll` schema — always use
// supabase.schema("payroll") before querying them.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ────────────────────────────────────────────────────────────────

export const payrollSettingsSchema = z.object({
  // ── Lønnsperiode ───────────────────────────────────────────────────────────
  period_type: z.enum(["monthly", "biweekly", "weekly"]),
  period_start_day: z.coerce.number().min(1).max(28),
  default_worked_hours_salary_code: z.string().nullable(),
  default_monthly_salary_code: z.string().nullable(),
  shift_grouping: z.enum(["department", "wage", "wage_type"]),
  // ── Arbeidsgiveravgifter ───────────────────────────────────────────────────
  employer_social_security_pct: z.coerce.number().min(0).max(100),
  vacation_pay_pct: z.coerce.number().min(0).max(100),
  pension_pct: z.coerce.number().min(0).max(100),
  // ── Tariff + tillegg ──────────────────────────────────────────────────────
  is_tariff_bound: z.boolean(),
  supplement_stacking_policy: z.enum(["sum_all", "highest_wins", "first_match"]),
  // ── TOIL + velferd ────────────────────────────────────────────────────────
  toil_default_max_banked_hours: z.coerce.number().min(0).max(10000),
  wellness_days_per_year_default: z.coerce.number().min(0).max(365),
  // ── Overtid ───────────────────────────────────────────────────────────────
  overtime_requires_pre_approval: z.boolean(),
  overtime_warn_threshold_minutes: z.coerce.number().min(0).max(1440),
  requires_four_eyes_for_period_approval: z.boolean(),
  // ── Punch-rounding ────────────────────────────────────────────────────────
  punch_rounding_direction: z.enum(["none", "nearest", "up", "down"]),
  punch_rounding_minutes: z.coerce.number().min(0).max(60),
  punch_rounding_snap_window_minutes: z.coerce.number().min(0).max(30),
  punch_window_early_minutes: z.coerce.number().min(0).max(120),
  punch_window_late_minutes: z.coerce.number().min(0).max(120),
  punch_grace_after_scheduled_minutes: z.coerce.number().min(0).max(120),
  forced_break_reminder_minutes: z.coerce.number().min(0).max(480),
  // ── Split-vakt ────────────────────────────────────────────────────────────
  split_shift_threshold_minutes: z.coerce.number().min(0).max(480),
  split_shift_allowance_amount: z.coerce.number().min(0).max(10000),
  // ── Ansatt-kontroll ───────────────────────────────────────────────────────
  employee_can_dispute_punch: z.boolean(),
  employee_dispute_window_days: z.coerce.number().min(0).max(90),
  manager_punch_edit_notifies_employee: z.boolean(),
  manager_punch_edit_requires_reason: z.boolean(),
});

export type PayrollSettingsInput = z.infer<typeof payrollSettingsSchema>;

// ─── Types ─────────────────────────────────────────────────────────────────

export type PayrollSettings = PayrollSettingsInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

export type SalaryCode = {
  id: string;
  code: string;
  name: string;
  category: string;
};

// ─── Query Keys ────────────────────────────────────────────────────────────

function payrollSettingsKey(workspaceId: string) {
  return ["settings", "payroll-general", workspaceId] as const;
}

function salaryCodesKey(workspaceId: string) {
  return ["settings", "salary-codes", workspaceId] as const;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Fetches the single payroll config row for the current workspace.
 * Returns null when no row exists yet (first-time setup).
 */
export function usePayrollSettings() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: payrollSettingsKey(wsId ?? "none"),
    queryFn: async (): Promise<PayrollSettings | null> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("workspace_settings")
        .select("*")
        .eq("workspace_id", wsId!)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data as PayrollSettings | null;
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Upserts payroll settings for the current workspace.
 * Uses onConflict on workspace_id so the first save creates the row
 * and subsequent saves update it — no separate create/update paths needed.
 */
export function useUpdatePayrollSettings() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: PayrollSettingsInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("workspace_settings")
        .upsert(
          {
            workspace_id: wsId!,
            ...values,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id" },
        );

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "payroll_settings updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            period_type: variables.period_type,
            shift_grouping: variables.shift_grouping,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: payrollSettingsKey(wsId!),
      });
      toast.success("Lønnsinnstillinger lagret");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke lagre: ${error.message}`);
    },
  });
}

/**
 * Fetches active salary codes for the current workspace.
 * Used to populate the default salary code dropdowns in the settings form.
 */
export function useSalaryCodes() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: salaryCodesKey(wsId ?? "none"),
    queryFn: async (): Promise<SalaryCode[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .select("id, code, name, category")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SalaryCode[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}
