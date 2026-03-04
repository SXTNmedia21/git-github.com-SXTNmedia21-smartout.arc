"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { ProtocolAssignee } from "./dashboard-types";

/**
 * Fetches assignees for a specific protocol with profile details.
 * Joins through profile!inner for workspace scoping (protocol_assignment has no workspace_id).
 * Connected to: ProtocolEmployeeList component
 */
export function useProtocolAssignees(protocolId: string | null) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.protocolAssignees(workspaceId ?? "none", protocolId ?? "none"),
    enabled: !!workspaceId && !!protocolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<ProtocolAssignee[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("protocol_assignment")
        .select(
          "assignment_id, profile_id, status, assigned_at, completed_at, profile!inner(display_name, avatar_url, role, workspace_id)",
        )
        .eq("protocol_id", protocolId!)
        .eq("profile.workspace_id", workspaceId!);

      if (error) throw error;

      return (data ?? []).map((row) => {
        const profile = row.profile as unknown as {
          display_name: string;
          avatar_url: string | null;
          role: string;
          workspace_id: string;
        };

        return {
          assignmentId: row.assignment_id,
          profileId: row.profile_id,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          role: profile.role,
          status: row.status as "pending" | "completed" | "expired",
          assignedAt: row.assigned_at,
          completedAt: row.completed_at,
        };
      });
    },
  });
}
