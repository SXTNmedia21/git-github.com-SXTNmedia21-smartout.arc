/**
 * auth-invitation.ts — E2E helpers for the Auth & Invitation P1 suite.
 *
 * Why: the 10 auth+invitation journeys need shared utilities that the
 * generic `auth.ts` + `seed.ts` helpers don't cover — Mailpit link parsing,
 * invitation row seeding/cleanup, and a login helper that does NOT wait
 * for /dashboard (since middleware redirects `/dashboard` → `/select-workspace`
 * on the portal subdomain per L-0089 & the Q19 council verdict).
 *
 * All helpers use the service-role client from `./seed.ts`.
 */

import type { Page } from "@playwright/test";
import { supabase } from "./seed";

// ---------------------------------------------------------------------------
// Test identities — re-used across the 10 specs. These land in auth.users
// once `seedAuthInvitationFixture()` runs at spec start.
// ---------------------------------------------------------------------------

export const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
export const HQ_COMPANY_ID = "a0000000-0000-0000-0000-000000000000";

// Existing seeded admin — owner of HQ Workspace. Already in seed.sql.
export const ADMIN_EMAIL = "admin@smartout.local";
export const ADMIN_PASSWORD = "password123";

// Existing seeded employee — used as "existing user" for variant-A accept
// + as "returning user happy-path login" target.
export const EXISTING_USER_EMAIL = "anna@smartout.local";
export const EXISTING_USER_PASSWORD = "password123";

// Seeded by this module at first run: user with TWO workspace memberships.
export const MULTI_USER_EMAIL = "invitation-test-multi@smartout.test";
export const MULTI_USER_PASSWORD = "password123";
export const MULTI_SECOND_WORKSPACE_ID = "b0000000-0000-0000-0000-00000000e2e2";
export const MULTI_SECOND_WORKSPACE_SLUG = "e2e-second-workspace";

// ---------------------------------------------------------------------------
// Mailpit — Supabase Local ships Mailpit on :54324 (see `supabase status`).
// The API shape is documented at https://mailpit.axllent.org/docs/api-v1/ .
// ---------------------------------------------------------------------------

const MAILPIT_BASE = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitMessage = {
  ID: string;
  From: { Name: string; Address: string };
  To: Array<{ Name: string; Address: string }>;
  Subject: string;
  Created: string;
};

type MailpitListResponse = {
  total: number;
  messages: MailpitMessage[];
};

/** Clear the Mailpit inbox so a test starts from zero. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_BASE}/api/v1/messages`, { method: "DELETE" });
}

/**
 * Poll Mailpit for the most recent message to `address`. Returns the full
 * HTML body + first embedded http(s) URL pointing at the web app.
 */
