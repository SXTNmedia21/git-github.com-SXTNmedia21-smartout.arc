import { test, expect } from "@playwright/test";

test.describe("Contract Composition — Admin Bypass", () => {
  test.skip("admin fills PII on behalf of employee", async ({ page }) => {
    // 1. Admin navigates to /dashboard/people/[id]/complete-data
    // 2. Selects identity group
    // 3. Fills personal_number
    // 4. Provides reason (min 10 chars)
    // 5. Confirms in modal
    // 6. Verifies success
    // 7. Verifies audit trail entry
    // 8. Verifies employee notification
  });
});
