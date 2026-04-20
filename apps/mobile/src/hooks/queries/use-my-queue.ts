/**
 * use-my-queue.ts — Helpdesk queue for the signed-in user.
 *
 * Returns engine_state rows with process_id='helpdesk_query_lifecycle'
 * where the caller is the assignee and status is open (waiting/active).
 * Mobile displays this as "Min kø" (Spec §3.2).
 *
 * Reads via Supabase with workspace-scoped RLS. Writes (resolve) go
 * through use-resolve-ticket.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type QueueTicket = {
  ticket_id: string;
  channel_id: string;
  status: "waiting" | "active";
  summary: string;
  opened_at: string;
  requester: {
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

async function fetchQueue(profileId: string, workspaceId: string): Promise<QueueTicket[]> {
  const { data, error } = await supabase
    .from("engine_state")
    .select("id, entity_id, status, context, started_at")
    .eq("workspace_id", workspaceId)
    .eq("process_id", "helpdesk_query_lifecycle")
    .eq("assignee_id", profileId)
    .in("status", ["waiting", "active"])
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!data) return [];

  const requesterIds = Array.from(
    new Set(
      data
        .map(
          (row) => (row.context as { requester_profile_id?: string } | null)?.requester_profile_id,
        )
        .filter((v): v is string => typeof v === "string"),
    ),
  );

  const { data: profiles } = requesterIds.length
    ? await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url")
        .in("profile_id", requesterIds)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

  return data.map((row) => {
    const ctx = (row.context as { summary?: string; requester_profile_id?: string } | null) ?? {};
    const requesterProfile = ctx.requester_profile_id
      ? byId.get(ctx.requester_profile_id)
      : undefined;
    return {
      ticket_id: row.id,
      channel_id: row.entity_id ?? "",
      status: row.status === "active" ? "active" : "waiting",
      summary: ctx.summary ?? "Uten tittel",
      opened_at: row.started_at,
      requester: requesterProfile
        ? {
            profile_id: requesterProfile.profile_id,
            display_name: requesterProfile.display_name ?? "ukjent",
            avatar_url: requesterProfile.avatar_url,
          }
        : null,
    };
  });
}

export function useMyQueue(profileId: string | undefined, workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["helpdesk", "queue", workspaceId, profileId],
    enabled: Boolean(profileId && workspaceId),
    staleTime: 15_000,
    queryFn: () => fetchQueue(profileId!, workspaceId!),
  });
}
