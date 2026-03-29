import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";

/**
 * Protocol Verification Tests
 *
 * These tests execute full protocol definitions against a live app.
 * Each protocol is a complete user journey with control gates between steps.
 * Results are persisted to journey_test_run with test_type='protocol'.
 *
 * Run with: pnpm --filter e2e test:protocol
 */
test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test("P-001: Admin Onboarding — full journey", async ({ page }) => {
      test.slow(); // Protocol runs are multi-step, need extra timeout

      const result = await runProtocol(page, P001_ADMIN_ONBOARDING);

      // Log step results for debugging
      for (const step of result.output.steps) {
        console.log(
          `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
        );
      }

      expect(result.success).toBe(true);
      expect(result.output.friction_data.failed_gates).toHaveLength(0);
    });
  });
});
