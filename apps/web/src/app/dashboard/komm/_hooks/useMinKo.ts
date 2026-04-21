"use client";

/**
 * useMinKo — queue hook for the "Min kø" sidebar section (ADR-0165).
 *
 * Returns open helpdesk tickets assigned to the current user, grouped by
 * the desk channel they belong to. Used by MinKoSection to render above
 * the Kanaler list when the user is responsible for any open work.
 *
 * Why group by desk_channel_id (context), not entity_id?
 *   entity_id points at the private sub-channel for private-mode tickets
 *   (ADR-0165 Rule 4). Requesters need that id to open a thread, but the
 *   Min kø sidebar wants to roll private sub-channels UP to their parent
 *   helpdesk so a rep sees "3 open in #HR" rather than 3 orphan rows for
 *   3 one-off sub-channels. context.desk_channel_id is the stable anchor.
 *
 * Status filter: 'waiting' + 'active' (open lifecycle per L-0079). We
 * never include 'complete' here — the Min kø section should disappear
 * when nothing is open.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type MinKoEntry = {
  channel_id: string;
  channel_name: string;
  unresolved_count: number;
  /** oldest ticket's started_at ISO — drives the age color-shift */
  oldest_started_at: string;
};

type TicketRow = {
  id: string;
  started_at: string;
  entity_id: string | null;
  context: Record<string, unknown> | null;
};

const EMPTY_RESULT: MinKoEntry[] = [];

export function useMinKo(profileId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["min-ko", workspaceId, profileId],
    enabled: Boolean(profileId),
    staleTime: 15_000,
    queryFn: async (): Promise<MinKoEntry[]> => {
      if (!profileId) return EMPTY_RESULT;
      const supabase = createClient();

      // Pull just enough for the sidebar: id (uniqueness), started_at (age),
      // entity_id (fallback when context is missing), context (desk rollup).
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, started_at, entity_id, context")
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("assignee_id", profileId)
        .in("status", ["waiting", "active"]);

      if (error) throw error;
      const rows = (data ?? []) as TicketRow[];
      if (rows.length === 0) return EMPTY_RESULT;

      // Group by desk_channel_id (context rollup). entity_id is a fallback
      // for legacy rows without the context anchor — those get grouped
      // under their own entity (no rollup), which is the least-surprising
      // behaviour until they're touched + migrated.
      const deskGroups = new Map<string, { count: number; oldest: string }>();
      for (const row of rows) {
        const deskChannelId =
          (row.context as { desk_channel_id?: string } | null)?.desk_channel_id ??
          row.entity_id ??
          null;
        if (!deskChannelId) continue;
        const existing = deskGroups.get(deskChannelId);
        if (!existing) {
          deskGroups.set(deskChannelId, { count: 1, oldest: row.started_at });
          continue;
        }
        existing.count += 1;
        if (row.started_at < existing.oldest) existing.oldest = row.started_at;
      }

      if (deskGroups.size === 0) return EMPTY_RESULT;

      // Resolve channel names in one roundtrip. Channel rows are small,
      // workspace-scoped, RLS-guarded — cheap to fetch by id-in.
      const deskIds = Array.from(deskGroups.keys());
      const { data: channels, error: channelErr } = await supabase
        .from("channel")
        .select("id, name")
        .in("id", deskIds);
      if (channelErr) throw channelErr;

      const nameById = new Map<string, string>();
      for (const ch of channels ?? []) {
        nameById.set(ch.id, ch.name ?? "Skranke");
      }

      return deskIds
        .map((id) => {
          const group = deskGroups.get(id)!;
          return {
            channel_id: id,
            channel_name: nameById.get(id) ?? "Skranke",
            unresolved_count: group.count,
            oldest_started_at: group.oldest,
          };
        })
        .sort((a, b) => a.oldest_started_at.localeCompare(b.oldest_started_at));
    },
  });
}
