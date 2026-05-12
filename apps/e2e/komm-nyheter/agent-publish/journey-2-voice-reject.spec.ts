/**
 * journey-2-voice-reject.spec.ts
 *
 * Journey: Voice-channel guard fires before gate
 *
 * Verifies that publish_announcement rejects voice-channel sessions as the
 * FIRST statement (Council B3 / ADR-0078 Layer 3 in-tool guard), before any
 * gate_action RPC call is made.
 *
 * Expected behaviour:
 *   - Tool returns a string mentioning both "voice" and "chat"
 *   - No channel_message row is inserted
 *
 * Note on gate audit: voice rejection happens BEFORE the gate call, so no
 * gate.* activity_trail row is emitted. This test asserts zero channel_message
 * inserts only. Gate-level deny audit is exercised in journey-3.
 *
 * DB assertions use service-role Supabase client. No browser automation.
 */

import { test, expect } from "@playwright/test";
import { resolveAdminWorkspaceId, resolveAdminProfileId } from "../../helpers/auth";
import { supabase, cleanupSeededAuthUsers, getSeededAuthUserIds } from "../../helpers/seed";
import { publishAnnouncement } from "@smartout/ai/capabilities/communication/publish-announcement";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";

// ---------------------------------------------------------------------------
// Helpers — reuse the news-channel + proactive-policy setup from journey-1
// ---------------------------------------------------------------------------

async function ensureNewsChannelWithPolicy(opts: {
  workspaceId: string;
  adminProfileId: string;
}): Promise<string> {
  const { data: existing } = await supabase
    .from("channel")
    .select("id")
    .eq("workspace_id", opts.workspaceId)
    .eq("channel_type", "news")
    .maybeSingle();

  let channelId: string;
  if (existing) {
    channelId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("channel")
      .insert({
        workspace_id: opts.workspaceId,
        channel_type: "news",
        name: "Nyheter",
        created_by: opts.adminProfileId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Failed to create news channel: ${error?.message}`);
    channelId = created.id;
  }

  await supabase.from("channel_member").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      profile_id: opts.adminProfileId,
      role: "member",
    },
    { onConflict: "channel_id,profile_id", ignoreDuplicates: true },
  );

  await supabase.from("channel_ai_policy").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      text_participation: "proactive",
      voice_participation: "disabled",
      auto_reminders: false,
      auto_shift_prep: false,
      auto_summarize: false,
    },
    { onConflict: "channel_id", ignoreDuplicates: false },
  );

  return channelId;
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.describe("publish_announcement — journey 2: voice channel reject", () => {
  let workspaceId: string;
  let adminProfileId: string;
  let channelId: string;

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;

    const profId = await resolveAdminProfileId(workspaceId);
    if (!profId) throw new Error("E2E_EMAIL admin user has no profile in their workspace");
    adminProfileId = profId;

    channelId = await ensureNewsChannelWithPolicy({ workspaceId, adminProfileId });
  });

  test.afterEach(async () => {
    await cleanupSeededAuthUsers(getSeededAuthUserIds());
  });

  test("voice context → tool rejects with voice+chat copy, no INSERT", async () => {
    // Build a voice-channel AgentToolContext — the tool must reject this as its
    // FIRST statement (before gate call) per Council B3 / ADR-0078.
    const voiceCtx: AgentToolContext = {
      workspaceId: workspaceId as AgentToolContext["workspaceId"],
      profileId: adminProfileId as AgentToolContext["profileId"],
      sessionId: "e2e-test-session-voice-reject",
      supabaseAdmin: supabase,
      channel: "voice",
    };

    // Snapshot row count before call to detect any stray INSERTs
    const { count: countBefore } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    const rejectedAt = new Date();

    const returnValue = await publishAnnouncement.execute(
      {
        channel_id: channelId,
        title: "Briefing",
        body: "All staff meeting at 14:00.",
        audience_kind: "all",
        confirm: true,
      },
      voiceCtx,
    );

    // Tool must return a plain string (not JSON) on voice reject
    expect(typeof returnValue).toBe("string");
    const msg = returnValue as string;

    // The reject copy must mention "voice" AND "chat" per the tool docstring
    // ("Announcement publishing is not available over voice. Switch to chat.")
    expect(msg).toMatch(/voice/i);
    expect(msg).toMatch(/chat/i);

    // Service-role assertion: zero channel_message rows inserted
    const { count: countAfter } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    expect(countAfter).toBe(countBefore);

    // Voice reject fires BEFORE gate call — no gate.* activity_trail rows.
    // We assert that no channel.message.sent rows appeared since rejectedAt.
    const { data: auditRows } = await supabase
      .from("activity_trail")
      .select("event_name")
      .eq("workspace_id", workspaceId)
      .eq("event_name", "channel.message.sent")
      .gte("created_at", rejectedAt.toISOString());

    expect(auditRows ?? []).toHaveLength(0);
  });
});
