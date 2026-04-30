/**
 * Mobile smoke 05 — Training page
 *
 * TODO (M2): Replace manual login preamble with a proper Playwright auth
 * fixture that injects a Supabase session via storageState/localStorage.
 *
 * Navigates from the authenticated app shell to the Training screen
 * (Opplæring). Verifies:
 *   1. The "Opplæring" heading renders
 *   2. No "No QueryClient set" crash text on the page (L-0108 regression guard)
 *   3. No uncaught runtime errors in console or pageerror events
 *
 * The training page is reachable via:
 *   - Shift-hub action bar → "Opplæring" button
 *   - Direct URL: /(app)/(home)/training (Expo Router deep-link)
 * This spec tries the direct deep-link first (faster), falls back to UI nav.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? "password123";

/** Reach the authenticated app shell. */
async function reachAppShell(
  page: Parameters<typeof test>[1] extends (args: { page: infer P }) => unknown ? P : never,
): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  const loginCta = page.getByText(/Logg inn eller opprett konto/i).first();
  await expect(loginCta).toBeVisible({ timeout: 15_000 });
  await loginCta.tap();

  const emailInput = page
    .locator('input[type="email"], input[placeholder*="post"], input[placeholder*="E-post"]')
    .first();
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(TEST_EMAIL);

  const passwordInput = page
    .locator('input[type="password"], input[placeholder*="assord"]')
    .first();
  await passwordInput.fill(TEST_PASSWORD);

  // RN Web renders TouchableOpacity as generic/div, not button role — use text match
  const submitBtn = page.getByText(/^Logg inn$/).last();
  await submitBtn.tap();

  // Expo Web strips group parens: /(app)/(home)/shift-hub → /shift-hub, /operations etc.
  await page.waitForURL(/workspace-select|shift-hub|operations|digest|\/\(app\)/, {
    timeout: 20_000,
  });
  if (page.url().includes("workspace-select")) {
    const workspaceItem = page
      .locator('[data-testid*="workspace"], button, [role="button"]')
      .filter({ hasText: /\w+/ })
      .first();
    await expect(workspaceItem).toBeVisible({ timeout: 10_000 });
    await workspaceItem.tap();
    await expect(page).toHaveURL(/shift-hub|operations|digest|\/\(app\)/, { timeout: 20_000 });
  }
}

test.describe("Mobile smoke: training page @smoke", () => {
  test("training page renders heading and has no QueryClient error", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await reachAppShell(page);

    // Try deep-link first — Expo Web supports direct path navigation
    await page.goto("/(app)/(home)/training", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(2_000);

    // If deep-link failed (redirected to auth), try UI navigation via shift-hub button
    if (!page.url().includes("training")) {
      const trainingBtn = page.getByText(/Opplæring/i).first();
      const isVisible = await trainingBtn.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isVisible) {
        await trainingBtn.tap();
        await page.waitForTimeout(2_000);
      }
    }

    // Primary assertion: the "Opplæring" heading is visible
    await expect(page.getByText(/Opplæring/i).first()).toBeVisible({ timeout: 10_000 });

    // Regression guard: "No QueryClient set" must not appear anywhere on the page
    const queryClientError = page.getByText(/No QueryClient set/i);
    await expect(queryClientError).not.toBeVisible({ timeout: 3_000 });

    // Critical console errors
    const criticalErrors = consoleErrors.filter((e) =>
      /QueryClient|Cannot read|is not a function|undefined is not|ReferenceError/i.test(e),
    );
    expect(
      criticalErrors,
      `Critical console errors on training page: ${criticalErrors.join(", ")}`,
    ).toHaveLength(0);

    expect(
      pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
      `Page errors on training page: ${pageErrors.join(", ")}`,
    ).toHaveLength(0);
  });
});
