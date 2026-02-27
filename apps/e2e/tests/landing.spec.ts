import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load the homepage and show correct title', async ({ page }) => {
    await page.goto('/');
    // Check if the page title mentions SmartOut or similar, using a substring match
    await expect(page).toHaveTitle(/.*SmartOut.*/i);
  });

  test('should navigate to procedures concept page', async ({ page }) => {
    await page.goto('/concepts/procedures');
    
    // Check if a heading exists on the procedures page
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });
});
