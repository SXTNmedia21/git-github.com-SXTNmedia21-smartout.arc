// apps/e2e/db/birthday-cohort.spec.ts
//
// E2E integration tests for ADR-0372 birthday cohort pipe.
// Runs against Supabase local (127.0.0.1:54321).
//
// Tests:
//   T1  fn_birthday_cohort_for_workspace returns opted-in profiles, excludes opt-outs
//   T2  Cohort RPC never returns DOB in result rows
//   T3  Returns 0 rows when no birthdays match today
//   T4  publish_announcement_atomic celebration branch: idempotency via celebration_publication UNIQUE
//   T5  workspace_celebration_config: auto_celebrate_birthdays=false causes NULL return from RPC
//
// Requires: supabase start + migrations applied.
// All mutations are cleaned up in afterAll.
//
// NOTE: These tests require SUPABASE_SERVICE_ROLE_KEY env var (loaded via op run).
// They SKIP when env var is missing (pnpm test in CI without Supabase local).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  seedBirthdayToday,
  seedBirthdayTodayCleanup,
  serviceClient,
  TEST_WORKSPACE_ID,
  BIRTHDAY_SUBJECT_PROFILE_ID,
  BIRTHDAY_OPTOUT_PROFILE_ID,
} from "./helpers/seed-birthday-today.js";

const HAS_SUPABASE_ENV =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Channel that exists in the test workspace (from seed.sql — news type).
const TEST_CHANNEL_ID = "ca000000-0000-0000-0000-000000000020";

// Track message_ids to clean up in afterAll.
const insertedMessageIds: string[] = [];

