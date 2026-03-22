"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export type DepartmentSessionRow = {
  sessionId: string;
  departmentId: string;
  departmentName: string;
  sessionDate: string;
  status: "upcoming" | "active" | "pending_signoff" | "closed" | "missed";
  plannedOpen: string | null;
  plannedClose: string | null;
  openedAt: string | null;
  closedAt: string | null;
  tasksTotal: number;
  tasksCompleted: number;
  signoffNotes: string | null;
};

export function useDepartmentSessions(date: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["hms", "department-sessions", wsId, date],
    enabled: !!wsId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DepartmentSessionRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department_session")
        .select("*, department:department_id(name)")
        .eq("workspace_id", wsId!)
        .eq("session_date", date)
        .order("department_id");

      if (error) throw error;

      return (data ?? []).map((s) => {
        const dept = s.department as unknown as { name: string } | null;
        return {
          sessionId: s.department_session_id,
          departmentId: s.department_id,
          departmentName: dept?.name ?? "Ukjent",
          sessionDate: s.session_date,
          status: s.status,
          plannedOpen: s.planned_open,
          plannedClose: s.planned_close,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          tasksTotal: s.tasks_total ?? 0,
          tasksCompleted: s.tasks_completed ?? 0,
          signoffNotes: s.signoff_notes,
        };
      });
    },
  });
}
