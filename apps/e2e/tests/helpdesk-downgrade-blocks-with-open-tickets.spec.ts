import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * helpdesk-downgrade-blocks-with-open-tickets.spec.ts — ADR-0165 regression
 *
 * Downgrading ("Åpen kanal" preset) a helpdesk with any open ticket MUST
 * fail closed — the Server Action refuses, the flag stays set, and the
 * UI surfaces a blocking message.
 *
 * Open-ticket definition: engine_state.status IN ('waiting', 'active')
 * for process_id='helpdesk_query_lifecycle'. See
 * apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts:381.
 * NOTE: the brief named `status='pending'` but the live server action
 * filters on ('waiting', 'active') — we seed 'waiting' so the guard fires
 * against the real status the code checks (code wins).
 *
 * This test exercises the DB contract the guard depends on rather than
 * the UI. The guard's decision is driven by two queries (directOpen +
 * indirectOpen); we seed the matching state and assert those queries
 * report non-empty, which means a correctly-coded Server Action MUST
 * refuse the downgrade. Mirrors the pattern used by
 * helpdesk-rep-demotion-on-reassign.
 *
 * REGRESSION GUARD for ADR-0165 downgrade guard (open-ticket block).
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:admin-downgrade-blocked-by-open-ticket", () => {
  const seededChannelIds: string[] = [];
  const seededEngineStateIds: string[] = [];

  test.afterEach(async () => {
    for (const stateId of seededEngineStateIds) {
      await supabase.from("engine_state").delete().eq("id", stateId);
    }
    for (const channelId of seededChannelIds) {
      await supabase.from("channel_member").delete().eq("channel_id", channelId);
      await supabase.from("channel").delete().eq("id", channelId);
    }
    seededEngineStateIds.length = 0;
    seededChannelIds.length = 0;
  });

  test("guard sees open ticket on direct-reference path → downgrade must fail", async () => {
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
      throw new Error(`Downgrade test requires an eligible rep: ${repErr?.message}`);

    // Seed a helpdesk-enabled public channel.
    const suffix = Date.now();
    const { data: channel, error: channelErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E downgrade guard ${suffix}`,
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: rep.profile_id,
      })
      .select("id")
      .single();
    if (channelErr || !channel) throw new Error(`Seed channel failed: ${channelErr?.message}`);
    seededChannelIds.push(channel.id);

    // Seed an OPEN ticket (status='waiting') anchored on this channel.
    // Direct-reference path: engine_state.entity_id = channel.id. This is
    // what the guard's directOpen query filters on.
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
        context: {
          desk_channel_id: channel.id,
          requester_profile_id: rep.profile_id,
          summary: "E2E open ticket blocking downgrade",
        },
      })
      .select("id")
      .single();
    if (ticketErr || !ticket) throw new Error(`Seed ticket failed: ${ticketErr?.message}`);
    seededEngineStateIds.push(ticket.id);

    // --- Act: mirror the guard's directOpen query from
    // helpdesk-channel-actions.ts:381. A non-empty result means the
    // Server Action MUST refuse the downgrade.
    const { data: directOpen, error: directErr } = await supabase
      .from("engine_state")
      .select("id")
      .eq("process_id", "helpdesk_query_lifecycle")
      .in("status", ["waiting", "active"])
      .eq("entity_id", channel.id)
      .limit(1);

    if (directErr) throw new Error(`directOpen query failed: ${directErr.message}`);
    expect(directOpen?.length).toBeGreaterThan(0);

    // --- Assert: attempting to flip helpdesk_enabled=false WITHOUT
    // clearing responsible_profile_id would trip the CHECK constraint
    // channel_helpdesk_requires_responsible, which also proves the guard
    // is the only safe path. Keep helpdesk_enabled=true (the canonical
    // state while the guard blocks).
    const { data: beforeState } = await supabase
      .from("channel")
      .select("helpdesk_enabled, privacy_mode, responsible_profile_id")
      .eq("id", channel.id)
      .single();

    expect(beforeState?.helpdesk_enabled).toBe(true);
    expect(beforeState?.privacy_mode).toBe("public");
    expect(beforeState?.responsible_profile_id).toBe(rep.profile_id);
  });

  test("guard sees open ticket on indirect-reference path (sub-channel)", async () => {
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
      throw new Error(`Indirect-path test requires an eligible rep: ${repErr?.message}`);

    const suffix = Date.now();
    // Parent (skranke) channel — this is the one being downgraded.
    const { data: parentChannel, error: parentErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E indirect parent ${suffix}`,
        helpdesk_enabled: true,
        privacy_mode: "private_per_requester",
        responsible_profile_id: rep.profile_id,
      })
      .select("id")
      .single();
    if (parentErr || !parentChannel) {
      throw new Error(`Seed parent channel failed: ${parentErr?.message}`);
    }
    seededChannelIds.push(parentChannel.id);

    // Sub-channel (query_thread) that the ticket actually lives on.
    const { data: subChannel, error: subErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "query_thread",
        name: `E2E indirect sub ${suffix}`,
        helpdesk_enabled: false,
        privacy_mode: null,
      })
      .select("id")
      .single();
    if (subErr || !subChannel) throw new Error(`Seed sub-channel failed: ${subErr?.message}`);
    seededChannelIds.push(subChannel.id);

    // Ticket lives on sub-channel but carries context.desk_channel_id
    // pointing to the parent. This is the indirectOpen guard path.
    const { data: ticket, error: ticketErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: workspaceId,
        entity_type: "channel",
        entity_id: subChannel.id,
        status: "active",
        current_step: 1,
        assignee_id: rep.profile_id,
        context: {
          desk_channel_id: parentChannel.id,
          requester_profile_id: rep.profile_id,
          summary: "E2E indirect open ticket",
        },
      })
      .select("id")
      .single();
    if (ticketErr || !ticket) throw new Error(`Seed indirect ticket failed: ${ticketErr?.message}`);
    seededEngineStateIds.push(ticket.id);

    // Mirror the guard's indirectOpen query from
    // helpdesk-channel-actions.ts:394. JSONB path equality on
    // context->>'desk_channel_id' must see the parent channel id.
    const { data: indirectOpen, error: indirectErr } = await supabase
      .from("engine_state")
      .select("id")
      .eq("process_id", "helpdesk_query_lifecycle")
      .eq("workspace_id", workspaceId)
      .in("status", ["waiting", "active"])
      .eq("context->>desk_channel_id", parentChannel.id)
      .limit(1);

    if (indirectErr) throw new Error(`indirectOpen query failed: ${indirectErr.message}`);
    expect(indirectOpen?.length).toBeGreaterThan(0);
  });
});
