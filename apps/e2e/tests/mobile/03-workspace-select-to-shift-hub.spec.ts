/**
 * Mobile smoke 03 — Workspace select → shift-hub
 *
 * TODO (M2): Replace manual login preamble with a proper Playwright auth
 * fixture that injects a Supabase session via storageState/localStorage.
 * Until that fixture exists, this spec runs the full login flow first.
 *
 * Happy path:
 *   login → workspace-select screen → tap first workspace → expect URL
 *   contains /shift-hub (or /(app) root which auto-redirects there).
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? "password123";

/** Minimal login helper — identical sequence to spec 02. */
async function loginMobile(
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
  await expect(passwordInput).toBeVisible({ timeout: 5_000 });
  await passwordInput.fill(TEST_PASSWORD);

  // RN Web renders TouchableOpacity as generic/div, not button role — use text match
  const submitBtn = page.getByText(/^Logg inn$/).last();
  await submitBtn.tap();

  // Expo Web strips group parens from URLs: /(app)/(home)/shift-hub → /shift-hub
  await expect(page).toHaveURL(/workspace-select|shift-hub|operations|digest|\/\(app\)/, {
    timeout: 20_000,
  });
}

test.describe("Mobile smoke: workspace-select → shift-hub @smoke", () => {
  test("picks workspace and lands on shift-hub", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await loginMobile(page);

    // If already past workspace-select (single workspace auto-picked), we may
    // already be at shift-hub — short-circuit.
    if (page.url().includes("shift-hub")) {
      return;
    }

    // On workspace-select: tap the first workspace card/button
    const workspaceItem = page
      .locator('[data-testid*="workspace"], button, [role="button"]')
      .filter({ hasText: /\w+/ })
      .first();
    await expect(workspaceItem).toBeVisible({ timeout: 10_000 });
    await workspaceItem.tap();

    // Expect to land on shift-hub or any app-shell screen (Expo Web strips group parens)
    await expect(page).toHaveURL(/shift-hub|operations|digest|\/\(app\)/, { timeout: 20_000 });

    expect(
      pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    ).toHaveLength(0);
  });
});