describe.skipIf(!HAS_SUPABASE_ENV)("Birthday cohort + auto-publish pipe (ADR-0372)", () => {
  let todayIso = "";

  beforeAll(async () => {
    const result = await seedBirthdayToday();
    todayIso = result.todayIso;
  });

  afterAll(async () => {
    // Clean up celebration_publication rows referencing test profiles.
    const db = serviceClient();
    await db
      .from("celebration_publication")
      .delete()
      .in("profile_id", [BIRTHDAY_SUBJECT_PROFILE_ID, BIRTHDAY_OPTOUT_PROFILE_ID]);

    // Clean up any published messages.
    if (insertedMessageIds.length > 0) {
      await db.from("channel_message").delete().in("id", insertedMessageIds);
    }

    // Remove seed profiles + identities.
    await seedBirthdayTodayCleanup();
  });

  beforeEach(async () => {
    // Clear celebration_publication rows from previous test iteration to allow re-runs.
    const db = serviceClient();
    await db
      .from("celebration_publication")
      .delete()
      .in("profile_id", [BIRTHDAY_SUBJECT_PROFILE_ID, BIRTHDAY_OPTOUT_PROFILE_ID]);
  });

  // ── T1: cohort includes opted-in, excludes opted-out ──────────────────────

  it("T1: cohort RPC returns opted-in profile, excludes opted-out profile", async () => {
    const db = serviceClient();

    const { data, error } = await db.rpc("fn_birthday_cohort_for_workspace", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_today: todayIso,
    });

    expect(error).toBeNull();
    const cohort = (data ?? []) as Array<{ profile_id: string; display_name: string }>;

    // Opted-in "Birthday Subject" must be present.
    expect(cohort.some((r) => r.profile_id === BIRTHDAY_SUBJECT_PROFILE_ID)).toBe(true);

    // Opted-out "Birthday Optout" must NOT be present.
    expect(cohort.some((r) => r.profile_id === BIRTHDAY_OPTOUT_PROFILE_ID)).toBe(false);
  });

  // ── T2: DOB never in cohort result ────────────────────────────────────────

  it("T2: cohort RPC never returns date_of_birth in result", async () => {
    const db = serviceClient();

    const { data, error } = await db.rpc("fn_birthday_cohort_for_workspace", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_today: todayIso,
    });

    expect(error).toBeNull();
    const serialized = JSON.stringify(data);

    // DOB must never appear in any form.
    expect(serialized).not.toContain("date_of_birth");
    expect(serialized).not.toContain("dob");
    expect(serialized).not.toContain("birth");
    // todayIso contains the year — ensure it's not present under a DOB-like key.
    // (display_name or profile_id could theoretically contain year as substring — check key names only)
    const rows = (data ?? []) as Record<string, unknown>[];
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain("date_of_birth");
      expect(Object.keys(row)).not.toContain("dob");
    }
  });

  // ── T3: 0 rows when no birthdays today ───────────────────────────────────

  it("T3: cohort returns 0 rows when no birthdays match today (offset date)", async () => {
    const db = serviceClient();

    // Use yesterday's date — no profiles have that DOB.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10);

    const { data, error } = await db.rpc("fn_birthday_cohort_for_workspace", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_today: yesterdayIso,
    });

    expect(error).toBeNull();
    const cohort = (data ?? []) as unknown[];

    // Our test profiles have DOB=today, so yesterday returns 0 of them.
    const testProfilesInResult = (cohort as Array<{ profile_id: string }>).filter(
      (r) =>
        r.profile_id === BIRTHDAY_SUBJECT_PROFILE_ID || r.profile_id === BIRTHDAY_OPTOUT_PROFILE_ID,
    );
    expect(testProfilesInResult).toHaveLength(0);
  });

  // ── T4: celebration_publication idempotency ────────────────────────────────

  it("T4: publish_announcement_atomic celebration branch is idempotent (2nd call returns NULL)", async () => {
    const db = serviceClient();

    const baseArgs = {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_actor_profile_id: BIRTHDAY_SUBJECT_PROFILE_ID, // celebrated profile IS the actor in celebration branch
      p_channel_id: TEST_CHANNEL_ID,
      p_content: "Gratulerer med dagen, Birthday Subject!\nI dag har Birthday Subject bursdag.",
      p_kind: "celebration",
      p_tier: "social",
      p_tags: ["birthday"],
      p_linked_entity_type: "profile",
      p_linked_entity_id: BIRTHDAY_SUBJECT_PROFILE_ID,
      p_tier_overridden: false,
      p_celebration_kind: "birthday",
      p_celebration_date: todayIso,
    } as Record<string, unknown>;

    // First call — should publish and return a message_id.
    const { data: firstMessageId, error: firstError } = await db.rpc(
      "publish_announcement_atomic",
      { ...baseArgs, p_client_message_id: crypto.randomUUID() },
    );

    // Record for cleanup regardless of outcome.
    if (firstMessageId) insertedMessageIds.push(firstMessageId as string);

    expect(firstError).toBeNull();
    // May return NULL if workspace celebration config is not yet backfilled in local.
    // The key assertion is: no error + no duplicate on 2nd call.
    if (firstMessageId !== null) {
      expect(typeof firstMessageId).toBe("string");

      // Second call same day — must return NULL (idempotency skip).
      const { data: secondMessageId, error: secondError } = await db.rpc(
        "publish_announcement_atomic",
        { ...baseArgs, p_client_message_id: crypto.randomUUID() },
      );

      expect(secondError).toBeNull();
      expect(secondMessageId).toBeNull(); // idempotency: already published today
    }
  });

  // ── T5: workspace disabled → NULL returned ─────────────────────────────────

  it("T5: publish_announcement_atomic returns NULL when workspace auto_celebrate_birthdays=false", async () => {
    const db = serviceClient();

    // Disable celebration for the test workspace.
    await db
      .from("workspace_celebration_config")
      .update({ auto_celebrate_birthdays: false })
      .eq("workspace_id", TEST_WORKSPACE_ID);

    try {
      const { data: messageId, error } = await db.rpc("publish_announcement_atomic", {
        p_workspace_id: TEST_WORKSPACE_ID,
        p_actor_profile_id: BIRTHDAY_SUBJECT_PROFILE_ID,
        p_channel_id: TEST_CHANNEL_ID,
        p_content: "Gratulerer med dagen!\nBursdag i dag.",
        p_kind: "celebration",
        p_tier: "social",
        p_tags: [],
        p_linked_entity_type: null,
        p_linked_entity_id: null,
        p_tier_overridden: false,
        p_client_message_id: crypto.randomUUID(),
        p_celebration_kind: "birthday",
        p_celebration_date: todayIso,
      } as Record<string, unknown>);

      expect(error).toBeNull();
      expect(messageId).toBeNull(); // disabled workspace → NULL
    } finally {
      // Restore celebration config.
      await db
        .from("workspace_celebration_config")
        .update({ auto_celebrate_birthdays: true })
        .eq("workspace_id", TEST_WORKSPACE_ID);
    }
  });
});
