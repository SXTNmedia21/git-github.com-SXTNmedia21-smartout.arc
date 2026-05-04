"use server";

/**
 * open-helpdesk-ticket-action.ts — Panic Bar → helpdesk ticket (G3 merge-blocker).
 *
 * Wires the Tier 0 Panic Bar buttons to the existing helpdesk infrastructure
 * so that every ticket creation goes through the canonical
 * `helpdesk_query_lifecycle` engine_state — never a raw insert.
 *
 * Architecture:
 *   - Mirrors the pattern in komm/thread/[channelId]/_actions/resolve-ticket.ts:
 *     capability tool logic is re-implemented here, NOT called directly.
 *     Capability tools expect an AgentToolContext from the agent-router; a
 *     Server Action is a different call path. Both paths emit the same
 *     telemetry events (L-0094 parity requirement).
 *   - Uses `gateAction` RPC per ADR-0099 (gate_action mandatory for mutations).
 *   - `helpdesk_query.openTicket` authority must be seeded with the same
 *     capability string as the capability tool (helpdesk_query).
 *   - Emits `help.escalated_to_ticket` (ADR-0219 spec §Telemetry) AND
 *     `helpdesk.query.opened` (reuse canonical event, mirrors tools.ts).
 *   - Channel guard: channel='system' — Server Actions have no voice or chat
 *     channel in the ADR-0078 sense; 'system' is the correct value for
 *     programmatic mutations (mirrors existing Server Actions in _actions/).
 *
 * Error shape: { ok: false; error: string } on validation / auth / DB errors.
 * Success shape: { ok: true; ticket_id: string; channel_id: string }.
 *
 * G3 merge-blocker (design spec §Trust Gate):
 *   Panic bar must never side-channel insert. This action is the ONLY path
 *   from PanicBar to the DB; it routes through gate_action + engine_state
 *   insert so both activity_trail AND engine_event receive the event.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction } from "@/app/dashboard/_actions/_shared";

// ── Input schema ──────────────────────────────────────────────────────────

const InputSchema = z.object({
  /** The helpdesk-enabled channel to route the query to. */
  desk_channel_id: z.string().uuid("desk_channel_id must be a valid UUID"),
  /**
   * Short summary shown to the rep in Min Kø. The Panic Bar derives this
   * from the button label + user display_name so the rep has immediate context.
   */
  summary: z.string().min(3).max(200),
  /**
   * Category tag for `help.escalated_to_ticket` telemetry. Maps 1:1 to the
   * three Panic Bar button labels.
   */
  panic_category: z.enum(["locked_out", "shift_wrong", "human"]),
});

export type OpenHelpdeskTicketInput = z.infer<typeof InputSchema>;

export type OpenHelpdeskTicketResult =
  | { ok: true; ticket_id: string; channel_id: string }
  | { ok: false; error: string };

// ── Action ────────────────────────────────────────────────────────────────

