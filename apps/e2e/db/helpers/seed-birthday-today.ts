// apps/e2e/db/helpers/seed-birthday-today.ts
//
// Reusable seed helper for birthday cohort E2E tests (ADR-0372).
//
// Seeds up to 2 test user_identity rows with date_of_birth = today:
//   - "birthday_subject": opted in (no celebrate_birthday flag or flag=true)
//   - "birthday_optout":  opted out (notification_pref.celebrate_birthday = false)
//
// Both are linked to the test workspace via profile rows (role='employee', status='active').
//
// Cleanup: call seedBirthdayTodayCleanup() in afterEach/afterAll.
//
// GDPR NOTE: These seed identities are test-only with no real PII.
// DOB is set to the current date to satisfy birthday-matching logic.
// user_identity rows are deleted on cleanup — no residual data.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";

// NOTE: Do not inline the service role key here — pre-commit husky hook rejects
// long JWT strings. Loaded from env. See apps/e2e/db/helpers/clients.ts for rationale.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const TEST_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

// Deterministic test UUIDs — stable across runs.
export const BIRTHDAY_SUBJECT_USER_ID = "b1r70000-0000-0000-0000-000000000001";
export const BIRTHDAY_SUBJECT_PROFILE_ID = "b1r70000-0000-0000-0000-000000000011";
export const BIRTHDAY_OPTOUT_USER_ID = "b1r70000-0000-0000-0000-000000000002";
export const BIRTHDAY_OPTOUT_PROFILE_ID = "b1r70000-0000-0000-0000-000000000022";

export type SeedResult = {
  subjectProfileId: string;
  optOutProfileId: string;
  todayIso: string; // YYYY-MM-DD in UTC
};

export function serviceClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Seeds 2 test profiles with DOB = today (UTC) in the test workspace.
 * Subject is opted in; optout profile has celebrate_birthday=false in notification_pref.
 */
export async function seedBirthdayToday(): Promise<SeedResult> {
  const db = serviceClient();
  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // ── 1. Upsert auth.users (required for FK user_identity.id → auth.users) ──
  // Use admin API to create test users (no email confirmation needed in local).
  // We upsert by ID to be idempotent.
  for (const [userId, email] of [
    [BIRTHDAY_SUBJECT_USER_ID, "birthday-subject@test.smartout.ai"],
    [BIRTHDAY_OPTOUT_USER_ID, "birthday-optout@test.smartout.ai"],
  ] as [string, string][]) {
    const { error } = await db.auth.admin.createUser({
      // @ts-expect-error — Supabase local admin API supports id override
      id: userId,
      email,
      password: "test-pw-only",
      email_confirm: true,
    });
    // Ignore "already exists" errors (idempotent re-run).
    if (error && !error.message.includes("already been registered")) {
      throw new Error(`Failed to create test auth user ${userId}: ${error.message}`);
    }
  }

  // ── 2. Upsert user_identity rows with DOB = today ─────────────────────────
  // direct insert via service role (bypasses RLS for test setup)
  await db.from("user_identity").upsert(
    [
      {
        id: BIRTHDAY_SUBJECT_USER_ID,
        date_of_birth: todayIso,
        email: "birthday-subject@test.smartout.ai",
        preferred_language: "no",
        timezone: "Europe/Oslo",
        full_name: "Birthday Subject",
      },
      {
        id: BIRTHDAY_OPTOUT_USER_ID,
        date_of_birth: todayIso,
        email: "birthday-optout@test.smartout.ai",
        preferred_language: "no",
        timezone: "Europe/Oslo",
        full_name: "Birthday Optout",
      },
    ],
    { onConflict: "id" },
  );

  // ── 3. Upsert profile rows ─────────────────────────────────────────────────
  await db.from("profile").upsert(
    [
      {
        profile_id: BIRTHDAY_SUBJECT_PROFILE_ID,
        workspace_id: TEST_WORKSPACE_ID,
        user_id: BIRTHDAY_SUBJECT_USER_ID,
        display_name: "Birthday Subject",
        role: "employee",
        status: "active",
        // notification_pref is NULL → default opt-in (celebrate_birthday absent = true)
        notification_pref: null,
      },
      {
        profile_id: BIRTHDAY_OPTOUT_PROFILE_ID,
        workspace_id: TEST_WORKSPACE_ID,
        user_id: BIRTHDAY_OPTOUT_USER_ID,
        display_name: "Birthday Optout",
        role: "employee",
        status: "active",
        // Explicit opt-out via ADR-0372 Q4 fallback JSONB key
        notification_pref: { celebrate_birthday: false },
      },
    ],
    { onConflict: "profile_id" },
  );

  return {
    subjectProfileId: BIRTHDAY_SUBJECT_PROFILE_ID,
    optOutProfileId: BIRTHDAY_OPTOUT_PROFILE_ID,
    todayIso,
  };
}

/**
 * Removes the test profiles + identities seeded by seedBirthdayToday().
 * Cascade deletions handle child rows (profile → celebration_publication etc.).
 */
export async function seedBirthdayTodayCleanup(): Promise<void> {
  const db = serviceClient();

  // Delete profiles first (FK references user_identity).
  await db
    .from("profile")
    .delete()
    .in("profile_id", [BIRTHDAY_SUBJECT_PROFILE_ID, BIRTHDAY_OPTOUT_PROFILE_ID]);

  // Delete user_identity rows.
  await db
    .from("user_identity")
    .delete()
    .in("id", [BIRTHDAY_SUBJECT_USER_ID, BIRTHDAY_OPTOUT_USER_ID]);

  // Clean up auth users (admin API).
  for (const userId of [BIRTHDAY_SUBJECT_USER_ID, BIRTHDAY_OPTOUT_USER_ID]) {
    await db.auth.admin.deleteUser(userId);
  }
}
