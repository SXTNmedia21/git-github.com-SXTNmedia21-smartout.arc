/**
 * e2e-contract-template-maler.spec.ts — clone-from-K1a regression for Maler tab.
 *
 * Walks the workspace template flow from /dashboard/contracts?tab=maler:
 *   1. Login as admin
 *   2. Navigate to Maler tab
 *   3. Open "Ny fra systemmal" picker
 *   4. Pick first K1a template → clone via /api/contract-templates/copy
 *   5. Confirm row appears in left zone, workbench shows lineage badge
 *   6. Confirm "Ny fra bunnen" button is disabled (TODO P1, by design —
 *      JOURNEY-fix-fork-template-auth.md)
 *
 * Cleanup is per-run only (afterEach deletes the cloned template_id) so the
 * spec stays idempotent across reruns. Service-role client comes from the
 * shared seed helper — same pattern as journey-employee-contract-e2e.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";

const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

const createdTemplateIds: string[] = [];

test.afterEach(async () => {
  if (createdTemplateIds.length === 0) return;
  await supabase
    .from("contract_template")
    .delete()
    .eq("workspace_id", HQ_WORKSPACE_ID)
    .in("template_id", createdTemplateIds);
  createdTemplateIds.length = 0;
});

test("@smoke Maler tab — clone K1a system template into workspace", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/dashboard/contracts?tab=maler");
  await page.waitForLoadState("domcontentloaded");

  // Wait for template list endpoint (fires on mount with workspace_id query).
  const listResponse = await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/contracts/templates?workspace_id=${HQ_WORKSPACE_ID}`) &&
      r.request().method() === "GET",
    { timeout: 10_000 },
  );
  expect(listResponse.ok()).toBe(true);
  const listJson = (await listResponse.json()) as { data?: Array<{ workspace_id: string | null }> };
  const k1aCount = (listJson.data ?? []).filter((t) => t.workspace_id === null).length;
  expect(k1aCount, "at least one K1a system template must exist").toBeGreaterThan(0);

  // "Ny fra bunnen" disabled by design — JOURNEY-fix-fork-template-auth.md.
  // Both empty-state and footer variants render the same disabled button.
  const blankBtn = page.getByRole("button", { name: /ny fra bunnen/i }).first();
  await expect(blankBtn).toBeVisible({ timeout: 5_000 });
  await expect(blankBtn).toBeDisabled();

  // Open the system picker — empty-state and footer both render the trigger.
  const openPickerBtn = page.getByRole("button", { name: /ny fra systemmal/i }).first();
  await expect(openPickerBtn).toBeVisible();
  await openPickerBtn.click();

  // Picker dialog visible with at least one K1a entry.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const firstSystemTpl = dialog.locator('button[type="button"]').first();
  await expect(firstSystemTpl).toBeVisible();

  // Click → expect POST /api/contract-templates/copy.
  const [copyResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/contract-templates/copy") && r.request().method() === "POST",
      { timeout: 10_000 },
    ),
    firstSystemTpl.click(),
  ]);

  expect(copyResp.ok(), `copy route must succeed (got ${copyResp.status()})`).toBe(true);

  const copyJson = (await copyResp.json()) as {
    template_id: string;
    name: string;
    source_template_id: string | null;
    source_template_version: string | null;
    forked_at: string | null;
  };
  expect(copyJson.template_id).toBeTruthy();
  expect(copyJson.source_template_id).toBeTruthy();
  expect(copyJson.forked_at).toBeTruthy();

  createdTemplateIds.push(copyJson.template_id);

  // Toast confirms (Norwegian "kopiert" / English "cloned").
  await expect(page.getByText(/kopiert|cloned/i).first()).toBeVisible({ timeout: 5_000 });

  // Workbench mounts with lineage badge ("Basert på ..." or "Egendefinert").
  // Norwegian locale fixed to use proper å in packages/i18n/locales/nb/contracts.json.
  await expect(page.getByText(/basert på|egendefinert/i).first()).toBeVisible({ timeout: 5_000 });
});
