/**
 * Phase E2E — Journey 8: Reverse flow from /people/[id] into the composition
 * drawer pre-filled with a profile.
 *
 * Covers JOURNEY-contract-hub-redesign §Journey 4 + council Gate 2 verdict
 * row #8.
 *
 * Entry:  /dashboard/people/<profile_id>
 *   → click "Lag kontrakt" actions button
 *   → router.push to /dashboard/people/contracts?open=compose&profileId=<id>
 *
 * The CompositionDrawer's reverse-flow seeding applies `initialProfileId`
 * once when the drawer opens and jumps the step cursor to `stilling` (step 2)
 * with the profile preselected (see CompositionDrawer.tsx lines 138-154).
 *
 * What we assert:
 *   A. The people-page CTA renders for a seeded profile (Anna Olsen,
 *      f0000000-0000-0000-0000-000000000001).
 *   B. Clicking it navigates to /dashboard/people/contracts with BOTH
 *      open=compose AND profileId=<anna> in the query string.
 *   C. On arrival, the drawer opens on step 2 (Stilling) — proven by the
 *      `02` step indicator being the active one. If the drawer still sits
 *      on step 1 it means the reverse-flow seeding regressed.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const ANNA_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";

test.describe("reverse flow — /people/[id] → /contracts?open=compose&profileId=…", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("setup_dismissed", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("people-page CTA navigates into drawer preselected + jumps to step 2", async ({ page }) => {
    test.setTimeout(90_000);

    await loginAsAdmin(page);
    await page.goto(`/dashboard/people/${ANNA_PROFILE_ID}`);
    await page.waitForLoadState("domcontentloaded");

    // "Lag kontrakt" button in the actions slot of the people detail page.
    const reverseCta = page.getByRole("button", { name: /lag kontrakt/i }).first();
    await expect(reverseCta).toBeVisible({ timeout: 15_000 });
    await reverseCta.click();

    // Navigated to the contracts hub with BOTH query params.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/people/contracts\\?.*open=compose.*profileId=${ANNA_PROFILE_ID}`),
      { timeout: 10_000 },
    );

    // Drawer mounted — step indicator list must be visible.
    const stepList = page.locator("ol li").filter({ hasText: /01|02|ansatt|stilling/i });
    await expect(stepList.first()).toBeVisible({ timeout: 15_000 });

    // Step 2 (Stilling) should be the active step after reverse-flow seeding.
    // The active step is rendered with the `text-foreground` class instead
    // of `text-muted-foreground`. The most reliable way to assert "active
    // step 2" is to look for the step-2 indicator text and confirm the
    // position-title input from StillingStep mounts.
    const stillingIndicator = page
      .locator("ol li")
      .filter({ hasText: /02|stilling/i })
      .first();
    await expect(stillingIndicator).toBeVisible({ timeout: 10_000 });

    // StillingStep renders <Input id="drawer-position-title" />. If this
    // mounts, the drawer is on step 2 — reverse flow seeded correctly.
    const positionInput = page.locator("#drawer-position-title");
    await expect(positionInput).toBeVisible({ timeout: 15_000 });
  });
});
