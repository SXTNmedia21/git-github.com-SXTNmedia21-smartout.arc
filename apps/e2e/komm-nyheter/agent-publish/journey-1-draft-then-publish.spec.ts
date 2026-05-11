/**
 * journey-1-draft-then-publish.spec.ts
 *
 * Journey: Draft-then-publish — two-call pattern correctness
 *
 * Exercises the two-call draft-return pattern (ADR-0099 §C4 broadcast-class harm
 * prevention):
 *   Call A  confirm=false → resolves audience, returns draft preview. No INSERT.
 *   Call B  confirm=true  → publishes via INSERT. Returns phase="published" + message_id.
 *
 * DB assertions use service-role Supabase client. No browser automation.
 *
 * Fixture layout:
 *   - Admin workspace + profile (from E2E fixture)
 *   - "Bar" department seeded fresh per test
 *   - 2 active employee profiles in Bar department
 *   - Workspace "news" channel + channel_ai_policy(proactive) + admin membership
 *   - engine_authority_config for "communication" (seeded by migration 20260601000000)
 *
 * Cleanup: targeted — only removes what this test created.
 */

import { test, expect } from "@playwright/test";
import { resolveAdminWorkspaceId, resolveAdminProfileId } from "../../helpers/auth";
import {
  supabase,
  seedDepartment,
  seedProfile,
  cleanupSeededAuthUsers,
  getSeededAuthUserIds,
} from "../../helpers/seed";
import { publishAnnouncement } from "@smartout/ai/capabilities/communication/publish-announcement";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve or create the workspace "news" channel.
 * Ensures the given profile is a channel_member (required for member-check
 * in publish_announcement before the INSERT).
 * Seeds a channel_ai_policy row with text_participation="proactive" so
 * isAiAllowedInChannel(isDirectlyMentioned=false) passes.
 */
async function ensureNewsChannelWithPolicy(opts: {
  workspaceId: string;
  adminProfileId: string;
}): Promise<string> {
  // Resolve or create the "news" channel
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

  // Ensure admin is a channel_member
  await supabase.from("channel_member").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      profile_id: opts.adminProfileId,
      role: "member",
    },
    { onConflict: "channel_id,profile_id", ignoreDuplicates: true },
  );

  // Seed channel_ai_policy with text_participation="proactive" so the
  // isAiAllowedInChannel(isDirectlyMentioned=false) guard in publish_announcement
  // passes. Default policy is "mention_only" which blocks agent-authored messages.
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

