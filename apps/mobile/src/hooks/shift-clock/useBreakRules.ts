/**
 * useBreakRules — Fetches workspace break rules from the payroll schema.
 *
 * Break rules define minimum durations, whether breaks are paid or unpaid,
 * and which shift lengths trigger mandatory breaks. This data is static
 * (admin-managed config) so it uses an infinite stale time.
 *
 * Consumed by the shift clock UI to:
 *   - Show break duration guidance when the employee starts a break
 *   - Warn if the employee takes a shorter break than required
 *   - Classify the break (paid/unpaid) via classifyBreak() from the shared package
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Shape of a break_rule row from payroll schema */
export type BreakRule = {
  break_rule_id: string;
  workspace_id: string;
  name: string;
  /** Minimum shift duration (hours) before this break rule applies */
  min_shift_hours: number;
  /** Minimum break duration in minutes */
  min_break_minutes: number;
  /** Whether the break counts as paid working time */
  is_paid: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function fetchBreakRules(): Promise<BreakRule[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  // break_rule lives in the payroll schema — not in generated types, cast to any
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any)
    .schema("payroll")
    .from("break_rule")
    .select("*")
    .eq("workspace_id", profile.workspace_id)
    .eq("is_active", true)
    .order("min_shift_hours", { ascending: true });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) throw error;

  return (data ?? []) as BreakRule[];
}

/**
 * Hook: returns active break rules for the workspace.
 *
 * Break rules are admin-managed configuration that rarely changes, so stale
 * time is set to Infinity — data is only re-fetched on explicit invalidation
 * or app restart.
 */
export function useBreakRules() {
  return useQuery<BreakRule[]>({
    queryKey: ["break-rules"],
    queryFn: fetchBreakRules,
    staleTime: Infinity,
    retry: 1,
  });
}
