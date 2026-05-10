import type { Page } from "@playwright/test";
import { supabase } from "./seed";

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
  // Detect setup wizard by either the skip button or being on /dashboard/setup
  const isOnSetup = () => page.url().includes("/dashboard/setup");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const skipVisible = await skipBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (skipVisible) {
      await skipBtn.click();
      await skipBtn.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      continue;
    }

    if (!isOnSetup()) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  // URL-based fallback: if still stuck on /setup, navigate directly to /dashboard
  if (isOnSetup()) {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    return;
  }

  if (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) {
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
async function submitLoginAndWait(page: Page, email?: string, password?: string): Promise<void> {
  if (email !== undefined) {
    await page.locator('input[type="email"]').fill(email);
  }
  if (password !== undefined) {
    await page.locator('input[type="password"]').fill(password);
  }

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

/**
 * Resolves the workspace_id that the default E2E_EMAIL admin user belongs to.
 * Use in E2E specs that need to assert against the workspace where the admin's
 * UI session actually mutates data, instead of an orphan-seeded workspace the
 * session can never reach.
 *
 * Strategy: look up the admin's profile row (oldest, in case of multiple
 * workspaces) and return its workspace_id. Service-role client from seed.ts
 * bypasses RLS so no auth setup is needed.
 *
 * Returns null if the admin user has no profile in any workspace.
 */
export async function resolveAdminWorkspaceId(): Promise<string | null> {
  const email = process.env.E2E_EMAIL ?? DEFAULT_EMAIL;

  // Supabase JS v2 does not expose auth.users via the public client — use the
  // admin API (service-role only) to look up the user by email.
  const {
    data: { users },
    error: listErr,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listErr || !users) return null;

  const adminUser = users.find((u) => u.email === email);
  if (!adminUser) return null;

  // Find the admin's oldest profile (first workspace they were seeded into)
  const { data: profiles, error: profileErr } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("user_id", adminUser.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) return null;
  return profiles[0]!.workspace_id;
}

/**
 * Resolves the profile_id for the E2E_EMAIL admin within a given workspace.
 * Pair with resolveAdminWorkspaceId() when you need the profile_id for
 * FK-constrained columns (e.g. pinned_by, sender_id).
 *
 * Returns null if no admin profile exists in that workspace.
 */
export async function resolveAdminProfileId(workspaceId: string): Promise<string | null> {
  const email = process.env.E2E_EMAIL ?? DEFAULT_EMAIL;

  const {
    data: { users },
    error: listErr,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (listErr || !users) return null;

  const adminUser = users.find((u) => u.email === email);
  if (!adminUser) return null;

  const { data: profiles, error: profileErr } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", adminUser.id)
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) return null;
  return profiles[0]!.profile_id;
}

export async function loginAsEmployee(
  page: Page,
  email?: string,
  password?: string,
): Promise<void> {
  await page.goto("/login");
  await dismissDevOverlay(page);
  await page.locator('input[type="email"]').fill(email ?? "anna@smartout.local");
  await page.locator('input[type="password"]').fill(password ?? "password123");
  await submitLoginAndWait(page);
  await page.waitForTimeout(1000);
  await skipOnboardingIfPresent(page);
}
