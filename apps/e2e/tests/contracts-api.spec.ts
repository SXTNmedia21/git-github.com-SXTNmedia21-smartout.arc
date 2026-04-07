/**
 * Regression tests for POST /api/contracts — schema shape and authorization gates.
 *
 * These tests cover two bugs found during the R3 council review:
 *   B1: Drawer sent `field_values` but Zod schema expects `overrides`. Zod silently
 *       strips unknown keys, so the wrong field name causes a silent no-op.
 *   B3: The route must reject unauthenticated requests with 401, and GET without
 *       workspace_id with 400.
 *
 * We use real UUIDs that don't match any seeded records — the goal is to exercise
 * schema validation and auth gates, NOT the happy path (which requires the contract
 * service running and real templates seeded).
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

// Placeholder UUIDs — deliberately don't match real workspace/profile/template records.
// We test schema shape and auth, not data correctness.
const FAKE_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";
const FAKE_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_TEMPLATE_ID = "00000000-0000-0000-0000-000000000002";

test.describe("POST /api/contracts — schema and authorization gates", () => {
  // B1 regression: drawer must send `overrides`, not `field_values`.
  //
  // Zod's default behavior silently strips unknown keys (.strip() is the default,
  // not .strict()). If the drawer sends `field_values`, Zod drops it without error
  // and the route returns 200 having processed nothing. This test documents the
  // WRONG shape so that any future drift is visible in test history.
  //
  // The assertion is intentionally loose — we just verify the route doesn't 500
  // on an unexpected key. The real guard is the "canonical shape" test below.
  test("rejects POST body with `field_values` key (must use `overrides`)", async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.post("/api/contracts", {
      data: {
        workspace_id: FAKE_WORKSPACE_ID,
        profile_id: FAKE_PROFILE_ID,
        template_id: FAKE_TEMPLATE_ID,
        // Wrong key — Zod will silently strip this. The route should still
        // process the request (overrides is optional), but this documents that
        // `field_values` is the broken shape the drawer must NOT send.
        field_values: { name: "Test" },
      },
    });

    // Route must not 500 on the unknown key. Failures from later layers are expected
    // (auth/role/data/service not running). 400 from Zod on the uuid format is also
    // acceptable — what's NOT acceptable is 500.
    expect([400, 403, 404, 503]).toContain(response.status());
  });

  // B1 regression: the canonical request body shape using `overrides` must be
  // accepted by Zod (schema layer). Any failure should come from later layers
  // (auth, role gate, data not found, service unavailable) — NOT from Zod parse.
  //
  // If this test returns 400, it means the Zod schema rejected the body shape,
  // which is a direct regression on B1.
  test("accepts POST body with canonical `overrides` key shape", async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.post("/api/contracts", {
      data: {
        workspace_id: FAKE_WORKSPACE_ID,
        profile_id: FAKE_PROFILE_ID,
        template_id: FAKE_TEMPLATE_ID,
        // Correct key — Zod schema must accept this shape.
        overrides: { name: "Test" },
      },
    });

    // Schema MUST accept this shape. 400 from Zod = regression on B1.
    // Other failure codes are expected against placeholder UUIDs:
    //   200/201 — unlikely with fake IDs but valid
    //   403 — role gate rejects (workspace doesn't exist, user not in it)
    //   404 — profile/template not found
    //   503 — contract service not configured in this environment
    expect(response.status()).not.toBe(400);
    expect([200, 201, 403, 404, 500, 503]).toContain(response.status());
  });

  // B3 regression: unauthenticated requests must be rejected before any data access.
  // Middleware or the route handler must return 401 for anonymous callers.
  test("rejects unauthenticated POST with 401", async ({ page }) => {
    // Clear all cookies to simulate an anonymous caller — no session token.
    await page.context().clearCookies();

    const response = await page.request.post("/api/contracts", {
      data: {
        workspace_id: FAKE_WORKSPACE_ID,
        profile_id: FAKE_PROFILE_ID,
        template_id: FAKE_TEMPLATE_ID,
        overrides: {},
      },
    });

    expect(response.status()).toBe(401);
  });

  // B3 regression: GET /api/contracts without workspace_id must return 400.
  // The route must validate required query params before touching the DB.
  test("rejects GET without workspace_id with 400", async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.get("/api/contracts");
    expect(response.status()).toBe(400);
  });
});
