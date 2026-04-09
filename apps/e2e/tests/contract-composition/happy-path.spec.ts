import { test, expect } from "@playwright/test";

test.describe("Contract Composition — Happy Path", () => {
  test.skip("admin composes contract via wizard", async ({ page }) => {
    // 1. Navigate to /dashboard/contracts/new
    // 2. Select employee
    // 3. Set position
    // 4. Wait for derivation
    // 5. Review and acknowledge all blocks
    // 6. Review clauses
    // 7. Send contract
    // 8. Verify contract appears in list with correct status
  });

  test.skip("employee completes data intake", async ({ page }) => {
    // 1. Login as employee
    // 2. Navigate to /dashboard/my-profile/complete
    // 3. Fill in personal_number, address
    // 4. Submit
    // 5. Verify success message
  });

  test.skip("employee signs contract via DocuSeal", async ({ page }) => {
    // 1. Login as employee
    // 2. Navigate to contract signing task
    // 3. Review terms
    // 4. Acknowledge rights
    // 5. Complete DocuSeal signing
    // 6. Verify contract status = signed
  });
});
