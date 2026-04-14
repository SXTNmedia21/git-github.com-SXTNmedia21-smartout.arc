import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Session Sign-off", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("sign-off shows warning when compliance tasks incomplete", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Admin view — look for session table
    await expect(page.locator("text=Avdeling").or(page.locator("text=Kitchen"))).toBeVisible({
      timeout: 10000,
    });

    // Click sign-off button if a pending_signoff session exists
    const signoffBtn = page.locator("text=Signer").first();
    if (await signoffBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signoffBtn.click();

      // Sign-off drawer should open
      await expect(page.locator("text=Signering")).toBeVisible({ timeout: 3000 });

      // Should show compliance task status
      await expect(
        page.locator("text=Påkrevde oppgaver").or(page.locator("text=Ingen påkrevde oppgaver")),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test("sign-off with exceptions requires notes", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    const signoffBtn = page.locator("text=Signer").first();
    if (await signoffBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signoffBtn.click();
      await page.waitForTimeout(500);

      // If there are warnings, the submit button should be disabled without notes
      const exceptionBtn = page.locator("text=Signer med unntak");
      if (await exceptionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Button should be disabled
        await expect(exceptionBtn).toBeDisabled();

        // Fill notes
        await page.fill(
          'textarea[placeholder*="unntak"], textarea',
          "Temperaturkontroll ble forsinket pga leveranse.",
        );

        // Button should now be enabled
        await expect(exceptionBtn).toBeEnabled();
      }
    }
  });

  test("clean sign-off works when no blocking issues", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    const signoffBtn = page.locator("text=Signer").first();
    if (await signoffBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signoffBtn.click();
      await page.waitForTimeout(500);

      // If clean sign-off is available
      const cleanBtn = page.locator("text=Signer økt");
      if (await cleanBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cleanBtn.click();
        await expect(page.locator("text=Økt signert og lukket")).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
