import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";

// ─────────────────────────────────────────────────────────────
// website-setup-wizard-deep.spec.ts
//
// Companion to journey-website-factory.spec.ts. That suite covers
// the happy-path template gallery + CRUD. This spec covers the
// wizard-specific gaps:
//   • Navigating to /dashboard/website/setup from empty state
//   • Template cards render with preview + select affordances
//   • Preview does not hang the page (no runtime error)
//   • When scrapling is running, site-generation plumbing is reachable
//   • No app-code fix is in scope — if a step explodes, test is red
//
// The website factory uses scrapling indirectly via /api/scrape/* for
// brand asset extraction. When SCRAPLING_URL is unset or unreachable,
// tests that need generation are marked as skip rather than failing CI.
// ─────────────────────────────────────────────────────────────

const SCRAPLING_URL = process.env.SCRAPLING_URL ?? "http://127.0.0.1:8000";
// Seed workspace owned by admin@smartout.local — matches the workspace
// loginAsAdmin lands the admin session in. Hard-coded in seed.sql so the
// e2e fixtures can refer to it without a lookup round-trip.
const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

async function scraplingReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPLING_URL}/health`, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureNoWebsite(): Promise<string | null> {
  // Always target the admin's seed workspace. A `.limit(1).single()`
  // without a filter picks an arbitrary row — if the DB has any other
  // workspace (dev seed, another spec's leftovers) we'd silently flip
  // has_website on the wrong tenant and poison unrelated tests.
  const { data: ws, error } = await supabase
    .from("workspace")
    .select("workspace_id, has_website")
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .maybeSingle();
  if (error) throw new Error(`ensureNoWebsite lookup failed: ${error.message}`);
  if (!ws) return null;

  if (ws.has_website) {
    await supabase
      .from("workspace")
      .update({ has_website: false })
      .eq("workspace_id", ws.workspace_id);
  }
  return ws.workspace_id;
}

async function loginAndDismissSetup(page: Parameters<typeof loginAsAdmin>[0]) {
  await loginAsAdmin(page);
  const skipBtn = page.locator("text=Hopp over og gå til dashboard");
  if (await skipBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
  }
}

test.describe("website-setup-wizard-deep", () => {
  test.describe.configure({ mode: "serial" });

  let workspaceId: string | null = null;

  test.beforeAll(async () => {
    workspaceId = await ensureNoWebsite();
  });

  // ─── Test 1: Setup page renders the template gallery ────────

  test("setup page shows at least one template card @smoke", async ({ page }) => {
    await loginAndDismissSetup(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });

    await expect(page.locator("text=Restaurant Classic").first()).toBeVisible({
      timeout: 15_000,
    });
    const previewBtns = page.locator("text=Forhåndsvisning");
    expect(await previewBtns.count()).toBeGreaterThan(0);
  });

  // ─── Test 2: Preview does not produce a runtime error ───────

  test("clicking a template preview does not throw a runtime error", async ({ page }) => {
    await loginAndDismissSetup(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });

    await expect(page.locator("text=Restaurant Classic").first()).toBeVisible({
      timeout: 15_000,
    });

    const previewBtn = page.locator("text=Forhåndsvisning").first();
    await previewBtn.click();
    await page.waitForTimeout(2_000);

    const bodyText = await page.textContent("body");
    expect(bodyText?.includes("Runtime Error") || bodyText?.includes("Application error")).toBe(
      false,
    );
  });

  // ─── Test 3: Back navigation from setup returns to overview ─

  test("navigating back from /dashboard/website/setup lands on /dashboard/website or /dashboard", async ({
    page,
  }) => {
    await loginAndDismissSetup(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Restaurant Classic").first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goBack();
    await page.waitForTimeout(1_500);
    // Either explicit dashboard/website, or if entered directly, root dashboard.
    expect(page.url()).toMatch(/\/dashboard($|\/)/);
  });

  // ─── Test 4: Setup page requires auth ───────────────────────

  test("unauthenticated visit to /dashboard/website/setup redirects to /login", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain("/login");
    await context.close();
  });

  // ─── Test 5: Scrapling-gated generation plumbing reachable ──
  // The website factory calls /api/scrape/public for brand assets on
  // generation. When scrapling is running, hit the proxy route and
  // confirm it returns a JSON body (not HTML error). When scrapling
  // is down, skip — the proxy route is designed to 503 and that path
  // is already tested in scrapling-health.spec.ts.

  test("scrape proxy route responds with JSON when scrapling is up", async ({ page, request }) => {
    const up = await scraplingReachable();
    if (!up) {
      test.skip(true, "Scrapling not running at SCRAPLING_URL");
      return;
    }
    await loginAndDismissSetup(page);

    // The proxy requires SCRAPLING_SERVICE_URL to be set on the Next
    // server. The Playwright dev server might not have it — then we
    // expect a 503 JSON, which is still "route is wired and returns JSON".
    const res = await request.post("http://127.0.0.1:3060/api/scrape/raw", {
      data: { url: "https://example.com" },
      failOnStatusCode: false,
    });

    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toContain("application/json");
    // Any status is acceptable (200/401/503) — the regression we guard
    // is "route returned HTML or 500 without a parseable body".
    expect([200, 400, 401, 403, 500, 502, 503]).toContain(res.status());
  });
});
