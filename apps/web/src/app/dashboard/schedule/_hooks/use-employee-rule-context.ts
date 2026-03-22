"use client";

/**
 * TanStack Query hook to load employee context needed for cascade rule evaluation.
 * Fetches birth date (via user_identity) and payroll profile data for a given profile.
 * Connected to: profile, user_identity, employee_payroll_profile tables
 * Used by: useShiftRuleCheck() for buildEntityContext()
 */

import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export type EmployeeRuleContext = {
  birthDate: string | null;
  contractType: string | null;
  agreedWeeklyHours: number | null;
  tariffCategory: string | null;
};

export function useEmployeeRuleContext(profileId: string | undefined) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["schedule", "employee-rule-context", workspaceId, profileId],
    queryFn: async (): Promise<EmployeeRuleContext> => {
      const supabase = createClient();

      // Load birth date from user_identity via profile.user_id
      const [profileRes, payrollRes] = await Promise.all([
        supabase
          .from("profile")
          .select("user_id, user_identity:user_identity(date_of_birth)")
          .eq("profile_id", profileId!)
          .single(),
        supabase
          .from("employee_payroll_profile")
          .select("tariff_category, agreed_weekly_hours, employment_contract_id, salary_type")
          .eq("profile_id", profileId!)
          .order("valid_from", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Extract birth date from the joined user_identity
      let birthDate: string | null = null;
      if (profileRes.data?.user_identity) {
        const ui = profileRes.data.user_identity;
        if (ui && typeof ui === "object" && "date_of_birth" in ui) {
          birthDate = (ui as { date_of_birth: string | null }).date_of_birth;
        }
      }

      return {
        birthDate,
        contractType: payrollRes.data?.salary_type ?? null,
        agreedWeeklyHours: payrollRes.data?.agreed_weekly_hours
          ? Number(payrollRes.data.agreed_weekly_hours)
          : null,
        tariffCategory: payrollRes.data?.tariff_category ?? null,
      };
    },
    enabled: !!profileId,
    staleTime: 10 * 60 * 1000, // 10 min — employee context rarely changes
  });
}
