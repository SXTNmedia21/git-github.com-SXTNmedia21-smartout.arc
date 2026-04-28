/**
 * journey-invite-create-account.spec.ts
 *
 * End-to-end regression for the "invitee creates account from invite link" path:
 *   Pending invitation exists → invitee opens /invite/<token> → page renders
 *   `valid_new_user` → invitee submits signup (token + first/last/password) →
 *   accept-invitation Edge Function creates auth user + user_identity + profile
 *   (status: trainee) + company_member + flips invitation.status to accepted.
 *
 * Why two cases:
 *   1. UI smoke — open the invite landing page, assert the workspace context +
 *      "Opprett konto" CTA renders, click it, assert /signup?invite=<token>
 *      arrives with the invite param preserved. This is the part of the flow
 *      that lives in the web app today (web /signup hands off to /join — full
 *      web acceptance writeback is not yet wired here per JOURNEY-employee-
 *      invitation-accept.md, only mobile calls accept-invitation directly).
 *
 *   2. API contract — call the accept-invitation Edge Function the same way
 *      `apps/mobile/app/(auth)/verify.tsx:289` does: with token + first_name
 *      + last_name + email + password (no Bearer — anon flow). Assert the DB
 *      side-effects documented in `docs/journeys/employee-invitation-accept.md`
 *      §"Database Effects". This is the canonical happy-path: when web finally
 *      wires the writeback (or mobile remains the only consumer), this test
 *      covers it either way because it talks to the function directly.
 *
 * Auth model: the Edge Function is invoked anonymously (anon key + token as
 *   credential). `service_role` is used in the test only to seed and assert.
 *
 * Scope guard: this spec does NOT modify app code. If a regression appears in
 *   the function or the page, we fail the test and report — no app patches.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";

// ── Seed constants (from supabase/seed.sql) ──────────────────────────────────
const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const SEED_COMPANY_ID = "a0000000-0000-0000-0000-000000000000";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const WEB_URL = process.env.E2E_WEB_URL ?? "http://127.0.0.1:3060";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function uniqueEmail(prefix = "e2e-accept"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function isWebServerUp(): Promise<boolean> {
  try {
    await fetch(`${WEB_URL}/login`, { method: "HEAD", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed a pending invitation directly via service-role. We bypass /api/admin/invite
 * because that path is already covered by `journey-employee-invitation.spec.ts`
 * — here we want full control over `expires_at` + minimal coupling to the BFF.
 */
async function seedInvitation(email: string): Promise<{ token: string; invitation_id: string }> {
  const { data, error } = await supabase
    .from("invitation")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      company_id: SEED_COMPANY_ID,
      email,
      role: "employee",
      status: "pending",
      invite_type: "link",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("invitation_id, token")
    .single();
  if (error || !data) throw new Error(`seed failed: ${error?.message}`);
  return { token: data.token, invitation_id: data.invitation_id };
}

/**
 * Drop the rows the test created. Set KEEP_E2E_INVITATIONS=1 to retain them so
 * the invite link in Mailpit + the created auth user stay alive for manual
 * inspection between runs.
 */
async function cleanup(email: string): Promise<void> {
  if (process.env.KEEP_E2E_INVITATIONS === "1") return;

  await supabase.from("invitation").delete().eq("email", email);

  const { data: identities } = await supabase
    .from("user_identity")
    .select("user_id")
    .eq("email", email);

  if (identities && identities.length > 0) {
    for (const u of identities) {
      await supabase.from("profile").delete().eq("user_id", u.user_id);
      await supabase.from("company_member").delete().eq("user_id", u.user_id);
      await supabase.auth.admin.deleteUser(u.user_id).catch(() => {
        /* user may have been removed already */
      });
    }
  }
}

/**
 * Call accept-invitation the same way the mobile app does. Returns parsed
 * JSON + HTTP status. Anon key is used for both `apikey` and `Authorization`
 * because this is the unauthenticated web/mobile signup flow.
 */
