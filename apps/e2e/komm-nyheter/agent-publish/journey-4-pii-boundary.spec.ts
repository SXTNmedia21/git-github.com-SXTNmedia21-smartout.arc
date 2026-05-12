/**
 * journey-4-pii-boundary.spec.ts
 *
 * Journey: PII boundary — tool return must not expose raw profile_ids
 *
 * Verifies that publish_announcement does NOT return raw profile_ids in its
 * JSON response even when the caller supplies explicit profile_ids
 * (audience_kind="individuals"). This enforces the Council B5 / ADR-0099
 * PII boundary: only count + label are returned; raw IDs stay in the DB.
 *
 * Assertions:
 *   - result.message_id is a UUID
 *   - Object.keys(result) does NOT include profile_ids / target_profile_ids / targetProfileIds
 *   - JSON.stringify(result) does NOT contain bar1.profile_id or bar2.profile_id
 *   - DB row DOES contain the profile_ids in target_profile_ids column
 *
 * DB assertions use service-role Supabase client. No browser automation.
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

test.describe("publish_announcement — journey 4: PII boundary", () => {
  let workspaceId: string;
  let adminProfileId: string;
  let channelId: string;
  let bar1ProfileId: string;
  let bar2ProfileId: string;

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

    // Seed "Bar" department + 2 employees
    const bar = await seedDepartment(workspaceId, { name: "Bar PII" });
    seededIds.departments.push(bar.department_id);

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

    bar1ProfileId = emp1.profile_id;
    bar2ProfileId = emp2.profile_id;

    channelId = await ensureNewsChannelWithPolicy({ workspaceId, adminProfileId });

    // Verify communication authority seed exists
    const { data: auth } = await supabase
      .from("engine_authority_config")
      .select("capability")
      .eq("workspace_id", workspaceId)
      .eq("capability", "communication")
      .maybeSingle();
    if (!auth) {
      throw new Error(
        "engine_authority_config missing for capability=communication. " +
          "Run migration 20260601100000_seed_communication_authority.sql first.",
      );
    }
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

  test("individuals audience: return has no raw profile_ids, DB row has them", async () => {
    const ctx: AgentToolContext = {
      workspaceId: workspaceId as AgentToolContext["workspaceId"],
      profileId: adminProfileId as AgentToolContext["profileId"],
      sessionId: "e2e-test-session-pii-boundary",
      supabaseAdmin: supabase,
      channel: "chat",
    };

    const raw = await publishAnnouncement.execute(
      {
        channel_id: channelId,
        title: "Individual briefing",
        body: "Please check the schedule update.",
        audience_kind: "individuals",
        profile_ids: [bar1ProfileId, bar2ProfileId],
        confirm: true,
      },
      ctx,
    );

    // Tool must return valid JSON
    expect(typeof raw).toBe("string");
    const result = JSON.parse(raw as string) as Record<string, unknown>;

    // Assertion 1: message_id is a UUID
    expect(result.message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    const messageId = result.message_id as string;
    seededIds.messages.push(messageId);

    // Assertion 2: PII boundary — returned object must NOT contain profile ID keys
    const returnedKeys = Object.keys(result);
    expect(returnedKeys).not.toContain("target_profile_ids");
    expect(returnedKeys).not.toContain("targetProfileIds");
    expect(returnedKeys).not.toContain("profile_ids");
    expect(returnedKeys).not.toContain("profileIds");

    // Assertion 3: PII boundary — serialized JSON must NOT contain raw profile UUID strings
    // (other than message_id which is intentionally returned)
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(bar1ProfileId);
    expect(serialized).not.toContain(bar2ProfileId);

    // Assertion 4: DB row DOES contain the profile IDs in target_profile_ids
    // (required for RLS-scoped delivery) — the DB stores them, the agent return does not
    const { data: msg, error: msgErr } = await supabase
      .from("channel_message")
      .select("target_profile_ids, visibility_scope")
      .eq("id", messageId)
      .single();

    expect(msgErr).toBeNull();
    expect(msg).toBeDefined();
    expect(msg!.visibility_scope).toBe("targeted_members");

    const storedIds = (msg!.target_profile_ids ?? []) as string[];
    expect(storedIds).toContain(bar1ProfileId);
    expect(storedIds).toContain(bar2ProfileId);
  });
});
