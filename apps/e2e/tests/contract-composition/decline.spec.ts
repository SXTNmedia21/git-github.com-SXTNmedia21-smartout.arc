import { test, expect } from "@playwright/test";

test.describe("Contract Composition — Decline Path", () => {
  test.skip("employee declines data intake", async ({ page }) => {
    // 1. Employee navigates to intake task
    // 2. Clicks decline
    // 3. Selects reason
    // 4. Verifies contract status = declined
    // 5. Verifies admin notification created
  });
});
