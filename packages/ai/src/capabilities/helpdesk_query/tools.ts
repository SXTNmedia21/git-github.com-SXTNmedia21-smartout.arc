// packages/ai/src/capabilities/helpdesk_query/tools.ts
// ADR-0161 + ADR-0162: ticket = engine_state running helpdesk_query_lifecycle.
// Conversation = linked channel. Desk = channel_type='desk' + responsible_profile_id.
// Tools drive the mutations between wait_for_event anchors in the engine_process.

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * open_ticket
 * Creates a conversation channel (query thread), spawns an engine_state
 * running helpdesk_query_lifecycle, and emits helpdesk.query.opened.
 * The channel_event projection trigger (ADR-0160) fans the event into
 * Komm UI automatically via the whitelist on event_type LIKE 'helpdesk.%'.
 */
export const openTicket = defineTool({
  name: "open_ticket",
  description:
    "Open a new helpdesk query on a desk. Creates the conversation channel, spawns the ticket state, and notifies the desk's responsible representative.",
  capability: "helpdesk_query",
  schema: z.object({
    desk_channel_id: z.string().uuid().describe("The desk channel to route the query to"),
    summary: z.string().min(3).max(200).describe("Short summary of the query"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // 1. Verify desk exists and has a responsible owner
    const { data: desk, error: deskErr } = await supabase
      .from("channel")
      .select("id, workspace_id, channel_type, responsible_profile_id, name")
      .eq("id", params.desk_channel_id)
      .single();

    if (deskErr || !desk) {
      return "Desk not found.";
    }
    if (desk.channel_type !== "desk") {
      return "Target channel is not a desk.";
    }
    if (desk.workspace_id !== ctx.workspaceId) {
      return "Desk belongs to a different workspace.";
    }
    if (!desk.responsible_profile_id) {
      return "Desk has no responsible representative — cannot route query.";
    }

    // 2. Create the conversation thread. channel_type='query_thread'
    //    (migration 20260515130400) keeps helpdesk threads out of the
    //    generic Kanaler sidebar — they belong under desks, not alongside
    //    user-created custom channels.
    const { data: thread, error: threadErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: ctx.workspaceId,
        channel_type: "query_thread",
        name: `Henvendelse: ${params.summary.slice(0, 60)}`,
        description: `Helpdesk-tråd på ${desk.name ?? "desk"}`,
        created_by: ctx.profileId,
      })
      .select("id")
      .single();

    if (threadErr || !thread) {
      return `Failed to create conversation thread: ${threadErr?.message ?? "unknown"}`;
    }

    // 3. Add requester + representative as channel members
    await supabase.from("channel_member").insert([
      {
        channel_id: thread.id,
        workspace_id: ctx.workspaceId,
        profile_id: ctx.profileId,
        role: "member",
      },
      {
        channel_id: thread.id,
        workspace_id: ctx.workspaceId,
        profile_id: desk.responsible_profile_id,
        role: "representative",
      },
    ]);

    // 4. Spawn engine_state (the ticket itself per ADR-0161)
    const { data: state, error: stateErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: ctx.workspaceId,
        entity_type: "channel",
        entity_id: thread.id,
        status: "waiting",
        current_step: 1,
        assignee_id: desk.responsible_profile_id,
        context: {
          desk_channel_id: params.desk_channel_id,
          requester_profile_id: ctx.profileId,
          summary: params.summary,
        },
      })
      .select("id")
      .single();

    if (stateErr || !state) {
      return `Failed to spawn ticket state: ${stateErr?.message ?? "unknown"}`;
    }

    // 5. Emit — the channel_event projection (ADR-0160) fans this to
    //    channel_event automatically via whitelist on 'helpdesk.%'.
    await emit({
      event: "helpdesk.query.opened",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "engine_state",
        entity_id: state.id,
        entity_label: params.summary,
      },
      properties: {
        channel_id: thread.id,
        desk_channel_id: params.desk_channel_id,
        assignee_profile_id: desk.responsible_profile_id,
        origin_type: ctx.channel === "voice" ? "voice" : "chat",
      },
    });

    return JSON.stringify({
      ticket_id: state.id,
      channel_id: thread.id,
      assignee_profile_id: desk.responsible_profile_id,
    });
  },
});

/**
 * list_my_queue
 * Returns active tickets assigned to the current user (as representative).
 */
