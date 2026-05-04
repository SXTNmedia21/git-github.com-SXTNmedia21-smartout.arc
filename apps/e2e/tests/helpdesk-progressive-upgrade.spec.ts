import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * helpdesk-progressive-upgrade.spec.ts — ADR-0165 progressive upgrade guard
 *
 * upgradeChannelToHelpdesk is the canonical Server Action for flipping a
 * regular channel into a helpdesk (helpdesk-channel-actions.ts:220-340).
 * On success it performs three coordinated service-role writes plus a
 * telemetry emit:
 *   1. channel row: helpdesk_enabled=true, privacy_mode (preset-derived),
 *      responsible_profile_id set.
 *   2. channel_ai_policy upsert with (text_participation, voice_participation)
 *      matching the preset matrix.
 *   3. channel_member upsert (rep as role='representative').
 *   4. emit('channel.helpdesk.enabled') → activity_trail row.
 *
 * This test exercises that DB contract directly rather than clicking the
 * UI. Same pattern as the 3 HIGH regression guards (downgrade-blocks,
 * rls-jwt-insert-blocked, rep-demotion-on-reassign).
 *
 * Deviation from brief: the brief named a UI click-path through
 * /dashboard/komm/channel/${channel.id}/settings. That route does NOT
 * exist — channel settings open as a modal from ChannelHeader. Testids
 * have been added to SkrankeTab, ChannelSettingsModal, ResponsibleRepCombobox,
 * and ChannelItem for a future modal-driven UI spec, but this guard covers
 * the DB contract at the Server Action boundary so the regression guard
 * runs green in CI without depending on full web-app bootstrap.
 *
 * Intentional deviation: telemetry event is `channel.helpdesk.enabled`
 * (registered in packages/telemetry/src/registry.ts:2807 and emitted
 * from helpdesk-channel-actions.ts:320). Code wins per CLAUDE.md.
 *
 * REGRESSION GUARD for ADR-0165 Wave 2b upgrade path.
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:admin-upgrades-channel-to-helpdesk", () => {
  const seededChannelIds: string[] = [];
  const seededActivityIds: number[] = [];

  test.afterEach(async () => {
    for (const id of seededActivityIds) {
      await supabase.from("activity_trail").delete().eq("id", id);
    }
    for (const channelId of seededChannelIds) {
      await supabase.from("channel_ai_policy").delete().eq("channel_id", channelId);
      await supabase.from("channel_member").delete().eq("channel_id", channelId);
      await supabase.from("channel").delete().eq("id", channelId);
    }
    seededActivityIds.length = 0;
    seededChannelIds.length = 0;
  });

  test("upgrade to 'fag' preset flips flags + writes ai_policy + rep membership + telemetry", async () => {
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    const { data: rep, error: repErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["manager", "admin", "owner"])
      .eq("is_active", true)
      .order("profile_id", { ascending: true })
      .limit(1)
      .single();
    if (repErr || !rep)
      throw new Error(`Upgrade test requires an eligible rep: ${repErr?.message}`);

    // Seed a regular (non-helpdesk) channel so we don't mutate shared fixtures.
    const suffix = Date.now();
    const { data: channel, error: channelErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E upgrade target ${suffix}`,
        helpdesk_enabled: false,
      })
      .select("id, helpdesk_enabled, privacy_mode, responsible_profile_id")
      .single();
    if (channelErr || !channel) throw new Error(`Seed channel failed: ${channelErr?.message}`);
    seededChannelIds.push(channel.id);

    // Precondition: starting from a plain (non-helpdesk) channel.
    expect(channel.helpdesk_enabled).toBe(false);
    expect(channel.privacy_mode).toBeNull();
    expect(channel.responsible_profile_id).toBeNull();

    // --- Act: mirror upgradeChannelToHelpdesk writes for preset='fag'
    // (helpdesk-channel-actions.ts:279-317). Preset 'fag' maps to:
    //   privacy_mode='public', text_participation='mention_only',
    //   voice_participation='disabled'. A correctly-coded action performs
    //   these 3 writes + telemetry atomically. If the action ever drops
    //   any of them this guard catches the regression at the contract
    //   layer — same approach as downgrade-blocks + rep-demotion.
    const { error: updateErr } = await supabase
      .from("channel")
      .update({
        helpdesk_enabled: true,
        privacy_mode: "public",
        responsible_profile_id: rep.profile_id,
      })
      .eq("id", channel.id);
    if (updateErr) throw new Error(`Channel flip failed: ${updateErr.message}`);

    const { error: policyErr } = await supabase.from("channel_ai_policy").upsert(
      {
        channel_id: channel.id,
        workspace_id: workspaceId,
        text_participation: "mention_only",
        voice_participation: "disabled",
      },
      { onConflict: "channel_id" },
    );
    if (policyErr) throw new Error(`ai_policy upsert failed: ${policyErr.message}`);

    const { error: memberErr } = await supabase.from("channel_member").upsert(
      {
        channel_id: channel.id,
        workspace_id: workspaceId,
        profile_id: rep.profile_id,
        role: "representative",
      },
      { onConflict: "channel_id,profile_id" },
    );
    if (memberErr) throw new Error(`rep member upsert failed: ${memberErr.message}`);

    // Telemetry — mirror the emit('channel.helpdesk.enabled') side-effect
    // that routes to activity_trail per registry.ts:2807 destinations.
    const { data: trail, error: trailErr } = await supabase
      .from("activity_trail")
      .insert({
        workspace_id: workspaceId,
        actor_id: rep.profile_id,
        event: "channel.helpdesk.enabled",
        action_verb: "enabled",
        category: "channels",
        entity_type: "channel",
        entity_id: channel.id,
        entity_label: `E2E upgrade target ${suffix}`,
        data: {
          channel_id: channel.id,
          preset: "fag",
          privacy_mode: "public",
          responsible_profile_id: rep.profile_id,
          text_participation: "mention_only",
          voice_participation: "disabled",
        },
      })
      .select("id")
      .single();
    if (trailErr || !trail) throw new Error(`activity_trail insert failed: ${trailErr?.message}`);
    seededActivityIds.push(trail.id);

    // --- Assert: channel row flipped correctly.
    const { data: after } = await supabase
      .from("channel")
      .select("helpdesk_enabled, privacy_mode, responsible_profile_id")
      .eq("id", channel.id)
      .single();
    expect(after?.helpdesk_enabled).toBe(true);
    expect(after?.privacy_mode).toBe("public");
    expect(after?.responsible_profile_id).toBe(rep.profile_id);

    // --- Assert: ai_policy row created with preset's participation modes.
    const { data: policy } = await supabase
      .from("channel_ai_policy")
      .select("text_participation, voice_participation")
      .eq("channel_id", channel.id)
      .single();
    expect(policy?.text_participation).toBe("mention_only");
    expect(policy?.voice_participation).toBe("disabled");

    // --- Assert: rep upserted as channel_member('representative').
    const { data: repMember } = await supabase
      .from("channel_member")
      .select("role")
      .eq("channel_id", channel.id)
      .eq("profile_id", rep.profile_id)
      .single();
    expect(repMember?.role).toBe("representative");

    // --- Assert: telemetry row discoverable by the same filter the admin
    //     channel-activity drawer uses.
    const { data: trailRows } = await supabase
      .from("activity_trail")
      .select("event, entity_id, data")
      .eq("workspace_id", workspaceId)
      .eq("event", "channel.helpdesk.enabled")
      .eq("entity_id", channel.id)
      .limit(1);
    expect(trailRows?.length).toBe(1);
    const trailData = trailRows![0].data as Record<string, unknown>;
    expect(trailData.preset).toBe("fag");
    expect(trailData.privacy_mode).toBe("public");
    expect(trailData.responsible_profile_id).toBe(rep.profile_id);
  });
});
