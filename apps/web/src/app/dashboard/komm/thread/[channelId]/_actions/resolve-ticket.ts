"use server";

/**
 * resolve-ticket.ts — wraps the helpdesk_query resolve_ticket capability
 * tool behind a Server Action so the UI can call it without going through
 * the chat router.
 *
 * Authorization logic mirrors tools.ts/resolveTicket exactly (assignee OR
 * admin in the ticket's workspace company). Duplicated intentionally —
 * the capability tool is driven by the agent router and expects its own
 * gated invocation; we don't want to create a Server Action that calls
 * an agent tool as that would blur the agent authority boundary.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import type { Database } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

const resolveSchema = z.object({
  ticket_id: z.string().uuid(),
  resolution_note: z.string().max(500).optional(),
});

type ResolveResult = { ok: true } | { ok: false; error: string };

async function resolveProfile(
  supabase: Client,
): Promise<{ userId: string; profileId: string; workspaceId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!profile) return null;
  return { userId: user.id, profileId: profile.profile_id, workspaceId: profile.workspace_id };
}

export async function resolveTicketAction(
  input: z.infer<typeof resolveSchema>,
): Promise<ResolveResult> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const ctx = await resolveProfile(supabase);
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const { data: ticket } = await supabase
    .from("engine_state")
    .select("id, workspace_id, entity_id, assignee_id, status, context")
    .eq("id", parsed.data.ticket_id)
    .eq("process_id", "helpdesk_query_lifecycle")
    .maybeSingle();

  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.workspace_id !== ctx.workspaceId) {
    return { ok: false, error: "Ticket belongs to a different workspace." };
  }
  if (ticket.status === "complete") {
    return { ok: false, error: "Ticket is already resolved." };
  }

  // Authorization: assignee OR admin in the ticket's workspace's company
  // (mirrors resolve_ticket capability tool, cross-tenant-safe).
  if (ticket.assignee_id !== ctx.profileId) {
    const { data: workspace } = await supabase
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", ticket.workspace_id)
      .single();
    if (!workspace?.company_id) {
      return { ok: false, error: "Kunne ikke løse saken — workspace mangler company." };
    }
    const { data: member } = await supabase
      .from("company_member")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("company_id", workspace.company_id)
      .maybeSingle();
    const isAdmin = member?.role === "owner" || member?.role === "admin";
    if (!isAdmin) {
      return { ok: false, error: "Bare den ansvarlige eller en administrator kan løse saken." };
    }
  }

  const nextContext = {
    ...(ticket.context as Record<string, unknown>),
    resolution_note: parsed.data.resolution_note ?? null,
    resolved_at: new Date().toISOString(),
    resolved_by: ctx.profileId,
  };

  const { error: updateErr } = await supabase
    .from("engine_state")
    .update({ status: "complete", context: nextContext, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.ticket_id);

  if (updateErr) return { ok: false, error: updateErr.message };

  await emit({
    event: "helpdesk.query.resolved",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    entity: {
      entity_type: "engine_state",
      entity_id: parsed.data.ticket_id,
      entity_label: "helpdesk ticket",
    },
    properties: {
      channel_id: ticket.entity_id ?? "",
      has_resolution_note: Boolean(parsed.data.resolution_note),
    },
  });

  if (ticket.entity_id) {
    revalidatePath(`/dashboard/komm/thread/${ticket.entity_id}`);
  }

  return { ok: true };
}
