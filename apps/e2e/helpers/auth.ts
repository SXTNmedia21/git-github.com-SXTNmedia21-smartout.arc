import type { Page } from "@playwright/test";

const DEFAULT_EMAIL = "admin@smartout.local";
const DEFAULT_PASSWORD = "password123";

/**
 * Handles the onboarding wizard skip if it appears after login.
 */
async function skipOnboardingIfPresent(page: Page): Promise<void> {
  const skipBtn = page.locator("text=Hopp over og gå til dashboard");
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
  }
}

type LoginOptions = {
  /** Set to false to keep the onboarding wizard visible (default: true) */
  skipOnboarding?: boolean;
};

export async function loginAsAdmin(page: Page, options: LoginOptions = {}): Promise<void> {
  const { skipOnboarding = true } = options;
  const email = process.env.E2E_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.E2E_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for login animation to complete and redirect
  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  if (skipOnboarding) {
    await skipOnboardingIfPresent(page);
  }
}

export async function loginAsEmployee(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await skipOnboardingIfPresent(page);
}
