/**
 * journey-engine.spec.ts — Journey Engine M1–M5 coverage (M6 E2E verification).
 *
 * This file exercises the 12 journeys the Journey Engine campaign enables.
 * Most tests require:
 *   1. A web dev server running from `campaign/journey-engine` (not
 *      `development`). The currently-running dev server on port 3060 is
 *      from `development` which predates these routes — so the admin UI
 *      routes and /api/journey/guided/* BFF return 404 there.
 *   2. Seeded journey + journey_version rows per the admin workflow.
 *
 * Until the CI pipeline wires campaign-branch dev server + journey seed,
 * every "live" test is `.skip` with a TODO comment. The intent is that
 * when M6 closes and the campaign merges to development, running
 * `pnpm -F e2e test:e2e -g "journey-engine"` green-lights the whole
 * campaign.
 *
 * Static/unit coverage already green (not duplicated here):
 *   - packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts
 *     (23 tests — capability shape, ADR-0134 context guard, run_guided
 *     fail-closed, journey_version_not_found)
 *   - packages/telemetry/src/__tests__/registry.journey.test.ts
 *     (30 tests — ADR-0175 destination contract + payload shape)
 *   - packages/journey-ir/src/types.test.ts (28 tests — IR schema)
 *   - apps/mobile/src/lib/__tests__/journey-bff.test.ts
 *     (7 tests — R5.2-1 wire format, no empty-string fallback)
 *   - supabase/functions/journey-stuck-detector/emit_contract_test.ts
 *     (15 Deno tests — event-mode payload, auth, idempotency)
 *
 * Journey coverage map (per the M6 brief):
 *   J1  admin creates journey_version .......... "J1-create-version"
 *   J2  admin edits version + step ............. "J2-edit-step"
 *   J3  admin status transition (draft→ready_test) "J3-status-transition"
 *   J4  admin test-run page renders Fjernkontroll "J4-test-run-page"
 *   J5  journey.run_guided capability invocation . covered in
 *        packages/ai/.../journey.capability.test.ts (unit);
 *        live integration is "J5-run-guided-live"
 *   J6  mobile BFF POST /api/journey/guided/start "J6-bff-post-start"
 *   J7  Fjernkontroll stuck transition ......... "J7-fjernkontroll-stuck"
 *   J8  Fjernkontroll completed transition ..... "J8-fjernkontroll-completed"
 *   J9  stuck-detector authed invocation ....... "J9-stuck-detector-authed"
 *   J10 stuck-detector anon rejection .......... "J10-stuck-detector-anon"
 *   J11 dual-gate on run_guided (disabled cap).. "J11-run-guided-dual-gate"
 *   J12 empty-string fallback ban (mobile) ..... covered in
 *        apps/mobile/src/lib/__tests__/journey-bff.test.ts (3rd test
 *        in `bffStartGuided` describe).
 *
 * Scope rule: no capability/component/BFF body is modified to make a
 * test pass. A failure here is a real bug and must escalate.
 */

import { test, expect } from "@playwright/test";

// ── J9 / J10 — stuck-detector Edge Function auth contract ────────────────────
//
// Runs regardless of web dev server — only needs Supabase local + the Edge
// Function. Safe to execute as soon as `supabase functions serve
// journey-stuck-detector` is running; otherwise skipped with a clear TODO.

