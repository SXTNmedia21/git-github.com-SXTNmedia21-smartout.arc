"use client";

/**
 * TanStack Query hooks for schedule_audit_log queries and rollback RPC.
 * Connected to: schedule-keys.ts (query keys), schedule-mappers.ts (DB ↔ frontend mapping)
 *
 * Audit log is read-only (populated by DB triggers). Rollback calls an RPC function.
 */

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { scheduleKeys } from "./schedule-keys";
import { type AuditLogEntry, fromDbAuditLog } from "./schedule-mappers";

// Re-export for consumers
export type { AuditLogEntry };

// ══════════════════════════════════════════════════════════════
// Query: Fetch audit log entries for a specific entity
// ══════════════════════════════════════════════════════════════

export function useAuditLog(tableName: string, rowId: string) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.auditLog(`${tableName}:${rowId}`),
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_audit_log")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .eq("table_name", tableName)
        .eq("row_id", rowId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(fromDbAuditLog);
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: Boolean(tableName && rowId),
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Rollback an audit entry
// ══════════════════════════════════════════════════════════════

export function useRollback() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (auditLogId: string) => {
      const supabase = createClient();

      const { error } = await supabase.rpc("rollback_audit_entry", {
        p_audit_log_id: auditLogId,
      });

      if (error) throw error;
    },

    onSuccess: (_data, auditLogId) => {
      void emit({
        event: "schedule rollback",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "reconciliation",
            entity_id: auditLogId,
            entity_label: "Audit log rollback",
          },
          data: { audit_log_id: auditLogId },
        },
      });
      toast.success("Endring rullet tilbake");
      // Invalidate ALL schedule queries since rollback can affect any table
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },

    onError: () => {
      toast.error("Kunne ikke rulle tilbake endringen");
    },
  });
}
