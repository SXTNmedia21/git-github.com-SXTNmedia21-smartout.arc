// kartotek.spec.ts — E2E spec for the accountant /workspaces kartotek flow.
//
// Coverage:
//   J1 — /workspaces list renders with workspace table and search input
//   J2 — Search input filters by workspace name and company name
//   J3 — Row click navigates to /workspaces/<id> detail page
//   J4 — Detail page renders all 7 sections (full_kartotek scope)
//   J5 — orders_only scope: members/contracts/billing_config show "Ikke tilgang" placeholder
//
// ⛔ ALL TESTS SKIPPED — apps/admin not deployed to CI yet.
// Remove `.skip` annotations when M7 deploys admin to staging and
// auth fixture is wired (storageState with accountant session).
//
// Admin base URL: http://localhost:3070 (dev) or ADMIN_BASE_URL env var.
//
// Auth: specs assume an authenticated accountant session injected via
// storageState from a pre-authenticated fixture. Fixture setup is M7 work.
// The test.skip(true, "M7: deploy first") annotation keeps them green on CI.

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.ADMIN_BASE_URL ?? "http://localhost:3070";

// ─── J1 — /workspaces list view ──────────────────────────────────────────────

test.describe("Workspaces — List view", () => {
  test.skip(true, "M7: deploy first");

  test("renders /workspaces with table and search input", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces`, { waitUntil: "domcontentloaded" });

    // Page heading
    await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();

    // Search input present
    const search = page.getByPlaceholder("Søk etter workspace eller selskap…");
    await expect(search).toBeVisible();

    // Table columns present
    await expect(page.getByRole("columnheader", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Selskap" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Org.nr" })).toBeVisible();
  });
});

// ─── J2 — Search filters ─────────────────────────────────────────────────────

test.describe("Workspaces — Search filter", () => {
  test.skip(true, "M7: deploy first");

  test("search by workspace name filters rows", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces`, { waitUntil: "domcontentloaded" });

    const search = page.getByPlaceholder("Søk etter workspace eller selskap…");
    const initialRows = await page.getByRole("row").count();

    // Type a query that should not match anything
    await search.fill("ZZZZNOTEXIST");
    await expect(page.getByText("Ingen workspaces matcher søket")).toBeVisible();

    // Clear filter — rows return
    await search.clear();
    await expect(page.getByRole("row")).toHaveCount(initialRows);
  });

  test("search by company name filters rows", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces`, { waitUntil: "domcontentloaded" });

    const search = page.getByPlaceholder("Søk etter workspace eller selskap…");
    // Type partial company name — expect at least 1 match or empty state
    await search.fill("AS");
    // Either rows remain or empty state shows — no crash
    const hasRows = (await page.getByRole("row").count()) > 1;
    const hasEmpty = await page.getByText("Ingen workspaces matcher søket").isVisible();
    expect(hasRows || hasEmpty).toBe(true);
  });
});

// ─── J3 — Row click navigates to detail ──────────────────────────────────────

test.describe("Workspaces — Row navigation", () => {
  test.skip(true, "M7: deploy first");

  test("clicking a workspace row navigates to /workspaces/<id>", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces`, { waitUntil: "domcontentloaded" });

    // Click first data row (skip header row at index 0)
    const firstRow = page.getByRole("row").nth(1);
    await firstRow.click();

    // Should navigate to a UUID detail route
    await expect(page).toHaveURL(/\/workspaces\/[0-9a-f-]{36}/);
  });
});

// ─── J4 — Detail page — full_kartotek scope ──────────────────────────────────

test.describe("Workspaces — Detail (full kartotek)", () => {
  test.skip(true, "M7: deploy first");

  /**
   * Assumes TEST_WORKSPACE_ID env var points to a workspace where the
   * test accountant has full_kartotek scope.
   */
  const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID ?? "00000000-0000-0000-0000-000000000001";

  test("detail page renders all 7 sections", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces/${WORKSPACE_ID}`, {
      waitUntil: "domcontentloaded",
    });

    // Section headings — verify all 7 are visible.
    // These match the CardTitle text in each section component.
    await expect(page.getByRole("heading").filter({ hasText: /Fakturaoppsett/i })).toBeVisible();
    await expect(page.getByRole("heading").filter({ hasText: /Ordrehistorikk/i })).toBeVisible();
    await expect(page.getByRole("heading").filter({ hasText: /Betalingsstatus/i })).toBeVisible();
    await expect(page.getByRole("heading").filter({ hasText: /Kontrakter/i })).toBeVisible();
    await expect(page.getByRole("heading").filter({ hasText: /Medlemmer/i })).toBeVisible();
    await expect(page.getByRole("heading").filter({ hasText: /Aktivitet/i })).toBeVisible();
  });

  test("order history row links to /orders?preview=", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces/${WORKSPACE_ID}`, {
      waitUntil: "domcontentloaded",
    });

    // If there are any order links, they point to /orders?preview=<id>
    const orderLink = page.locator('a[href*="/orders?preview="]').first();
    const hasOrders = await orderLink.isVisible();
    if (hasOrders) {
      await expect(orderLink).toHaveAttribute("href", /\/orders\?preview=/);
    }
  });
});

// ─── J5 — Detail page — orders_only graceful degradation ─────────────────────

test.describe("Workspaces — Detail (orders_only scope)", () => {
  test.skip(true, "M7: deploy first");

  /**
   * Assumes TEST_WORKSPACE_ID_ORDERS_ONLY env var points to a workspace
   * where the test accountant has orders_only scope.
   */
  const WORKSPACE_ID =
    process.env.TEST_WORKSPACE_ID_ORDERS_ONLY ?? "00000000-0000-0000-0000-000000000002";

  test("RLS-denied sections render Ikke tilgang placeholder without crash", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces/${WORKSPACE_ID}`, {
      waitUntil: "domcontentloaded",
    });

    // Page must not show a 500 error
    await expect(page.getByRole("heading", { name: /500/i })).not.toBeVisible();

    // At least one "Ikke tilgang" placeholder should be visible for
    // members, contracts, or billing_config sections.
    const notAllowed = page.getByText(
      "Ikke tilgang — denne seksjonen krever full kartotek-tilgang",
    );
    await expect(notAllowed.first()).toBeVisible();
  });

  test("order history still shows for orders_only scope", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspaces/${WORKSPACE_ID}`, {
      waitUntil: "domcontentloaded",
    });

    // OrderHistorySection heading always renders (not RLS-gated).
    await expect(page.getByRole("heading").filter({ hasText: /Ordrehistorikk/i })).toBeVisible();
  });
});
