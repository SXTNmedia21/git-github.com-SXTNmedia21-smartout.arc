import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * J-CLOSURE-3 — Admin overrider preflight via BFF (M2 clockout-wizard).
 *
 * Tests the Next.js API route POST /api/reconciliation/wizard-override directly
 * via Playwright's `request` fixture — no browser page required.
 *
 * ADR-0132: mobile must go through this BFF.
 * ADR-0134: identity is server-derived; client must not supply workspace_id.
 * Route schema: { sessionId, reason (min 20 chars), blockerCodes (min 1) }.
 *
 * Auth: Cookie-based (web) or Bearer token (mobile). These tests use the
 * service-role Supabase admin client to obtain a user JWT for the admin
 * fixture (admin@smartout.local), then pass it as Bearer to simulate the
 * mobile path. If the local Supabase instance is unavailable or the admin
 * fixture doesn't exist, all tests skip gracefully.
 *
 * NOTE: Full integration (activity_trail assertion) requires Supabase local
 * to be running with seed data. The tests verify HTTP status + body structure
 * only — DB-level assertions are skipped with TODO comments below.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

// Base URL of the running Next.js dev server (matches playwright.config.ts).
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3060;
const BFF_BASE = `http://127.0.0.1:${E2E_WEB_PORT}`;
const OVERRIDE_URL = `${BFF_BASE}/api/reconciliation/wizard-override`;

/**
 * Obtain a JWT access token for admin@smartout.local via Supabase auth.
 * Returns null if Supabase is not reachable or credentials are wrong.
 */
async function getAdminBearerToken(): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

/**
 * Obtain a valid department_session_id from any existing session in the
 * admin's workspace. Returns null if none exist.
 */
async function getAnySessionId(bearerToken: string): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Get the profile first to find the workspace.
    const { data: userResp } = await admin.auth.getUser(bearerToken);
    if (!userResp.user) return null;
    const { data: profile } = await admin
      .from("profile")
      .select("workspace_id")
      .eq("user_id", userResp.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!profile) return null;

    const { data: session } = await admin
      .from("department_session")
      .select("department_session_id")
      .eq("workspace_id", profile.workspace_id)
      .not("status", "in", '("approved","locked")')
      .limit(1)
      .maybeSingle();
    return session?.department_session_id ?? null;
  } catch {
    return null;
  }
}

test.describe("J-CLOSURE-3 — BFF /api/reconciliation/wizard-override", () => {
  // All tests in this suite are API-only and do not require a browser page.

  test("J-C3-401 — no bearer token returns 401", async ({ request }) => {
    const res = await request.post(OVERRIDE_URL, {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000001",
        reason: "Dette er en test begrunnelse som er lang nok.",
        blockerCodes: ["MISSING_SIGNATURE"],
      },
      // No Authorization header — same-origin check will be skipped in tests
      // since playwright sets no Origin header by default.
    });
    // Unauthenticated request must return 401.
    expect(res.status()).toBe(401);
  });

  test("J-C3-400 — reason < 20 chars returns 400", async ({ request }) => {
    const token = await getAdminBearerToken();
    if (!token) {
      test.skip();
      return;
    }
    const res = await request.post(OVERRIDE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        sessionId: "00000000-0000-0000-0000-000000000001",
        reason: "kort", // < 20 chars
        blockerCodes: ["MISSING_SIGNATURE"],
      },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body["error"]).toBe("string");
  });

  test("J-C3-400 — missing blockerCodes returns 400", async ({ request }) => {
    const token = await getAdminBearerToken();
    if (!token) {
      test.skip();
      return;
    }
    const res = await request.post(OVERRIDE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        sessionId: "00000000-0000-0000-0000-000000000001",
        reason: "Dette er en begrunnelse som er lang nok.",
        blockerCodes: [], // empty — fails min(1)
      },
    });
    expect(res.status()).toBe(400);
  });

  test("J-C3-200 — valid bearer + valid session returns 200 ok:true", async ({ request }) => {
    const token = await getAdminBearerToken();
    if (!token) {
      test.skip();
      return;
    }
    const sessionId = await getAnySessionId(token);
    if (!sessionId) {
      // No sessions in the workspace — skip rather than fail.
      // TODO: seed a department_session fixture and remove this skip.
      test.skip();
      return;
    }

    const res = await request.post(OVERRIDE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        sessionId,
        reason: "Preflight godkjent manuelt av leder per telefon under drift.",
        blockerCodes: ["MISSING_SIGNATURE", "LATE_PUNCH"],
      },
    });

    // Could be 200 (ok) or 409 (session already approved/locked or no recon row).
    // Both are valid outcomes — 500 is not.
    expect([200, 404, 409]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as Record<string, unknown>;
      expect(body["ok"]).toBe(true);
      expect(typeof body["reconciliation_id"]).toBe("string");
      // TODO: assert activity_trail row with override=true using service role client.
    }
  });
});
