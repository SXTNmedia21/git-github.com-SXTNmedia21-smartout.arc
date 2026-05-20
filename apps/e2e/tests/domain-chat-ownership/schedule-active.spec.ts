import { test } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectOrbActive } from "../../helpers/orb";

test.describe("DomainChatOwnership — negative-space (non-owning pages)", () => {
  test("schedule page keeps Orb active (no embedded chat surface)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/schedule");
    await expectOrbActive(page);
  });

  test("shift-clock page without active shift keeps Orb active (chat tab not mounted)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/shift-clock");
    // Admin role may redirect away from shift-clock (admin can't clock in — shift-clock
    // is an employee surface). Wherever the admin lands after the redirect, no
    // DomainChatOwnership declaration is mounted, so Orb stays active.
    await expectOrbActive(page);
  });
});
