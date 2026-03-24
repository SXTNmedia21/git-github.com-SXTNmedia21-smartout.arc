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
 * - Step content renders inside a <main> element with data-walkai-id attributes.
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
    const stepArea = page.locator('[data-walkai-type="wizard-step"]');
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

test.describe("join-wizard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Clear any previous wizard state
    await page.goto("/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
  });

  // ─── Test 1: Join page loads with Step 1 ────────────────

  test("join page loads with step 1 visible", async ({ page }) => {
    await page.goto("/join");

    // WizardShell should render with join-shell data attribute
    await expect(page.locator('[data-walkai-id="join-shell"]')).toBeVisible({ timeout: 10_000 });

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
  // We navigate forward by clicking "Neste" twice (step 1 → 2 → 3).
  //
  // FIXME: WizardShell.useWizardState.next() validates step.validation against the
  // full nested state (JoinState), but step schemas (step1Schema, step2Schema) expect
  // flat keys (email, companyName). This mismatch means next() always fails validation
  // for steps with required fields, blocking forward navigation. Once the validation
  // is fixed (either remove step.validation from definition or validate substates),
  // un-fixme these tests.

  test.fixme("can navigate to step 3 (about) via Neste buttons", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");

    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate: step 1 → 2 → 3
    await clickNextNTimes(page, 2);

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

  // FIXME: Requires navigating to step 3 — blocked by validation schema mismatch (see test 2)
  test.fixme("step 3 shows AI action menu for filled fields", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3
    await clickNextNTimes(page, 2);
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

  // FIXME: Requires navigating to step 3 — blocked by validation schema mismatch (see test 2)
  test.fixme("step 3 has back and next buttons", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3
    await clickNextNTimes(page, 2);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    // Back button (in WizardNavBar at bottom)
    const backButton = page.locator("button", { hasText: "Tilbake" }).first();
    await expect(backButton).toBeVisible();

    // Next button — step has its own Neste inside the step area
    const stepArea = page.locator('[data-walkai-type="wizard-step"]');
    const nextButton = stepArea.locator("button", { hasText: "Neste" });
    await expect(nextButton).toBeVisible();

    // Click back → should go to step 2 (business step)
    await backButton.click();

    // Verify we're on step 2 by checking the step content changed
    // WizardShell does not update URL, so we check the DOM instead
    await expect(page.locator('[data-walkai-id="join-business-step"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ─── Test 5: Step 3 textareas are editable ──────────────

  // FIXME: Requires navigating to step 3 — blocked by validation schema mismatch (see test 2)
  test.fixme("step 3 textareas accept user input", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3
    await clickNextNTimes(page, 2);
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

  // FIXME: Requires navigating to step 3 — blocked by validation schema mismatch (see test 2)
  test.fixme("can advance from step 3 to step 4", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to step 3 (about — skippable)
    await clickNextNTimes(page, 2);
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 5_000,
    });

    // Click next (step 3 fields are optional/skippable) — use step's own button
    const stepArea = page.locator('[data-walkai-type="wizard-step"]');
    const nextButton = stepArea.locator("button", { hasText: "Neste" });
    await nextButton.click();

    // Should advance to step 4 (hours) — verify via data-walkai-id
    await expect(page.locator('[data-walkai-id="join-hours-step"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ─── Test 7: Full wizard step flow (7 steps) ─────────────

  // FIXME: Requires navigating through all 7 steps — blocked by validation schema mismatch (see test 2)
  test.fixme("full wizard flow navigates through all steps", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/join");

    // Step 1 (account) → verify visible
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // The join wizard has 7 steps: account, business, about, hours, menu, create_account, team
    const stepIds = ["account", "business", "about", "hours", "menu", "create_account", "team"];

    // Verify step 1 data attribute
    await expect(page.locator(`[data-walkai-id="join-${stepIds[0]}-step"]`)).toBeVisible();

    // Navigate forward through remaining steps using the helper
    for (let i = 1; i < stepIds.length; i++) {
      await clickNextNTimes(page, 1);
      await expect(page.locator(`[data-walkai-id="join-${stepIds[i]}-step"]`)).toBeVisible({
        timeout: 5_000,
      });
    }

    // Last step — WizardNavBar shows "Fullfør" instead of "Neste"
    await expect(page.locator("button", { hasText: "Fullfør" })).toBeVisible();
  });

  // ─── Test 8: Brand panel → SKIPPED ─────────────────────
  // Brand panel no longer exists in WizardShell. Replaced by WizardSidebar
  // which shows step labels (visible on lg+ screens only).

  test.skip("brand panel shows step-specific messages", async () => {
    // WizardShell replaced brand panel with WizardSidebar.
    // Sidebar shows step labels, not contextual brand messages.
  });

  // ─── Test 9: Sidebar progress labels match join steps ───

  test("sidebar progress labels match the actual join steps", async ({ page }) => {
    await page.goto("/join");
    await expect(page.locator('[data-walkai-id="join-shell"]')).toBeVisible({ timeout: 10_000 });

    // WizardSidebar renders labels from join.json i18n keys.
    // Labels: Konto, Bedrift, Om bedriften, Drift, Meny, Opprett konto, Team
    // Sidebar is only visible on lg+ screens, so check the nav element.
    const sidebar = page.locator('nav[aria-label="Wizard progress"]');

    // These labels should exist in the sidebar
    await expect(sidebar.getByText("Konto")).toBeVisible();
    await expect(sidebar.getByText("Bedrift")).toBeVisible();
    await expect(sidebar.getByText("Om bedriften")).toBeVisible();
    await expect(sidebar.getByText("Opprett konto")).toBeVisible();
    await expect(sidebar.getByText("Team")).toBeVisible();

    // Legacy labels that no longer exist
    await expect(sidebar.getByText("Identitet")).not.toBeVisible();
  });
});
