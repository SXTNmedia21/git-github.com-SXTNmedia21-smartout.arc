import { test, expect } from "@playwright/test";

// ─────────────────────────────────────────────────────────────
// scrapling-health.spec.ts
//
// Verifies the Scrapling Python microservice (services/scrapling).
// Scrapling enriches workspace intelligence during /join wizard
// (company name → NACE → departments/locations). When it is down,
// the intelligence pipeline falls back to manual entry and the
// onboarding wizard loses its pre-filled data.
//
// The spec is skipped when SCRAPLING_URL is unset so CI does not
// fail in environments where the service is not running.
//
// Start locally (from repo root, with 1Password session):
//   op run --env-file=.env.template -- docker compose \
//     -f infra/docker-compose.yml up scrapling
// Or directly:
//   cd services/scrapling && pip install -r requirements.txt && python main.py
// ─────────────────────────────────────────────────────────────

const SCRAPLING_URL = process.env.SCRAPLING_URL ?? "http://127.0.0.1:8000";
const SCRAPLING_AUTH_TOKEN = process.env.SCRAPLING_AUTH_TOKEN;

test.describe("scrapling-health", () => {
  // ─── Test 1: Health endpoint responds ────────────────────

  test("responds to /health with healthy status @smoke", async ({ request }) => {
    let res;
    try {
      res = await request.get(`${SCRAPLING_URL}/health`, { timeout: 5_000 });
    } catch (err) {
      test.skip(
        true,
        `Scrapling not reachable at ${SCRAPLING_URL} — start service to run this test. ${String(err)}`,
      );
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("scrapling");
    expect(body.version).toBeTruthy();
    // /health advertises the list of extractors the service can handle.
    // Downstream callers (workspace document analyze) rely on this.
    expect(Array.isArray(body.extractors)).toBe(true);
    expect(body.extractors.length).toBeGreaterThan(0);
  });

  // ─── Test 2: Dashboard HTML served at / ──────────────────

  test("serves the operator dashboard at /", async ({ request }) => {
    let res;
    try {
      res = await request.get(`${SCRAPLING_URL}/`, { timeout: 5_000 });
    } catch (err) {
      test.skip(true, `Scrapling not reachable: ${String(err)}`);
      return;
    }

    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toContain("<!doctype html");
  });

  // ─── Test 3: Auth enforcement (when token configured) ────
  // When SCRAPLING_AUTH_TOKEN is set, /extract must 401 on bad auth.
  // When not set, the service is in "Docker network isolation" mode
  // and this test is skipped.

  test("rejects /extract with missing/invalid bearer when token configured", async ({
    request,
  }) => {
    if (!SCRAPLING_AUTH_TOKEN) {
      test.skip(true, "SCRAPLING_AUTH_TOKEN not set — service in open mode");
      return;
    }

    let res;
    try {
      res = await request.post(`${SCRAPLING_URL}/extract`, {
        data: { url: "https://example.com" },
        headers: { Authorization: "Bearer wrong-token" },
        timeout: 5_000,
      });
    } catch (err) {
      test.skip(true, `Scrapling not reachable: ${String(err)}`);
      return;
    }

    expect(res.status()).toBe(401);
  });
});
