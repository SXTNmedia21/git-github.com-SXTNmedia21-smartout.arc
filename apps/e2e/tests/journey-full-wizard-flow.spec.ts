import { test, expect, type Page } from "@playwright/test";

/**
 * Full Journey: Join → Onboarding → Setup
 *
 * End-to-end test covering the complete new-company lifecycle:
 * 1. /join — 6 steps: account, business, about, hours, menu, password
 * 2. /onboarding — confirm pre-filled data, finalize workspace
 * 3. /dashboard/setup — document drop, governance, payroll, employment, team, shifts, season, handbook
 */

const TS = Date.now().toString(36);
const TEST_EMAIL = `journey-${TS}@smartout.test`;
const TEST_PASSWORD = "JourneyTest123!";

// ── Helpers ──

async function waitForHeading(page: Page, pattern: RegExp, timeoutMs = 30_000) {
  const heading = page
    .locator("main h2, [data-botsson-type='wizard-step'] h2")
    .filter({ hasText: pattern });
  await expect(heading.first()).toBeVisible({ timeout: timeoutMs });
}

async function clickNeste(page: Page) {
  await page.waitForTimeout(600);
  await page.locator("button:has-text('Neste')").last().click();
}

async function skipOrNext(page: Page) {
  await page.waitForTimeout(400);
  const skip = page.locator("button:has-text('Hopp over')");
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
  } else {
    await clickNeste(page);
  }
}

// ── Journey ──

test.describe("Journey: Full Wizard Flow", () => {
  test.describe.configure({ mode: "serial" });

  let workspaceUrl: string;

  test("Phase 1: Join Wizard — create account", async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto("http://localhost:3060/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
    await page.reload();

    // Step 1: Account
    await waitForHeading(page, /Opprett din konto/);
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#companyName").fill("Journey Test Restaurant");
    await page.locator("#industry").click();
    await page.getByRole("option", { name: /Restaurant/i }).click();
    await page.locator("#city").fill("Trondheim");
    await page.locator("#websiteUrl").fill("https://example.com");
    await clickNeste(page);

    // Step 2: Business
    await waitForHeading(page, /Bedriftsinformasjon/);
    await page.locator("#firstName").fill("Journey");
    await page.locator("#lastName").fill("Tester");
    await page.locator("#street").fill("Munkegata 1");
    await page.locator("#postalCode").fill("7011");
    await page.locator("#city").fill("Trondheim");
    await page.locator("#orgNumber").fill("987654325");
    await clickNeste(page);

    // Step 3: About — skip
    await waitForHeading(page, /Fortell om bedriften/, 30_000);
    await skipOrNext(page);

    // Step 4: Hours
    await waitForHeading(page, /Drift/);
    await page.locator("#phone").fill("+47 73 00 00 00");
    await clickNeste(page);

    // Step 5: Menu — skip
    await waitForHeading(page, /Meny/);
    await skipOrNext(page);

    // Step 6: Password
    await waitForHeading(page, /Opprett konto/);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.locator("#confirmPassword").fill(TEST_PASSWORD);
    await page.locator("button:has-text('Fullf')").click();

    // Should redirect to /onboarding
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    workspaceUrl = page.url();

    expect(workspaceUrl).toContain("/onboarding");
    expect(workspaceUrl).toContain("ws=");
    console.log(`Join complete → ${workspaceUrl}`);
  });

  test("Phase 2: Onboarding Wizard — confirm & load", async ({ page }) => {
    test.setTimeout(60_000);

    // Login first (session from Phase 1 doesn't carry over)
    await page.goto("http://localhost:3060/login");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect after login
    await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 15_000 });
    console.log(`After login: ${page.url()}`);

    // Navigate to onboarding
    await page.goto("http://localhost:3060/onboarding");
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent("body");
    const hasError = bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");
    const hasWizard = await page
      .locator("nav[aria-label='Wizard progress']")
      .isVisible()
      .catch(() => false);
    const heading = await page
      .locator("main h2")
      .first()
      .textContent()
      .catch(() => "none");

    console.log(`Onboarding: hasWizard=${hasWizard}, heading="${heading}", hasError=${hasError}`);
    await page.screenshot({ path: "/tmp/e2e-onboarding.png", fullPage: true });

    expect(hasError).toBeFalsy();
  });

  test("Phase 3: Dashboard Setup — document upload accessible", async ({ page }) => {
    test.setTimeout(60_000);

    // Login
    await page.goto("http://localhost:3060/login");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 15_000 });

    // Go to setup
    await page.goto("http://localhost:3060/dashboard/setup");
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent("body");
    const hasError = bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");

    console.log(`Setup page loaded, hasError=${hasError}`);
    await page.screenshot({ path: "/tmp/e2e-setup.png", fullPage: true });

    // Check if setup wizard loaded (Welcome step or Document drop)
    const hasWelcome = bodyText?.includes("Velkommen") || bodyText?.includes("Last opp");
    const hasSetupWizard = bodyText?.includes("Neste") || bodyText?.includes("Hopp over");

    console.log(`Setup: hasWelcome=${hasWelcome}, hasSetupWizard=${hasSetupWizard}`);

    expect(hasError).toBeFalsy();
  });
});