test.describe("publish_announcement — journey 1: draft then publish", () => {
  let workspaceId: string;
  let adminProfileId: string;
  let channelId: string;

  const seededIds = {
    departments: [] as string[],
    profiles: [] as string[],
    messages: [] as string[],
  };

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;

    const profId = await resolveAdminProfileId(workspaceId);
    if (!profId) throw new Error("E2E_EMAIL admin user has no profile in their workspace");
    adminProfileId = profId;

    seededIds.departments = [];
    seededIds.profiles = [];
    seededIds.messages = [];

    // Seed "Bar" department
    const bar = await seedDepartment(workspaceId, { name: "Bar" });
    seededIds.departments.push(bar.department_id);

    // Seed 2 active employees in Bar
    const emp1 = await seedProfile(workspaceId, {
      role: "employee",
      status: "active",
      department_id: bar.department_id,
    });
    const emp2 = await seedProfile(workspaceId, {
      role: "employee",
      status: "active",
      department_id: bar.department_id,
    });
    seededIds.profiles.push(emp1.profile_id, emp2.profile_id);

    // Ensure news channel exists with proactive AI policy
    channelId = await ensureNewsChannelWithPolicy({ workspaceId, adminProfileId });

    // Verify communication authority seed exists (migration 20260601000000_seed_communication_authority.sql)
    const { data: auth } = await supabase
      .from("engine_authority_config")
      .select("capability, level")
      .eq("workspace_id", workspaceId)
      .eq("capability", "communication")
      .maybeSingle();
    if (!auth) {
      throw new Error(
        "engine_authority_config missing for capability=communication. " +
          "Run migration 20260601000000_seed_communication_authority.sql first.",
      );
    }

    // Store bar dept id on the test context for assertions
    (test as unknown as { _barDeptId: string })._barDeptId = bar.department_id;
  });

  test.afterEach(async () => {
    if (seededIds.messages.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededIds.messages);
    }
    if (seededIds.profiles.length > 0) {
      await supabase.from("profile").delete().in("profile_id", seededIds.profiles);
    }
    await cleanupSeededAuthUsers(getSeededAuthUserIds());
    if (seededIds.departments.length > 0) {
      await supabase.from("department").delete().in("department_id", seededIds.departments);
    }
  });

  test("Call A (confirm=false): returns draft phase, resolves 2 Bar recipients, no INSERT", async () => {
    // Resolve the Bar department ID from DB (seeded in beforeEach)
    const { data: barDept } = await supabase
      .from("department")
      .select("department_id")
      .eq("workspace_id", workspaceId)
      .eq("name", "Bar")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const barDeptId = barDept!.department_id;

    const ctx: AgentToolContext = {
      workspaceId: workspaceId as AgentToolContext["workspaceId"],
      profileId: adminProfileId as AgentToolContext["profileId"],
      sessionId: "e2e-test-session-draft",
      supabaseAdmin: supabase,
      channel: "chat",
    };

    // Snapshot row count before call — used to assert no INSERT happened
    const { count: countBefore } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    const raw = await publishAnnouncement.execute(
      {
        channel_id: channelId,
        title: "Mandatory briefing",
        body: "Please attend the 14:00 debrief.",
        audience_kind: "department",
        department_ids: [barDeptId],
        confirm: false,
      },
      ctx,
    );

    // Parse JSON return
    const result = JSON.parse(raw as string) as Record<string, unknown>;

    expect(result.phase).toBe("draft");
    expect(typeof result.target_profile_count).toBe("number");
    // 2 active employees were seeded in Bar
    expect(result.target_profile_count).toBe(2);
    expect(result).not.toHaveProperty("message_id");
    expect(result.audience_label).toBeTruthy();

    // Service-role assertion: no INSERT happened
    const { count: countAfter } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    expect(countAfter).toBe(countBefore);
  });

  test("Call B (confirm=true): publishes message, returns message_id, activity_trail row exists", async () => {
    // Resolve the Bar department ID
    const { data: barDept } = await supabase
      .from("department")
      .select("department_id")
      .eq("workspace_id", workspaceId)
      .eq("name", "Bar")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const barDeptId = barDept!.department_id;

    // Resolve the 2 Bar employee profile IDs for assertion
    const { data: barProfiles } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("department_id", barDeptId)
      .eq("status", "active");
    const barProfileIds = (barProfiles ?? []).map((p: { profile_id: string }) => p.profile_id);
    // We expect exactly the 2 we seeded (may be more if prior test data leaked,
    // but at minimum our 2 must be present)
    expect(barProfileIds.length).toBeGreaterThanOrEqual(2);

    const ctx: AgentToolContext = {
      workspaceId: workspaceId as AgentToolContext["workspaceId"],
      profileId: adminProfileId as AgentToolContext["profileId"],
      sessionId: "e2e-test-session-publish",
      supabaseAdmin: supabase,
      channel: "chat",
    };

    const publishedAt = new Date();

    const raw = await publishAnnouncement.execute(
      {
        channel_id: channelId,
        title: "Mandatory briefing",
        body: "Please attend the 14:00 debrief.",
        audience_kind: "department",
        department_ids: [barDeptId],
        confirm: true,
      },
      ctx,
    );

    const result = JSON.parse(raw as string) as Record<string, unknown>;

    expect(result.phase).toBe("published");
    expect(typeof result.message_id).toBe("string");
    expect(result.message_id).toMatch(/^[0-9a-f]{8}-/);
    expect(typeof result.target_profile_count).toBe("number");
    expect(result.target_profile_count).toBeGreaterThanOrEqual(2);

    const messageId = result.message_id as string;
    seededIds.messages.push(messageId);

    // Service-role assertion: channel_message row has correct shape
    const { data: msg, error: msgErr } = await supabase
      .from("channel_message")
      .select("id, visibility_scope, target_profile_ids, message_type, sender_id")
      .eq("id", messageId)
      .single();

    expect(msgErr).toBeNull();
    expect(msg).toBeDefined();
    expect(msg!.visibility_scope).toBe("targeted_members");
    expect(msg!.message_type).toBe("announcement");
    expect(msg!.sender_id).toBe(adminProfileId);

    // target_profile_ids contains the Bar employees (DB has the IDs; agent return does not)
    const storedIds = (msg!.target_profile_ids ?? []) as string[];
    expect(storedIds.length).toBeGreaterThanOrEqual(2);
    for (const seededId of seededIds.profiles) {
      expect(storedIds).toContain(seededId);
    }

    // activity_trail assertion: channel.message.sent event with entity_id = messageId
    // WHY "event" not "event_name": activity_trail column is named `event` (see migration
    // 00005_activity_trail.sql). The field stores the full dot-separated event name.
    const { data: trail } = await supabase
      .from("activity_trail")
      .select("event, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("event", "channel.message.sent")
      .eq("entity_id", messageId)
      .gte("created_at", publishedAt.toISOString())
      .limit(1);

    expect(trail?.[0]).toBeDefined();
    expect(trail![0]!.entity_id).toBe(messageId);
  });
});
