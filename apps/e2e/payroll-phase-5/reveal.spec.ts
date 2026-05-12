/**
 * payroll-phase-5/reveal.spec.ts
 *
 * E2E spec for Phase 5 PII reveal round-trip.
 * Source: docs/journeys/JOURNEY-payroll-phase-5-admin-reveals-personal-number.md
 *         docs/journeys/JOURNEY-payroll-phase-5-admin-reveals-bank-account.md
 *         docs/journeys/JOURNEY-payroll-phase-5-cross-workspace-reveal-rejected.md
 *
 * Group A — admin reveal (personal number + bank account): SKIPPED
 * Group B — cross-workspace rejection: SKIPPED
 *
 * Status: SCAFFOLDED — skipped pending e2e seed infrastructure.
 *
 * Blockers:
 *   1. No payroll-phase-5 seed helper exists. The tests require a seeded employee
 *      with personal_number + bank_account set in public.profile. The existing
 *      seed helpers (apps/e2e/helpers/seed.ts) do not seed PII columns.
 *   2. data-testid="reveal-personal_number" and data-testid="reveal-bank_account"
 *      exist in LonnsprofilSection.tsx (lines 885 + 917) — no additions needed.
 *      data-testid="lonnsprofil-form" exists at LonnsprofilSection.tsx:481.
 *   3. The complete-data route requires admin auth + profile with active
 *      employee_payroll_profile row. The loginAsAdmin helper (apps/e2e/helpers/auth.ts)
 *      covers auth but not the payroll-profile seed.
 *   4. activity_trail verification requires a Supabase admin client query
 *      post-reveal. The supabase helper (apps/e2e/helpers/seed.ts) exports a
 *      service-role client that can be reused.
 *
 * When these blockers are resolved: remove test.skip and verify with
 *   pnpm --filter apps/e2e exec playwright test payroll-phase-5/reveal.spec.ts
 *
 * Parallel to Phase 4 e2e Group B skip pattern (JOURNEY-payroll-phase-4-*.md).
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

// ─── Seed constants (replace with actual UUIDs from payroll-phase-5 seed helper) ───
const SEED_EMPLOYEE_ID = "REPLACE_ME_SEED_EMPLOYEE_UUID";
const SEED_WORKSPACE_B_PROFILE_ID = "REPLACE_ME_WORKSPACE_B_PROFILE_UUID";

// ─── Group A — Admin reveals personal number ─────────────────────────────────

test.describe("Group A: admin reveals employee personal number", () => {
  test.skip("admin reveal round-trip: masked → click → value shown + activity_trail row written", async ({
    page,
  }) => {
    // Arrange
    await loginAsAdmin(page);
    await page.goto(`/dashboard/people/${SEED_EMPLOYEE_ID}/complete-data`);

    // Wait for LonnsprofilSection to load
    await page.waitForSelector('[data-testid="lonnsprofil-form"]', { timeout: 15000 });

    // Scroll to HIGH-PII block
    const revealWrapper = page.locator('[data-testid="reveal-personal_number"]');
    await revealWrapper.scrollIntoViewIfNeeded();

    // Assert masked initial state — Eye icon visible, value is MASK
    const maskedSpan = revealWrapper.locator('span[aria-label*="skjult"]');
    await expect(maskedSpan).toBeVisible({ timeout: 5000 });
    await expect(maskedSpan).toContainText("••••••••");

    // Reveal button should be visible (hasValue = true in fetch mode before first click)
    const revealButton = revealWrapper.locator('button[aria-label*="Vis Personnummer"]');
    await expect(revealButton).toBeVisible();

    // Act — click reveal
    await revealButton.click();

    // Wait for BFF response — the component shows a Loader2 during fetch
    await page.waitForSelector(
      '[data-testid="reveal-personal_number"] span[aria-label*="synlig"]',
      {
        timeout: 10000,
      },
    );

    // Assert — revealed value is a Norwegian fødselsnummer (11 digits, may have space)
    const revealedSpan = revealWrapper.locator('span[aria-label*="synlig"]');
    await expect(revealedSpan).toBeVisible();
    await expect(revealedSpan).toHaveText(/^\d{6}\s?\d{5}$/);

    // Assert — activity_trail row written within 2s
    // Uses supabase admin client to verify the audit row
    // Uncomment when seed helper provides employee_profile_id:
    //
    // const { data: auditRows } = await supabase
    //   .from("activity_trail")
    //   .select("event_name, entity_id, actor_id")
    //   .eq("event_name", "payroll.personal_number_revealed")
    //   .eq("entity_id", SEED_EMPLOYEE_ID)
    //   .order("created_at", { ascending: false })
    //   .limit(1);
    // expect(auditRows).toHaveLength(1);
    // expect(auditRows![0].event_name).toBe("payroll.personal_number_revealed");

    // Assert — value auto-masks after 5s
    await page.waitForTimeout(5500);
    const maskedAgain = revealWrapper.locator('span[aria-label*="skjult"]');
    await expect(maskedAgain).toBeVisible();
  });

  test.skip("admin reveal: non-admin role cannot see the Personnummer reveal button", async ({
    page,
  }) => {
    // TODO: login as employee (non-admin)
    // The employee's /dashboard/my-contract uses static RevealableField (no fetchEndpoint)
    // Navigate to their own my-contract page
    await page.goto("/dashboard/my-contract");

    // The my-contract RevealableField is static-mode (value already in props)
    // There should be a reveal button IF personal_number is set
    // There should NOT be a fetchEndpoint-based button (no BFF call for self-reveal on this page)

    // This test verifies the absence of admin-mode in the employee's view.
    // Employee sees their own data on /dashboard/my-contract (static mode, no BFF).
    // /dashboard/people/[id]/complete-data is NOT accessible to employees (admin-only route).
  });
});

// ─── Group A.2 — Admin reveals bank account ──────────────────────────────────

test.describe("Group A.2: admin reveals bank account", () => {
  test.skip("admin reveal bank account: masked → click → 11-digit account shown", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/dashboard/people/${SEED_EMPLOYEE_ID}/complete-data`);
    await page.waitForSelector('[data-testid="lonnsprofil-form"]', { timeout: 15000 });

    const revealWrapper = page.locator('[data-testid="reveal-bank_account"]');
    await revealWrapper.scrollIntoViewIfNeeded();

    // Assert masked initial state
    const maskedSpan = revealWrapper.locator('span[aria-label*="skjult"]');
    await expect(maskedSpan).toBeVisible({ timeout: 5000 });
    await expect(maskedSpan).toContainText("••••••••");

    // Click reveal
    const revealButton = revealWrapper.locator('button[aria-label*="Vis Bankkonto"]');
    await expect(revealButton).toBeVisible();
    await revealButton.click();

    // Wait for reveal
    await page.waitForSelector('[data-testid="reveal-bank_account"] span[aria-label*="synlig"]', {
      timeout: 10000,
    });

    // Norwegian bank account: 11 digits, may be formatted as NNNN.NN.NNNNN or unformatted
    const revealedSpan = revealWrapper.locator('span[aria-label*="synlig"]');
    await expect(revealedSpan).toBeVisible();
    await expect(revealedSpan).toHaveText(/[\d.]{11,}/);

    // Auto-mask after 5s
    await page.waitForTimeout(5500);
    await expect(revealWrapper.locator('span[aria-label*="skjult"]')).toBeVisible();
  });
});

// ─── Group B — Cross-workspace reveal rejected ────────────────────────────────

test.describe("Group B: cross-workspace reveal rejected", () => {
  test.skip("cross-workspace profileId in reveal request returns 404 and does not leak PII", async ({
    page,
  }) => {
    // Arrange: log in as admin in workspace A
    await loginAsAdmin(page);

    // Intercept the reveal request to assert the 404 response
    let revealResponseStatus: number | undefined;
    await page.route("**/api/payroll/reveal-personal-number", async (route) => {
      // Modify the body to use a workspace-B profile_id
      await route.continue({
        postData: JSON.stringify({ profileId: SEED_WORKSPACE_B_PROFILE_ID }),
      });
    });

    page.on("response", (response) => {
      if (response.url().includes("/api/payroll/reveal-personal-number")) {
        revealResponseStatus = response.status();
      }
    });

    // Navigate to any valid page and trigger the reveal via fetch
    await page.goto(`/dashboard/people/${SEED_EMPLOYEE_ID}/complete-data`);
    await page.waitForSelector('[data-testid="lonnsprofil-form"]', { timeout: 15000 });

    // Trigger the reveal click (which will use the intercepted body)
    const revealWrapper = page.locator('[data-testid="reveal-personal_number"]');
    await revealWrapper.scrollIntoViewIfNeeded();
    const revealButton = revealWrapper.locator('button[aria-label*="Vis Personnummer"]');
    if (await revealButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await revealButton.click();
    } else {
      // Direct API call as fallback
      await page.evaluate(async (wsProfileId) => {
        const res = await fetch("/api/payroll/reveal-personal-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: wsProfileId }),
          credentials: "include",
        });
        return res.status;
      }, SEED_WORKSPACE_B_PROFILE_ID);
    }

    // Assert: response was 404 (not_found)
    await page.waitForTimeout(2000);
    expect(revealResponseStatus).toBe(404);

    // Assert: no PII value shown in the component
    const revealedSpan = revealWrapper.locator('span[aria-label*="synlig"]');
    await expect(revealedSpan).not.toBeVisible({ timeout: 2000 });

    // Assert: activity_trail attempt-audit row written (requires supabase admin client)
    // The attempt-audit row has entity_id = SEED_WORKSPACE_B_PROFILE_ID and is_self=false
    // Verify via DB query when seed infrastructure is in place.
  });
});

