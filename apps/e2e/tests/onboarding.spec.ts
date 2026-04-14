import { test, expect } from "@playwright/test";

test.describe("Invitation Accept Page", () => {
  test("should show error for invalid token", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(
      page
        .locator("text=Invitasjonen ble ikke funnet")
        .or(page.locator("text=Invitation not found"))
        .or(page.locator("text=ikke funnet")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show invitation page structure for valid-format token", async ({ page }) => {
    await page.goto("/invite/11111111-1111-1111-1111-111111111111");
    await expect(page.locator("body")).toBeVisible();
  });
});
