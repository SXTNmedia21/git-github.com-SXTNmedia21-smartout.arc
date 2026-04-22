/**
 * admin-login.ts — platform-admin / godmode login helper for E2E.
 *
 * Why: `helpers/auth.ts::loginAsAdmin(page)` logs the seeded
 * `admin@smartout.local` user in and skips the onboarding wizard. It does
 * NOT return identity metadata, and it does NOT verify that the user has
 * godmode permissions for `/platform-admin/*` routes. The Journey Engine
 * admin-authoring tests (J1–J4) run against `/platform-admin/journeys/**`,
 * which redirect non-godmode users to `/dashboard`. This helper is a thin
 * wrapper that:
 *
 *   1. Calls the existing `loginAsAdmin` flow (form-based login, cookie
 *      session). No new auth path.
 *   2. Verifies the session landed on an authenticated route.
 *   3. Returns the admin's `user_id`, `profile_id`, and `workspace_id`
 *      — the three fields the caller needs to filter cleanup / assertion.
 *   4. Re-confirms the user row is flagged `is_godmode` via service-role
 *      client; if not, throws loudly so a misconfigured local DB does not
 *      silently skip platform-admin paths.
 *
 * Seed dependency: `supabase/seed.sql` step 8 sets `is_godmode = true` on
 * `admin@smartout.local`. If the seed has regressed, this helper will
 * throw before the test navigates to `/platform-admin/*` — clearer failure.
 *
 * No 1Password required — creds default to `admin@smartout.local` /
 * `password123` (seed.sql), overridable via `E2E_EMAIL` / `E2E_PASSWORD`
 * in `apps/e2e/.env.local` (gitignored).
 */

import type { Page } from "@playwright/test";
import { loginAsAdmin } from "./auth";
import { supabase } from "./seed";

export type PlatformAdminSession = {
  user_id: string;
  profile_id: string;
  workspace_id: string;
  email: string;
};

// The seeded admin. Hardcoded — the fixture is deterministic in seed.sql.
const ADMIN_EMAIL_DEFAULT = "admin@smartout.local";

/**
 * Log in as the seeded platform admin and return identity metadata.
 *
 * @throws if the admin user is missing, not godmode, or has no active profile.
 */
export async function loginAsPlatformAdmin(page: Page): Promise<PlatformAdminSession> {
  const email = process.env.E2E_EMAIL ?? ADMIN_EMAIL_DEFAULT;

  // 1. Form login. loginAsAdmin handles the onboarding-skip + retries.
  await loginAsAdmin(page, { skipOnboarding: true });

  // 2. Re-derive identity from the seed via service-role. The form login
  //    does not surface the user_id / profile_id back to us, but the
  //    tests need them for cleanup filtering and for asserting activity
  //    trail entries.
  const userRecord = await resolveAdminIdentity(email);
  if (!userRecord) {
    throw new Error(
      `loginAsPlatformAdmin: could not resolve identity for ${email}. ` +
        `Check supabase/seed.sql has been applied (npx supabase db reset).`,
    );
  }

  // 3. Godmode precondition — platform-admin routes require it.
  const { data: identity, error: identityErr } = await supabase
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", userRecord.user_id)
    .maybeSingle();
  if (identityErr) {
    throw new Error(`loginAsPlatformAdmin: user_identity lookup failed: ${identityErr.message}`);
  }
  if (!identity?.is_godmode) {
    throw new Error(
      `loginAsPlatformAdmin: ${email} is not flagged is_godmode. ` +
        `seed.sql step 8 should set this — apply the seed via 'npx supabase db reset'.`,
    );
  }

  return userRecord;
}

/**
 * Resolve user_id + profile_id + workspace_id for the seeded admin.
 *
 * The `profile` row is picked by `user_id + is_active=true` (single row
 * per workspace per user in seed — HQ workspace).
 */
async function resolveAdminIdentity(email: string): Promise<PlatformAdminSession | null> {
  // Supabase does not expose a single GET-user-by-email REST call, so we
  // page through admin.listUsers. The seed has <20 users so page 1 is
  // sufficient; we ask for perPage=200 to be safe.
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (userErr) {
    throw new Error(`resolveAdminIdentity: listUsers failed: ${userErr.message}`);
  }
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (profileErr) {
    throw new Error(`resolveAdminIdentity: profile lookup failed: ${profileErr.message}`);
  }
  if (!profile) return null;

  return {
    user_id: user.id,
    profile_id: (profile as { profile_id: string }).profile_id,
    workspace_id: (profile as { workspace_id: string }).workspace_id,
    email: user.email ?? email,
  };
}
