/**
 * use-resolve-ticket.ts — Mark a helpdesk ticket as resolved.
 *
 * Mirrors the authorization of the helpdesk_query.resolve_ticket
 * capability tool exactly: assignee OR admin in the ticket's workspace
 * company. Direct Supabase write because the capability tool is driven
 * by the AI router; calling it from a UI mutation would blur the agent
 * authority boundary.
 *
 * Emits helpdesk.query.resolved via the mobile telemetry helper (ADR-0134).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { emit } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";

type Input = {
  ticket_id: string;
  channel_id: string;
  resolution_note?: string;
};

type Result = { ok: true } | { ok: false; error: string };

async function resolve(input: Input): Promise<Result> {
  const ctx = await getProfileContext();
  // getProfileContext throws on missing identity — reach here only with
  // a valid profile in an active workspace. Need the raw user id too for
  // the cross-tenant-safe admin-override lookup (company_member.user_id).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const userId = user.id;

  const { data: ticket } = await supabase
    .from("engine_state")
    .select("id, workspace_id, assignee_id, status, context")
    .eq("id", input.ticket_id)
    .eq("process_id", "helpdesk_query_lifecycle")
    .maybeSingle();

  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Ticket belongs to a different workspace." };
  }
  if (ticket.status === "complete") {
    return { ok: false, error: "Ticket is already resolved." };
  }

  if (ticket.assignee_id !== ctx.profileId) {
    // Admin override — cross-tenant safe via workspace → company_id join.
    const { data: workspace } = await supabase
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", ticket.workspace_id)
      .single();
    if (!workspace?.company_id) {
      return { ok: false, error: "Kunne ikke slå opp selskap for saken." };
    }
    const { data: member } = await supabase
      .from("company_member")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", workspace.company_id)
      .maybeSingle();
    const isAdmin = member?.role === "owner" || member?.role === "admin";
    if (!isAdmin) {
      return { ok: false, error: "Bare ansvarlig eller administrator kan løse saken." };
    }
  }

  const nextContext = {
    ...(ticket.context as Record<string, unknown>),
    resolution_note: input.resolution_note ?? null,
    resolved_at: new Date().toISOString(),
    resolved_by: ctx.profileId,
  };
  // completed_at mirrors engine-dispatch/index.ts — every terminal transition
  // to 'complete' must stamp completed_at or SLA/reporting queries drop this
  // ticket off the timeline.
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("engine_state")
    .update({
      status: "complete",
      context: nextContext,
      updated_at: nowIso,
      completed_at: nowIso,
    })
    .eq("id", input.ticket_id);
  if (error) return { ok: false, error: error.message };

  await emit({
    event: "helpdesk.query.resolved",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "engine_state",
      entity_id: input.ticket_id,
      entity_label: "helpdesk ticket",
    },
    properties: {
      channel_id: input.channel_id,
      has_resolution_note: Boolean(input.resolution_note),
    },
  });

  return { ok: true };
}

export function useResolveTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolve,
    onSuccess: (result, variables) => {
      if (result.ok) {
        void qc.invalidateQueries({ queryKey: ["helpdesk", "queue"] });
        void qc.invalidateQueries({
          queryKey: ["helpdesk", "ticket", undefined, variables.channel_id],
          exact: false,
        });
      }
    },
  });
}
