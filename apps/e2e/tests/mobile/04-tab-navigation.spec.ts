/**
 * Mobile smoke 04 — Tab navigation
 *
 * TODO (M2): Replace manual login preamble with a proper Playwright auth
 * fixture that injects a Supabase session via storageState/localStorage.
 *
 * Verifies that each visible bottom-tab renders without console errors or
 * uncaught runtime crashes. Tabs present in /(app)/_layout.tsx:
 *   Kalender (Vakter), Min kø, Chat, Min side
 *
 * The "Hjem" tab (shift-hub) is exercised implicitly as the landing screen.
 * This spec taps each tab in sequence and asserts no fatal errors on each.
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

  // Handle workspace-select if it appears (single-workspace users auto-redirect past it)
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

const TABS = [
  { label: /Kalender|Vakter/i, description: "Kalender tab" },
  { label: /Min kø/i, description: "Min kø tab" },
  { label: /Chat/i, description: "Chat tab" },
  { label: /Min side/i, description: "Min side tab" },
];

test.describe("Mobile smoke: tab navigation @smoke", () => {
  for (const tab of TABS) {
    test(`taps "${tab.description}" without console error`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Only flag runtime crashes — ignore benign network/favicon noise
          if (
            /QueryClient|Cannot read|is not a function|undefined is not|ReferenceError/i.test(text)
          ) {
            consoleErrors.push(text);
          }
        }
      });

      const pageErrors: string[] = [];
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      await reachAppShell(page);

      // Tap the target tab in the bottom tab bar
      const tabBtn = page.getByText(tab.label).first();
      await expect(tabBtn).toBeVisible({ timeout: 10_000 });
      await tabBtn.tap();

      // Give the screen time to mount
      await page.waitForTimeout(1_500);

      // Each tab renders something — the page body must not be empty
      await expect(page.locator("body")).toBeVisible();

      expect(
        consoleErrors,
        `Console error on ${tab.description}: ${consoleErrors.join(", ")}`,
      ).toHaveLength(0);
      expect(
        pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
        `Page error on ${tab.description}: ${pageErrors.join(", ")}`,
      ).toHaveLength(0);
    });
  }
});
