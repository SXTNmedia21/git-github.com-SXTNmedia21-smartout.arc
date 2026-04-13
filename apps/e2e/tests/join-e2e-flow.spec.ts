import { test, expect, type Page } from "@playwright/test";

/**
 * Join Wizard — Full E2E flow with dummy data.
 *
 * Tests the complete /join → signup → /onboarding flow.
 * Uses a unique email per run to avoid "already registered" conflicts.
 */

const UNIQUE_SUFFIX = Date.now().toString(36);
const TEST_EMAIL = `e2e-${UNIQUE_SUFFIX}@smartout.test`;
const TEST_PASSWORD = "TestPass123!";

const DUMMY_DATA = {
  companyName: "E2E Testrestaurant",
  industry: "restaurant",
  city: "Oslo",
  websiteUrl: "https://example.com",
  firstName: "Test",
  lastName: "Bruker",
  street: "Testgata 1",
  postalCode: "0001",
  orgNumber: "987654325",
  phone: "+47 99 99 99 99",
};

/** Helper: get the step heading inside the main content area (not brand panel) */
async function waitForStepHeading(page: Page, pattern: RegExp, timeoutMs = 20_000) {
  const heading = page
    .locator("main h2, [data-botsson-type='wizard-step'] h2")
    .filter({ hasText: pattern });
  await expect(heading.first()).toBeVisible({ timeout: timeoutMs });
  return heading.first();
}

/** Helper: click Neste in WizardNavBar */
async function clickNeste(page: Page) {
  await page.waitForTimeout(600); // let useEffect sync state
  await page.locator("button:has-text('Neste')").last().click();
}

/** Helper: click Hopp over or Neste */
async function skipOrNext(page: Page) {
  await page.waitForTimeout(400);
  const skip = page.locator("button:has-text('Hopp over')");
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
  } else {
    await clickNeste(page);
  }
}

test.describe("join-wizard-e2e", () => {
  test.describe.configure({ mode: "serial" });

  test("full join flow: account → business → about → hours → menu → summary", async ({ page }) => {
    test.setTimeout(120_000);

    // ── Step 1: Account ──
    // Auth (signUp) now happens silently in step 1 after email+password entry.
    // firstName, lastName, password, and confirmPassword all live on step 1.
    await page.goto("http://localhost:3060/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
    await page.reload();
    await waitForStepHeading(page, /Opprett din konto/);
    console.log("Step 1: Account");

    await page.locator("#companyName").fill(DUMMY_DATA.companyName);
    await page.locator("#industry").click();
    await page.getByRole("option", { name: /Restaurant/i }).click();
    await page.locator("#city").fill(DUMMY_DATA.city);
    await page.locator("#email").fill(TEST_EMAIL);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.locator("#confirmPassword").fill(TEST_PASSWORD);
    await page.locator("#firstName").fill(DUMMY_DATA.firstName);
    await page.locator("#lastName").fill(DUMMY_DATA.lastName);

    await clickNeste(page);

    // ── Step 2: Business ──
    // No firstName/lastName here — those moved to step 1.
    await waitForStepHeading(page, /Bedriftsinformasjon/, 30_000);
    console.log("Step 2: Business");

    await page.locator("#street").fill(DUMMY_DATA.street);
    await page.locator("#postalCode").fill(DUMMY_DATA.postalCode);
    await page.locator("#city").fill(DUMMY_DATA.city);
    await page.locator("#orgNumber").fill(DUMMY_DATA.orgNumber);

    await clickNeste(page);
    // ── Step 3: About (skippable) ──
    await waitForStepHeading(page, /Fortell om bedriften/, 30_000);
    console.log("Step 3: About — skipping");
    await skipOrNext(page);

    // ── Step 4: Hours ──
    await waitForStepHeading(page, /Drift/, 15_000);
    console.log("Step 4: Hours");

    await page.locator("#phone").fill(DUMMY_DATA.phone);
    await clickNeste(page);

    // ── Step 5: Menu (skippable) ──
    await waitForStepHeading(page, /Meny/, 15_000);
    console.log("Step 5: Menu — skipping");
    await skipOrNext(page);

    // ── Step 6: Summary (last) ──
    // Step 6 is now a read-only review step ("Alt ser bra ut").
    // Auth already happened silently in step 1. The "Fullfør" button is
    // in the wizard nav bar (isLast=true) — it triggers onComplete directly.
    await waitForStepHeading(page, /Alt ser bra ut/, 15_000);
    console.log("Step 6: Summary — submitting");

    await page.locator("button:has-text('Fullf')").click();

    console.log("Signup submitted, waiting for redirect...");

    // Should redirect to /onboarding or /dashboard
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 });

    const finalUrl = page.url();
    console.log(`Redirected to: ${finalUrl}`);
    expect(finalUrl).toMatch(/\/(onboarding|dashboard)/);

    console.log("E2E Join flow PASSED!");
  });
});
