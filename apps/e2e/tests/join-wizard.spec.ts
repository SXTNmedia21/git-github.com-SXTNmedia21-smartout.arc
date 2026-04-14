import { test, expect, type Page } from "@playwright/test";

/**
 * Join Wizard E2E Tests
 *
 * Tests the /join signup wizard flow using WizardShell.
 *
 * Key architecture notes:
 * - WizardShell does NOT support URL-based step navigation (?step=N).
 *   Navigation is state-driven via "Neste"/"Tilbake" buttons in WizardNavBar.
 * - Sidebar (WizardSidebar) renders step labels from i18n (join.json).
 * - Brand panel no longer exists — replaced by WizardSidebar (lg+ only).
 * - Step content renders inside a <main> element with data-botsson-id attributes.
 * - Each step has a Zod validation schema validated against its substate
 *   (via validationKey). Steps with required fields must be filled before navigating.
 */

/**
 * Navigate forward N steps by clicking the step's own "Neste" button.
 *
 * Steps 1-5 have their own "Neste" button inside the step content area
 * (with local validation + state update). The WizardNavBar also has a
 * "Neste" button. To avoid ambiguity, we target the one inside <main>.
 */
async function clickNextNTimes(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    const stepArea = page.locator('[data-botsson-type="wizard-step"]');
    const stepNeste = stepArea.locator("button", { hasText: "Neste" });

    // If the step has its own Neste button, click it; otherwise fall back to WizardNavBar
    if (await stepNeste.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await stepNeste.click();
    } else {
      // Steps without their own Neste (e.g. step 6, 7) use WizardNavBar
      await page.locator("button", { hasText: "Neste" }).last().click();
    }
    await page.waitForTimeout(300);
  }
}

/**
 * Fill step 1 (account) with valid data so validation passes.
 * Password fields are local component state and not part of wizard validation,
 * so we skip them here — only wizard-persisted fields are required.
 *
 * Industry uses a shadcn Select (Radix), so we click the trigger then pick an option.
 */
async function fillStep1(page: Page) {
  await page.locator('input[id="companyName"]').fill("Strøm Mat & Bar");
  // shadcn Select — click trigger to open popover, then pick option
  await page.locator('[id="industry"]').click();
  await page.getByRole("option").first().click();
  await page.locator('input[id="city"]').fill("Skien");
  await page.locator('input[id="email"]').fill("test@example.com");
  await page.locator('input[id="firstName"]').fill("Test");
  await page.locator('input[id="lastName"]').fill("Bruker");
  // Wait for useEffect to sync local state → wizard state
  await page.waitForTimeout(300);
}

/**
 * Fill step 2 (business) with valid data so validation passes.
 * Org number 911722267 passes the MOD-11 check digit validator.
 */
async function fillStep2(page: Page) {
  await page.locator('input[id="street"]').fill("Langbrygga 5");
  await page.locator('input[id="postalCode"]').fill("3724");
  await page.locator('input[id="city"]').fill("Skien");
  await page.locator('input[id="orgNumber"]').fill("911 722 267");
  await page.waitForTimeout(200);
}

