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
import type { AgentToolContext, ProfileRole, SessionChannel } from "../types.js";
import { resolveObserver } from "./observer-resolver.js";
import { callGateAction } from "./gate.js";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

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

    // ADR-0134 / ADR-0151 — workspace_id + profile_id must resolve.
    if (!ctx.workspaceId || !ctx.profileId) {
      return "Error opening ticket: missing workspaceId or profileId (ADR-0134).";
    }

    // ADR-0099 / ADR-0186 mandatory C4 gate before mutation. Authority row
    // seeded by 20260515130300_helpdesk_query_authority_seed.sql; fail-
    // closed on denial OR RPC error.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "helpdesk_query",
      channel: normaliseChannel(ctx.channel),
      actionType: "open_ticket",
      entityId: params.desk_channel_id,
    });
    if (!gate.allow) {
      return JSON.stringify({
        error: "gate_denied",
        reason: gate.reason ?? "denied",
        adr: "ADR-0099",
      });
    }

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

    // ── 5. SLA breach trigger spawn (T9b — ADR-0235 / ADR-0233) ─────
    // Read authority config ONCE at spawn — snapshot semantics. Admin
    // changes to observer_escalation_hours after this point do NOT affect
    // the in-flight ticket. Failure here logs + skips SLA but never fails
    // openTicket — the ticket is the primary deliverable.
    try {
      await spawnSlaBreachTrigger({
        supabase,
        ctx,
        ticketStateId: state.id,
        deskChannelId: desk.id,
        responsibleProfileId: desk.responsible_profile_id,
      });
    } catch (err) {
      // Best-effort. Log + continue. Adding a `helpdesk.sla.setup_failed`
      // telemetry event was considered — kept as console.warn for now since
      // there is no operational dashboard / consumer for the signal yet.
      // If silent failures become invisible in production, register the
      // event in packages/telemetry/src/registry.ts and switch to emit().
      console.warn(
        JSON.stringify({
          tool: "open_ticket",
          warning: "sla_setup_failed",
          ticket_id: state.id,
          workspace_id: ctx.workspaceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return JSON.stringify({
      ticket_id: state.id,
      channel_id: conversationChannelId,
      assignee_profile_id: desk.responsible_profile_id,
    });
  },
});

/**
 * spawnSlaBreachTrigger — internal helper for openTicket (T9b).
 *
 * Codifies the SLA-spawn protocol per ADR-0235:
 *   1. Read engine_authority_config (snapshot semantics — admin edits after
 *      this point do NOT change in-flight tickets).
 *   2. Resolve the observer via the ADR-0233 proxy chain.
 *      If null → skip the trigger insert (fire-time would silently no-op
 *      against state.assignee_id=NULL — see migration step 2 dispatcher
 *      guard note in 20260429100000).
 *   3. Insert pre-canned engine_event with payload keys EXACTLY as the
 *      migration header documents:
 *        target_state_id  → dispatcher copies into spawned context
 *        assignee_id      → dispatcher copies into spawned engine_state
 *      Plus auxiliary fields read by downstream consumers.
 *   4. Look up the engine_trigger row for event_type='helpdesk.query.sla_breached'
 *      to satisfy the FK on engine_delayed_trigger.trigger_id.
 *   5. Insert engine_delayed_trigger with fire_at = NOW + hours * 3600s.
 *
 * Failures throw — caller catches + logs. Returns nothing on success.
 */
async function spawnSlaBreachTrigger(args: {
  supabase: AgentToolContext["supabaseAdmin"];
  ctx: AgentToolContext;
  ticketStateId: string;
  deskChannelId: string;
  responsibleProfileId: string;
}): Promise<void> {
  const { supabase, ctx, ticketStateId, deskChannelId, responsibleProfileId } = args;

  // 1. Authority snapshot — workspace + capability key.
  const { data: authority } = await supabase
    .from("engine_authority_config")
    .select("observer_escalation_hours, min_role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("capability", "helpdesk_query")
    .maybeSingle();

  const hours = (authority?.observer_escalation_hours as number | undefined) ?? null;
  const minRoleRaw = (authority?.min_role as string | undefined) ?? "manager";

  if (authority === null || hours === null || hours === undefined) {
    console.warn(
      JSON.stringify({
        tool: "open_ticket",
        sla: "skipped_missing_authority",
        workspace_id: ctx.workspaceId,
        capability: "helpdesk_query",
      }),
    );
    return;
  }

  // ProfileRole narrowing — engine_authority_config.min_role is TEXT;
  // unknown values default to 'manager' (matches authority seed default).
  const minRole: ProfileRole =
    minRoleRaw === "employee" ||
    minRoleRaw === "manager" ||
    minRoleRaw === "admin" ||
    minRoleRaw === "owner"
      ? minRoleRaw
      : "manager";

  // 2. Resolve observer via ADR-0233 proxy chain. null → silent SLA
  //    failure already loud (resolveObserver emits no_observer_resolved).
  //    Skip the trigger insert because dispatcher would no-op on missing
  //    assignee_id at step 2 (send_notification guard).
  const observer = await resolveObserver({
    workspaceId: ctx.workspaceId,
    repProfileId: responsibleProfileId,
    minRole,
    supabase,
    engineStateId: ticketStateId,
  });

  if (observer.observer_profile_id === null) {
    return;
  }

  // 3. Insert pre-canned engine_event. Payload keys MUST match the
  //    20260429100000 migration header contract — the dispatcher's spawn
  //    flow (engine-dispatch:341) copies payload fields into the spawned
  //    engine_state.context + assignee_id.
  //
  //    target_state_id → context.target_state_id → handler reads this
  //    assignee_id     → engine_state.assignee_id → step 2 recipient
  const breachPayload = {
    target_state_id: ticketStateId,
    assignee_id: observer.observer_profile_id,
    desk_channel_id: deskChannelId,
    responsible_profile_id: responsibleProfileId,
    origin_ticket_id: ticketStateId,
  };

  const { data: breachEvent, error: eventErr } = await supabase
    .from("engine_event")
    .insert({
      event_type: "helpdesk.query.sla_breached",
      workspace_id: ctx.workspaceId,
      payload: breachPayload,
    })
    .select("id")
    .single();

  if (eventErr || !breachEvent) {
    throw new Error(`failed to insert breach event: ${eventErr?.message ?? "unknown"}`);
  }

  // 4. Look up the trigger row id for the FK on engine_delayed_trigger.
  //    Seeded by 20260428130000 + repointed by 20260428222919 to
  //    helpdesk_sla_breach_handler.
  const { data: breachTrigger, error: trigErr } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "helpdesk.query.sla_breached")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (trigErr || !breachTrigger) {
    throw new Error(
      `failed to find engine_trigger for helpdesk.query.sla_breached: ${trigErr?.message ?? "no row"}`,
    );
  }

  // 5. Insert delayed trigger with snapshot fire_at.
  const fireAt = new Date(Date.now() + hours * 3600_000).toISOString();
  const { error: delayedErr } = await supabase.from("engine_delayed_trigger").insert({
    trigger_id: breachTrigger.id as string,
    event_id: breachEvent.id as string,
    workspace_id: ctx.workspaceId,
    fire_at: fireAt,
  });

  if (delayedErr) {
    throw new Error(`failed to insert delayed trigger: ${delayedErr.message}`);
  }
}

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

    // ADR-0134 / ADR-0151 — workspace_id + profile_id must resolve.
    if (!ctx.workspaceId || !ctx.profileId) {
      return "Error resolving ticket: missing workspaceId or profileId (ADR-0134).";
    }

    // ADR-0099 / ADR-0186 mandatory C4 gate before mutation. Authority row
    // seeded by 20260515130300_helpdesk_query_authority_seed.sql; fail-
    // closed. Custom assignee/admin authorization below is defence-in-
    // depth on top of the gate.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "helpdesk_query",
      channel: normaliseChannel(ctx.channel),
      actionType: "resolve_ticket",
      entityId: params.ticket_id,
    });
    if (!gate.allow) {
      return JSON.stringify({
        error: "gate_denied",
        reason: gate.reason ?? "denied",
        adr: "ADR-0099",
      });
    }

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

    // ── SLA trigger cancellation (T9c — ADR-0235) ──────────────────
    // Cancel any pending SLA breach trigger BEFORE emitting resolved.
    // Order matters: if cancellation runs after emit, a window exists
    // where fire-delayed-triggers could re-dispatch the breach event for
    // an already-resolved ticket.
    //
    // Lookup pattern: engine_event payload->>target_state_id matches the
    // ticket id (T9b convention), then update engine_delayed_trigger by
    // event_id. Cancellation is best-effort — failure here logs + falls
    // through to emit (the ticket IS resolved; missing cancellation
    // produces a noisy notification but never a wrong-ticket mutation).
    try {
      await cancelSlaBreachTrigger(supabase, ctx.workspaceId, params.ticket_id);
    } catch (err) {
      console.warn(
        JSON.stringify({
          tool: "resolve_ticket",
          warning: "sla_cancel_failed",
          ticket_id: params.ticket_id,
          workspace_id: ctx.workspaceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
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

/**
 * cancelSlaBreachTrigger — internal helper for resolveTicket (T9c).
 *
 * Per ADR-0235: when a ticket is resolved, find the pre-canned SLA
 * engine_event(s) tied to this ticket (matched by event_type +
 * payload->>target_state_id, the convention T9b uses) and cancel any
 * pending engine_delayed_trigger rows. Cancellation = `cancelled_at = NOW()`,
 * matching fire-delayed-triggers' "skip if cancelled" filter.
 *
 * Multiple breach events SHOULD be unique per ticket (T9b inserts exactly
 * one) but the query handles N defensively. Idempotent — re-running on a
 * resolved ticket is a no-op (filter `fired=false AND cancelled_at IS NULL`
 * matches nothing the second time around).
 */
async function cancelSlaBreachTrigger(
  supabase: AgentToolContext["supabaseAdmin"],
  workspaceId: string,
  ticketId: string,
): Promise<void> {
  const { data: breachEvents, error: lookupErr } = await supabase
    .from("engine_event")
    .select("id")
    .eq("event_type", "helpdesk.query.sla_breached")
    .eq("workspace_id", workspaceId)
    .filter("payload->>target_state_id", "eq", ticketId);

  if (lookupErr) {
    throw new Error(`failed to look up breach events: ${lookupErr.message}`);
  }

  if (!breachEvents || breachEvents.length === 0) {
    // No breach trigger was registered for this ticket — most likely
    // pre-T9 ticket OR SLA setup was skipped (no observer / missing
    // authority). Nothing to cancel.
    return;
  }

  const eventIds = breachEvents.map((e) => e.id as string);
  const { error: cancelErr } = await supabase
    .from("engine_delayed_trigger")
    .update({ cancelled_at: new Date().toISOString() })
    .in("event_id", eventIds)
    .eq("fired", false)
    .is("cancelled_at", null);

  if (cancelErr) {
    throw new Error(`failed to cancel delayed trigger: ${cancelErr.message}`);
  }
}
