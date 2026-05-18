import { test, expect } from "@playwright/test";

/**
 * Journey 1 — New restaurant happy path (ADR-0357 + 0358 stable).
 * Public visitor with no prior session. Fills wizard, submits, redirects to /onboarding.
 *
 * Smoke. Should run < 90s.
 */
test.describe("join-journey-1-happy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
    await page.reload();
  });

  test("@smoke fresh visitor completes signup", async ({ page }) => {
    test.setTimeout(120_000);

    // Step 1
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 25_000,
    });
    await page.locator('input[id="companyName"]').fill("Test Restaurant Journey 1");
    // industry select — find by label
    await page.locator('button[id="industry"]').click();
    await page
      .getByRole("option", { name: /restaurant/i })
      .first()
      .click();
    await page.locator('input[id="city"]').fill("Oslo");
    const uniqueEmail = `journey1-${Date.now()}@e2e-smartout.local`;
    await page.locator('input[id="email"]').fill(uniqueEmail);
    await page.locator('input[id="password"]').fill("e2e-test-1234");
    await page.locator('input[id="confirmPassword"]').fill("e2e-test-1234");
    await page.locator('input[id="firstName"]').fill("Test");
    await page.locator('input[id="lastName"]').fill("User");
    await page.locator('input[id="confirmPassword"]').blur(); // arms silent auth

    await page.locator("button", { hasText: /Neste/ }).last().click();

    // Step 2
    await expect(page.getByRole("heading", { name: /Bedriftsinformasjon/ })).toBeVisible({
      timeout: 25_000,
    });
    await page.locator('input[id="street"]').fill("Karl Johans gate 1");
    await page.locator('input[id="postalCode"]').fill("0154");
    await page.locator('input[id="city"]').fill("Oslo");
    await page.locator('input[id="orgNumber"]').fill("911 722 267"); // MOD-11 valid
    await page.locator("button", { hasText: /Neste/ }).last().click();

    // Step 3 — skippable, just advance
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 25_000,
    });
    // Allow typewriter to fill or skip
    await page
      .locator("button", { hasText: /Neste|Hopp over/ })
      .last()
      .click();

    // Step 4 — Drift
    await expect(page.getByRole("heading", { name: /Drift/ })).toBeVisible({ timeout: 25_000 });
    await page.locator('input[id="phone"]').fill("+47 22 11 22 33");
    await page.locator("button", { hasText: /Neste/ }).last().click();

    // Step 5 — Meny (skippable)
    await expect(page.getByRole("heading", { name: /Meny/ })).toBeVisible({ timeout: 25_000 });
    await page
      .locator("button", { hasText: /Neste|Hopp over/ })
      .last()
      .click();

    // Step 6 — Summary
    await expect(page.getByRole("heading", { name: /Alt ser bra ut/ })).toBeVisible({
      timeout: 25_000,
    });

    // Submit
    await page
      .locator("button", { hasText: /Fullfør/ })
      .last()
      .click();

    // Expect redirect to /onboarding
    await page.waitForURL(/\/onboarding/, { timeout: 60_000 });
  });
});
