import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/login');
    // Check for the sign in header using standard exact text
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible({ timeout: 10000 });
  });

  // Adding actual authentication testing would require a test user or bypass
  // so keeping it simple for now verifying the UI loads.
});
