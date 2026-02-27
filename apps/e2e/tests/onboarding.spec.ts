import { test, expect } from '@playwright/test';

test.describe('Onboarding Wizard Flow', () => {
  // Use a longer timeout for this specific test because the "crawling" mock takes 3 seconds,
  // and finalize mock takes another 3 seconds.
  test.setTimeout(60000);

  test('should complete the entire onboarding process using fallback data', async ({ page }) => {
    // 1. Visit Onboarding
    await page.goto('/onboarding');
    await expect(page.locator('h1:has-text("Let\'s build your workspace.")')).toBeVisible({ timeout: 10000 });

    // 2. Trigger fallback by filling URL and submitting
    await page.fill('input[placeholder="your-webpage.com"]', 'mocksite.com');
    await page.click('button:has-text("Scan & Generate")');
    await expect(page.locator('h2:has-text("Verify Company Identity")')).toBeVisible({ timeout: 10000 });

    // 3. Skip org verification to move to branding
    await page.click('button:has-text("Skip this step for now")');

    // 4. Branding step
    await expect(page.locator('h1:has-text("Your Branding & Voice")')).toBeVisible();
    await page.click('button:has-text("Generate Contract & Proceed")');

    // 5. Season Education step
    await expect(page.locator('h1:has-text("The Concept of Seasons")')).toBeVisible();
    await page.click('button:has-text("I understand, let\'s build one")');

    // 6. Season Identity step
    await expect(page.locator('h1:has-text("Name Your First Season")')).toBeVisible();
    // Default values are pre-filled, so we can just proceed
    await page.click('button:has-text("Setup Departments")');

    // 7. Departments step
    await expect(page.locator('h1:has-text("Define Departments")')).toBeVisible();
    await expect(page.locator('h3:has-text("Active Departments")')).toBeVisible();
    await page.click('button:has-text("Setup Teams")');

    // 8. Teams step
    await expect(page.locator('h1:has-text("Define Teams")')).toBeVisible();
    await expect(page.locator('h3:has-text("Teams Setup")')).toBeVisible();
    await page.click('button:has-text("Verify Locations")');

    // 9. Locations step
    await expect(page.locator('h1:has-text("Setup Locations")')).toBeVisible();
    await page.click('button:has-text("Setup Procedures")');

    // 10. Procedures step
    await expect(page.locator('h1:has-text("Define Procedures")')).toBeVisible();
    await page.click('button:has-text("Final Review")');

    // 11. Battlefield Review step
    await expect(page.locator('h1:has-text("Battlefield Review")')).toBeVisible();
    // Check if the mock company name successfully passed down
    await expect(page.locator('span:has-text("Grand Hotel Oslo")')).toBeVisible();

    // Mock the activate-workspace call so we can see the success state
    await page.route('**/functions/v1/activate-workspace', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    // Finalize
    await page.click('button:has-text("Activate Workspace")');

    // Wait for finalizing string
    await expect(page.locator('h2:has-text("Finalizing Workspace")')).toBeVisible();

    // Check for "You're All Set!" meaning it finished successfully.
    await expect(page.locator('h2:has-text("You\'re All Set!")')).toBeVisible({ timeout: 15000 });
  });
});
