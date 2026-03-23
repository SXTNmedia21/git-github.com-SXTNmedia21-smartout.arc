"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type SessionTask = {
  id: string;
  workspaceId: string;
  departmentSessionId: string;
  sessionHookId: string | null;
  title: string;
  description: string | null;
  status:
    | "pending"
    | "available"
    | "in_progress"
    | "completed"
    | "skipped"
    | "overdue"
    | "escalated";
  assignedTo: string | null;
  completedBy: string | null;
  completedAt: string | null;
  evidence: Record<string, unknown> | null;
  isComplianceRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export function useSessionTasks(sessionId: string | undefined, profileFilter?: string | null) {
  return useQuery({
    queryKey: ["hms", "session-tasks", sessionId, profileFilter],
    enabled: !!sessionId,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<SessionTask[]> => {
      const supabase = createClient();
      let query = supabase
        .from("session_task")
        .select("*")
        .eq("department_session_id", sessionId!)
        .order("created_at");

      if (profileFilter) {
        query = query.or(`assigned_to.eq.${profileFilter},assigned_to.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((t) => ({
        id: t.id,
        workspaceId: t.workspace_id,
        departmentSessionId: t.department_session_id,
        sessionHookId: t.session_hook_id,
        title: t.title,
        description: t.description,
        status: t.status,
        assignedTo: t.assigned_to,
        completedBy: t.completed_by,
        completedAt: t.completed_at,
        evidence: t.evidence as Record<string, unknown> | null,
        isComplianceRequired: t.is_compliance_required,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    },
  });
}
