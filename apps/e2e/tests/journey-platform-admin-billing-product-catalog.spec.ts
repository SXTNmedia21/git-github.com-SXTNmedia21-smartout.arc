import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

/**
 * Journey: Platform Admin — Billing Product Catalog
 *
 * Validates the ad-hoc invoice drawer flow on /platform-admin/billing/invoices:
 *  - Opening the drawer
 *  - Picking a company from the combobox (Popover + Command)
 *  - Catalog-driven line auto-fill (description / unit_price / vat_rate)
 *  - Free-text fallback line
 *  - Mixed lines (catalog + free-text)
 *  - Editing the description after picking a product clears the binding
 *  - Submit gating on company selection
 *
 * Demo data (seed.sql):
 *   Companies: Villa Mat AS, Grillrestaurant Bårdshaug AS, Fjelds mat, Yogurt Heaven
 *   Products (billing_product, workspace_id IS NULL, is_active=true):
 *     - Onboarding pakke standard
 *     - Onboarding pakke utvidet
 *     - Konsulenttimer – senior
 *     - Konsulenttimer – standard
 *     - Tilpasset utvikling – timepris
 */

const INVOICES_URL = "/platform-admin/billing/invoices";
const INVOICE_DETAIL_RE = /\/platform-admin\/billing\/invoices\/[0-9a-f-]{36}/i;

async function openDrawer(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(INVOICES_URL, { waitUntil: "domcontentloaded" });
  // Drawer opens through the AdHocInvoiceDrawer's own trigger button.
  // The page may render a redirect to /dashboard if the user is not godmode —
  // tests skip in that case (handled by individual specs that read URL).
  const opener = page.getByTestId("ad-hoc-invoice-open");
  await opener.waitFor({ state: "visible", timeout: 10000 });
  await opener.click();
  await page.getByTestId("ad-hoc-invoice-drawer").waitFor({ state: "visible", timeout: 5000 });
}

async function pickCompany(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.getByTestId("company-picker").click();
  // Combobox uses Command — type into the search input then click the option.
  const search = page.getByPlaceholder("Søk selskap…");
  await search.fill(name);
  await page.getByRole("option", { name }).first().click();
  // Verify the picker label updated to the selected company.
  await expect(page.getByTestId("company-picker")).toContainText(name);
}

async function pickProductOnLine(
  page: import("@playwright/test").Page,
  lineIdx: number,
  productName: string,
): Promise<void> {
  await page.getByTestId(`line-product-picker-${lineIdx}`).click();
  // Radix Select renders options as role="option".
  await page
    .getByRole("option", { name: new RegExp(productName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")) })
    .first()
    .click();
}

test.describe("Platform Admin Billing Product Catalog", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("@smoke creates ad-hoc invoice from product catalog", async ({ page }) => {
    await openDrawer(page);
    await pickCompany(page, "Villa Mat AS");

    // Pick "Onboarding pakke standard" on line 0.
    await pickProductOnLine(page, 0, "Onboarding pakke standard");

    // After selection, the description / unit_price should auto-fill.
    const descInput = page.getByTestId("line-description-0");
    const priceInput = page.getByTestId("line-unit-price-0");
    await expect(descInput).toHaveValue(/Onboarding pakke standard/i);
    // unit_price should be a positive number from the catalog (string form
    // because Input is type="number" but value is stored as string).
    const priceValue = await priceInput.inputValue();
    expect(Number(priceValue)).toBeGreaterThan(0);

    // Submit and expect navigation to the new invoice's detail page.
    await Promise.all([
      page.waitForURL(INVOICE_DETAIL_RE, { timeout: 15000 }),
      page.getByTestId("submit-invoice").click(),
    ]);
    expect(page.url()).toMatch(INVOICE_DETAIL_RE);
  });

  test("creates ad-hoc invoice with free-text lines", async ({ page }) => {
    await openDrawer(page);
    await pickCompany(page, "Grillrestaurant Bårdshaug AS");

    // Leave product picker on "Egen linje (fri tekst)" — the default placeholder
    // is shown until something is picked. Just type description + price manually.
    await page.getByTestId("line-description-0").fill("Marketing audit");
    await page.getByTestId("line-unit-price-0").fill("5000");

    await Promise.all([
      page.waitForURL(INVOICE_DETAIL_RE, { timeout: 15000 }),
      page.getByTestId("submit-invoice").click(),
    ]);
    expect(page.url()).toMatch(INVOICE_DETAIL_RE);
  });

  test("creates ad-hoc invoice with mixed lines", async ({ page }) => {
    await openDrawer(page);
    await pickCompany(page, "Fjelds mat");

    // Line 0: catalog product.
    await pickProductOnLine(page, 0, "Konsulenttimer – senior");
    await expect(page.getByTestId("line-description-0")).toHaveValue(/Konsulenttimer/i);

    // Add a second line.
    await page.getByTestId("add-line").click();
    await page.getByTestId("line-description-1").waitFor({ state: "visible", timeout: 5000 });

    // Line 1: free-text.
    await page.getByTestId("line-description-1").fill("Reise og diett");
    await page.getByTestId("line-unit-price-1").fill("1250");

    // Both lines should be present.
    await expect(page.getByTestId("line-description-0")).toBeVisible();
    await expect(page.getByTestId("line-description-1")).toBeVisible();

    await Promise.all([
      page.waitForURL(INVOICE_DETAIL_RE, { timeout: 15000 }),
      page.getByTestId("submit-invoice").click(),
    ]);
    expect(page.url()).toMatch(INVOICE_DETAIL_RE);
  });

  test("editing description after picking product clears product binding", async ({ page }) => {
    await openDrawer(page);
    await pickCompany(page, "Yogurt Heaven");

    // Pick a catalog product.
    await pickProductOnLine(page, 0, "Konsulenttimer – senior");
    const desc = page.getByTestId("line-description-0");
    await expect(desc).toHaveValue(/Konsulenttimer/i);

    // Edit the description manually — this should clear the product_id binding.
    await desc.fill("Custom consult");
    await expect(desc).toHaveValue("Custom consult");

    // The product picker should now show no product selected — i.e. it falls
    // back to the placeholder "Velg fra katalog…" (because product_id is null
    // and the SelectValue renders the value="custom" SelectItem text or the
    // placeholder). The description being the user-typed value is the
    // load-bearing assertion.
    // Double-check by re-opening the picker: "Egen linje (fri tekst)" should
    // be the active option. We assert the picker trigger no longer contains
    // the product name.
    const picker = page.getByTestId("line-product-picker-0");
    await expect(picker).not.toContainText("Konsulenttimer");
  });

  test("submit button disabled when no company selected", async ({ page }) => {
    await openDrawer(page);

    // No company picked, no description typed → submit must be disabled.
    const submit = page.getByTestId("submit-invoice");
    await expect(submit).toBeDisabled();
  });

  // TODO: API-level setup needed (FK violation, unauthorized variants).
  test.skip("rejects ad-hoc invoice with invalid company_id (FK violation)", async () => {
    // Requires direct Server Action invocation with a non-existent company_id
    // to assert the Zod / DB error path. Add when an API harness exists.
  });

  // TODO: API-level setup needed (godmode toggle).
  test.skip("rejects ad-hoc invoice for non-godmode user", async () => {
    // Requires logging in as a non-godmode user and asserting the action
    // returns { ok: false, error: "unauthorized" } or the page redirects.
  });
});
