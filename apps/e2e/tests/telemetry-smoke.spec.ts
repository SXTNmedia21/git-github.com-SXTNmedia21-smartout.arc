import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { expectTelemetryEvent, telemetryTimestamp } from "../helpers/telemetry";

// ============================================
// telemetry-smoke.spec.ts
// Runs one real website setup mutation and
// proves local Playwright can hit telemetry.
// Why: local e2e should verify both product
// telemetry and journey reporter persistence.
// ============================================

let workspaceId: string | null = null;

/**
 * Removes website rows for the target workspace so the setup wizard is reachable.
 * Why: the telemetry smoke must execute the real "create from template" mutation.
 *
 * @returns Promise that resolves when cleanup is complete
 */
async function resetWebsiteStateForWorkspace(targetWorkspaceId: string): Promise<void> {
  await supabase
    .from("workspace")
    .update({ has_website: false })
    .eq("workspace_id", targetWorkspaceId);

  await supabase
    .schema("websites" as "public")
    .from("website_section")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
  await supabase
    .schema("websites" as "public")
    .from("website_page")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
  await supabase
    .schema("websites" as "public")
    .from("website_domain")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
  await supabase
    .schema("websites" as "public")
    .from("website_snapshot")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
  await supabase
    .schema("websites" as "public")
    .from("website")
    .delete()
    .eq("workspace_id", targetWorkspaceId);
}

test.describe("journey:admin-creates-website-from-template", () => {
  test.beforeAll(async () => {
    const { data: workspace } = await supabase
      .from("workspace")
      .select("workspace_id")
      .limit(1)
      .single();

    if (!workspace) {
      throw new Error("Telemetry smoke requires at least one workspace");
    }

    workspaceId = workspace.workspace_id;
    await resetWebsiteStateForWorkspace(workspaceId);
  });

  test("telemetry smoke writes activity trail for website setup", async ({ page }) => {
    if (!workspaceId) {
      throw new Error("Telemetry smoke workspace not initialized");
    }

    const since = telemetryTimestamp();

    await loginAsAdmin(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });

    const templateCard = page.locator("button").filter({ hasText: "Restaurant Classic" }).first();
    const nextButton = page.getByRole("button", { name: "Neste" });
    await expect(templateCard).toBeVisible({ timeout: 15000 });
    await templateCard.click();

    // Some local runs focus the card without toggling the selected state on first click.
    // If that happens, press Enter on the focused card and wait for the step button to enable.
    if (!(await nextButton.isEnabled().catch(() => false))) {
      await templateCard.focus();
      await templateCard.press("Enter");
    }

    await expect(nextButton).toBeEnabled({ timeout: 5000 });
    await nextButton.click();
    await page.getByLabel("Navn på nettsiden").fill(`Telemetry Smoke ${Date.now()}`);
    await expect(nextButton).toBeEnabled({ timeout: 5000 });
    await nextButton.click();
    await page.getByRole("button", { name: "Opprett nettside" }).click();

    await page.waitForURL("**/dashboard/website", { timeout: 15000 });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });

    await expectTelemetryEvent("website setup completed", workspaceId, {
      since,
      entityType: "website",
      timeout: 15000,
    });
  });
});
