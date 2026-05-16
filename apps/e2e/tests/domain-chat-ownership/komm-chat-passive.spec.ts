import { test } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectOrbActive, expectOrbPassive } from "../../helpers/orb";

test.describe("DomainChatOwnership — komm/chat surface", () => {
  test("declares ownership → Orb passive; cleanup on navigation → Orb active", async ({ page }) => {
    // 1. login + lands on /dashboard
    await loginAsAdmin(page);

    // 2. baseline: dashboard is non-owning, Orb active
    await expectOrbActive(page);

    // 3. navigate to /dashboard/komm/chat (declares ownership)
    await page.goto("/dashboard/komm/chat");
    await expectOrbPassive(page);

    // 4. navigate back to /dashboard (cleanup decrements counter to 0)
    await page.goto("/dashboard");
    await expectOrbActive(page);
  });
});