// ─── Group C — Tax-card manual entry ──────────────────────────────────────────

test.describe("Group C: admin enters tax card manually", () => {
  test.skip("admin saves percentage tax card and value persists on reload", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/dashboard/people/${SEED_EMPLOYEE_ID}/complete-data`);
    await page.waitForSelector('[data-testid="lonnsprofil-form"]', { timeout: 15000 });

    // Click Rediger
    await page.getByRole("button", { name: "Rediger" }).click();

    // Fill tax card type = percentage
    const taxTypeSelect = page.locator('[data-testid="edit-tax_card_type"]');
    await taxTypeSelect.selectOption("percentage");

    // Fill year
    const taxYearInput = page.locator('[data-testid="edit-tax_card_year"]');
    await taxYearInput.clear();
    await taxYearInput.fill("2026");

    // Fill percentage
    const taxPctInput = page.locator('[data-testid="edit-tax_percentage"]');
    await taxPctInput.clear();
    await taxPctInput.fill("35");

    // Save
    await page.getByRole("button", { name: "Lagre" }).click();

    // Assert toast
    await expect(page.getByText("Lønnsprofil oppdatert")).toBeVisible({ timeout: 5000 });

    // Assert VIEW mode shows saved values
    await expect(page.locator('[data-testid="tax_card_type"]')).toContainText("Trekkprosent");
    await expect(page.locator('[data-testid="tax_percentage"]')).toContainText("35 %");
    await expect(page.locator('[data-testid="tax_card_year"]')).toContainText("2026");
  });

  test.skip("validation: type=percentage without percentage value shows error", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/dashboard/people/${SEED_EMPLOYEE_ID}/complete-data`);
    await page.waitForSelector('[data-testid="lonnsprofil-form"]', { timeout: 15000 });

    await page.getByRole("button", { name: "Rediger" }).click();

    // Set type to percentage but do NOT fill the percentage field
    const taxTypeSelect = page.locator('[data-testid="edit-tax_card_type"]');
    await taxTypeSelect.selectOption("percentage");

    // Fill year to pass year validation
    const taxYearInput = page.locator('[data-testid="edit-tax_card_year"]');
    await taxYearInput.clear();
    await taxYearInput.fill("2026");

    // Clear percentage (leave empty)
    const taxPctInput = page.locator('[data-testid="edit-tax_percentage"]');
    await taxPctInput.clear();

    // Attempt save
    await page.getByRole("button", { name: "Lagre" }).click();

    // Assert validation error shown
    await expect(
      page.getByText("Trekkprosent (0–100) er påkrevd ved prosent-skattekort"),
    ).toBeVisible({ timeout: 3000 });

    // Assert: editing state not cleared (still in edit mode)
    await expect(page.locator('[data-testid="edit-tax_card_type"]')).toBeVisible();
  });
});
