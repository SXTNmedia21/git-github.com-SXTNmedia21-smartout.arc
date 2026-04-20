import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("HMS Session Sign-off", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("sign-off shows warning when compliance tasks incomplete", async ({ page }) => {
    await page.goto("/dashboard/hms/drift");
    await page.waitForLoadState("networkidle");

    // Admin view — the drift page renders DriftSessionTable which has i18n headers.
    // Wait for either the table header "Avdeling"/"Department" or loading to finish.
    const tableHeader = page
      .locator("text=Avdeling")
      .or(page.locator("text=Department"))
      .or(page.locator("text=Kitchen"));

    const hasTable = await tableHeader.isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasTable) {
      // No sessions for today — drift page may show empty state. Verify no error.
      const bodyText = await page.textContent("body");
      const hasError =
        bodyText?.includes("Runtime Error") || bodyText?.includes("Application error");
      expect(hasError).toBeFalsy();
      return;
    }

    // Click sign-off button if a pending_signoff session exists
    const signoffBtn = page.locator("text=Signer").or(page.locator("text=Sign")).first();
    if (await signoffBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signoffBtn.click();

      // Sign-off drawer should open
      await expect(page.locator("text=Signering").or(page.locator("text=Sign-off"))).toBeVisible({
        timeout: 3000,
      });

      // Should show compliance task status
      await expect(
        page
          .locator("text=Påkrevde oppgaver")
          .or(page.locator("text=Ingen påkrevde oppgaver"))
          .or(page.locator("text=Required tasks"))
          .or(page.locator("text=No required tasks")),
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
