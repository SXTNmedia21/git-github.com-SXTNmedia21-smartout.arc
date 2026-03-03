"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { guardianKeys } from "./guardian-keys";
import type { TimeRange } from "./useSessionHistory";

export type ToolUsageStat = {
  toolName: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
};

function getTimeRangeStart(range: TimeRange): string {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    now.setDate(now.getDate() - 7);
  } else {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString();
}

export function useToolUsageStats(timeRange: TimeRange) {
  return useQuery({
    queryKey: guardianKeys.toolUsage(timeRange),
    queryFn: async (): Promise<ToolUsageStat[]> => {
      const supabase = createClient();
      const since = getTimeRangeStart(timeRange);

      // Fetch tool-related events from guardian_log
      const { data, error } = await supabase
        .from("guardian_log")
        .select("event_type, data")
        .like("event_type", "tool.%")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by tool name
      const toolMap = new Map<string, { calls: number; success: number; failure: number }>();

      for (const row of data) {
        // event_type format: "tool.call", "tool.result", "tool.error"
        // data may contain { tool_name: "..." }
        const rowData = row.data as Record<string, unknown> | null;
        const toolName =
          (rowData?.tool_name as string) ?? (rowData?.name as string) ?? row.event_type;

        if (!toolMap.has(toolName)) {
          toolMap.set(toolName, { calls: 0, success: 0, failure: 0 });
        }
        const entry = toolMap.get(toolName)!;

        if (row.event_type === "tool.call") {
          entry.calls++;
        } else if (row.event_type === "tool.result") {
          entry.success++;
        } else if (row.event_type === "tool.error") {
          entry.failure++;
        } else {
          // Generic tool event — count as a call
          entry.calls++;
        }
      }

      // Convert to sorted array
      const stats: ToolUsageStat[] = [];
      for (const [toolName, counts] of toolMap) {
        const total = counts.calls || counts.success + counts.failure || 1;
        stats.push({
          toolName,
          callCount: Math.max(counts.calls, counts.success + counts.failure),
          successCount: counts.success,
          failureCount: counts.failure,
          successRate:
            counts.success + counts.failure > 0
              ? Math.round((counts.success / (counts.success + counts.failure)) * 100)
              : total > 0
                ? 100
                : 0,
        });
      }

      // Sort by call count descending, top 10
      stats.sort((a, b) => b.callCount - a.callCount);
      return stats.slice(0, 10);
    },
    refetchInterval: 60_000,
  });
}
