"use client";

/**
 * useChannelHelpdeskFlags — sidebar-row helpdesk metadata (ADR-0165).
 *
 * The canonical channel RPC (get_my_channels) was shipped before the
 * Progressive Channel discriminator existed, and returns neither
 * helpdesk_enabled nor privacy_mode nor responsible_profile_id. Rather
 * than fork the RPC for a presentation concern, this hook pulls the
 * three flags in a lightweight id-indexed map the channel-row renderer
 * can join in place. Open-ticket counts for reps come from a second
 * query — engine_state rollup by desk_channel_id, same anchor as the
 * Min kø sidebar (useMinKo).
 *
 * Both queries are cached separately so flag changes and ticket churn
 * don't invalidate each other.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type HelpdeskFlags = {
  helpdesk_enabled: boolean;
  privacy_mode: "public" | "private_per_requester" | null;
  responsible_profile_id: string | null;
};

export type HelpdeskFlagMap = Map<string, HelpdeskFlags>;

/**
 * Returns a map keyed by channel.id with helpdesk posture flags. Only
 * helpdesk-enabled channels are returned — callers can treat absence as
 * "regular channel, no indicators to draw."
 */
export function useChannelHelpdeskFlags() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["channel-helpdesk-flags", workspaceId],
    staleTime: 30_000,
    queryFn: async (): Promise<HelpdeskFlagMap> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("channel")
        .select("id, helpdesk_enabled, privacy_mode, responsible_profile_id")
        .eq("workspace_id", workspaceId)
        .eq("helpdesk_enabled", true);
      if (error) throw error;

      const out: HelpdeskFlagMap = new Map();
      for (const row of data ?? []) {
        out.set(row.id, {
          helpdesk_enabled: row.helpdesk_enabled ?? false,
          privacy_mode: (row.privacy_mode ?? null) as HelpdeskFlags["privacy_mode"],
          responsible_profile_id: row.responsible_profile_id ?? null,
        });
      }
      return out;
    },
  });
}

/**
 * Open-ticket counts PER desk channel for the current user. Only returned
 * when the user is the responsible rep for the channel — unrelated reps
 * never need the count, and workers never need it at all. Key is desk
 * channel id (context.desk_channel_id), same rollup semantics as useMinKo.
 */
export function useDeskOpenCounts(profileId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["desk-open-counts", workspaceId, profileId],
    enabled: Boolean(profileId),
    staleTime: 15_000,
    queryFn: async (): Promise<Map<string, number>> => {
      if (!profileId) return new Map();
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_state")
        .select("entity_id, context")
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("assignee_id", profileId)
        .in("status", ["waiting", "active"]);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const deskId =
          (row.context as { desk_channel_id?: string } | null)?.desk_channel_id ??
          row.entity_id ??
          null;
        if (!deskId) continue;
        counts.set(deskId, (counts.get(deskId) ?? 0) + 1);
      }
      return counts;
    },
  });
}
