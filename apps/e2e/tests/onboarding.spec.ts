import { test, expect } from "@playwright/test";

test.describe("Onboarding Wizard Flow", () => {
  // Skip: onboarding wizard was rewritten with new UI/labels.
  // These tests reference the old English wizard. See workspace-setup-flow.spec.ts for current tests.
  test.skip(true, "Onboarding wizard rewritten — tests need update to match new Norwegian UI");

  test.setTimeout(60000);

  test("should complete entire wizard with fallback data (unauthenticated → skip auth)", async ({
    page,
  }) => {
    // 1. Init step — enter URL
    await page.goto("/onboarding");
    await expect(page.locator('h1:has-text("Let\'s build your workspace.")')).toBeVisible({
      timeout: 10000,
    });

    // 2. Submit URL → triggers crawling → falls back to mock after 3s
    await page.fill('input[placeholder="your-webpage.com"]', "mocksite.com");
    await page.click('button:has-text("Scan & Generate")');

    // 3. Auth step appears (since user is not authenticated)
    await expect(page.locator('h1:has-text("Save your progress")')).toBeVisible({
      timeout: 10000,
    });

    // Skip auth for now
    await page.click('button:has-text("Skip for now")');

    // 4. Org verification step
    await expect(page.locator('h2:has-text("Verify Company Identity")')).toBeVisible({
      timeout: 5000,
    });
    await page.click('button:has-text("Skip this step for now")');

    // 5. Branding step
    await expect(page.locator('h1:has-text("Your Branding & Voice")')).toBeVisible();
    await page.click('button:has-text("Generate Contract & Proceed")');

    // 6. Season Education step
    await expect(page.locator('h1:has-text("The Concept of Seasons")')).toBeVisible();
    await page.click('button:has-text("I understand, let\'s build one")');

    // 7. Season Identity step
    await expect(page.locator('h1:has-text("Name Your First Season")')).toBeVisible();
    await page.click('button:has-text("Setup Departments")');

    // 8. Departments step
    await expect(page.locator('h1:has-text("Define Departments")')).toBeVisible();
    await expect(page.locator('h3:has-text("Active Departments")')).toBeVisible();
    await page.click('button:has-text("Setup Teams")');

    // 9. Teams step
    await expect(page.locator('h1:has-text("Define Teams")')).toBeVisible();
    await page.click('button:has-text("Verify Locations")');

    // 10. Locations step
    await expect(page.locator('h1:has-text("Setup Locations")')).toBeVisible();
    await page.click('button:has-text("Setup Procedures")');

    // 11. Procedures step
    await expect(page.locator('h1:has-text("Define Procedures")')).toBeVisible();
    await page.click('button:has-text("Final Review")');

    // 12. Battlefield Review step — verify mock data carried through
    await expect(page.locator('h1:has-text("Battlefield Review")')).toBeVisible();
    await expect(page.locator('span:has-text("Grand Hotel Oslo")')).toBeVisible();

    // Mock the activate-workspace Edge Function
    await page.route("**/functions/v1/activate-workspace", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          workspaceId: "00000000-0000-0000-0000-000000000099",
        }),
      });
    });

    // Mock workspace slug lookup
    await page.route("**/rest/v1/workspace*workspace_id*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slug: "grand-hotel-oslo" }),
      });
    });

    // 13. Click Activate Workspace
    await page.click('button:has-text("Activate Workspace")');

    // 14. Finalizing step
    await expect(page.locator('h2:has-text("Finalizing Workspace")')).toBeVisible();

    // 15. Invite step appears after finalization
    await expect(page.locator('h1:has-text("Invite your first team member")')).toBeVisible({
      timeout: 15000,
    });

    // Skip invite → go to done
    await page.click('button:has-text("Skip for now")');

    // 16. Done step
    await expect(page.locator('h2:has-text("You\'re All Set!")')).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show auth step with signup form", async ({ page }) => {
    await page.goto("/onboarding");
    await page.fill('input[placeholder="your-webpage.com"]', "test.com");
    await page.click('button:has-text("Scan & Generate")');

    // Wait for auth step
    await expect(page.locator('h1:has-text("Save your progress")')).toBeVisible({
      timeout: 10000,
    });

    // Verify signup form elements
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('input[placeholder="Email address"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password (min. 8 characters)"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Confirm password"]')).toBeVisible();

    // Switch to sign in mode
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    // Confirm password field should not be visible in sign-in mode
    await expect(page.locator('input[placeholder="Confirm password"]')).not.toBeVisible();
  });

  test("should navigate back through steps", async ({ page }) => {
    await page.goto("/onboarding");
    await page.fill('input[placeholder="your-webpage.com"]', "test.com");
    await page.click('button:has-text("Scan & Generate")');

    // Skip auth
    await expect(page.locator('h1:has-text("Save your progress")')).toBeVisible({
      timeout: 10000,
    });
    await page.click('button:has-text("Skip for now")');

    // Skip org verification
    await expect(page.locator('h2:has-text("Verify Company Identity")')).toBeVisible({
      timeout: 5000,
    });
    await page.click('button:has-text("Skip this step for now")');

    // Go to branding
    await expect(page.locator('h1:has-text("Your Branding & Voice")')).toBeVisible();

    // Go back to org verification
    await page.click('button:has-text("Back")');
    await expect(page.locator('h2:has-text("Verify Company Identity")')).toBeVisible();
  });

  test("should edit sections from battlefield review", async ({ page }) => {
    // Fast-track to review by going through all steps
    await page.goto("/onboarding");
    await page.fill('input[placeholder="your-webpage.com"]', "test.com");
    await page.click('button:has-text("Scan & Generate")');

    await expect(page.locator('h1:has-text("Save your progress")')).toBeVisible({
      timeout: 10000,
    });
    await page.click('button:has-text("Skip for now")');

    await expect(page.locator('h2:has-text("Verify Company Identity")')).toBeVisible({
      timeout: 5000,
    });
    await page.click('button:has-text("Skip this step for now")');

    await expect(page.locator('h1:has-text("Your Branding & Voice")')).toBeVisible();
    await page.click('button:has-text("Generate Contract & Proceed")');

    await expect(page.locator('h1:has-text("The Concept of Seasons")')).toBeVisible();
    await page.click('button:has-text("I understand, let\'s build one")');

    await expect(page.locator('h1:has-text("Name Your First Season")')).toBeVisible();
    await page.click('button:has-text("Setup Departments")');

    await expect(page.locator('h1:has-text("Define Departments")')).toBeVisible();
    await page.click('button:has-text("Setup Teams")');

    await expect(page.locator('h1:has-text("Define Teams")')).toBeVisible();
    await page.click('button:has-text("Verify Locations")');

    await expect(page.locator('h1:has-text("Setup Locations")')).toBeVisible();
    await page.click('button:has-text("Setup Procedures")');

    await expect(page.locator('h1:has-text("Define Procedures")')).toBeVisible();
    await page.click('button:has-text("Final Review")');

    // Now on battlefield review — click edit on a section
    await expect(page.locator('h1:has-text("Battlefield Review")')).toBeVisible();

    // Click edit on Departments section
    const deptEditButton = page
      .locator('h3:has-text("Departments")')
      .locator("..")
      .locator('button:has-text("Edit")');
    await deptEditButton.click();

    // Should jump back to departments step
    await expect(page.locator('h1:has-text("Define Departments")')).toBeVisible();
  });

  test("should skip URL input with skip button", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.locator('h1:has-text("Let\'s build your workspace.")')).toBeVisible({
      timeout: 10000,
    });

    // Click skip instead of entering URL
    await page.click('button:has-text("Skip text")');

    // Should go to auth step (since not authenticated)
    await expect(page.locator('h1:has-text("Save your progress")')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Invitation Accept Page", () => {
  test("should show error for invalid token", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(
      page
        .locator("text=Invitasjonen ble ikke funnet")
        .or(page.locator("text=Invitation not found"))
        .or(page.locator("text=ikke funnet")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show invitation page structure for valid-format token", async ({ page }) => {
    // Even with a non-existent but valid UUID token, the page should load
    await page.goto("/invite/11111111-1111-1111-1111-111111111111");
    // Page loads without 500 error
    await expect(page.locator("body")).toBeVisible();
  });
});
