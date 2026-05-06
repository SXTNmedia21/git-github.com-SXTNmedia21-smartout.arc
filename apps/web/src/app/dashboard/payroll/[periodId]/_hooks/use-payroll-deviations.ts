/**
 * Hook: fetch deviation rows for a payroll period.
 *
 * Returns all deviations ordered by severity (error → warning → info) then
 * check_id. Includes profile display_name for each deviation row so the
 * DeviationList can render without a secondary profile fetch.
 *
 * Acknowledged deviations are included — the UI shows them with a visual
 * distinction (strikethrough / dimmed) but keeps them visible for audit.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { payrollKeys } from "../../_hooks/payroll-keys";

export type DeviationRow = Database["payroll"]["Tables"]["deviation"]["Row"] & {
  profileDisplayName: string;
};

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

async function fetchDeviations(periodId: string): Promise<DeviationRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("payroll")
    .from("deviation")
    .select("*")
    .eq("period_id", periodId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data?.length) return [];

  // Fetch profile names for deviations that have a profile_id
  const profileIds = [...new Set(data.filter((d) => d.profile_id).map((d) => d.profile_id!))];

  const nameMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profile")
      .select("profile_id, user_identity(first_name, last_name)")
      .in("profile_id", profileIds);

    for (const p of profiles ?? []) {
      const identity = Array.isArray(p.user_identity) ? p.user_identity[0] : p.user_identity;
      const first = identity?.first_name ?? "";
      const last = identity?.last_name ?? "";
      nameMap.set(p.profile_id, [first, last].filter(Boolean).join(" ") || "Ukjent");
    }
  }

  return data
    .map((d) => ({
      ...d,
      profileDisplayName: d.profile_id ? (nameMap.get(d.profile_id) ?? "Ukjent") : "—",
    }))
    .sort((a, b) => {
      const sevA = SEVERITY_ORDER[a.severity] ?? 9;
      const sevB = SEVERITY_ORDER[b.severity] ?? 9;
      if (sevA !== sevB) return sevA - sevB;
      return a.check_id.localeCompare(b.check_id);
    });
}

const STALE_TIME_MS = 30 * 1000; // deviations change during recalc — shorter stale

export function usePayrollDeviations(periodId: string) {
  return useQuery<DeviationRow[]>({
    queryKey: payrollKeys.deviations(periodId),
    queryFn: () => fetchDeviations(periodId),
    staleTime: STALE_TIME_MS,
    retry: 1,
    enabled: !!periodId,
  });
}
