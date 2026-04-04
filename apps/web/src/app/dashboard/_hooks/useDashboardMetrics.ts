/**
 * useDashboardMetrics — Fetches live metric counters shown in the dashboard metric strip.
 *
 * Combines three independent queries into a single hook:
 * - Unsigned employment contracts (contracts awaiting signature)
 * - Pending protocol assignments (training not yet complete)
 * - Budget variance from the latest workspace_budget row
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export function useDashboardMetrics() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard-metrics", workspaceId],
    queryFn: async () => {
      const [contractsRes, trainingRes, budgetRes] = await Promise.all([
        // Count unsigned contracts — any status that isn't "signed"
        supabase
          .from("employment_contract")
          .select("contract_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .neq("status", "signed"),

        // Count pending protocol assignments via profile join to scope to workspace.
        // protocol_assignment has no workspace_id, so we count all pending assignments
        // for profiles belonging to this workspace.
        supabase
          .from("protocol_assignment")
          .select("assignment_id, profile:profile_id!inner(workspace_id)", {
            count: "exact",
            head: true,
          })
          .eq("status", "pending")
          .eq("profile.workspace_id", workspaceId),

        // Grab the most recent daily budget row to compute variance
        supabase
          .from("workspace_budget")
          .select("revenue_target, labor_cost_target, period_date")
          .eq("workspace_id", workspaceId)
          .eq("period_type", "daily")
          .order("period_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const unsignedContracts = contractsRes.count ?? 0;
      const expiringTraining = trainingRes.count ?? 0;

      // Budget variance is shown as "—" when no target data exists
      let budgetVariance = "—";
      if (budgetRes.data?.revenue_target) {
        // Without actual revenue data in this table, show the target for context
        // The variance will be properly wired once actual_revenue is tracked
        budgetVariance = `${Math.round(budgetRes.data.revenue_target).toLocaleString("nb-NO")} kr`;
      }

      return { unsignedContracts, expiringTraining, budgetVariance };
    },
    staleTime: 60_000,
  });
}
