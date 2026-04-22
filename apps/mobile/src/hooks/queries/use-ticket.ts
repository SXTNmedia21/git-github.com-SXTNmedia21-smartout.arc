/**
 * use-ticket.ts — Fetch a single helpdesk ticket by its channel_id.
 *
 * Returns the engine_state row joined with channel + requester + assignee
 * profile data. Used by the ticket detail screen (Spec §3.3).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type TicketDetail = {
  ticket_id: string;
  channel_id: string;
  status: "waiting" | "active" | "complete";
  summary: string;
  opened_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  desk_channel_id: string | null;
  requester: {
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  assignee: {
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  is_read_only: boolean;
  audio_policy: string;
};

async function fetchTicket(channelId: string, workspaceId: string): Promise<TicketDetail | null> {
  const { data: channel } = await supabase
    .from("channel")
    .select("id, channel_type, is_read_only, audio_policy, name, workspace_id")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel || channel.workspace_id !== workspaceId) return null;
  if (channel.channel_type !== "query_thread") return null;

  const { data: row } = await supabase
    .from("engine_state")
    .select("id, status, assignee_id, context, started_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("process_id", "helpdesk_query_lifecycle")
    .eq("entity_id", channelId)
    .maybeSingle();
  if (!row) return null;

  const ctx =
    (row.context as {
      summary?: string;
      desk_channel_id?: string;
      requester_profile_id?: string;
      resolved_at?: string;
      resolution_note?: string;
    } | null) ?? {};

  const profileIds = [ctx.requester_profile_id, row.assignee_id].filter(
    (v): v is string => typeof v === "string",
  );
  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url")
        .in("profile_id", profileIds)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

  const requester = ctx.requester_profile_id ? byId.get(ctx.requester_profile_id) : undefined;
  const assignee = row.assignee_id ? byId.get(row.assignee_id) : undefined;

  const status: TicketDetail["status"] =
    row.status === "complete" ? "complete" : row.status === "active" ? "active" : "waiting";

  return {
    ticket_id: row.id,
    channel_id: channel.id,
    status,
    summary: ctx.summary ?? channel.name ?? "Ny henvendelse",
    opened_at: row.started_at,
    updated_at: row.updated_at,
    resolved_at: status === "complete" ? (ctx.resolved_at ?? row.updated_at) : null,
    resolution_note: ctx.resolution_note ?? null,
    desk_channel_id: ctx.desk_channel_id ?? null,
    requester: requester
      ? {
          profile_id: requester.profile_id,
          display_name: requester.display_name ?? "ukjent",
          avatar_url: requester.avatar_url,
        }
      : null,
    assignee: assignee
      ? {
          profile_id: assignee.profile_id,
          display_name: assignee.display_name ?? "ukjent",
          avatar_url: assignee.avatar_url,
        }
      : null,
    is_read_only: channel.is_read_only,
    audio_policy: channel.audio_policy ?? "off",
  };
}

export function useTicket(channelId: string | undefined, workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["helpdesk", "ticket", workspaceId, channelId],
    enabled: Boolean(channelId && workspaceId),
    staleTime: 10_000,
    queryFn: () => fetchTicket(channelId!, workspaceId!),
  });
}
