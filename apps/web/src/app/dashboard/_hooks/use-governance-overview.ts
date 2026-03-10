"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ProtocolOverviewItem } from "./dashboard-types";

/**
 * Fetches governance overview: active protocols with assignment completion rates.
 * Joins protocol → policy for policy_type, aggregates assignments per protocol.
 * Connected to: GovernanceOverview component
 */
export function useGovernanceOverview() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.governanceOverview(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<ProtocolOverviewItem[]> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      // Fetch active protocols with policy type
      const { data: protocols, error: protocolError } = await supabase
        .from("protocol")
        .select("protocol_id, name, description, status, policy:policy_id(policy_type)")
        .eq("workspace_id", wsId)
        .eq("status", "active");

      if (protocolError) throw protocolError;
      if (!protocols || protocols.length === 0) return [];

      const protocolIds = protocols.map((p: { protocol_id: string }) => p.protocol_id);

      // Fetch all assignments for these protocols (workspace-scoped via protocol)
      const { data: assignments, error: assignmentError } = await supabase
        .from("protocol_assignment")
        .select("protocol_id, status")
        .in("protocol_id", protocolIds);

      if (assignmentError) throw assignmentError;

      // Aggregate counts per protocol
      const countMap = new Map<
        string,
        { completed: number; pending: number; expired: number; total: number }
      >();

      for (const a of assignments ?? []) {
        const existing = countMap.get(a.protocol_id) ?? {
          completed: 0,
          pending: 0,
          expired: 0,
          total: 0,
        };
        existing.total++;
        if (a.status === "completed") existing.completed++;
        else if (a.status === "pending") existing.pending++;
        else if (a.status === "expired") existing.expired++;
        countMap.set(a.protocol_id, existing);
      }

      // Build overview items
      const items: ProtocolOverviewItem[] = protocols.map(
        (p: {
          protocol_id: string;
          name: string;
          description: string | null;
          status: string;
          policy: { policy_type: string } | null;
        }) => {
          const counts = countMap.get(p.protocol_id) ?? {
            completed: 0,
            pending: 0,
            expired: 0,
            total: 0,
          };
          return {
            protocolId: p.protocol_id,
            protocolName: p.name,
            protocolDescription: p.description,
            policyType: p.policy?.policy_type ?? "custom",
            totalAssigned: counts.total,
            completedCount: counts.completed,
            pendingCount: counts.pending,
            expiredCount: counts.expired,
            completionPercent:
              counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
          };
        },
      );

      // Sort by worst completion first
      items.sort((a, b) => a.completionPercent - b.completionPercent);

      return items;
    },
  });
}
