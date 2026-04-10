// ============================================
// platform-admin-landing-posthog-bridge.spec.ts
// Smoke test for Platform Admin landing analytics: PostHog row quick
// actions use stable aria-labels and external links. Tolerates empty
// tables in local dev (no rows => no quick actions, test still passes).
//
// Connected to: apps/web platform-admin landing sessions/leads columns
//               (posthog-links bridge + table quick-action cells)
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test.describe("Platform Admin — landing PostHog bridge", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("landing page loads and PostHog quick-action targets are well-formed when rows exist", async ({
    page,
  }) => {
    await page.goto("/platform-admin/landing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tab", { name: /Sessions/i })).toBeVisible({ timeout: 15_000 });

    const sessionBridge = page.locator('[aria-label="Open session in PostHog"]');
    const sessionCount = await sessionBridge.count();
    if (sessionCount > 0) {
      const first = sessionBridge.first();
      await expect(first).toBeVisible();
      await expect(first).toHaveAttribute("href", /./);
      await expect(first).toHaveAttribute("target", "_blank");
    }

    await page.getByRole("tab", { name: /Leads/i }).click();
    await expect(page.getByRole("tab", { name: /Leads/i })).toHaveAttribute("data-state", "active");

    const visitorBridge = page.locator('[aria-label="Open visitor in PostHog"]');
    const visitorCount = await visitorBridge.count();
    if (visitorCount > 0) {
      const first = visitorBridge.first();
      await expect(first).toBeVisible();
      await expect(first).toHaveAttribute("href", /./);
      await expect(first).toHaveAttribute("target", "_blank");
    }
  });
});