test.describe("join-wizard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Clear any previous wizard state
    await page.goto("/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
  });

  // ─── Test 1: Join page loads with Step 1 ────────────────

  test("join page loads with step 1 visible @smoke", async ({ page }) => {
    await page.goto("/join");

    // WizardShell should render with join-shell data attribute
    await expect(page.locator('[data-botsson-id="join-shell"]')).toBeVisible({ timeout: 10_000 });

    // Step 1 heading (account step)
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Required fields should be present
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="companyName"]')).toBeVisible();
  });

  // ─── Test 2: Navigate to Step 3 via button clicks ───────
  // WizardShell does not support ?step=N URL navigation.
  // We navigate forward by filling required fields then clicking "Neste".
  // Each step validates its own substate via validationKey (e.g. "account", "business").

  test("can navigate to step 3 (about) via Neste buttons", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");

    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Fill step 1 required fields, then advance
    await fillStep1(page);
    await clickNextNTimes(page, 1);

    // Fill step 2 required fields, then advance
    await fillStep2(page);
    await clickNextNTimes(page, 1);

    // Step 3 heading
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    // Three textareas should be visible
    await expect(page.locator('textarea[id="aboutUs"]')).toBeVisible();
    await expect(page.locator('textarea[id="ourHistory"]')).toBeVisible();
    await expect(page.locator('textarea[id="ourConcept"]')).toBeVisible();
  });

  // ─── Test 3: Step 3 gear menu works for AI actions ──────

  test("step 3 shows AI action menu for filled fields", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3 (fill steps 1 + 2 first)
    await fillStep1(page);
    await clickNextNTimes(page, 1);
    await fillStep2(page);
    await clickNextNTimes(page, 1);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    const aboutUs = page.locator('textarea[id="aboutUs"]');
    await aboutUs.fill("Vi er en restaurant i Trondheim.");

    const menuButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-settings2") })
      .first();
    await expect(menuButton).toBeVisible();

    await menuButton.click();

    await expect(page.getByRole("button", { name: "Skriv om" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gjør lengre" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gjør kortere" })).toBeVisible();
  });

  // ─── Test 4: Step 3 navigation buttons work ─────────────

  test("step 3 has back and next buttons", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3 (fill steps 1 + 2 first)
    await fillStep1(page);
    await clickNextNTimes(page, 1);
    await fillStep2(page);
    await clickNextNTimes(page, 1);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    // Back button (in WizardNavBar at bottom)
    const backButton = page.locator("button", { hasText: "Tilbake" }).first();
    await expect(backButton).toBeVisible();

    // Next button — step has its own Neste inside the step area
    const stepArea = page.locator('[data-botsson-type="wizard-step"]');
    const nextButton = stepArea.locator("button", { hasText: "Neste" });
    await expect(nextButton).toBeVisible();

    // Click back → should go to step 2 (business step)
    await backButton.click();

    // Verify we're on step 2 by checking the step content changed
    // WizardShell does not update URL, so we check the DOM instead
    await expect(page.locator('[data-botsson-id="join-business-step"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ─── Test 5: Step 3 textareas are editable ──────────────

  test("step 3 textareas accept user input", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3 (fill steps 1 + 2 first)
    await fillStep1(page);
    await clickNextNTimes(page, 1);
    await fillStep2(page);
    await clickNextNTimes(page, 1);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    const aboutUs = page.locator('textarea[id="aboutUs"]');
    await aboutUs.fill("Vi er en restaurant i Trondheim.");
    await expect(aboutUs).toHaveValue("Vi er en restaurant i Trondheim.");

    const ourHistory = page.locator('textarea[id="ourHistory"]');
    await ourHistory.fill("Siden 2004 har vi servert god mat.");
    await expect(ourHistory).toHaveValue("Siden 2004 har vi servert god mat.");

    const ourConcept = page.locator('textarea[id="ourConcept"]');
    await ourConcept.fill("Fersk sjømat fra lokale leverandører.");
    await expect(ourConcept).toHaveValue("Fersk sjømat fra lokale leverandører.");
  });

  // ─── Test 6: Step 3 → Step 4 navigation works ──────────

  test("can advance from step 3 to step 4", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3 (fill steps 1 + 2 first, step 3 is skippable)
    await fillStep1(page);
    await clickNextNTimes(page, 1);
    await fillStep2(page);
    await clickNextNTimes(page, 1);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    // Click next (step 3 fields are optional/skippable) — use step's own button
    const stepArea = page.locator('[data-botsson-type="wizard-step"]');
    const nextButton = stepArea.locator("button", { hasText: "Neste" });
    await nextButton.click();

    // Should advance to step 4 (hours) — verify via data-botsson-id
    await expect(page.locator('[data-botsson-id="join-hours-step"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ─── Test 7: Full wizard step flow (6 steps) ─────────────

  test("full wizard flow navigates through all steps", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/join");

    // Step 1 (account) → verify visible
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // The join wizard has 6 steps: account, business, about, hours, menu, summary
    const stepIds = ["account", "business", "about", "hours", "menu", "summary"];

    // Verify step 1 data attribute
    await expect(page.locator(`[data-botsson-id="join-${stepIds[0]}-step"]`)).toBeVisible();

    // Step 1 → 2: fill required account fields
    await fillStep1(page);
    await clickNextNTimes(page, 1);
    await expect(page.locator(`[data-botsson-id="join-${stepIds[1]}-step"]`)).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 → 3: fill required business fields
    await fillStep2(page);
    await clickNextNTimes(page, 1);
    await expect(page.locator(`[data-botsson-id="join-${stepIds[2]}-step"]`)).toBeVisible({
      timeout: 5_000,
    });

    // Steps 3-5 → navigate forward (about + menu are skippable, hours needs phone)
    for (let i = 3; i < stepIds.length; i++) {
      // Step 4 (hours) requires a valid phone number — fill it.
      // The openingHours array is auto-populated with 7 default entries by Step4Hours.
      if (stepIds[i - 1] === "hours") {
        // Wait for Step4Hours component to mount and sync defaults to wizard state
        await page.waitForTimeout(500);
        await page.locator('input[id="phone"]').fill("+47 35 52 61 00");
        await page.waitForTimeout(300);
      }
      await clickNextNTimes(page, 1);
      await expect(page.locator(`[data-botsson-id="join-${stepIds[i]}-step"]`)).toBeVisible({
        timeout: 5_000,
      });
    }

    // Last step (summary) — WizardNavBar shows "Fullfør" instead of "Neste"
    await expect(page.locator("button", { hasText: "Fullfør" })).toBeVisible();
  });

  // ─── Test 8: Sidebar progress labels match join steps ───

  test("sidebar progress labels match the actual join steps", async ({ page }) => {
    await page.goto("/join");
    await expect(page.locator('[data-botsson-id="join-shell"]')).toBeVisible({ timeout: 10_000 });

    // WizardSidebar renders labels from join.json i18n keys.
    // Current labels: Konto, Bedrift, Identitet, Drift, Meny, Oppsummering
    // Sidebar is only visible on lg+ screens, so check the nav element.
    const sidebar = page.locator('nav[aria-label="Wizard progress"]');

    // These labels should exist in the sidebar (exact match to avoid "Bedrift"/"Drift" collision)
    await expect(sidebar.getByText("Konto", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Bedrift", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Identitet", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Drift", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Meny", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Oppsummering", { exact: true })).toBeVisible();

    // Legacy labels that no longer exist
    await expect(sidebar.getByText("Om bedriften", { exact: true })).not.toBeVisible();
  });
});
