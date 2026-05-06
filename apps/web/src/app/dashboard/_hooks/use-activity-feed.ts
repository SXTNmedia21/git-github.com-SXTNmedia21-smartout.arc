"use client";

/**
 * useActivityFeed — Queries activity_trail for workspace events.
 * Supports category/time filters and realtime subscription for live updates.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type ActivityFeedFilters = {
  category?: "scheduling" | "operations" | "training" | "all";
  timeRange?: "today" | "7d" | "30d";
};

export type ActivityEntry = {
  id: number;
  event: string;
  actionVerb: string;
  actorId: string;
  actorName: string;
  entityType: string;
  entityLabel: string | null;
  description: string;
  createdAt: string;
  category: string;
};

function getTimeRangeFilter(range: "today" | "7d" | "30d"): string {
  const now = new Date();
  if (range === "today") {
    return `${now.toISOString().slice(0, 10)}T00:00:00`;
  }
  const days = range === "7d" ? 7 : 30;
  const past = new Date(now.getTime() - days * 24 * 60 * 60_000);
  return past.toISOString();
}

export function useActivityFeed(options: { limit: number; filters: ActivityFeedFilters }) {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const workspaceId = workspace.workspace_id;

  const queryKey = ["activity-feed", workspaceId, options.filters, options.limit];

  const query = useQuery({
    queryKey,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("activity_trail")
        .select(
          "id, event, action_verb, actor_id, entity_type, entity_label, category, created_at, data, actor:actor_id(display_name)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(options.limit);

      if (options.filters.category && options.filters.category !== "all") {
        q = q.eq("category", options.filters.category);
      }

      if (options.filters.timeRange) {
        q = q.gte("created_at", getTimeRangeFilter(options.filters.timeRange));
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((row) => {
        const actor = row.actor as unknown as { display_name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
        return {
          id: row.id,
          event: row.event,
          actionVerb: row.action_verb,
          actorId: row.actor_id ?? "platform", // Phase 2A: actor_id is nullable for platform writes (actor_kind='platform')
          actorName: actor?.display_name ?? "System",
          entityType: row.entity_type,
          entityLabel: row.entity_label,
          description: `${row.action_verb} ${row.entity_type}${row.entity_label ? ` — ${row.entity_label}` : ""}`,
          createdAt: row.created_at,
          category: row.category,
        } satisfies ActivityEntry;
      });
    },
  });

  // Realtime subscription — refetch on new inserts
  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_trail",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, supabase, queryClient, queryKey]);

  return query;
}
