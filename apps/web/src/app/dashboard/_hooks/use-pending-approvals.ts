"use client";

/**
 * usePendingApprovals — Queries department sessions awaiting manager sign-off.
 * Returns up to 10 sessions ordered by date ascending so the oldest pending
 * approval surfaces first. Used by the ApprovalQueue widget.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type PendingApproval = {
  session_id: string;
  department_name: string;
  session_date: string;
  status: string;
};

export function usePendingApprovals() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ["dashboard", "pending-approvals", workspace.workspace_id],
    staleTime: 30_000,
    queryFn: async (): Promise<PendingApproval[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department_session")
        .select(
          "department_session_id, session_date, status, department:department!inner(name)",
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "pending_signoff")
        .order("session_date", { ascending: true })
        .limit(10);

      if (error) throw error;

      return (data ?? []).map((row) => ({
        session_id: row.department_session_id,
        department_name: (row.department as { name: string })?.name ?? "",
        session_date: row.session_date,
        status: row.status,
      }));
    },
  });
}
