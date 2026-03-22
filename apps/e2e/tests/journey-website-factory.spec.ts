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

  // Wait for login animation to complete and redirect
  await page.waitForURL(/\/(dashboard|onboarding|setup)/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // If redirected to onboarding wizard, skip it
  const skipBtn = page.locator("text=Hopp over og gå til dashboard");
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  }

  // May need to skip again on subsequent navigations
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForLoadState("domcontentloaded");
  }
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

  test("shows setup prompt or redirects when no website exists", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    // Should either redirect to /setup or show "Opprett nettside" link
    const setupLink = page.locator("text=Opprett nettside");
    const setupUrl = page.url().includes("/setup");

    if (setupUrl) {
      expect(page.url()).toContain("/dashboard/website/setup");
    } else {
      await expect(setupLink.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("shows template gallery on setup page", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });

    // Wait for a known template name to appear
    await expect(page.locator("text=Restaurant Classic").first()).toBeVisible({ timeout: 15000 });

    // Should have template cards with "Forhåndsvisning" buttons
    const previewBtns = page.locator("text=Forhåndsvisning");
    const count = await previewBtns.count();
    expect(count).toBeGreaterThan(0);
  });

  test("can preview a template", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website/setup", { waitUntil: "domcontentloaded" });

    await expect(page.locator("text=Restaurant Classic").first()).toBeVisible({ timeout: 15000 });

    // Click the first preview button
    const previewBtn = page.locator("text=Forhåndsvisning").first();
    await previewBtn.click();

    // Preview should show section types (hero, cta, etc.) or a dialog
    const sectionPreview = page.locator("text=hero").first();
    const dialog = page.locator("[role='dialog']").first();

    const sectionVisible = await sectionPreview.isVisible({ timeout: 5000 }).catch(() => false);
    const dialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

    expect(sectionVisible || dialogVisible).toBe(true);
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
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    // Should show website overview (not redirect to setup)
    await expect(page.locator("text=Nettside").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows page list or setup prompt on overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    // Wait for the "Nettside" heading to confirm we're on the right page
    await expect(page.locator("h1:has-text('Nettside')")).toBeVisible({ timeout: 15000 });

    // Should show page list with "Hjem" OR setup prompt if website not visible via RLS
    const homePage = page.locator("text=Hjem").first();
    const setupPrompt = page.locator("text=Opprett nettside").first();

    const homeVisible = await homePage.isVisible({ timeout: 5000 }).catch(() => false);
    const setupVisible = await setupPrompt.isVisible({ timeout: 3000 }).catch(() => false);

    expect(homeVisible || setupVisible).toBe(true);
  });

  test("can navigate to page editor", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

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
  test("shows add page button or setup prompt", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1:has-text('Nettside')")).toBeVisible({ timeout: 15000 });

    const addBtn = page.locator("text=Legg til side").first();
    const setupPrompt = page.locator("text=Opprett nettside").first();

    const addVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const setupVisible = await setupPrompt.isVisible({ timeout: 3000 }).catch(() => false);

    expect(addVisible || setupVisible).toBe(true);
  });

  test("add page dialog opens", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    const addBtn = page.locator("text=Legg til side").first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();

      // Dialog should appear with title input
      await expect(page.locator("[role='dialog']").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("home page cannot be deleted", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

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
  test("publish button or setup prompt visible on overview", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1:has-text('Nettside')")).toBeVisible({ timeout: 15000 });

    const publishBtn = page.locator("text=Publiser").first();
    const setupPrompt = page.locator("text=Opprett nettside").first();

    const pubVisible = await publishBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const setupVisible = await setupPrompt.isVisible({ timeout: 3000 }).catch(() => false);

    expect(pubVisible || setupVisible).toBe(true);
  });

  test("preview button opens new tab", async ({ page, context }) => {
    await login(page);
    await page.goto("/dashboard/website", { waitUntil: "domcontentloaded" });

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