export async function waitForMagicLinkEmail(
  address: string,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<{ link: string; body: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const pollMs = options.pollMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const search = new URLSearchParams({ query: `to:${address}`, limit: "10" });
    const res = await fetch(`${MAILPIT_BASE}/api/v1/search?${search.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as MailpitListResponse;
      if (data.messages && data.messages.length > 0) {
        const msg = data.messages[0];
        const full = await fetch(`${MAILPIT_BASE}/api/v1/message/${msg.ID}`);
        if (full.ok) {
          const detail = (await full.json()) as { HTML?: string; Text?: string };
          const body = detail.HTML ?? detail.Text ?? "";
          // Supabase inserts either /auth/v1/verify?...&redirect_to=... or
          // a raw redirect. We want the redirect target (the web app URL).
          // Match http(s) URLs and prefer one that targets our portal host.
          const urls = body.match(/https?:\/\/[^\s"<>]+/g) ?? [];
          // Prefer a URL that leads back to the web app (127.0.0.1 / localhost).
          const preferred = urls.find(
            (u) => u.includes("127.0.0.1:3060") || u.includes("localhost:3060"),
          );
          const link = preferred ?? urls[0] ?? "";
          return { link, body };
        }
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(`Timed out waiting for mail to ${address} within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Invitation seeding — bypasses the Edge Function for deterministic tests.
// ---------------------------------------------------------------------------

type SeedInvitationOpts = {
  email?: string | null;
  phone?: string | null;
  role?: "employee" | "manager" | "admin" | "owner";
  expiresAt?: Date;
  status?: "pending" | "accepted" | "expired" | "cancelled";
  invitedBy?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type SeededInvitation = {
  invitation_id: string;
  token: string;
  email: string | null;
  workspace_id: string;
  status: string;
  expires_at: string;
  opened_at: string | null;
};

/** Insert an invitation row directly (service role). */
export async function seedInvitation(
  workspaceId: string = HQ_WORKSPACE_ID,
  companyId: string = HQ_COMPANY_ID,
  overrides: SeedInvitationOpts = {},
): Promise<SeededInvitation> {
  const {
    email = `invitee-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@smartout.test`,
    role = "employee",
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status = "pending",
    invitedBy = null,
    firstName = null,
    lastName = null,
    phone = null,
  } = overrides;

  const { data, error } = await supabase
    .from("invitation")
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      email,
      phone,
      role,
      status,
      expires_at: expiresAt.toISOString(),
      invited_by: invitedBy,
      first_name: firstName,
      last_name: lastName,
      invite_type: email ? "email" : phone ? "sms" : "link",
    })
    .select("invitation_id, token, email, workspace_id, status, expires_at, opened_at")
    .single();

  if (error) throw new Error(`seedInvitation failed: ${error.message}`);
  return data as SeededInvitation;
}

/** Delete an invitation by id — use inside test.afterEach for cleanup. */
export async function deleteInvitation(invitationId: string): Promise<void> {
  await supabase.from("invitation").delete().eq("invitation_id", invitationId);
}

/** Re-read an invitation row. */
export async function getInvitation(invitationId: string): Promise<SeededInvitation | null> {
  const { data } = await supabase
    .from("invitation")
    .select("invitation_id, token, email, workspace_id, status, expires_at, opened_at")
    .eq("invitation_id", invitationId)
    .maybeSingle();
  return (data as SeededInvitation | null) ?? null;
}

// ---------------------------------------------------------------------------
// Auth user management — create / delete by email, find by email.
// ---------------------------------------------------------------------------

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return hit?.id ?? null;
}

export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const id = await findUserIdByEmail(email);
  if (!id) return;
  // Delete profile rows first to satisfy FKs — do not rely on CASCADE.
  await supabase.from("profile").delete().eq("user_id", id);
  await supabase.auth.admin.deleteUser(id);
}

/** Stamp welcome_shown_at on the user so /welcome redirects to /dashboard. */
export async function setWelcomeShown(userId: string, shown: boolean): Promise<void> {
  const metadata = shown
    ? { welcome_shown_at: new Date().toISOString() }
    : { welcome_shown_at: null };
  await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata });
}

// ---------------------------------------------------------------------------
// Multi-workspace fixture — creates a second workspace + membership for
// MULTI_USER_EMAIL so /select-workspace renders >=2 cards.
// ---------------------------------------------------------------------------

