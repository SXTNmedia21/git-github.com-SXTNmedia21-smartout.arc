/**
 * /dashboard/komm/thread/[channelId] — Spec §2 Server Component.
 *
 * Renders the ticket conversation surface for a channel_type='query_thread'
 * row. Access gating: caller must be either the assignee, an admin in
 * the ticket's workspace company, or the requester themselves. Anyone
 * else is redirected to /dashboard/komm with no indication the ticket
 * exists.
 *
 * Spec §2 deviation: the spec prescribes /dashboard/komm/[channelId]
 * with a fork on channel_type. Existing Komm routes everything through
 * the root page and tracks activeChannelId in client state; grafting a
 * dynamic [channelId] segment on top of that would conflict. A dedicated
 * /thread/[channelId] route keeps the Kanaler surface untouched and
 * gives ticket threads their own deep-link target.
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { TicketConversationView, type TicketInitial } from "./_components/TicketConversationView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ channelId: string }>;
};

export default async function TicketThreadPage({ params }: PageProps) {
  const { channelId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, display_name, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) redirect("/dashboard");

  // ── Load the channel + ensure it's a query_thread. ───────────────────
  const { data: channel } = await supabase
    .from("channel")
    .select("id, workspace_id, channel_type, is_read_only, audio_policy, name, description")
    .eq("id", channelId)
    .maybeSingle();

  if (!channel || channel.workspace_id !== profile.workspace_id) {
    // Don't leak cross-tenant existence — treat as not-found.
    notFound();
  }
  if (channel.channel_type !== "query_thread") {
    // A non-ticket channel redirects back to the normal Komm surface.
    redirect("/dashboard/komm");
  }

  // ── Load the engine_state (the ticket) via entity_id → channel.id. ───
  const { data: ticketRow } = await supabase
    .from("engine_state")
    .select("id, status, assignee_id, context, updated_at")
    .eq("workspace_id", profile.workspace_id)
    .eq("process_id", "helpdesk_query_lifecycle")
    .eq("entity_id", channelId)
    .maybeSingle();

  if (!ticketRow) notFound();

  const ticketContext =
    (ticketRow.context as {
      summary?: string;
      desk_channel_id?: string;
      requester_profile_id?: string;
      resolved_at?: string;
      resolution_note?: string;
    }) ?? {};

  // ── Access control: assignee, requester, or admin. ───────────────────
  const isAssignee = ticketRow.assignee_id === profile.profile_id;
  const isRequester = ticketContext.requester_profile_id === profile.profile_id;

  let isAdmin = false;
  if (!isAssignee && !isRequester) {
    const { data: workspaceRow } = await supabase
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", profile.workspace_id)
      .single();
    if (workspaceRow?.company_id) {
      const { data: member } = await supabase
        .from("company_member")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", workspaceRow.company_id)
        .maybeSingle();
      isAdmin = member?.role === "owner" || member?.role === "admin";
    }
  }

  if (!isAssignee && !isRequester && !isAdmin) {
    redirect("/dashboard/komm");
  }

  // ── Resolve requester + assignee profiles for the header. ────────────
  const profileIds = [ticketContext.requester_profile_id, ticketRow.assignee_id].filter(
    (v): v is string => typeof v === "string",
  );

  const { data: profileRows } = profileIds.length
    ? await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url")
        .in("profile_id", profileIds)
    : { data: [] };
  const profileById = new Map((profileRows ?? []).map((p) => [p.profile_id, p]));

  const requesterRaw = ticketContext.requester_profile_id
    ? profileById.get(ticketContext.requester_profile_id)
    : undefined;
  const assigneeRaw = ticketRow.assignee_id ? profileById.get(ticketRow.assignee_id) : undefined;

  const status: TicketInitial["status"] =
    ticketRow.status === "complete"
      ? "complete"
      : ticketRow.status === "active"
        ? "active"
        : "waiting";

  const ticket: TicketInitial = {
    ticket_id: ticketRow.id,
    channel_id: channel.id,
    status,
    summary: ticketContext.summary ?? channel.name ?? "Ny henvendelse",
    requester: requesterRaw
      ? {
          profile_id: requesterRaw.profile_id,
          display_name: requesterRaw.display_name ?? "ukjent",
          avatar_url: requesterRaw.avatar_url,
        }
      : null,
    assignee: assigneeRaw
      ? {
          profile_id: assigneeRaw.profile_id,
          display_name: assigneeRaw.display_name ?? "ukjent",
          avatar_url: assigneeRaw.avatar_url,
        }
      : null,
    resolved_at:
      status === "complete" ? (ticketContext.resolved_at ?? ticketRow.updated_at ?? null) : null,
    resolution_note: ticketContext.resolution_note ?? null,
    is_read_only: channel.is_read_only,
    audio_policy: channel.audio_policy ?? "off",
    channel_name: channel.name ?? null,
    // engine_state lacks created_at; updated_at is a close proxy for "opened"
    // (set at insert, bumped on mutations — header relative-time reads fine).
    opened_at: ticketRow.updated_at ?? null,
  };

  // canResolve = assignee or admin. The requester-only viewer cannot resolve.
  const canResolve = isAssignee || isAdmin;

  return (
    <TicketConversationView
      ticket={ticket}
      profileId={profile.profile_id}
      currentUserName={profile.display_name ?? "kollega"}
      canResolve={canResolve}
    />
  );
}
