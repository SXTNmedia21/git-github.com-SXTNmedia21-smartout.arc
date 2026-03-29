"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { useDepartmentSessions } from "./use-department-sessions";
import { useDeviations } from "./use-deviations";

export type DriftInsights = {
  totalSessions: number;
  activeSessions: number;
  closedSessions: number;
  missedSessions: number;
  pendingSignoffSessions: number;
  taskCompletionPercent: number;
  totalTasks: number;
  completedTasks: number;
  openDeviations: number;
  blockingDeviations: number;
  overdueTasks: number;
};

const EMPTY_INSIGHTS: DriftInsights = {
  totalSessions: 0,
  activeSessions: 0,
  closedSessions: 0,
  missedSessions: 0,
  pendingSignoffSessions: 0,
  taskCompletionPercent: 0,
  totalTasks: 0,
  completedTasks: 0,
  openDeviations: 0,
  blockingDeviations: 0,
  overdueTasks: 0,
};

/**
 * Derives operational insights for the Drift page from existing session,
 * deviation, and task data. Composes useDepartmentSessions + useDeviations
 * with one additional query for overdue task count.
 */
export function useDriftInsights(date: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  const { data: sessions, isLoading: sessionsLoading } = useDepartmentSessions(date);
  const { data: deviations, isLoading: deviationsLoading } = useDeviations({
    status: ["open", "acknowledged", "escalated"],
  });

  const sessionIds = useMemo(() => (sessions ?? []).map((s) => s.sessionId), [sessions]);

  const { data: overdueCount, isLoading: overdueLoading } = useQuery({
    queryKey: ["hms", "overdue-tasks", wsId, date, sessionIds],
    enabled: !!wsId && sessionIds.length > 0,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("session_task")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wsId!)
        .in("department_session_id", sessionIds)
        .in("status", ["overdue", "escalated"]);

      if (error) throw error;
      return count ?? 0;
    },
  });

  const isLoading = sessionsLoading || deviationsLoading || overdueLoading;

  const insights = useMemo((): DriftInsights => {
    if (!sessions) return EMPTY_INSIGHTS;

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.status === "active").length;
    const closedSessions = sessions.filter((s) => s.status === "closed").length;
    const missedSessions = sessions.filter((s) => s.status === "missed").length;
    const pendingSignoffSessions = sessions.filter((s) => s.status === "pending_signoff").length;

    const totalTasks = sessions.reduce((sum, s) => sum + s.tasksTotal, 0);
    const completedTasks = sessions.reduce((sum, s) => sum + s.tasksCompleted, 0);
    const taskCompletionPercent =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const openDeviations = deviations?.length ?? 0;
    const blockingDeviations = deviations?.filter((d) => d.blocksDayApproval).length ?? 0;

    return {
      totalSessions,
      activeSessions,
      closedSessions,
      missedSessions,
      pendingSignoffSessions,
      taskCompletionPercent,
      totalTasks,
      completedTasks,
      openDeviations,
      blockingDeviations,
      overdueTasks: overdueCount ?? 0,
    };
  }, [sessions, deviations, overdueCount]);

  return { insights, isLoading };
}
