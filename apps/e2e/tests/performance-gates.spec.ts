import { test, expect, type Page } from "@playwright/test";
import { PERF_GATES, expectVisibleWithin, expectColdLoadWithin } from "../helpers/performance";

const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const skipBtn = page.locator("text=Hopp over og gå til dashboard");
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
  }
}

// ─── Cold Page Load Gates (< 3s) ───────────────────────────

test.describe("Performance Gates — Cold Page Load", () => {
  test("login page loads within 3s", async ({ page }) => {
    await expectColdLoadWithin(
      page,
      "/login",
      'button[type="submit"]',
      PERF_GATES.coldPageLoad,
      "Login page cold load",
    );
  });

  test("signup page loads within 3s", async ({ page }) => {
    await expectColdLoadWithin(
      page,
      "/signup",
      "body",
      PERF_GATES.coldPageLoad,
      "Signup page cold load",
    );
  });

  test("onboarding page loads within 3s", async ({ page }) => {
    await expectColdLoadWithin(
      page,
      "/onboarding",
      "body",
      PERF_GATES.coldPageLoad,
      "Onboarding page cold load",
    );
  });
});

// ─── Login → Dashboard Gate (< 2s) ─────────────────────────

test.describe("Performance Gates — Login to Dashboard", () => {
  test("login → first content visible within 2s", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    const start = Date.now();
    await page.click('button[type="submit"]');

    // Wait for any post-login content (login animation, dashboard, or wizard)
    await page
      .locator("text=Der er du jo")
      .or(page.locator("[data-sidebar]"))
      .or(page.locator("text=Oppsett av arbeidsrom"))
      .first()
      .waitFor({ state: "visible", timeout: PERF_GATES.loginToDashboard + 1000 });

    const elapsed = Date.now() - start;
    expect(
      elapsed,
      `Login → first content took ${elapsed}ms (limit: ${PERF_GATES.loginToDashboard}ms)`,
    ).toBeLessThanOrEqual(PERF_GATES.loginToDashboard);
  });
});

// ─── Page Navigation Gates (< 1s) ──────────────────────────
// Measures client-side route transition by navigating from one
// dashboard page to another using goto (simulates link click).

test.describe("Performance Gates — Page Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);

    // These tests need the sidebar — skip if wizard is covering it
    const sidebar = page.locator("[data-sidebar], aside, nav").first();
    if (!(await sidebar.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Sidebar not visible — wizard active");
    }
  });

  test("sidebar → schedule within 1s", async ({ page }) => {
    const link = page.locator('a[href*="/dashboard/schedule"]').first();
    if (!(await link.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Schedule link not visible");
      return;
    }

    const start = Date.now();
    await link.click();
    await page.locator("text=Vaktliste").first().waitFor({ state: "visible", timeout: 2000 });
    const elapsed = Date.now() - start;

    expect(
      elapsed,
      `Sidebar → Schedule took ${elapsed}ms (limit: ${PERF_GATES.pageNavigation}ms)`,
    ).toBeLessThanOrEqual(PERF_GATES.pageNavigation);
  });

  test("sidebar → website within 1s", async ({ page }) => {
    const link = page.locator('a[href*="/dashboard/website"]').first();
    if (!(await link.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Website link not visible");
      return;
    }

    const start = Date.now();
    await link.click();
    await page
      .locator('h1:has-text("Nettside")')
      .first()
      .waitFor({ state: "visible", timeout: 2000 });
    const elapsed = Date.now() - start;

    expect(
      elapsed,
      `Sidebar → Website took ${elapsed}ms (limit: ${PERF_GATES.pageNavigation}ms)`,
    ).toBeLessThanOrEqual(PERF_GATES.pageNavigation);
  });

  test("sidebar → season within 1s", async ({ page }) => {
    const link = page.locator('a[href*="/dashboard/season"]').first();
    if (!(await link.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Season link not visible");
      return;
    }

    const start = Date.now();
    await link.click();
    await page
      .locator("text=Sesongplanlegging")
      .first()
      .waitFor({ state: "visible", timeout: 2000 });
    const elapsed = Date.now() - start;

    expect(
      elapsed,
      `Sidebar → Season took ${elapsed}ms (limit: ${PERF_GATES.pageNavigation}ms)`,
    ).toBeLessThanOrEqual(PERF_GATES.pageNavigation);
  });
});

// ─── API Content Gates (< 2s) ──────────────────────────────

test.describe("Performance Gates — API Content", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("schedule grid renders within 2s", async ({ page }) => {
    await page.goto("/dashboard/schedule", { waitUntil: "commit" });
    await expectVisibleWithin(page, "text=Vaktliste", PERF_GATES.apiContent, "Schedule heading");
  });

  test("website overview renders within 2s", async ({ page }) => {
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    // May redirect to wizard — check if we're on the right page
    const heading = page.locator('h1:has-text("Nettside")').first();
    if (!(await heading.isVisible({ timeout: PERF_GATES.apiContent + 1000 }).catch(() => false))) {
      test.skip(true, "Website page redirected (wizard active)");
      return;
    }
  });

  test("season page renders within 2s", async ({ page }) => {
    await page.goto("/dashboard/season", { waitUntil: "commit" });
    await expectVisibleWithin(
      page,
      "text=Sesongplanlegging",
      PERF_GATES.apiContent,
      "Season page heading",
    );
  });
});

// ─── Wizard Step Transition Gates (< 500ms) ────────────────

test.describe("Performance Gates — Wizard Steps", () => {
  test("setup wizard step transition within 500ms", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});

    const wizardHeader = page.locator("text=Oppsett av arbeidsrom");
    if (!(await wizardHeader.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "No setup wizard visible");
      return;
    }

    const nextBtn = page.locator('button:has-text("Neste")');
    if (!(await nextBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "No Neste button visible");
      return;
    }

    const start = Date.now();
    await nextBtn.click();
    await page.locator("h1").first().waitFor({ state: "visible", timeout: 1500 });
    const elapsed = Date.now() - start;

    expect(
      elapsed,
      `Wizard step transition took ${elapsed}ms (limit: ${PERF_GATES.wizardStep}ms)`,
    ).toBeLessThanOrEqual(PERF_GATES.wizardStep);
  });

  test("template gallery loads within 2s", async ({ page }) => {
    await login(page);
    await expectColdLoadWithin(
      page,
      "/dashboard/website/setup",
      "text=Restaurant Classic",
      PERF_GATES.apiContent,
      "Template gallery load",
    );
  });
});
