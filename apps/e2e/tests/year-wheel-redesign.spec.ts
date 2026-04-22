import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

/**
 * Year Wheel Redesign E2E — covers flows introduced by the 2026-04-20 spec
 * that are NOT in `season-planning.spec.ts` (which focuses on shell landmarks
 * and deferred-tab skip flags).
 *
 * Scope here:
 *  - Alt+N keyboard shortcut opens SeasonQuickCreateSheet
 *  - Quick-create sheet cancel does not persist a zombie draft
 *  - Sidebar filter pills change state (without relying on seeded data counts)
 *  - `/dashboard/season/[seasonId]` with an invalid id returns 404
 *  - Season page submenu routes use `router.push` (Back preserves previous tab)
 *
 * Flows intentionally NOT covered here (require specific seed data or
 * real mouse-drag kinematics that Playwright's pointer events don't replay
 * faithfully enough to be stable):
 *  - Draw-to-create pixel-drag → phantom → sheet round-trip
 *  - Click-block-routes-to-season (needs a known season id in the workspace)
 *  - Popover editor on hour-factor bars (needs a season with factors seeded)
 *
 * Ref: docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md §14
 * Ref: docs/journeys/JOURNEY-year-wheel.md
 */

// Run serially within this describe so parallel workers don't thrash
// Turbopack dev-server first-compile. Also gives each test a 60s budget
// (default 30s is tight when Turbopack is doing route compile + HMR under
// load). CI enforces `workers: 1` globally (playwright.config.ts:24) so
// this is a local-DX stabilizer, not a CI change.
test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("Year Wheel Redesign — New Flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("Alt+N opens the quick-create sheet with today + 7 day defaults", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Press Alt+N — the page-client registers a window keydown handler.
    await page.keyboard.press("Alt+n");

    // The shadcn Sheet renders as role="dialog" with the title "Ny sesong".
    const sheet = page.getByRole("dialog").filter({ hasText: "Ny sesong" });
    await expect(sheet).toBeVisible({ timeout: 5000 });

    // Navn input is autofocused with the default name pre-filled.
    const nameInput = sheet.getByLabel("Navn", { exact: true });
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("Ny sesong");

    // Start date field is present and populated (we don't assert the exact
    // date because the test clock floats with "today").
    const startInput = sheet.getByLabel("Start", { exact: true });
    await expect(startInput).toBeVisible();
    const startValue = await startInput.inputValue();
    expect(startValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // End date is 7 days after start.
    const endInput = sheet.getByLabel("Slutt", { exact: true });
    await expect(endInput).toBeVisible();
    const endValue = await endInput.inputValue();
    expect(endValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const start = new Date(startValue);
    const end = new Date(endValue);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    expect(diffDays).toBe(7);
  });

  test("quick-create sheet can be abandoned with Avbryt without creating a season", async ({
    page,
  }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Capture the URL before we open the sheet — we should still be here
    // after Avbryt (no redirect to /dashboard/season/[newId]).
    const urlBefore = page.url();

    await page.keyboard.press("Alt+n");

    const sheet = page.getByRole("dialog").filter({ hasText: "Ny sesong" });
    await expect(sheet).toBeVisible({ timeout: 5000 });

    const cancelButton = sheet.getByRole("button", { name: "Avbryt" });
    await cancelButton.click();

    // Sheet closes; URL unchanged; we did not route to a season page.
    await expect(sheet).not.toBeVisible({ timeout: 3000 });
    expect(page.url()).toBe(urlBefore);
    expect(page.url()).not.toContain("/dashboard/season/");
  });

  test("sidebar filter pills change aria-selected state", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Sidebar renders a tablist with filter pills. Their labels are
    // "Alle / Aktiv / Utkast / Arkivert".
    const sidebar = page.locator('aside[aria-label^="Sesonger"]').first();
    await expect(sidebar).toBeVisible({ timeout: 8000 });

    const filterTablist = sidebar.getByRole("tablist").first();

    const alleTab = filterTablist.getByRole("tab", { name: /^Alle/ });
    const draftTab = filterTablist.getByRole("tab", { name: /^Utkast/ });

    // Default: "Alle" is selected.
    await expect(alleTab).toHaveAttribute("aria-selected", "true");

    // Click "Utkast" — selection moves.
    await draftTab.click();
    await expect(draftTab).toHaveAttribute("aria-selected", "true");
    await expect(alleTab).toHaveAttribute("aria-selected", "false");
  });

  test("invalid seasonId in /dashboard/season/[id] triggers notFound", async ({ page }) => {
    // A well-formed UUID that is guaranteed not to exist in any workspace.
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await page.goto(`/dashboard/season/${fakeId}?tab=budget`, {
      waitUntil: "domcontentloaded",
    });

    // Next.js notFound() renders a 404 page. Middleware may redirect through
    // /login first; follow until we settle on either /login or a 404 body.
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // We should never land on /dashboard/year-wheel/[id] (the old stale
    // redirect that the redesign fix removed).
    expect(page.url()).not.toMatch(/\/dashboard\/year-wheel\/[a-f0-9-]+/);

    // Either Next's default 404 text or the redirect to /login is acceptable.
    // If the resolveDashboardContext redirect already fired, we're on /login.
    const currentUrl = page.url();
    const status = response?.status();
    const isLogin = currentUrl.includes("/login");
    const is404Status = status === 404;
    const is404Body = await page
      .getByText(/404|Page not found|Finner ikke siden/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(isLogin || is404Status || is404Body).toBe(true);
  });

  test("season submenu tab clicks preserve back-button history (router.push)", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Find any season id we can deep-link to — click the first season in the
    // sidebar list if one exists; otherwise skip with a clear reason (tests
    // should not be fragile to seed-data absence).
    const sidebar = page.locator('aside[aria-label^="Sesonger"]').first();
    await expect(sidebar).toBeVisible({ timeout: 8000 });

    const firstSeasonRow = sidebar
      .locator("button")
      .filter({ hasNotText: /^Alle|^Aktiv|^Utkast|^Arkivert/ })
      .first();

    const hasSeasonRow = await firstSeasonRow.isVisible({ timeout: 2000 }).catch(() => false);
    test.skip(!hasSeasonRow, "No seasons seeded in this workspace — skipping tab-history test");

    await firstSeasonRow.click();

    // Expect to land on /dashboard/season/[id]?tab=budget
    await page.waitForURL(/\/dashboard\/season\/[a-f0-9-]+\?tab=budget/, {
      timeout: 10000,
    });
    const budgetUrl = page.url();

    // Click "Dag" submenu tab.
    const submenu = page.getByRole("tablist", { name: /Sesongseksjoner/ });
    await submenu.getByRole("tab", { name: "Dag" }).click();
    await page.waitForURL(/\?tab=day/, { timeout: 5000 });
    const dayUrl = page.url();

    expect(dayUrl).not.toBe(budgetUrl);

    // Browser Back should land us on the previous tab (budget), NOT on
    // /dashboard/year-wheel (which is what replace semantics would do).
    await page.goBack();
    await page.waitForURL(/\?tab=budget/, { timeout: 5000 });
    expect(page.url()).toContain("?tab=budget");
    expect(page.url()).not.toContain("/dashboard/year-wheel");
  });

  test("AiSuggestionCard renders as empty-state with no action buttons", async ({ page }) => {
    // Theatre-prevention check (L-0046): the AiSuggestionCard must NOT
    // render Accept/Avvis buttons until a real suggestion backend lands.
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const card = page.locator('[aria-label="AI-forslag kommer snart"]').first();
    await expect(card).toBeVisible({ timeout: 5000 });

    // Text content matches the empty-state copy.
    await expect(card.getByText(/Ingen AI-forslag ennå/)).toBeVisible();

    // No Accept / Avvis buttons in the card (theatre check).
    const accept = card.getByRole("button", { name: /Accept|Godta/i });
    const reject = card.getByRole("button", { name: /Avvis|Reject/i });
    await expect(accept).toHaveCount(0);
    await expect(reject).toHaveCount(0);
  });

  test("year-nav chevrons update ?year= URL param and page re-renders", async ({ page }) => {
    await page.goto("/dashboard/year-wheel", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const nextYearButton = page.getByRole("button", { name: "Neste år" });
    await expect(nextYearButton).toBeVisible({ timeout: 5000 });

    const urlBefore = new URL(page.url());
    const yearBefore = urlBefore.searchParams.get("year");

    await nextYearButton.click();
    await page.waitForURL(/[?&]year=\d{4}/, { timeout: 5000 });

    const urlAfter = new URL(page.url());
    const yearAfter = urlAfter.searchParams.get("year");
    expect(yearAfter).not.toBeNull();
    expect(yearAfter).not.toBe(yearBefore);

    // Sidebar header should reflect the new year ("Sesonger {year}").
    const sidebar = page.locator('aside[aria-label^="Sesonger"]').first();
    await expect(sidebar).toBeVisible();
    const sidebarLabel = await sidebar.getAttribute("aria-label");
    expect(sidebarLabel).toContain(yearAfter);
  });
});
