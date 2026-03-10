"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { guardianKeys } from "./guardian-keys";

export type StageAnalysisEntry = {
  stageId: string;
  stageName: string;
  missionId: string;
  avgTimeSeconds: number;
  completionCount: number;
  dropOffCount: number;
  completionRate: number;
};

export function useStageAnalysis(missionId?: string) {
  return useQuery({
    queryKey: guardianKeys.stageAnalysis(missionId),
    queryFn: async (): Promise<StageAnalysisEntry[]> => {
      const supabase = createClient();

      // Fetch stage-related events
      let query = supabase
        .from("guardian_log")
        .select("event_type, data, session_id, created_at")
        .in("event_type", ["stage.changed", "stage.completed", "stage.advance"])
        .order("created_at", { ascending: true })
        .limit(5000);

      // Filter by mission via session lookup would be expensive,
      // so we filter on data.mission_id if available in the log event
      if (missionId) {
        query = query.filter("data->>mission_id", "eq", missionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group stage transitions by session to calculate time per stage
      type StageEvent = {
        stageId: string;
        stageName: string;
        missionId: string;
        timestamp: number;
      };

      const sessionStages = new Map<string, StageEvent[]>();

      for (const row of data) {
        const rowData = row.data as Record<string, unknown> | null;
        if (!rowData) continue;

        const stageId = (rowData.stage_id as string) ?? (rowData.target_stage_id as string) ?? "";
        const stageName = (rowData.stage_name as string) ?? stageId;
        const mission = (rowData.mission_id as string) ?? "unknown";

        if (!stageId) continue;

        if (!sessionStages.has(row.session_id)) {
          sessionStages.set(row.session_id, []);
        }
        sessionStages.get(row.session_id)!.push({
          stageId,
          stageName,
          missionId: mission,
          timestamp: new Date(row.created_at).getTime(),
        });
      }

      // Calculate time spent per stage across all sessions
      const stageStats = new Map<
        string,
        {
          stageName: string;
          missionId: string;
          durations: number[];
          completions: number;
          dropOffs: number;
        }
      >();

      for (const [, events] of sessionStages) {
        for (let i = 0; i < events.length; i++) {
          const current = events[i]!;
          const key = current.stageId;

          if (!stageStats.has(key)) {
            stageStats.set(key, {
              stageName: current.stageName,
              missionId: current.missionId,
              durations: [],
              completions: 0,
              dropOffs: 0,
            });
          }

          const stat = stageStats.get(key)!;

          if (i < events.length - 1) {
            // Time until next stage
            const nextEvent = events[i + 1]!;
            const duration = (nextEvent.timestamp - current.timestamp) / 1000;
            if (duration > 0 && duration < 3600) {
              // Cap at 1 hour to filter outliers
              stat.durations.push(duration);
            }
            stat.completions++;
          } else {
            // Last event in session — could be a drop-off
            stat.dropOffs++;
          }
        }
      }

      // Convert to output
      const entries: StageAnalysisEntry[] = [];
      for (const [stageId, stat] of stageStats) {
        const avgTimeSeconds =
          stat.durations.length > 0
            ? Math.round(stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length)
            : 0;
        const total = stat.completions + stat.dropOffs;

        entries.push({
          stageId,
          stageName: stat.stageName,
          missionId: stat.missionId,
          avgTimeSeconds,
          completionCount: stat.completions,
          dropOffCount: stat.dropOffs,
          completionRate: total > 0 ? Math.round((stat.completions / total) * 100) : 0,
        });
      }

      // Sort by avg time descending (bottlenecks first)
      entries.sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds);
      return entries;
    },
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
  });
}
