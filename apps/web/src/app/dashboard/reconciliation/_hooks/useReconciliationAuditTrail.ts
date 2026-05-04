"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type ReconciliationAuditEntry = {
  id: string;
  createdAt: string;
  actorName: string | null;
  action: string;
  eventName: string;
  reason: string | null;
  isOverride: boolean;
  payload: Record<string, unknown>;
};

/**
 * Fetches activity_trail entries for a given reconciliation, ordered by
 * newest first. Powers the Revisjonslogg tab (J5).
 *
 * Filter contract: entity_type='daily_reconciliation' + entity_id=<recon_id>.
 * The emit() registry writes entity_type/entity_id under properties.entity,
 * which activity_trail stores as two dedicated columns for querying.
 */
export function useReconciliationAuditTrail(reconciliationId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["reconciliation-audit-trail", reconciliationId],
    enabled: !!reconciliationId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ReconciliationAuditEntry[]> => {
      if (!reconciliationId) return [];

      const { data, error } = await supabase
        .from("activity_trail")
        .select(
          "id, event, action_verb, actor_id, created_at, data, profile:actor_id(display_name)",
        )
        .eq("entity_type", "reconciliation")
        .eq("entity_id", reconciliationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return (
        (data ?? []) as unknown as Array<{
          id: number;
          event: string;
          action_verb: string;
          actor_id: string;
          created_at: string;
          data: Record<string, unknown> | null;
          profile: { display_name: string } | null;
        }>
      ).map((row) => {
        const payloadData = (row.data ?? {}) as Record<string, unknown>;
        const isOverride = payloadData.override === true;
        const reason = typeof payloadData.reason === "string" ? payloadData.reason : null;
        const action =
          typeof payloadData.action === "string" ? payloadData.action : row.action_verb;

        return {
          id: String(row.id),
          createdAt: row.created_at,
          actorName: row.profile?.display_name ?? null,
          action,
          eventName: row.event,
          reason,
          isOverride,
          payload: payloadData,
        };
      });
    },
  });
}
