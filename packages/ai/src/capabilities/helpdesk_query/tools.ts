// packages/ai/src/capabilities/helpdesk_query/tools.ts
// ADR-0161 + ADR-0162 + ADR-0165: ticket = engine_state running helpdesk_query_lifecycle.
// Conversation = linked channel. Helpdesk = channel with helpdesk_enabled=true
// (progressive flag per ADR-0165 — replaces the Phase 1 channel_type='desk' model).
// Tools drive the mutations between wait_for_event anchors in the engine_process.
//
// Public vs private mode branch (ADR-0165 Rule 2):
//   - privacy_mode='public'                → ticket conversation IS the helpdesk
//                                            channel itself. engine_state.entity_id
//                                            = helpdesk channel id. No sub-channel.
//   - privacy_mode='private_per_requester' → spawn a query_thread sub-channel,
//                                            requester + rep only, engine_state
//                                            .entity_id = sub_channel.id. This
//                                            mirrors the Phase 1 flow.

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * open_ticket
 * Creates (or reuses) the conversation channel and spawns an engine_state
 * running helpdesk_query_lifecycle. Branches on privacy_mode:
 *   - public  → conversation = the helpdesk channel itself.
 *   - private → conversation = freshly spawned query_thread sub-channel.
 * Emits helpdesk.query.opened. The channel_event projection trigger
 * (ADR-0160) fans the event into Komm UI via the 'helpdesk.%' whitelist.
 */
export const openTicket = defineTool({
  name: "open_ticket",
  description:
    "Open a new helpdesk query. For public-mode helpdesks the conversation stays in the same channel; for private-mode helpdesks a new sub-channel is spawned. Either way an engine_state is created and the responsible rep is notified.",
  capability: "helpdesk_query",
  schema: z.object({
    desk_channel_id: z
      .string()
      .uuid()
      .describe("The helpdesk-enabled channel to route the query to (parent for private mode)"),
    summary: z.string().min(3).max(200).describe("Short summary of the query"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // 1. Verify the helpdesk is well-formed. Helpdesk-ness keyed off the
    //    flag (ADR-0165 Rule 1) — the legacy channel_type='desk' enum is
    //    deprecated-not-dropped, so accept BOTH shapes to cover the
    //    backfill window + future channels that never had that enum.
    const { data: desk, error: deskErr } = await supabase
      .from("channel")
      .select(
        "id, workspace_id, channel_type, helpdesk_enabled, privacy_mode, responsible_profile_id, name",
      )
      .eq("id", params.desk_channel_id)
      .single();

    if (deskErr || !desk) {
      return "Desk not found.";
    }
    const isHelpdesk = desk.helpdesk_enabled === true || desk.channel_type === "desk";
    if (!isHelpdesk) {
      return "Target channel is not a helpdesk.";
    }
    if (desk.workspace_id !== ctx.workspaceId) {
      return "Desk belongs to a different workspace.";
    }
    if (!desk.responsible_profile_id) {
      return "Desk has no responsible representative — cannot route query.";
    }

    // ADR-0165 Rule 4 — unified entity ontology. Which channel the engine_state
    // anchors on depends on privacy mode:
    //   - 'public'                → the helpdesk channel itself (no sub-channel).
    //   - 'private_per_requester' → spawn a query_thread sub-channel.
    // Legacy 'desk' rows with NULL privacy_mode (pre-backfill window) default
    // to the private path (matches Phase 1 behavior; backfill sets 'private
    // _per_requester' explicitly so this branch only fires on rollback).
    const isPublic = desk.privacy_mode === "public";
    let conversationChannelId: string;

    if (isPublic) {
      // Public mode — reuse the helpdesk channel as the conversation. The
      // first message (sent by the requester through the UI compose path,
      // NOT this tool) is the "opening post" discoverable via MIN(created_at)
      // per L-0088. This tool doesn't insert any message — the caller
      // already posted via openPublicTicketFromMessage Server Action.
      conversationChannelId = desk.id;
    } else {
      // Private mode — spawn a fresh query_thread sub-channel with
      // requester + rep as the only members.
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

      conversationChannelId = thread.id;
    }

    // 3. Emit helpdesk.query.opened — the engine_trigger row (ADR-0161,
    //    migration 20260518230000) maps this event to helpdesk_query_lifecycle.
    //    The dispatcher owns engine_state spawn; this tool does NOT insert
    //    engine_state directly (single-spawn contract per ADR-0161).
    //
    //    entity: channel ontology (ADR-0165 Rule 4) — dispatcher sets
    //    engine_state.entity_type='channel' + entity_id=conversationChannelId.
    //    Properties carry all context the dispatcher needs to build the
    //    state context (summary, desk_channel_id, requester_profile_id,
    //    assignee_profile_id). engine-event.ts promotes entity_type/entity_id
    //    and assignee_id to the top of the dispatch payload.
    const emitTimestamp = new Date().toISOString();
    await emit({
      event: "helpdesk.query.opened",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "channel",
        entity_id: conversationChannelId,
        entity_label: params.summary,
      },
      properties: {
        channel_id: conversationChannelId,
        desk_channel_id: params.desk_channel_id,
        assignee_profile_id: desk.responsible_profile_id,
        requester_profile_id: ctx.profileId,
        summary: params.summary,
        origin_type: ctx.channel === "voice" ? "voice" : "chat",
      },
    });

    // 4. Fetch back the dispatcher-spawned state. The Edge Function runs
    //    synchronously in the same request but there may be a brief lag
    //    in dev or under load. Retry up to 3 times with 100ms between.
    //    Match on (workspace_id, process_id, entity_id, started_at >= emit).
    let state: { id: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const { data } = await supabase
        .from("engine_state")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("entity_id", conversationChannelId)
        .gte("started_at", emitTimestamp)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        state = data;
        break;
      }
    }

    if (!state) {
      // Dispatcher spawn is async in dev — return a best-effort response.
      // The ticket IS opening (event emitted + trigger wired). Callers that
      // need an immediate ticket_id should retry via list_my_queue.
      return JSON.stringify({
        ticket_id: null,
        channel_id: conversationChannelId,
        assignee_profile_id: desk.responsible_profile_id,
        note: "Ticket is opening — id available via list_my_queue within seconds.",
      });
    }

    return JSON.stringify({
      ticket_id: state.id,
      channel_id: conversationChannelId,
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
      .select("id, entity_id, status, current_step, context, started_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .eq("assignee_id", ctx.profileId)
      .in("status", ["waiting", "active"])
      .order("started_at", { ascending: false })
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
        opened_at: row.started_at,
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
      .select("id, entity_id, status, assignee_id, context, started_at, updated_at")
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
      opened_at: data.started_at,
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

    // Update engine_state → complete. L-0079 — completed_at MUST stamp on
    // every terminal transition outside engine-dispatch (the dispatcher is
    // the authoritative writer for this column). Skipping it causes SLA +
    // reporting queries that order on completed_at to silently drop UI-
    // and capability-resolved rows. Mirror the dispatcher's column set.
    const nowIso = new Date().toISOString();
    const nextContext = {
      ...(ticket.context as Record<string, unknown>),
      resolution_note: params.resolution_note ?? null,
      resolved_at: nowIso,
      resolved_by: ctx.profileId,
    };

    const { error: updateErr } = await supabase
      .from("engine_state")
      .update({
        status: "complete",
        context: nextContext,
        updated_at: nowIso,
        completed_at: nowIso,
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
