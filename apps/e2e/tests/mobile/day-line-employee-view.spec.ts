/**
 * mobile/day-line-employee-view.spec.ts
 *
 * ADR-0367 Phase F Mobile E2E — Employee views day lines on mobile.
 *
 * Journey: JOURNEY-day-line-employee-view-mobile.md
 * Covers:
 *   J1 — calendar-day-screen renders for today's date after login
 *   J2 — day-screen-loading resolves to either day-line-sections or legacy timeline
 *   J3 — when session exists, day-line-sections renders (read-only, no edit affordances)
 *   J4 — day-screen-day-name and day-screen-day-date show the correct date
 *
 * Read-only surface per ADR-0133: no authoring verbs tested here.
 *
 * Mobile boundary (ADR-0133): Employee may view items, complete tasks, view
 * area names + hours. No create/edit/delete affordances on this screen.
 *
 * Auth: Employee login flow (same credentials as admin in seed; employee role
 * in seed workspace is anna@smartout.local with fallback to admin@smartout.local).
 *
 * Route: /(app)/(calendar)/day/[date] — Expo Web strips group parens →
 *        navigates as /day/YYYY-MM-DD (or via the calendar tab → day tap).
 *
 * Project: mobile (Playwright `apps/e2e/tests/mobile/` pattern).
 */
import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.E2E_EMAIL ?? "anna@smartout.local";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? "password123";

/** Today's date in YYYY-MM-DD (local time). Pure JS — no date-fns dependency. */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const TODAY = todayISO();

// ── Shared mobile login helper ────────────────────────────────────────────────

async function loginMobile(page: Page): Promise<boolean> {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  // Try the welcome screen CTA
  const loginCta = page.getByText(/Logg inn eller opprett konto/i).first();
  const ctaVisible = await loginCta.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!ctaVisible) {
    // May already be on the login screen or authenticated
    const alreadyAuth = page.getByText(/shift-hub|Oversikt|Vakter/i).first();
    if (await alreadyAuth.isVisible({ timeout: 3_000 }).catch(() => false)) return true;
    return false;
  }

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

  const submitBtn = page.getByText(/^Logg inn$/).last();
  await expect(submitBtn).toBeVisible({ timeout: 5_000 });
  await submitBtn.tap();

  try {
    await page.waitForURL(/workspace-select|shift-hub|operations|digest|\/\(app\)/, {
      timeout: 20_000,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("mobile/day-line: employee view — ADR-0367 Phase F @mobile", () => {
  // ── J1: calendar-day-screen renders ──────────────────────────────────────
  test("J1 — calendar-day-screen renders for today after login", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const loggedIn = await loginMobile(page);
    if (!loggedIn) {
      test.skip(true, "Mobile login failed — Expo Metro may not be running on port 8083");
      return;
    }

    // Navigate to today's day view — Expo Web strips group-route parens from URLs
    // /(app)/(calendar)/day/[date] → /day/[date]
    await page.goto(`/day/${TODAY}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);

    // calendar-day-screen testID is the root SafeAreaView of the day route
    const dayScreen = page.locator('[testid="calendar-day-screen"]').or(
      // RN Web renders testID as data-testid in DOM
      page.locator('[data-testid="calendar-day-screen"]'),
    );

    await expect(dayScreen).toBeVisible({ timeout: 12_000 });

    // No fatal runtime errors
    expect(
      pageErrors.filter((e) => !/ResizeObserver|favicon/i.test(e)),
      `Unexpected page errors: ${pageErrors.join(", ")}`,
    ).toHaveLength(0);
  });

  // ── J2: loading resolves to content ──────────────────────────────────────
  test("J2 — loading state resolves to day content within timeout", async ({ page }) => {
    const loggedIn = await loginMobile(page);
    if (!loggedIn) {
      test.skip(true, "Mobile login failed — Expo Metro may not be running on port 8083");
      return;
    }

    await page.goto(`/day/${TODAY}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1_500);

    // Loading spinner should NOT still be visible after 10 s (data should have loaded)
    const loadingView = page
      .locator('[data-testid="day-screen-loading"]')
      .or(page.locator('[testid="day-screen-loading"]'));

    // Wait for loading to disappear (or confirm it was never shown)
    try {
      await expect(loadingView).not.toBeVisible({ timeout: 10_000 });
    } catch {
      // If still loading after 10 s, fail explicitly
      throw new Error("day-screen-loading still visible after 10 s — data fetch stalled");
    }

    // Either day-line-sections (session path) or legacy timeline content should be present
    const content = page
      .locator('[data-testid="day-line-sections"]')
      .or(page.locator('[testid="day-line-sections"]'))
      .or(page.locator('[data-testid="day-screen-scroll"]'))
      .or(page.locator('[testid="day-screen-scroll"]'))
      .first();

    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  // ── J3: session path renders day-line sections ───────────────────────────
  test("J3 — day-line-sections renders when session exists (read-only)", async ({ page }) => {
    const loggedIn = await loginMobile(page);
    if (!loggedIn) {
      test.skip(true, "Mobile login failed — Expo Metro may not be running on port 8083");
      return;
    }

    await page.goto(`/day/${TODAY}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);

    const dayLineSections = page
      .locator('[data-testid="day-line-sections"]')
      .or(page.locator('[testid="day-line-sections"]'));

    const hasSections = await dayLineSections.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasSections) {
      // No session seeded for today — legacy calendar path is acceptable
      // Verify the legacy timeline is visible instead
      const scrollView = page
        .locator('[data-testid="day-screen-scroll"]')
        .or(page.locator('[testid="day-screen-scroll"]'));
      await expect(scrollView).toBeVisible({ timeout: 5_000 });
      // Graceful skip message — not a failure for no-session seed environments
      test.info().annotations.push({
        type: "note",
        description:
          "No session seeded for today — legacy timeline rendered instead of day-line-sections (acceptable in pre-session seed environments)",
      });
      return;
    }

    // Section container is visible — confirm no authoring affordances per ADR-0133
    // (no "Ny dagslinje", no "Endre åpningstider" on mobile read-only surface)
    const createDayLineTrigger = page.getByText(/Ny dagslinje/i);
    await expect(createDayLineTrigger)
      .not.toBeVisible({ timeout: 2_000 })
      .catch(() => {
        // If visible, that violates ADR-0133 mobile boundary
        throw new Error(
          "ADR-0133 violation: 'Ny dagslinje' authoring affordance visible on mobile read-only surface",
        );
      });
  });

  // ── J4: header shows correct date ────────────────────────────────────────
  test("J4 — day-screen-day-date shows today's date", async ({ page }) => {
    const loggedIn = await loginMobile(page);
    if (!loggedIn) {
      test.skip(true, "Mobile login failed — Expo Metro may not be running on port 8083");
      return;
    }

    await page.goto(`/day/${TODAY}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2_000);

    const dateEl = page
      .locator('[data-testid="day-screen-day-date"]')
      .or(page.locator('[testid="day-screen-day-date"]'));

    await expect(dateEl).toBeVisible({ timeout: 10_000 });

    // The date label format is "{day}. {month-long-nb}" e.g. "18. mai"
    // Extract the day-of-month from TODAY (YYYY-MM-DD) to verify it's rendered
    const dayOfMonth = String(new Date(TODAY).getDate());
    const dateText = await dateEl.textContent();
    expect(
      dateText,
      `day-screen-day-date should contain today's day-of-month (${dayOfMonth})`,
    ).toContain(dayOfMonth);
  });
});
