"use client";

/**
 * Hook for PayrollProfileRichCard: fetches payroll profile by its PK (id),
 * joins profile name/role, and looks up current tariff rate if applicable.
 * PK is `id` (uuid) — NOT profile_id. Verified against schema.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export function useDrawerPayrollProfile(payrollProfileId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: [
      "dashboard",
      "entity-drawer",
      "payroll_profile",
      wsId ?? "none",
      payrollProfileId,
    ] as const,
    queryFn: async () => {
      const payrollRes = await supabase
        .from("employee_payroll_profile")
        .select(
          "id, profile_id, salary_type, agreed_weekly_hours, tariff_category, seniority_start_date, has_fagbrev, tariff_override_id, valid_from, valid_until, holiday_allowance_pct, trade_union_member, payroll_sync_status, profile:profile!profile_id(display_name, role, status)",
        )
        .eq("id", payrollProfileId)
        .single();

      if (payrollRes.error) throw payrollRes.error;

      const payroll = payrollRes.data;

      // If there's a tariff override, fetch the rate row.
      // tariff_rate_table columns: amount (number), rate_type (string), unit (string)
      // No hourly_rate/monthly_rate/description — use amount + unit for display.
      let tariffRate: {
        amount: number;
        rate_type: string;
        unit: string;
        seniority_years: number | null;
      } | null = null;
      if (payroll.tariff_override_id) {
        const { data: override } = await supabase
          .from("tariff_rate_table")
          .select("amount, rate_type, unit, seniority_years")
          .eq("id", payroll.tariff_override_id)
          .maybeSingle();
        if (override) {
          tariffRate = override;
        }
      }

      // Calculate seniority in years
      const seniorityYears = payroll.seniority_start_date
        ? Math.floor(
            (Date.now() - new Date(payroll.seniority_start_date).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000),
          )
        : null;

      const profile = payroll.profile as {
        display_name: string;
        role: string;
        status: string;
      } | null;

      return {
        payroll,
        profileName: profile?.display_name ?? null,
        profileRole: profile?.role ?? null,
        profileStatus: profile?.status ?? null,
        tariffRate,
        seniorityYears,
      };
    },
    enabled: !!wsId && !!payrollProfileId,
    staleTime: 30_000,
  });
}

export type DrawerPayrollProfileData = ReturnType<typeof useDrawerPayrollProfile>["data"];
