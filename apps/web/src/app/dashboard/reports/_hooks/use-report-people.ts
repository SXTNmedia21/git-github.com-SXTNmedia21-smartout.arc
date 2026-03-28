"use client";

// Fetches people/employee analytics for the People tab of the Reports page.
// Queries profile (role distribution, status breakdown) and
// employment_contract (tenure distribution by start_date).
// No cross-table joins needed — all three datasets are independent.

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { CHART_COLORS } from "../_components/chart-utils";

// ── Return types (must match PeopleSection chart props exactly) ───────────

export type RoleDistributionItem = {
  name: string;
  count: number;
};

export type StatusBreakdownItem = {
  name: string;
  count: number;
  color: string;
};

export type TenureDistributionItem = {
  range: string;
  count: number;
};

export type DeptStat = {
  name: string;
  employees: number;
  coverage: number;
  readiness: number;
  training: number;
  color: string;
};

export type PeopleData = {
  roleDistribution: RoleDistributionItem[];
  statusBreakdown: StatusBreakdownItem[];
  tenureDistribution: TenureDistributionItem[];
};

// Human-readable Norwegian labels for each profile_status value
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Aktiv", color: CHART_COLORS.emerald },
  trainee: { label: "Trainee", color: CHART_COLORS.amber },
  inactive: { label: "Inaktiv", color: CHART_COLORS.rose },
  offboarding: { label: "Offboarding", color: "#71717a" },
};

// Norwegian role labels (profile_role enum values → display names)
const ROLE_LABELS: Record<string, string> = {
  employee: "Ansatt",
  manager: "Leder",
  admin: "Administrator",
  owner: "Eier",
};

function monthDiff(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

function tenureBucket(months: number): string {
  if (months < 3) return "0-3 mnd";
  if (months < 6) return "3-6 mnd";
  if (months < 12) return "6-12 mnd";
  if (months < 24) return "1-2 ar";
  return "2+ ar";
}

const TENURE_ORDER = ["0-3 mnd", "3-6 mnd", "6-12 mnd", "1-2 ar", "2+ ar"] as const;

export function useReportPeople() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["reports", "people", wsId],
    queryFn: async (): Promise<PeopleData> => {
      const supabase = createClient();

      const [profilesResult, contractsResult] = await Promise.all([
        supabase.from("profile").select("profile_id, role, status").eq("workspace_id", wsId!),

        supabase
          .from("employment_contract")
          .select("contract_id, profile_id, start_date, status")
          .eq("workspace_id", wsId!)
          .eq("status", "signed"),
      ]);

      if (profilesResult.error) throw new Error(profilesResult.error.message);

      const profiles = profilesResult.data ?? [];
      // Contracts may be sparse — tolerate errors by returning empty
      const contracts = contractsResult.error ? [] : (contractsResult.data ?? []);

      // ── Role distribution ──────────────────────────────────────────────
      // Count profiles by role and map to Norwegian labels.
      // job_title would be richer but isn't queryable as an aggregate easily;
      // use the role enum for now which is guaranteed to exist.
      const roleCounts = new Map<string, number>();
      for (const p of profiles) {
        const label = ROLE_LABELS[p.role] ?? p.role;
        roleCounts.set(label, (roleCounts.get(label) ?? 0) + 1);
      }

      const roleDistribution: RoleDistributionItem[] = Array.from(roleCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // ── Status breakdown ───────────────────────────────────────────────
      const statusCounts = new Map<string, number>();
      for (const p of profiles) {
        statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
      }

      // Always emit all four statuses in a fixed order even if count is 0
      const statusOrder = ["active", "trainee", "inactive", "offboarding"] as const;
      const statusBreakdown: StatusBreakdownItem[] = statusOrder.map((s) => ({
        name: STATUS_LABELS[s]?.label ?? s,
        count: statusCounts.get(s) ?? 0,
        color: STATUS_LABELS[s]?.color ?? "#71717a",
      }));

      // ── Tenure distribution from employment contracts ─────────────────
      // One active contract per profile; bucket by months since start_date.
      const tenureCounts = new Map<string, number>(TENURE_ORDER.map((b) => [b, 0]));

      for (const contract of contracts) {
        const months = monthDiff(contract.start_date);
        const bucket = tenureBucket(months);
        tenureCounts.set(bucket, (tenureCounts.get(bucket) ?? 0) + 1);
      }

      // If no contracts exist, fall back to profile joined_at — not available in
      // this query, so we just return zero-filled buckets gracefully.
      const tenureDistribution: TenureDistributionItem[] = TENURE_ORDER.map((range) => ({
        range,
        count: tenureCounts.get(range) ?? 0,
      }));

      return { roleDistribution, statusBreakdown, tenureDistribution };
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}
