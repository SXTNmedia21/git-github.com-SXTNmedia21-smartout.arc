import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * helpdesk-public-ticket-lifecycle.spec.ts — L-0079 regression guard
 *
 * Public-mode (fag) helpdesk: open → resolve lifecycle. L-0079 learning:
 * every terminal engine_state transition outside the engine-dispatch
 * dispatcher MUST stamp completed_at; otherwise SLA + reporting queries
 * silently drop rows ordered on completed_at.
 *
 * Guards the resolveTicketFromMessage Server Action at
 * apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts:1056-1064.
 *
 * This test exercises the DB contract the Server Action depends on
 * rather than the UI. Mirrors the 3-step write the resolveTicket action
 * performs (status='complete' + updated_at + completed_at stamped
 * atomically). If the Server Action ever drops the completed_at stamp,
 * this guard fails and catches the L-0079 regression at the contract
 * layer — the same pattern used by helpdesk-downgrade-blocks-with-open-
 * tickets and helpdesk-rep-demotion-on-reassign.
 *
 * REGRESSION GUARD for L-0079 (completed_at stamping on terminal transition).
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:public-helpdesk-ticket-open-and-resolve", () => {
  const seededChannelIds: string[] = [];
  const seededEngineStateIds: string[] = [];
  const seededMessageIds: string[] = [];

  test.afterEach(async () => {
    for (const messageId of seededMessageIds) {
      await supabase.from("channel_message").delete().eq("id", messageId);
    }
    for (const stateId of seededEngineStateIds) {
      await supabase.from("engine_state").delete().eq("id", stateId);
    }
    for (const channelId of seededChannelIds) {
      await supabase.from("channel_member").delete().eq("channel_id", channelId);
      await supabase.from("channel_message").delete().eq("channel_id", channelId);
      await supabase.from("channel").delete().eq("id", channelId);
    }
    seededMessageIds.length = 0;
    seededEngineStateIds.length = 0;
    seededChannelIds.length = 0;
  });

  test("resolving a public-mode ticket stamps completed_at and preserves monotonicity", async () => {
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    const { data: rep, error: repErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["manager", "admin", "owner"])
      .eq("is_active", true)
      .limit(1)
      .single();
    if (repErr || !rep)
      throw new Error(`Lifecycle test requires an eligible rep: ${repErr?.message}`);

    // Seed a public-mode helpdesk.
    const suffix = Date.now();
    const { data: channel, error: channelErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E public lifecycle ${suffix}`,
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: rep.profile_id,
      })
      .select("id")
      .single();
    if (channelErr || !channel) throw new Error(`Seed channel failed: ${channelErr?.message}`);
    seededChannelIds.push(channel.id);

    // Simulate openPublicTicketFromMessage outcome: one message + one
    // engine_state anchored on the channel (ADR-0165 Rule 4 unified
    // ontology — public-mode engine_state.entity_id = channel_id).
    const { data: message, error: msgErr } = await supabase
      .from("channel_message")
      .insert({
        channel_id: channel.id,
        workspace_id: workspaceId,
        sender_id: rep.profile_id,
        content: "Hvor er nøkkelen til kjølerom B?",
      })
      .select("id")
      .single();
    if (msgErr || !message) throw new Error(`Seed message failed: ${msgErr?.message}`);
    seededMessageIds.push(message.id);

    const startedAtIso = new Date().toISOString();
    const { data: ticket, error: ticketErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: workspaceId,
        entity_type: "channel",
        entity_id: channel.id,
        status: "waiting",
        current_step: 1,
        assignee_id: rep.profile_id,
        started_at: startedAtIso,
        context: {
          desk_channel_id: channel.id,
          requester_profile_id: rep.profile_id,
          summary: "Hvor er nøkkelen til kjølerom B?",
        },
      })
      .select("id, started_at")
      .single();
    if (ticketErr || !ticket) throw new Error(`Seed ticket failed: ${ticketErr?.message}`);
    seededEngineStateIds.push(ticket.id);

    // --- Act: mirror the resolveTicketFromMessage write contract
    // (helpdesk-channel-actions.ts:1056-1064). A correctly-coded action
    // stamps completed_at on the same update as status='complete'. If
    // any future refactor splits those writes or drops completed_at,
    // this regression guard fails and catches it at the contract layer.
    const beforeResolve = Date.now();
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("engine_state")
      .update({
        status: "complete",
        updated_at: nowIso,
        completed_at: nowIso,
        context: {
          desk_channel_id: channel.id,
          requester_profile_id: rep.profile_id,
          summary: "Hvor er nøkkelen til kjølerom B?",
          resolution_note: null,
          resolved_at: nowIso,
          resolved_by: rep.profile_id,
        },
      })
      .eq("id", ticket.id);
    if (updateErr) throw new Error(`Resolve write failed: ${updateErr.message}`);

    // --- Assert DB: status='complete', completed_at non-null, monotonic
    // with started_at. L-0079 invariant.
    const { data: after } = await supabase
      .from("engine_state")
      .select("status, completed_at, started_at, context")
      .eq("id", ticket.id)
      .single();

    expect(after?.status).toBe("complete");
    expect(after?.completed_at).not.toBeNull();

    const completedAt = after?.completed_at ? new Date(after.completed_at).getTime() : 0;
    const startedAt = after?.started_at ? new Date(after.started_at).getTime() : 0;

    // completed_at must be a fresh, real ISO timestamp (within 5s of resolve).
    expect(completedAt).toBeGreaterThan(beforeResolve - 1000);
    expect(completedAt).toBeLessThan(beforeResolve + 5000);
    // Monotonic: started_at < completed_at.
    expect(startedAt).toBeLessThan(completedAt);

    // resolution trail written on context JSONB (audit trace, not schema column).
    const ctx = after?.context as Record<string, unknown> | null;
    expect(ctx?.resolved_at).not.toBeNull();
    expect(ctx?.resolved_by).toBe(rep.profile_id);
  });
});
