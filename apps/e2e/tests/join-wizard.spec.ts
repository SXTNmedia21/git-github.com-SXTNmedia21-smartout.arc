import { test, expect } from "@playwright/test";

/**
 * Join Wizard E2E Tests
 *
 * Tests the /join signup wizard flow, focusing on:
 * - Step navigation (1-6)
 * - Step 3: Workspace intelligence (AI content generation + "Skriv på nytt")
 * - Form validation between steps
 */

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

    // Step 1 heading (in the form area, not brand panel)
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Required fields should be present
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="companyName"]')).toBeVisible();
  });

  // ─── Test 2: Navigate to Step 3 via URL ─────────────────

  test("can navigate directly to step 3 via URL", async ({ page }) => {
    await page.goto("/join?step=3");

    // Step 3 heading
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
    });

    // Three textareas should be visible
    await expect(page.locator('textarea[id="aboutUs"]')).toBeVisible();
    await expect(page.locator('textarea[id="ourHistory"]')).toBeVisible();
    await expect(page.locator('textarea[id="ourConcept"]')).toBeVisible();
  });

  // ─── Test 3: Step 3 gear menu works for AI actions ──────

  test("step 3 shows AI action menu for filled fields", async ({ page }) => {
    await page.goto("/join?step=3");
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
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
    await page.goto("/join?step=3");
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
    });

    // Back button
    const backButton = page.locator("button", { hasText: "Tilbake" });
    await expect(backButton).toBeVisible();

    // Next button
    const nextButton = page.locator("button", { hasText: "Neste" });
    await expect(nextButton).toBeVisible();

    // Click back → should go to step 2
    await backButton.click();
    await expect(page).toHaveURL(/step=2/);
  });

  // ─── Test 5: Step 3 textareas are editable ──────────────

  test("step 3 textareas accept user input", async ({ page }) => {
    await page.goto("/join?step=3");
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
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
    await page.goto("/join?step=3");
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
    });

    // Fill optional fields and click next
    const nextButton = page.locator("button", { hasText: "Neste" });
    await nextButton.click();

    // Should advance to step 4 (all step 3 fields are optional)
    await expect(page).toHaveURL(/step=4/, { timeout: 5_000 });
  });

  // ─── Test 7: Full wizard step flow (1→2→3→4→5→6) ───────

  test("full wizard flow navigates through all steps", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/join?step=1");

    // Step 1 → verify visible
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 10_000,
    });

    // Navigate forward through each step via URL
    for (let step = 2; step <= 6; step++) {
      await page.goto(`/join?step=${step}`);
      // Each step has a main heading in the form area
      await page.waitForTimeout(500);
    }

    // Verify we're on step 6
    await expect(page).toHaveURL(/step=6/);
  });

  // ─── Test 8: Brand panel shows contextual messages ──────

  test("brand panel shows step-specific messages", async ({ page }) => {
    await page.goto("/join?step=3");
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 10_000,
    });

    // Brand panel heading for step 3
    // "Gi bedriften din en stemme."
    const brandText = page.locator('h2:has-text("stemme")');
    await expect(brandText).toBeVisible({ timeout: 5_000 });
  });

  test("progress labels match the actual join steps", async ({ page }) => {
    await page.goto("/join?step=3");
    await expect(page.getByText("Om bedriften")).toBeVisible();
    await expect(page.getByText("Identitet")).not.toBeVisible();

    await page.goto("/join?step=6");
    await expect(page.getByText("Opprett konto")).toBeVisible();
    await expect(page.getByText("Team")).not.toBeVisible();
  });
});