export async function openHelpdeskTicketAction(
  input: OpenHelpdeskTicketInput,
): Promise<OpenHelpdeskTicketResult> {
  // 1. Validate input
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Ugyldig input.",
    };
  }
  const { desk_channel_id, summary, panic_category } = parsed.data;

  // 2. Authenticate — re-derive profile from session; never trust body params.
  //    Uses the JWT-scoped client: profile lookup via RLS guarantees the caller
  //    can only see their own active profile in their workspace.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke autentisert." };

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!profile) return { ok: false, error: "Ingen aktiv profil." };

  const { profileId, workspaceId } = {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };

  // 3. Authority gate — ADR-0099 + G3 merge-blocker.
  //    channel='system': Server Actions are programmatic mutations, not chat/voice.
  //    capability='helpdesk_query', action_type='create': mirrors the tool's
  //    authority seed row (authority seed: helpdesk_query / create, confirm role).
  const gate = await gateAction({
    workspaceId,
    capability: "helpdesk_query",
    channel: "system",
    actorProfileId: profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: gate.reason ?? "Du har ikke tilgang til å opprette helpdesk-sak.",
    };
  }

  // 4. Verify the helpdesk channel exists + belongs to this workspace.
  //    Mirrors open_ticket tool validation logic (tools.ts:57-68).
  //    Uses admin client for consistent read — RLS on 'channel' may require
  //    channel_member row; at panic-bar invocation the user may not yet be a
  //    member (that's the point — they need help).
  const admin = createAdminClient();
  const { data: desk, error: deskErr } = await admin
    .from("channel")
    .select(
      "id, workspace_id, channel_type, helpdesk_enabled, privacy_mode, responsible_profile_id, name",
    )
    .eq("id", desk_channel_id)
    .single();

  if (deskErr || !desk) {
    return { ok: false, error: "Skranke ikke funnet." };
  }
  const isHelpdesk = desk.helpdesk_enabled === true || desk.channel_type === "desk";
  if (!isHelpdesk) {
    return { ok: false, error: "Kanalen er ikke en helpdesk-skranke." };
  }
  if (desk.workspace_id !== workspaceId) {
    return { ok: false, error: "Skranke tilhører et annet workspace." };
  }
  if (!desk.responsible_profile_id) {
    return {
      ok: false,
      error: "Skranken har ingen ansvarlig representant — kan ikke rute henvendelsen.",
    };
  }

  // 5. Branch on privacy_mode — mirrors tools.ts open_ticket branching.
  //    Panic Bar always creates a PRIVATE ticket (query_thread sub-channel)
  //    because panic scenarios almost always carry sensitive context.
  //    Public-mode desks fall through to the standard private path on panic
  //    to preserve confidentiality regardless of the channel's default.
  const isPublic = desk.privacy_mode === "public";
  let conversationChannelId: string;

  if (isPublic) {
    // Public-mode desk: use the helpdesk channel itself as the conversation
    // (ADR-0165 Rule 4). Panic bar does not insert any message here —
    // the PanicBar confirmation drawer carries the user's summary text.
    conversationChannelId = desk.id;
  } else {
    // Private-mode desk (or NULL privacy_mode — treat as private per
    // tools.ts legacy fallback): spawn a query_thread sub-channel.
    const { data: thread, error: threadErr } = await admin
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "query_thread",
        name: `Panikk: ${summary.slice(0, 60)}`,
        description: `Helpdesk-tråd via Panikk-knapp på ${desk.name ?? "skranke"}`,
        created_by: profileId,
      })
      .select("id")
      .single();

    if (threadErr || !thread) {
      return {
        ok: false,
        error: `Kunne ikke opprette samtaletråd: ${threadErr?.message ?? "ukjent feil"}`,
      };
    }

    await admin.from("channel_member").insert([
      {
        channel_id: thread.id,
        workspace_id: workspaceId,
        profile_id: profileId,
        role: "member",
      },
      {
        channel_id: thread.id,
        workspace_id: workspaceId,
        profile_id: desk.responsible_profile_id,
        role: "representative",
      },
    ]);

    conversationChannelId = thread.id;
  }

  // 6. Spawn engine_state — the ticket itself per ADR-0161.
  //    entity_id resolves per the branch above (unified ontology, ADR-0165 Rule 4).
  //    context.desk_channel_id always points at the helpdesk channel so Min Kø
  //    grouping queries have a single key even in public mode.
  const { data: state, error: stateErr } = await admin
    .from("engine_state")
    .insert({
      process_id: "helpdesk_query_lifecycle",
      workspace_id: workspaceId,
      entity_type: "channel",
      entity_id: conversationChannelId,
      status: "waiting",
      current_step: 1,
      assignee_id: desk.responsible_profile_id,
      context: {
        desk_channel_id,
        requester_profile_id: profileId,
        summary,
        panic_category,
      },
    })
    .select("id")
    .single();

  if (stateErr || !state) {
    return {
      ok: false,
      error: `Kunne ikke opprette helpdesk-sak: ${stateErr?.message ?? "ukjent feil"}`,
    };
  }

  // 7. Emit — two events required by spec §Telemetry + L-0094 parity.
  //    a) helpdesk.query.opened: canonical event, mirrors tools.ts emit.
  //       Feeds channel_event projection (ADR-0160) → Komm UI.
  //    b) help.escalated_to_ticket: new help-hub event (ADR-0219).
  //       Routes to activity_trail + engine_event per registry.ts routing.
  await emit({
    event: "helpdesk.query.opened",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    entity: {
      entity_type: "engine_state",
      entity_id: state.id,
      entity_label: summary,
    },
    properties: {
      channel_id: conversationChannelId,
      desk_channel_id,
      assignee_profile_id: desk.responsible_profile_id,
      // origin_type accepts "chat" | "voice" per registry.ts; panic bar is
      // a web UI action (not voice), so "chat" is the correct discriminator.
      origin_type: "chat",
      requester_profile_id: profileId,
      summary,
    },
  });

  await emit({
    event: "help.escalated_to_ticket",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    entity: {
      entity_type: "profile",
      entity_id: profileId,
      entity_label: "panic bar escalation",
    },
    properties: {
      ticket_id: state.id,
      panic_category,
    },
  });

  revalidatePath("/dashboard/help");

  return { ok: true, ticket_id: state.id, channel_id: conversationChannelId };
}
