"use client";

/**
 * activity-tools-bridge.tsx — registers Botsson read tools for the Activity
 * surface inside the harness registry.
 *
 * Why a bridge:
 *  - Keeps ActivityView free from voice-tool registration bookkeeping.
 *  - Mounts ONLY when data is available (feed loaded). All three tools are
 *    read-only so there is no write-gate risk — but mounting only in ready
 *    state prevents tools from returning empty arrays before the first fetch.
 *
 * Data sourcing:
 *  - Re-uses the same useActivityFeed hooks that ActivityView + ActivityFeed
 *    already call. Two instances: `feed` (today, 30 entries) for getRecentActivity
 *    and getActivitySummary; `feedWide` (30d, 200 entries) for searchActivity.
 *    TanStack dedup means there is no extra network cost for `feed` (same
 *    queryKey as the ActivityFeed component). feedWide uses its own queryKey.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useActivityFeed } from "@/app/dashboard/_hooks/use-activity-feed";
import { useActivityTools } from "./use-activity-tools";

export function ActivityToolsBridge() {
  const { data: feed } = useActivityFeed({
    limit: 30,
    filters: { timeRange: "today" },
  });

  const { data: feedWide } = useActivityFeed({
    limit: 200,
    filters: { timeRange: "30d" },
  });

  const tools = useActivityTools({
    feed: feed ?? [],
    feedWide: feedWide ?? [],
  });

  useRegisterTools("activity", tools);

  return null;
}
