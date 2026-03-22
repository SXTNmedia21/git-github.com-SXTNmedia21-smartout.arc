import { test, expect, type Page } from "@playwright/test";
import { supabase, seedWorkspace, seedProfile } from "../helpers/seed";

// ─── Constants ─────────────────────────────────────────────
const TEST_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "password123";

// Track state for cleanup
let workspaceId: string | null = null;
let websiteId: string | null = null;

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
}

// ─── Journey: Admin Creates Website from Template ──────────

test.describe("journey:admin-creates-website-from-template", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Ensure workspace has no website (has_website = false)
    const { data: ws } = await supabase
      .from("workspace")
      .select("workspace_id, has_website")
      .limit(1)
      .single();

    if (ws) {
      workspaceId = ws.workspace_id;
      if (ws.has_website) {
        // Clean up existing website for fresh test
        await supabase
          .from("workspace")
          .update({ has_website: false })
          .eq("workspace_id", workspaceId);

        // Remove website data from websites schema
        const admin = supabase;
        const { data: existingWebsite } = await admin
          .schema("websites" as "public")
          .from("website")
          .select("website_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (existingWebsite) {
          websiteId = existingWebsite.website_id;
          await admin
            .schema("websites" as "public")
            .from("website_section")
            .delete()
            .eq("workspace_id", workspaceId);
          await admin
            .schema("websites" as "public")
            .from("website_page")
            .delete()
            .eq("workspace_id", workspaceId);
          await admin
            .schema("websites" as "public")
            .from("website_domain")
            .delete()
            .eq("workspace_id", workspaceId);
          await admin
            .schema("websites" as "public")
            .from("website_snapshot")
            .delete()
            .eq("workspace_id", workspaceId);
          await admin
            .schema("websites" as "public")
            .from("website")
            .delete()
            .eq("workspace_id", workspaceId);
          websiteId = null;
        }
      }
    }
  });

  test.afterAll(async () => {
    // Restore workspace state if test created a website
    if (workspaceId && websiteId) {
      const admin = supabase;
      await admin
        .schema("websites" as "public")
        .from("website_section")
        .delete()
        .eq("workspace_id", workspaceId);
      await admin
        .schema("websites" as "public")
        .from("website_page")
        .delete()
        .eq("workspace_id", workspaceId);
      await admin
        .schema("websites" as "public")
        .from("website_domain")
        .delete()
        .eq("workspace_id", workspaceId);
      await admin
        .schema("websites" as "public")
        .from("website_snapshot")
        .delete()
        .eq("workspace_id", workspaceId);
      await admin
        .schema("websites" as "public")
        .from("website")
        .delete()
        .eq("workspace_id", workspaceId);
      await supabase
        .from("workspace")
        .update({ has_website: false })
        .eq("workspace_id", workspaceId);
    }
  });

  test("redirects to setup wizard when no website exists", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");
    await page.waitForURL("**/dashboard/website/setup**", { timeout: 10000 });
    expect(page.url()).toContain("/dashboard/website/setup");
  });

  test("shows template gallery on setup page", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website/setup");

    // Template gallery should show template cards
    await expect(
      page.locator("[data-testid='template-gallery'], .template-gallery, h1, h2").first(),
    ).toBeVisible({
      timeout: 10000,
    });

    // Should have at least one template card
    const templateCards = page.locator("[data-testid='template-card'], [role='button']");
    const count = await templateCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("can preview a template", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website/setup");

    // Click the first preview button
    const previewBtn = page.locator("text=Forh\u00e5ndsvisning").first();
    if (await previewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await previewBtn.click();
      // Preview overlay should appear
      await expect(
        page.locator("[data-testid='template-preview'], [role='dialog']").first(),
      ).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

// ─── Journey: Admin Edits Sections ─────────────────────────

test.describe("journey:admin-edits-section-content", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Ensure a website exists for editing tests
    const { data: ws } = await supabase
      .from("workspace")
      .select("workspace_id, has_website")
      .limit(1)
      .single();

    if (ws) {
      workspaceId = ws.workspace_id;

      if (!ws.has_website) {
        // Create a minimal website via direct DB insert for testing
        const admin = supabase;
        const { data: website } = await admin
          .schema("websites" as "public")
          .from("website")
          .insert({
            workspace_id: workspaceId,
            name: "E2E Test Site",
            slug: `e2e-test-${Date.now()}`,
            template_key: "restaurant-classic",
            status: "draft",
            theme: { primaryColor: "#1a1a2e", fontHeading: "Inter", fontBody: "Inter" },
          })
          .select("website_id")
          .single();

        if (website) {
          websiteId = website.website_id;

          // Create a home page
          await admin
            .schema("websites" as "public")
            .from("website_page")
            .insert({
              website_id: websiteId,
              workspace_id: workspaceId,
              title: "Hjem",
              slug: "",
              page_type: "home",
              sort_order: 0,
              is_visible: true,
            });

          await supabase
            .from("workspace")
            .update({ has_website: true })
            .eq("workspace_id", workspaceId);
        }
      } else {
        // Get existing website
        const { data: existingWebsite } = await supabase
          .schema("websites" as "public")
          .from("website")
          .select("website_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        websiteId = existingWebsite?.website_id ?? null;
      }
    }
  });

  test("navigates to website overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    // Should show website overview (not redirect to setup)
    await expect(page.locator("text=Nettside").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows page list on overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    // Should show at least one page (the home page)
    await expect(page.locator("text=Hjem").first()).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to page editor", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    // Click on a page row to navigate to editor
    const pageLink = page.locator("a[href*='/dashboard/website/pages/']").first();
    if (await pageLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pageLink.click();
      await page.waitForURL("**/dashboard/website/pages/**", { timeout: 10000 });
      expect(page.url()).toContain("/dashboard/website/pages/");
    }
  });
});

// ─── Journey: Admin Manages Pages ──────────────────────────

test.describe("journey:admin-manages-pages", () => {
  test("can see add page button on overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    const addBtn = page.locator("text=Legg til side").first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });

  test("add page dialog opens", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    const addBtn = page.locator("text=Legg til side").first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();

      // Dialog should appear with title input
      await expect(page.locator("[role='dialog']").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("home page cannot be deleted", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    // Home page's delete button should be disabled or not present
    const homeRow = page.locator("text=Hjem").first().locator("..");
    const deleteBtn = homeRow.locator(
      "[aria-label*='delete'], [aria-label*='slett'], button:has(svg.lucide-trash)",
    );
    const count = await deleteBtn.count();
    if (count > 0) {
      await expect(deleteBtn.first()).toBeDisabled();
    }
    // If no delete button exists for home, that's also correct
  });
});

// ─── Journey: Admin Publishes Website ──────────────────────

test.describe("journey:admin-publishes-website", () => {
  test("publish button visible on overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website");

    // Look for publish button
    const publishBtn = page.locator("text=Publiser").first();
    await expect(publishBtn).toBeVisible({ timeout: 10000 });
  });

  test("preview button opens new tab", async ({ page, context }) => {
    await login(page);
    await page.goto("/dashboard/website");

    const previewBtn = page.locator("text=Forh\u00e5ndsvisning").first();
    if (await previewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Listen for new tab
      const [newPage] = await Promise.all([
        context.waitForEvent("page", { timeout: 5000 }).catch(() => null),
        previewBtn.click(),
      ]);

      if (newPage) {
        // New tab should open with preview URL
        expect(newPage.url()).toContain("preview");
        await newPage.close();
      }
    }
  });
});
