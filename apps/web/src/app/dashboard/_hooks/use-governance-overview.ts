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

      // Fetch all assignments for these protocols with progress columns
      const { data: assignments, error: assignmentError } = await supabase
        .from("protocol_assignment")
        .select(
          "protocol_id, status, procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed",
        )
        .in("protocol_id", protocolIds);

      if (assignmentError) throw assignmentError;

      // Aggregate counts per protocol (all 6 statuses)
      const countMap = new Map<
        string,
        {
          completed: number;
          pending: number;
          expired: number;
          not_started: number;
          in_progress: number;
          waived: number;
          total: number;
        }
      >();

      for (const a of assignments ?? []) {
        const existing = countMap.get(a.protocol_id) ?? {
          completed: 0,
          pending: 0,
          expired: 0,
          not_started: 0,
          in_progress: 0,
          waived: 0,
          total: 0,
        };
        existing.total++;
        const status = a.status as string;
        if (status === "completed") existing.completed++;
        else if (status === "pending") existing.pending++;
        else if (status === "expired") existing.expired++;
        else if (status === "not_started") existing.not_started++;
        else if (status === "in_progress") existing.in_progress++;
        else if (status === "waived") existing.waived++;
        countMap.set(a.protocol_id, existing);
      }

      // Build progress-weighted completion map
      const progressMap = new Map<string, { totalSteps: number; completedSteps: number }>();
      for (const a of assignments ?? []) {
        const existing = progressMap.get(a.protocol_id) ?? { totalSteps: 0, completedSteps: 0 };
        const total =
          (a.procedures_total ?? 0) + (a.tests_total ?? 0) + (a.confirmations_total ?? 0);
        const done =
          (a.procedures_completed ?? 0) + (a.tests_passed ?? 0) + (a.confirmations_signed ?? 0);
        existing.totalSteps += total;
        existing.completedSteps += done;
        progressMap.set(a.protocol_id, existing);
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
            not_started: 0,
            in_progress: 0,
            waived: 0,
            total: 0,
          };
          const progress = progressMap.get(p.protocol_id);
          const completionPercent =
            progress && progress.totalSteps > 0
              ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
              : counts.total > 0
                ? Math.round((counts.completed / counts.total) * 100)
                : 0;

          return {
            protocolId: p.protocol_id,
            protocolName: p.name,
            protocolDescription: p.description,
            policyType: p.policy?.policy_type ?? "custom",
            totalAssigned: counts.total,
            completedCount: counts.completed,
            pendingCount: counts.pending,
            expiredCount: counts.expired,
            notStartedCount: counts.not_started,
            inProgressCount: counts.in_progress,
            waivedCount: counts.waived,
            completionPercent,
          };
        },
      );

      // Sort by worst completion first
      items.sort((a, b) => a.completionPercent - b.completionPercent);

      return items;
    },
  });
}
