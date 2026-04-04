"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import type { DeviationRow, DeviationStatus, DeviationDomain } from "@smartout/hms";

type UseDeviationsOptions = {
  status?: DeviationStatus[];
  domain?: DeviationDomain;
  sessionId?: string;
};

export function useDeviations(options: UseDeviationsOptions = {}) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["hms", "deviations", wsId, options],
    enabled: !!wsId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DeviationRow[]> => {
      const supabase = createClient();
      let query = supabase
        .from("deviation")
        .select(
          "*, department:department_id(name), reporter:reported_by(display_name), resolver:resolved_by(display_name)",
        )
        .eq("workspace_id", wsId!)
        .order("created_at", { ascending: false });

      if (options.status && options.status.length > 0) {
        query = query.in("status", options.status);
      }
      if (options.domain) {
        query = query.eq("domain", options.domain);
      }
      if (options.sessionId) {
        query = query.eq("session_id", options.sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((d) => {
        const dept = d.department as unknown as { name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
        const reporter = d.reporter as unknown as { display_name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
        const resolver = d.resolver as unknown as { display_name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
        return {
          deviationId: d.deviation_id,
          workspaceId: d.workspace_id,
          departmentId: d.department_id,
          departmentName: dept?.name ?? null,
          sessionId: d.session_id,
          sourceTaskId: d.source_task_id,
          procedureId: d.procedure_id,
          protocolId: d.protocol_id,
          domain: d.domain,
          severity: d.severity,
          status: d.status,
          title: d.title,
          description: d.description,
          reportedBy: d.reported_by,
          reporterName: reporter?.display_name ?? null,
          resolvedBy: d.resolved_by,
          resolverName: resolver?.display_name ?? null,
          resolvedAt: d.resolved_at,
          resolutionNotes: d.resolution_notes,
          attachments: d.attachments,
          blocksDayApproval: d.blocks_day_approval,
          requiresAction: d.requires_action,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        };
      });
    },
  });
}
