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

/**
 * Removes the Next.js dev overlay portal that intercepts pointer events.
 * Needed because platform-admin pages aren't covered by loginAsAdmin's
 * dismissal (the overlay can re-appear after navigation).
 */
async function dismissDevOverlay(page: import("@playwright/test").Page): Promise<void> {
  await page
    .evaluate(() => {
      const observer = new MutationObserver(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});
}

test.describe("Platform Admin — landing PostHog bridge", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("landing page loads and PostHog quick-action targets are well-formed when rows exist", async ({
    page,
  }) => {
    await page.goto("/platform-admin/landing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tab", { name: /Sessions/i })).toBeVisible({ timeout: 15_000 });

    // Dismiss dev overlay that can intercept pointer events on tab clicks
    await dismissDevOverlay(page);

    const sessionBridge = page.locator('[aria-label="Open session in PostHog"]');
    const sessionCount = await sessionBridge.count();
    if (sessionCount > 0) {
      const first = sessionBridge.first();
      await expect(first).toBeVisible();
      await expect(first).toHaveAttribute("href", /./);
      await expect(first).toHaveAttribute("target", "_blank");
    }

    // Radix UI tabs activate on pointerdown — ensure the click is a real
    // user gesture by waiting for network idle and using a standard click.
    const leadsTab = page.getByRole("tab", { name: /Leads/i });
    await page.waitForLoadState("networkidle");
    await leadsTab.click();
    await expect(leadsTab).toHaveAttribute("data-state", "active", { timeout: 5_000 });

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