export async function ensureMultiWorkspaceFixture(): Promise<{
  userId: string;
  firstWorkspaceId: string;
  secondWorkspaceId: string;
}> {
  // 1. Ensure the auth user exists with a known password.
  let userId = await findUserIdByEmail(MULTI_USER_EMAIL);
  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: MULTI_USER_EMAIL,
      password: MULTI_USER_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`create multi user: ${error?.message}`);
    userId = data.user.id;
  } else {
    // Reset password so test assumptions hold even across local-DB churn.
    await supabase.auth.admin.updateUserById(userId, { password: MULTI_USER_PASSWORD });
  }

  // 2. Ensure a user_identity row exists (seed.sql already has one for HQ
  //    admin; the auth trigger may or may not create it for new users).
  await supabase.from("user_identity").upsert(
    {
      user_id: userId,
      first_name: "Multi",
      last_name: "Tester",
    },
    { onConflict: "user_id" },
  );

  // 3. Ensure the second workspace exists.
  await supabase.from("workspace").upsert(
    {
      workspace_id: MULTI_SECOND_WORKSPACE_ID,
      company_id: HQ_COMPANY_ID,
      name: "E2E Second Workspace",
      slug: MULTI_SECOND_WORKSPACE_SLUG,
      country: "NO",
      currency: "NOK",
      language: "no",
      timezone: "Europe/Oslo",
      is_active: true,
      onboarding_completed: true,
    },
    { onConflict: "workspace_id" },
  );

  // 4. Ensure profile rows in BOTH workspaces for this user.
  await supabase.from("profile").upsert(
    [
      {
        profile_id: "f0000000-0000-0000-0000-00000000e2e1",
        workspace_id: HQ_WORKSPACE_ID,
        user_id: userId,
        display_name: "Multi Tester",
        profile_code: "MULTI1",
        role: "employee",
        status: "active",
        is_active: true,
      },
      {
        profile_id: "f0000000-0000-0000-0000-00000000e2e2",
        workspace_id: MULTI_SECOND_WORKSPACE_ID,
        user_id: userId,
        display_name: "Multi Tester",
        profile_code: "MULTI2",
        role: "manager",
        status: "active",
        is_active: true,
      },
    ],
    { onConflict: "profile_id" },
  );

  return {
    userId,
    firstWorkspaceId: HQ_WORKSPACE_ID,
    secondWorkspaceId: MULTI_SECOND_WORKSPACE_ID,
  };
}

// ---------------------------------------------------------------------------
// Login helper tuned for the portal auth flow.
// ---------------------------------------------------------------------------

async function dismissNextDevOverlay(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const observer = new MutationObserver(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});
}

/**
 * Portal host we navigate through. 127.0.0.1 (the Playwright baseURL) maps
 * to `{ type: "root" }` in extractSubdomain (apps/web/src/lib/subdomain.ts),
 * which means middleware does NOT apply the portal `/dashboard` →
 * `/select-workspace` redirect. `app.localhost` matches the portal branch —
 * this is the canonical local-dev portal host.
 */
export const PORTAL_BASE = process.env.E2E_PORTAL_BASE ?? "http://app.localhost:3060";

/** Navigate to a portal-subdomain path (app.localhost) instead of 127.0.0.1. */
export async function gotoPortal(page: Page, path: string): Promise<void> {
  const url = path.startsWith("http") ? path : `${PORTAL_BASE}${path}`;
  await page.goto(url);
}

/**
 * Submit the login form and wait for any authenticated transition.
 * Differs from helpers/auth.ts::loginAsAdmin because that helper waits for
 * `/dashboard`. Our tests need to observe the real post-auth path:
 *   portal `/dashboard` → middleware → `/select-workspace`.
 *
 * Uses the `app.localhost` host so middleware recognises us as the portal
 * subdomain (needed for the Q19 post-auth redirect to work).
 */
export async function loginWithPassword(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await gotoPortal(page, "/login");
  await dismissNextDevOverlay(page);

  // Ensure password tab is selected (it's the default, but be defensive in
  // case Wave C7 flipped the default to magic).
  const passwordTab = page.getByRole("button", { name: "E-post og passord", exact: true });
  if (await passwordTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await passwordTab.click().catch(() => {});
  }

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await dismissNextDevOverlay(page);

  const submit = page.locator('button[type="submit"]').first();

  // Multiple retries — Next dev first click can lose focus to hydration.
  let reached = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await submit.click({ force: true });
    try {
      await page.waitForURL(/\/(dashboard|select-workspace|welcome|onboarding|setup)/, {
        timeout: 15_000,
      });
      reached = true;
      break;
    } catch {
      await page.waitForTimeout(1200);
    }
  }

  if (!reached) {
    throw new Error(`Login did not reach an authenticated route. Final URL: ${page.url()}`);
  }
}

/** Sign out — clears cookies in the current context. Tolerates closed contexts. */
export async function signOut(page: Page): Promise<void> {
  try {
    await page.context().clearCookies();
  } catch {
    // Context closed — fine, tests are ending anyway.
  }
}
