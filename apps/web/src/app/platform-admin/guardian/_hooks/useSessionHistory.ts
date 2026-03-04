"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { guardianKeys } from "./guardian-keys";

export type TimeRange = "today" | "7d" | "30d";

export type SessionHistoryRow = {
  id: string;
  mission_id: string | null;
  channel: string;
  status: string;
  mode: string;
  stage_index: number;
  created_at: string;
  completed_at: string | null;
  workspace_id: string;
};

export type SessionStats = {
  total: number;
  completed: number;
  abandoned: number;
  active: number;
  completionRate: number;
  abandonedRate: number;
  avgDurationMinutes: number;
  byMission: Record<string, number>;
  byChannel: Record<string, number>;
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

export function useSessionHistory(timeRange: TimeRange) {
  return useQuery({
    queryKey: guardianKeys.sessions(timeRange),
    queryFn: async (): Promise<SessionStats> => {
      const supabase = createClient();
      const since = getTimeRangeStart(timeRange);

      const { data, error } = await supabase
        .from("engine_sessions")
        .select(
          "id, mission_id, channel, status, mode, stage_index, created_at, completed_at, workspace_id",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          total: 0,
          completed: 0,
          abandoned: 0,
          active: 0,
          completionRate: 0,
          abandonedRate: 0,
          avgDurationMinutes: 0,
          byMission: {},
          byChannel: {},
        };
      }

      const sessions = data as SessionHistoryRow[];
      const total = sessions.length;
      const completed = sessions.filter((s) => s.status === "completed").length;
      const abandoned = sessions.filter(
        (s) => s.status === "abandoned" || s.status === "expired",
      ).length;
      const active = sessions.filter((s) => s.status === "active").length;

      // Calculate average duration for completed sessions
      const completedSessions = sessions.filter((s) => s.status === "completed" && s.completed_at);
      let avgDurationMinutes = 0;
      if (completedSessions.length > 0) {
        const totalMs = completedSessions.reduce((sum, s) => {
          const start = new Date(s.created_at).getTime();
          const end = new Date(s.completed_at!).getTime();
          return sum + (end - start);
        }, 0);
        avgDurationMinutes = Math.round((totalMs / completedSessions.length / 60_000) * 10) / 10;
      }

      // Group by mission
      const byMission: Record<string, number> = {};
      for (const s of sessions) {
        const key = s.mission_id ?? "agent_mode";
        byMission[key] = (byMission[key] ?? 0) + 1;
      }

      // Group by channel
      const byChannel: Record<string, number> = {};
      for (const s of sessions) {
        byChannel[s.channel] = (byChannel[s.channel] ?? 0) + 1;
      }

      return {
        total,
        completed,
        abandoned,
        active,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        abandonedRate: total > 0 ? Math.round((abandoned / total) * 100) : 0,
        avgDurationMinutes,
        byMission,
        byChannel,
      };
    },
    refetchInterval: 60_000,
  });
}