async function callAcceptInvitation(payload: {
  token: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invitation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Journey — Invitee creates account from invite link", () => {
  test("UI: /invite/<token> renders valid_new_user and links to /signup with invite param", async ({
    page,
  }) => {
    if (!(await isWebServerUp())) {
      test.skip(true, "Web dev server not running");
      return;
    }

    const email = uniqueEmail("e2e-ui-accept");
    const { token } = await seedInvitation(email);

    try {
      await page.goto(`${WEB_URL}/invite/${token}`);
      await page.waitForLoadState("domcontentloaded");

      // Workspace context renders — proves get_invitation_by_token RPC resolved
      // and page returned the valid_new_user branch (not the "invalid" / "used"
      // / "expired" branches which would render different copy).
      await expect(page.getByText("HQ Workspace", { exact: false }).first()).toBeVisible({
        timeout: 10_000,
      });

      // CTA copy from invite-token-client.tsx:317.
      const cta = page.getByRole("button", { name: /Opprett konto og bli med/i }).first();
      await expect(cta).toBeVisible();

      await cta.click();
      await page.waitForURL(/\/signup\?.*invite=/, { timeout: 10_000 });

      // The invite token is preserved as the `invite` query param so /signup
      // can forward it through the auth callback and pick up the invitation
      // server-side. Per ADR-0167 the token IS the credential — this is why
      // we never log it, but we DO carry it through same-origin navigation.
      const url = new URL(page.url());
      expect(url.pathname).toBe("/signup");
      expect(url.searchParams.get("invite")).toBe(token);
    } finally {
      await cleanup(email);
    }
  });

  test("API: anon caller signs up via accept-invitation → user_identity + profile + company_member created, invitation accepted", async () => {
    const email = uniqueEmail("e2e-api-accept");
    const { token, invitation_id } = await seedInvitation(email);

    try {
      const { status, body } = await callAcceptInvitation({
        token,
        first_name: "E2E",
        last_name: "Accept",
        email,
        password: "test-password-1234",
      });

      expect(status, `accept-invitation returned ${status}: ${JSON.stringify(body)}`).toBe(200);
      expect(body.success).toBe(true);
      expect(body.workspace_id).toBe(SEED_WORKSPACE_ID);
      expect(typeof body.profile_id).toBe("string");

      // 1. Invitation row flipped to accepted.
      // Note: schema has NO `accepted_at` / `accepted_by` columns despite what
      // docs/journeys/employee-invitation-accept.md §"Database Effects" claims —
      // the function only flips `status` and may bump `updated_at`.
      const { data: inv } = await supabase
        .from("invitation")
        .select("status, updated_at")
        .eq("invitation_id", invitation_id)
        .single();
      expect(inv?.status).toBe("accepted");
      expect(inv?.updated_at).toBeTruthy();

      // 2. user_identity exists for the new auth user.
      const { data: identity } = await supabase
        .from("user_identity")
        .select("user_id, email, first_name, last_name")
        .eq("email", email)
        .single();
      expect(identity).not.toBeNull();
      expect(identity?.first_name).toBe("E2E");
      expect(identity?.last_name).toBe("Accept");

      // 3. profile created in the target workspace with status=trainee + role from invite.
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id, status, role, user_id")
        .eq("profile_id", body.profile_id as string)
        .single();
      expect(profile?.workspace_id).toBe(SEED_WORKSPACE_ID);
      expect(profile?.status).toBe("trainee");
      expect(profile?.role).toBe("employee");
      expect(profile?.user_id).toBe(identity?.user_id);

      // 4. company_member exists linking auth user → company.
      // Note: company_member.role is the company-level role ("member" / "admin"
      // / "owner"), distinct from profile.role (the workspace-level role from
      // the invite). No `profile_id` FK on this table — the join is via user_id.
      const { data: member } = await supabase
        .from("company_member")
        .select("user_id, company_id, role, is_active")
        .eq("user_id", identity!.user_id)
        .eq("company_id", SEED_COMPANY_ID)
        .single();
      expect(member).not.toBeNull();
      expect(member?.is_active).toBe(true);
    } finally {
      await cleanup(email);
    }
  });

  test("API: short password is rejected (400)", async () => {
    const email = uniqueEmail("e2e-bad-pw");
    const { token } = await seedInvitation(email);

    try {
      const { status, body } = await callAcceptInvitation({
        token,
        first_name: "E2E",
        last_name: "BadPw",
        email,
        password: "short",
      });

      expect(status).toBe(400);
      expect(String(body.error)).toMatch(/at least 8 characters/i);
    } finally {
      await cleanup(email);
    }
  });

  test("API: missing first_name/last_name is rejected (400)", async () => {
    const email = uniqueEmail("e2e-missing-name");
    const { token } = await seedInvitation(email);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ token, password: "test-password-1234", email }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      expect(res.status).toBe(400);
      expect(String(body.error)).toMatch(/missing required fields/i);
    } finally {
      await cleanup(email);
    }
  });

  test("API: idempotency — calling accept twice with the same token returns 404 on the second call", async () => {
    const email = uniqueEmail("e2e-idempotent");
    const { token } = await seedInvitation(email);

    try {
      const first = await callAcceptInvitation({
        token,
        first_name: "E2E",
        last_name: "First",
        email,
        password: "test-password-1234",
      });
      expect(first.status).toBe(200);

      // Second call: invitation is now status=accepted, function filters
      // `eq('status', 'pending')` so the lookup returns no row → 404.
      const second = await callAcceptInvitation({
        token,
        first_name: "E2E",
        last_name: "Second",
        email,
        password: "test-password-1234",
      });
      expect(second.status).toBe(404);
      expect(String(second.body.error)).toMatch(/invalid or expired/i);
    } finally {
      await cleanup(email);
    }
  });
});

/** Reserve loginAsAdmin import — keeps the helper warm for follow-up tests
 *  that need an admin viewer on the same /invite/<token> page (e.g. authn
 *  drift detection: signed-in admin must NOT be auto-accepted as the invitee
 *  per accept-invitation:99). */
void loginAsAdmin;
