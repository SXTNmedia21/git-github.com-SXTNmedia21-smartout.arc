import type { Page } from "@playwright/test";

const DEFAULT_EMAIL = "admin@smartout.local";
const DEFAULT_PASSWORD = "password123";

/**
 * Removes the Next.js dev overlay portal that intercepts pointer events.
 * Must be called before any click actions on login or other pages in dev mode.
 */
async function dismissDevOverlay(page: Page): Promise<void> {
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

/**
 * Handles the onboarding wizard skip if it appears after login.
 */
async function skipOnboardingIfPresent(page: Page): Promise<void> {
  const skipBtn = page.getByRole("button", { name: "Hopp over og gå til dashboard" });
  const setupHeading = page.getByText("Oppsett av arbeidsrom").first();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const skipVisible = await skipBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (skipVisible) {
      await skipBtn.click();
      await skipBtn.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      continue;
    }

    const setupVisible = await setupHeading.isVisible({ timeout: 500 }).catch(() => false);
    if (!setupVisible) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  if (
    (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) ||
    (await setupHeading.isVisible({ timeout: 500 }).catch(() => false))
  ) {
    throw new Error(`E2E login remained on onboarding flow: ${page.url()}`);
  }
}

type LoginOptions = {
  /** Set to false to keep the onboarding wizard visible (default: true) */
  skipOnboarding?: boolean;
};

/**
 * Submits the login form and waits for a real authenticated transition.
 * Why: in local dev the page can still be hydrating, which can turn the first click
 * into a plain GET /login?email=... request instead of the Supabase sign-in handler.
 *
 * @returns Promise that resolves once the browser reaches an authenticated page
 */
async function submitLoginAndWait(page: Page): Promise<void> {
  const submitButton = page.locator('button[type="submit"]');
  const invalidCredentials = page.locator("text=Feil e-post eller passord.").first();

  await dismissDevOverlay(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await submitButton.click({ force: true });

    try {
      await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 15000 });
      return;
    } catch {
      if (await invalidCredentials.isVisible({ timeout: 1000 }).catch(() => false)) {
        throw new Error("E2E login failed with invalid credentials");
      }

      // The first click can happen before the client handler is ready.
      // Give the page a moment to hydrate, then retry once.
      await page.waitForTimeout(1200);
    }
  }

  throw new Error(`E2E login did not reach an authenticated route. Final URL: ${page.url()}`);
}

export async function loginAsAdmin(page: Page, options: LoginOptions = {}): Promise<void> {
  const { skipOnboarding = true } = options;
  const email = process.env.E2E_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.E2E_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto("/login");
  await dismissDevOverlay(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await submitLoginAndWait(page);
  await page.waitForTimeout(1000);

  if (skipOnboarding) {
    await skipOnboardingIfPresent(page);
  }
}

export async function loginAsEmployee(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await dismissDevOverlay(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await submitLoginAndWait(page);
  await page.waitForTimeout(1000);
  await skipOnboardingIfPresent(page);
}