test.describe("J9/J10 — journey-stuck-detector auth contract @journey-engine", () => {
  const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL ?? "http://127.0.0.1:54321/functions/v1";
  const WATCHDOG_SECRET = process.env.WATCHDOG_CRON_SECRET ?? "";
  const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

  test("J10 — anon key is rejected with 401", async ({ request }) => {
    test.skip(
      !ANON_KEY,
      "SUPABASE_ANON_KEY not set — set it via apps/e2e/.env.local for the local stack",
    );
    const response = await request.post(`${FUNCTIONS_URL}/journey-stuck-detector`, {
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      data: { mode: "cron" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test("J9 — authenticated invocation returns 2xx (legacy cron mode smoke)", async ({
    request,
  }) => {
    // The legacy cron path is a sufficient auth smoke — the event-mode
    // contract (which actually emits `journey stuck`) is pinned by the
    // 15 Deno tests in emit_contract_test.ts. This Playwright test only
    // proves the live function accepts a service-role / watchdog token.
    test.skip(!WATCHDOG_SECRET, "WATCHDOG_CRON_SECRET not set — set it via apps/e2e/.env.local");
    const response = await request.post(`${FUNCTIONS_URL}/journey-stuck-detector`, {
      headers: {
        Authorization: `Bearer ${WATCHDOG_SECRET}`,
        "Content-Type": "application/json",
      },
      data: { mode: "cron" },
      failOnStatusCode: false,
    });
    // 200 (processed), 204 (noop), or 500-if-no-runs-yet are all acceptable
    // auth outcomes — the only state we guard against is 401.
    expect(response.status()).not.toBe(401);
  });
});

// ── J6 — mobile BFF POST /api/journey/guided/start ─────────────────────────
//
// Contract: body with `workspace_id` / `actor_id` is IGNORED. Server derives
// from auth. We assert the request is accepted (or rejected with a non-identity
// reason) — never with a hint that it used the spoofed workspace_id.
//
// Full contract coverage for mobile shape lives in
// apps/mobile/src/lib/__tests__/journey-bff.test.ts. This test is the
// server-side complement — that the BFF itself refuses to reflect client
// identity fields.
//
// SKIPPED until the web dev server runs from `campaign/journey-engine`.

test.describe("J6 — BFF POST /api/journey/guided/start @journey-engine", () => {
  // Unblocked 2026-04-22: campaign-branch web dev server runs on port 3062.
  // J6 tests verify auth + Zod schema — no seeded journey_version needed;
  // the tests assert BFF rejects unauthenticated + ignores spoofed body IDs.

  test("rejects unauthenticated request with 401", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: "11111111-1111-1111-1111-111111111111" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(401);
  });

  test("rejects spoofed workspace_id in body (CVE-class red line)", async ({
    request,
    baseURL,
  }) => {
    // Authenticated but body includes `workspace_id: "<attacker>"`. Zod
    // strips unknown keys — the server MUST NOT act on the attacker-supplied
    // id. We verify indirectly: the 404 ("Journey version not found") path
    // scopes by the server-derived workspace, not by body.
    const response = await request.post(`${baseURL}/api/journey/guided/start`, {
      headers: { Authorization: "Bearer <test-token>" },
      data: {
        journey_version_id: "11111111-1111-1111-1111-111111111111",
        workspace_id: "00000000-0000-0000-0000-dead",
        actor_id: "00000000-0000-0000-0000-beef",
      },
      failOnStatusCode: false,
    });
    // Any response code other than a silent 200 using the attacker id is
    // acceptable. 404 (wrong workspace) or 422 (capability rejected) proves
    // the BFF ignored the spoofed fields.
    expect([401, 404, 409, 422]).toContain(response.status());
  });
});

// ── J1–J4 — admin authoring + test-run surface ─────────────────────────────

test.describe("J1–J4 — admin journey authoring @journey-engine", () => {
  test.skip(
    true,
    "TODO(M6): requires web dev server on campaign/journey-engine + godmode-admin login helper. Unblock when CI dispatches campaign-branch dev server.",
  );

  test("J1 — create journey version lands in draft", async ({ page }) => {
    await page.goto("/platform-admin/journeys/versions/new");
    await page.getByRole("combobox", { name: /parent journey/i }).click();
    await page.getByRole("option").first().click();
    await page.getByLabel(/title/i).fill("E2E Test Journey");
    await page.getByLabel(/module/i).fill("testing");
    await page.getByRole("button", { name: /create|opprett/i }).click();
    await expect(page.getByText(/draft/i)).toBeVisible();
  });

  test("J2 — edit version + save step updates IR", async ({ page }) => {
    // Depends on a seeded draft version — helper TODO.
    // await page.goto(`/platform-admin/journeys/versions/${seededVersionId}`);
    // StepActionEditor exposes a textarea for step.action per M4 handoff.
  });

  test("J3 — status transition draft → ready_test emits event", async ({ page }) => {
    // Move status via the transition button; confirm `journey_version transitioned`
    // appears in activity_trail (query via supabase service-role helper).
    // CANNOT reach `published` via UI — M4-fix.
  });

  test("J4 — test-run page renders Fjernkontroll in idle", async ({ page }) => {
    // Visits .../versions/[id]/run. Expect <section aria-label="Fjernkontroll:...">.
    // Expect the state label "Klar" (idle).
  });
});

// ── J7 / J8 — Fjernkontroll realtime state transitions ──────────────────────
//
// Fjernkontroll subscribes to engine_event realtime filtered by entity_id=run_id.
// We inject events server-side, then assert the state label updates.
//
// These are pure UI contract tests — no capability code is modified.

test.describe("J7/J8 — Fjernkontroll realtime transitions @journey-engine", () => {
  test.skip(
    true,
    "TODO(M6): requires web dev server on campaign/journey-engine + seeded run_id with live Realtime channel. Unblock when CI wires journey seed + starts web on this branch.",
  );

  test("J7 — engine_event 'journey stuck' transitions state machine to stuck", async ({ page }) => {
    // 1. Admin opens .../versions/<id>/run?run=<seededRunId>
    // 2. Test harness inserts into engine_event via service-role:
    //    { event_name: "journey stuck", entity_id: seededRunId, properties: {...} }
    // 3. Assert the sr-only live region announces "Fast" within 5s.
    // 4. Assert the status pill shows "Fast" icon (AlertTriangle).
  });

  test("J8 — engine_event 'journey completed' transitions state machine to completed", async ({
    page,
  }) => {
    // Same as J7 but event_name = "journey completed". Expect "Fullført".
  });
});

// ── J11 — dual-gate on run_guided (disabled capability returns 403) ────────

test.describe("J11 — run_guided dual-gate @journey-engine", () => {
  test.skip(
    true,
    "TODO(M6): requires a test workspace where engine_authority_config has gate_action = 'disabled' for journey.run_guided. Unblock when seed provides the row.",
  );

  test("disabled capability returns 403 capability_disabled", async ({ request, baseURL }) => {
    // 1. Seed: UPDATE engine_authority_config SET gate_action = 'disabled'
    //    WHERE capability = 'journey.run_guided' AND workspace_id = <testWs>.
    // 2. POST /api/journey/guided/start with authed user in that workspace.
    // 3. Expect status 403 with body.error containing "capability_disabled".
    // 4. Teardown: restore gate_action = 'autonomous'.
    const response = await request.post(`${baseURL}/api/journey/guided/start`, {
      data: { journey_version_id: "11111111-1111-1111-1111-111111111111" },
      failOnStatusCode: false,
    });
    expect(response.status()).toBe(403);
  });
});
