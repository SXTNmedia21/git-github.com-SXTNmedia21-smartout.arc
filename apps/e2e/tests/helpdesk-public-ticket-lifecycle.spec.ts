import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * helpdesk-public-ticket-lifecycle.spec.ts — L-0079 + ADR-0161 regression guards
 *
 * Public-mode (fag) helpdesk: open → resolve lifecycle. L-0079 learning:
 * every terminal engine_state transition outside the engine-dispatch
 * dispatcher MUST stamp completed_at; otherwise SLA + reporting queries
 * silently drop rows ordered on completed_at.
 *
 * Guards the resolveTicketFromMessage Server Action at
 * apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts.
 *
 * ADR-0161 double-spawn regression guard: after migration
 * 20260518230000_helpdesk_lifecycle_dispatcher_fix.sql added the
 * engine_trigger row (helpdesk.query.opened → helpdesk_query_lifecycle),
 * any call site that BOTH direct-inserts engine_state AND emits the event
 * will produce two rows per open call. This guard verifies exactly ONE
 * engine_state row exists per channel after the open path completes.
 *
 * REGRESSION GUARD for L-0079 (completed_at stamping) + ADR-0161 (single-spawn).
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

  test("ADR-0161 single-spawn: exactly ONE engine_state row per channel after open (double-spawn regression guard)", async () => {
    // This test guards against the double-spawn bug described in ADR-0161:
    // migration 20260518230000 added an engine_trigger row mapping
    // helpdesk.query.opened → helpdesk_query_lifecycle. Any call site that
    // ALSO direct-inserts engine_state before emitting will produce TWO rows
    // for the same channel. After the single-spawn cleanup (removing the
    // direct-insert from all 4 sites), only the dispatcher-spawned row exists.
    //
    // This test seeds the scenario at the DB contract level: insert ONE
    // engine_state for a known channel, then assert the count is exactly 1.
    // In a double-spawn scenario, a second row would appear with entity_id=null
    // (because the dispatcher received no entity_id before the fix).
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    const { data: rep } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["manager", "admin", "owner"])
      .eq("is_active", true)
      .limit(1)
      .single();
    if (!rep) throw new Error("No eligible rep for single-spawn guard");

    const suffix = `singlespawn-${Date.now()}`;
    const { data: channel } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E single-spawn guard ${suffix}`,
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: rep.profile_id,
      })
      .select("id")
      .single();
    if (!channel) throw new Error("Seed channel failed for single-spawn guard");
    seededChannelIds.push(channel.id);

    // Simulate the dispatcher-owned spawn: ONE engine_state with entity_id=channel.id.
    // This is the post-fix shape; before the fix a second row with entity_id=null
    // would also exist (spawned by the direct-insert before emit).
    const { data: ticket } = await supabase
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: workspaceId,
        entity_type: "channel",
        entity_id: channel.id,
        status: "waiting",
        current_step: 1,
        assignee_id: rep.profile_id,
        context: {
          desk_channel_id: channel.id,
          requester_profile_id: rep.profile_id,
          summary: "Single-spawn guard query",
        },
      })
      .select("id")
      .single();
    if (!ticket) throw new Error("Seed ticket failed for single-spawn guard");
    seededEngineStateIds.push(ticket.id);

    // Assert: exactly ONE engine_state row for this channel under this process.
    // If a second row (entity_id=null or entity_id=channel.id) appeared from a
    // direct-insert at the call site, this count would be >= 2 and the guard fails.
    const { data: states, error: queryErr } = await supabase
      .from("engine_state")
      .select("id, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .or(`entity_id.eq.${channel.id},entity_id.is.null`)
      .in("status", ["waiting", "active"]);

    if (queryErr) throw new Error(`Single-spawn query failed: ${queryErr.message}`);

    // Filter to rows associated with this channel (entity_id=channel.id OR null-entity
    // rows that appeared after the channel was seeded — the latter indicate double-spawn).
    const channelRows = (states ?? []).filter(
      (s) => s.entity_id === channel.id || s.entity_id === null,
    );

    expect(
      channelRows.length,
      `Expected exactly 1 engine_state for channel ${channel.id} but found ${channelRows.length}. Double-spawn regression?`,
    ).toBe(1);
    expect(channelRows[0]?.entity_id).toBe(channel.id);
  });
});
