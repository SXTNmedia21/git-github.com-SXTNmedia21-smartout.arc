"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ActionCounts } from "./dashboard-types";

/**
 * Fetches counts for actionable items across the workspace.
 * 5 parallel count queries using head:true for efficiency.
 * Connected to: ActionStrip component
 */
export function useActionItems() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.actionItems(workspaceId ?? "none"),
    enabled: !!workspaceId,
    queryFn: async (): Promise<ActionCounts> => {
      const wsId = workspaceId!;
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [shiftGaps, pendingContracts, stuckOnboarding, pendingProtocols, staleInvitations] =
        await Promise.all([
          // 1. Shift gaps: unassigned shifts in next 2 days
          supabase
            .from("schedule_shift")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId)
            .is("employee_id", null)
            .gte("shift_date", today)
            .lte("shift_date", twoDaysFromNow!),

          // 2. Pending contracts
          supabase
            .from("employment_contract")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId)
            .eq("status", "sent"),

          // 3. Stuck onboarding (no completion in 48h)
          supabase
            .from("onboarding_session")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId)
            .is("completed_at", null)
            .lt("updated_at", fortyEightHoursAgo),

          // 4. Pending protocol assignments (join through profile for workspace)
          supabase
            .from("protocol_assignment")
            .select("*, profile!inner(workspace_id)", { count: "exact", head: true })
            .eq("profile.workspace_id", wsId)
            .eq("status", "pending"),

          // 5. Stale invitations (pending > 7 days)
          supabase
            .from("invitation")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", wsId)
            .eq("status", "pending")
            .lt("created_at", sevenDaysAgo),
        ]);

      const counts: ActionCounts = {
        shiftGaps: shiftGaps.count ?? 0,
        pendingContracts: pendingContracts.count ?? 0,
        stuckOnboarding: stuckOnboarding.count ?? 0,
        pendingProtocols: pendingProtocols.count ?? 0,
        staleInvitations: staleInvitations.count ?? 0,
        total: 0,
      };
      counts.total =
        counts.shiftGaps +
        counts.pendingContracts +
        counts.stuckOnboarding +
        counts.pendingProtocols +
        counts.staleInvitations;

      return counts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile action counts
    refetchInterval: 60_000,
  });
}