export const listMyQueue = defineTool({
  name: "list_my_queue",
  description:
    "List open helpdesk tickets assigned to the current user. Returns up to 50 tickets ordered by age.",
  capability: "helpdesk_query",
  schema: z.object({
    limit: z.number().min(1).max(50).optional().default(20),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("engine_state")
      .select("id, entity_id, status, current_step, context, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .eq("assignee_id", ctx.profileId)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(params.limit);

    if (error) {
      return `Error: ${error.message}`;
    }

    return JSON.stringify({
      count: data?.length ?? 0,
      tickets: (data ?? []).map((row) => ({
        ticket_id: row.id,
        channel_id: row.entity_id,
        status: row.status,
        summary: (row.context as { summary?: string })?.summary ?? null,
        opened_at: row.created_at,
      })),
    });
  },
});

/**
 * get_ticket
 * Read one ticket by id, including its linked channel and requester.
 */
export const getTicket = defineTool({
  name: "get_ticket",
  description: "Fetch a helpdesk ticket by id — status, assignee, conversation channel, summary.",
  capability: "helpdesk_query",
  schema: z.object({
    ticket_id: z.string().uuid(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("engine_state")
      .select("id, entity_id, status, assignee_id, context, created_at, updated_at")
      .eq("id", params.ticket_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .single();

    if (error || !data) {
      return "Ticket not found.";
    }

    const context =
      (data.context as {
        summary?: string;
        desk_channel_id?: string;
        requester_profile_id?: string;
      }) || {};

    return JSON.stringify({
      ticket_id: data.id,
      channel_id: data.entity_id,
      status: data.status,
      assignee_profile_id: data.assignee_id,
      requester_profile_id: context.requester_profile_id ?? null,
      desk_channel_id: context.desk_channel_id ?? null,
      summary: context.summary ?? null,
      opened_at: data.created_at,
      updated_at: data.updated_at,
    });
  },
});

/**
 * resolve_ticket
 * Marks the ticket complete and emits helpdesk.query.resolved.
 * Only the current assignee, an admin, or the desk's responsible profile
 * may resolve. RLS enforces workspace isolation on engine_state.
 */
export const resolveTicket = defineTool({
  name: "resolve_ticket",
  description:
    "Mark a helpdesk ticket as resolved. Closes the engine_state and emits helpdesk.query.resolved. Only the assignee (or an admin) may resolve.",
  capability: "helpdesk_query",
  schema: z.object({
    ticket_id: z.string().uuid(),
    resolution_note: z
      .string()
      .max(500)
      .optional()
      .describe("Optional short note describing how the query was resolved"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Fetch + authorize
    const { data: ticket, error: fetchErr } = await supabase
      .from("engine_state")
      .select("id, workspace_id, entity_id, assignee_id, status, context")
      .eq("id", params.ticket_id)
      .eq("process_id", "helpdesk_query_lifecycle")
      .single();

    if (fetchErr || !ticket) {
      return "Ticket not found.";
    }
    if (ticket.workspace_id !== ctx.workspaceId) {
      return "Ticket belongs to a different workspace.";
    }
    if (ticket.status === "complete") {
      return "Ticket is already resolved.";
    }

    // Authorization: assignee OR admin/owner in the ticket workspace's company.
    // Representative-role authorization via channel_member is deferred to Phase 2
    // (currently reps that aren't also the assignee cannot resolve — document this
    // boundary if/when reassignment is implemented).
    if (ticket.assignee_id !== ctx.profileId) {
      // Hard-fail on missing session user — silent empty-string match would
      // grant admin to nobody but looks like a valid "not admin" result,
      // confusing the caller. Explicit error instead.
      if (!ctx.userId) {
        return "Cannot authorize admin override — session has no user identity.";
      }

      // Scope admin lookup to the ticket's workspace's company. Without this
      // scope, a user who is admin in Company A could resolve tickets in
      // Workspace Y owned by Company B (cross-tenant privilege escalation).
      const { data: workspace, error: workspaceErr } = await supabase
        .from("workspace")
        .select("company_id")
        .eq("workspace_id", ticket.workspace_id)
        .single();

      if (workspaceErr || !workspace?.company_id) {
        return "Failed to resolve ticket workspace — cannot authorize admin override.";
      }

      const { data: adminCheck } = await supabase
        .from("company_member")
        .select("role")
        .eq("user_id", ctx.userId)
        .eq("company_id", workspace.company_id)
        .maybeSingle();

      const isAdmin = adminCheck?.role === "owner" || adminCheck?.role === "admin";
      if (!isAdmin) {
        return "Only the assignee or an admin may resolve this ticket.";
      }
    }

    // Update engine_state → complete
    const nextContext = {
      ...(ticket.context as Record<string, unknown>),
      resolution_note: params.resolution_note ?? null,
      resolved_at: new Date().toISOString(),
      resolved_by: ctx.profileId,
    };

    const { error: updateErr } = await supabase
      .from("engine_state")
      .update({
        status: "complete",
        context: nextContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.ticket_id);

    if (updateErr) {
      return `Failed to resolve ticket: ${updateErr.message}`;
    }

    // Emit — channel_event projection picks this up for Komm UI.
    // ticket.entity_id is the conversation channel (ADR-0161 ontology).
    await emit({
      event: "helpdesk.query.resolved",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "engine_state",
        entity_id: params.ticket_id,
        entity_label: "helpdesk ticket",
      },
      properties: {
        channel_id: ticket.entity_id ?? "",
        has_resolution_note: Boolean(params.resolution_note),
      },
    });

    return JSON.stringify({ resolved: true, ticket_id: params.ticket_id });
  },
});
