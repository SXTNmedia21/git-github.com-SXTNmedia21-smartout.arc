import { test, expect } from "@playwright/test";

/**
 * Journey 3 — Long-idle Step 3 then submit (ADR-0357).
 * Sketches the multi-minute idle by using page.clock.fastForward.
 * Verifies wizard survives client-side token rotation without a 500.
 */
test.describe("join-journey-3-long-idle", () => {
  test("submits cleanly after 6-minute idle simulation", async ({ page }) => {
    test.setTimeout(180_000);

    await page.clock.install();
    await page.goto("/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
    await page.reload();

    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 25_000,
    });

    // Fill Step 1 minimally then arm auth
    await page.locator('input[id="companyName"]').fill("Idle Test Co");
    await page.locator('button[id="industry"]').click();
    await page
      .getByRole("option", { name: /restaurant/i })
      .first()
      .click();
    await page.locator('input[id="city"]').fill("Oslo");
    const email = `journey3-${Date.now()}@e2e-smartout.local`;
    await page.locator('input[id="email"]').fill(email);
    await page.locator('input[id="password"]').fill("e2e-test-1234");
    await page.locator('input[id="confirmPassword"]').fill("e2e-test-1234");
    await page.locator('input[id="firstName"]').fill("Idle");
    await page.locator('input[id="lastName"]').fill("Tester");
    await page.locator('input[id="confirmPassword"]').blur();

    await page.locator("button", { hasText: /Neste/ }).last().click();

    // Step 2 minimal
    await expect(page.getByRole("heading", { name: /Bedriftsinformasjon/ })).toBeVisible({
      timeout: 25_000,
    });
    await page.locator('input[id="street"]').fill("S1");
    await page.locator('input[id="postalCode"]').fill("0000");
    await page.locator('input[id="city"]').fill("Oslo");
    await page.locator('input[id="orgNumber"]').fill("911722267");
    await page.locator("button", { hasText: /Neste/ }).last().click();

    // Step 3 — idle for 6 minutes (simulated)
    await expect(page.getByRole("heading", { name: /Fortell om bedriften/ })).toBeVisible({
      timeout: 25_000,
    });
    await page.clock.fastForward("6:00"); // 6 minutes

    // Continue through to summary
    await page
      .locator("button", { hasText: /Neste|Hopp over/ })
      .last()
      .click();
    await expect(page.getByRole("heading", { name: /Drift/ })).toBeVisible({ timeout: 25_000 });
    await page.locator('input[id="phone"]').fill("+47 22 11 22 33");
    await page.locator("button", { hasText: /Neste/ }).last().click();

    await expect(page.getByRole("heading", { name: /Meny/ })).toBeVisible({ timeout: 25_000 });
    await page
      .locator("button", { hasText: /Neste|Hopp over/ })
      .last()
      .click();

    await expect(page.getByRole("heading", { name: /Alt ser bra ut/ })).toBeVisible({
      timeout: 25_000,
    });

    // Submit — must NOT 500 even after long idle
    await page
      .locator("button", { hasText: /Fullfør/ })
      .last()
      .click();

    // Expect redirect OR session_expired toast (acceptable per ADR-0358)
    // Catch both: redirect to /onboarding OR /login?return_to
    await page.waitForURL(/\/(onboarding|login\?.*return_to=%2Fjoin)/, { timeout: 60_000 });
  });
});
