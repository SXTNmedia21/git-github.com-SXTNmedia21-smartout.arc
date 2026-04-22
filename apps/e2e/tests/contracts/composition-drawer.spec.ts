/**
 * Phase E2E — Journey 5: Composition drawer (replaces retired full-page wizard)
 *
 * Covers JOURNEY-contract-composition-engine (amended: drawer flow) + council
 * Gate 2 verdict row #5.
 *
 * Focus — drawer open/close + URL state semantics:
 *   - Clicking "Lag kontrakt" header CTA adds `?open=compose` to the URL
 *   - The CompositionDrawer mounts (glass Sheet, right side, step indicator)
 *   - ESC closes the drawer and strips `open=compose` (and profileId) from URL
 *
 * Deep 5-step completion (Ansatt → Send) is covered by the pre-existing
 * `tests/contract-composition/happy-path.spec.ts` which runs against the
 * full-page wizard form. Phase 3 migrated that wizard into the drawer but
 * kept the same step shells (AnsattStep, StillingStep, …) — so the happy-
 * path spec still validates the business logic. This test only verifies
 * the drawer shell + URL contract.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

test.describe("composition drawer — open/close + URL query-param state", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("setup_dismissed", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("Lag kontrakt CTA opens drawer + adds ?open=compose", async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsAdmin(page);
    await page.goto("/dashboard/contracts");
    await page.waitForLoadState("domcontentloaded");

    // Header CTA — the Plus-icon "Lag kontrakt" button.
    const cta = page.getByRole("button", { name: /lag kontrakt/i }).first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    await cta.click();

    await expect(page).toHaveURL(/\?open=compose/, { timeout: 5_000 });

    // Drawer header appears — "Ny ansettelseskontrakt" / "Compose contract".
    // We match the step indicator `01 · Ansatt` to be robust against copy.
    const stepIndicator = page
      .locator("ol li")
      .filter({ hasText: /01|ansatt/i })
      .first();
    await expect(stepIndicator).toBeVisible({ timeout: 10_000 });
  });

  test("ESC closes drawer and strips ?open=compose from URL", async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsAdmin(page);
    await page.goto("/dashboard/contracts?open=compose");
    await page.waitForLoadState("domcontentloaded");

    // Drawer must mount since the query param is set.
    const stepIndicator = page
      .locator("ol li")
      .filter({ hasText: /01|ansatt/i })
      .first();
    await expect(stepIndicator).toBeVisible({ timeout: 15_000 });

    // ESC closes the Sheet. shadcn/radix Sheet binds Escape natively.
    await page.keyboard.press("Escape");

    // URL no longer has open=compose. The base path should match again.
    await expect(page).toHaveURL(/\/dashboard\/contracts(?!\?open=compose)/, {
      timeout: 5_000,
    });
  });
});
