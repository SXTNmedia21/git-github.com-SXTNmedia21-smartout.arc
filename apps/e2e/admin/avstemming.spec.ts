import { test, expect } from "@playwright/test";

/**
 * admin/avstemming.spec.ts — E2E scaffold for the Avstemming workflow (M7c).
 *
 * All tests are skipped pending deployed environment + accountant seed data.
 * Status: SCAFFOLDED — live execution deferred to M8 (Erik UAT).
 * ⛔ NEVER auto-trigger settlement — all run tests must use explicit click.
 *
 * Journeys:
 *   1. Visit dashboard (/) — action-dashboard with period summary
 *   2. Open run-confirmation (/avstemming/run) — workspace selector + period
 *   3. View past run detail (/avstemming/{run_id}) — summary + download cards
 *   4. View history (/avstemming/historikk) — table of prior runs
 *
 * Admin app runs on port 3070 in dev.
 * Production: https://admin.smartout.ai
 */

const BASE_URL = process.env.ADMIN_E2E_BASE_URL ?? "http://localhost:3070";

// ─── Journey 1: Dashboard ────────────────────────────────────────────────────

test.describe("Journey 1: Accountant dashboard", () => {
  test.skip(true, "M8: needs deployed env + accountant seed");

  test("visits dashboard — sees period CTA with Kjør avstemming button", async ({ page }) => {
    // TODO: authenticate as accountant via seed helper
    await page.goto(BASE_URL + "/");

    // CTA card present
    await expect(page.getByText(/Avstemming —/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Kjør avstemming/i })).toBeVisible();

    // Period cutoff visible
    await expect(page.getByText(/Periodekutt:/)).toBeVisible();
  });

  test("dashboard shows QuickTasks when pending orders exist", async ({ page }) => {
    // TODO: seed invoices with status=issued
    await page.goto(BASE_URL + "/");

    await expect(page.getByText(/Hurtigoppgaver/)).toBeVisible();
    // Either shows tasks or "du er à jour"
    const hasTask = await page
      .getByText(/venter «mottatt betalt»/)
      .isVisible()
      .catch(() => false);
    const empty = await page
      .getByText(/Ingen hurtigoppgaver/)
      .isVisible()
      .catch(() => false);
    expect(hasTask || empty).toBe(true);
  });

  test("dashboard RecentSettlement shows last run or empty state", async ({ page }) => {
    await page.goto(BASE_URL + "/");
    await expect(page.getByText(/Forrige periode/)).toBeVisible();
  });
});

// ─── Journey 2: Run confirmation ─────────────────────────────────────────────

test.describe("Journey 2: Run confirmation (/avstemming/run)", () => {
  test.skip(true, "M8: needs deployed env + accountant seed");

  test("opens run-confirmation — workspace checkboxes visible, all checked by default", async ({
    page,
  }) => {
    // TODO: authenticate as accountant
    await page.goto(BASE_URL + "/avstemming/run");

    await expect(page.getByText(/Kjør avstemming/)).toBeVisible();
    await expect(page.getByText(/Workspaces/)).toBeVisible();
    await expect(page.getByText(/Periode/)).toBeVisible();

    // Confirm button present
    await expect(page.getByRole("button", { name: /Kjør avstemming/i })).toBeEnabled();
  });

  test("deselecting all workspaces disables submit button", async ({ page }) => {
    await page.goto(BASE_URL + "/avstemming/run");

    // Click "Fjern alle" to deselect all
    const fjernAlle = page.getByText(/Fjern alle/i);
    if (await fjernAlle.isVisible()) {
      await fjernAlle.click();
      await expect(page.getByRole("button", { name: /Kjør avstemming/i })).toBeDisabled();
    }
  });

  test("error path: unauthenticated user redirects to /auth/login", async ({ page }) => {
    // Do NOT authenticate — direct navigation
    await page.goto(BASE_URL + "/avstemming/run");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

// ─── Journey 3: View past run detail ─────────────────────────────────────────

test.describe("Journey 3: View past run detail (/avstemming/[run_id])", () => {
  test.skip(true, "M8: needs deployed env + settlement_run seed row");

  test("detail page shows period label, status badge, and download cards", async ({ page }) => {
    // TODO: seed a succeeded settlement_run, get run_id
    const run_id = process.env.E2E_SETTLEMENT_RUN_ID ?? "00000000-0000-0000-0000-000000000000";

    await page.goto(BASE_URL + `/avstemming/${run_id}`);

    await expect(page.getByText(/Avstemming —/)).toBeVisible();
    await expect(page.getByText(/Fullført/)).toBeVisible();
    await expect(page.getByText(/Last ned/)).toBeVisible();
    await expect(page.getByText("Sammendrag")).toBeVisible();
    await expect(page.getByText("Detalj-linjer")).toBeVisible();
    await expect(page.getByText("Faktura-bunke")).toBeVisible();
    await expect(page.getByText("Avvik-liste")).toBeVisible();
  });

  test("non-existent run_id returns 404", async ({ page }) => {
    await page.goto(BASE_URL + "/avstemming/00000000-0000-0000-0000-000000000000");
    // Next.js notFound() renders the not-found page
    await expect(page.getByText(/404|Not Found|Ikke funnet/i)).toBeVisible();
  });

  test("accessing another accountant's run returns 404", async ({ page }) => {
    // TODO: seed run owned by different accountant user
    // TODO: authenticate as different accountant
    // TODO: assert notFound
  });
});

// ─── Journey 4: View history ──────────────────────────────────────────────────

test.describe("Journey 4: View history (/avstemming/historikk)", () => {
  test.skip(true, "M8: needs deployed env + accountant seed");

  test("historikk page shows table with prior runs", async ({ page }) => {
    // TODO: authenticate as accountant
    await page.goto(BASE_URL + "/avstemming/historikk");

    await expect(page.getByText(/Historikk/)).toBeVisible();
    // Either shows table rows or empty state
    const hasRows = await page
      .getByText(/Vis pakke/)
      .isVisible()
      .catch(() => false);
    const empty = await page
      .getByText(/Ingen tidligere avstemmingar/)
      .isVisible()
      .catch(() => false);
    expect(hasRows || empty).toBe(true);
  });

  test("clicking Vis pakke navigates to run detail", async ({ page }) => {
    await page.goto(BASE_URL + "/avstemming/historikk");

    const visPacke = page.getByRole("link", { name: /Vis pakke/i }).first();
    if (await visPacke.isVisible()) {
      await visPacke.click();
      await expect(page).toHaveURL(/\/avstemming\/[0-9a-f-]{36}$/);
    }
  });
});
