import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";
import { generateDocs } from "../generators/docs-generator";
import { generateMissionDraft } from "../generators/mission-generator";
import { generateAudit } from "../generators/audit-generator";

/**
 * Protocol Verification Tests
 *
 * Each protocol is a complete user journey with control gates between steps.
 * After execution, generators produce docs, mission drafts, and UX audits.
 * Results are persisted to journey_test_run with test_type='protocol'.
 *
 * Run with: pnpm --filter e2e test:protocol
 */
test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test("P-001: Admin Onboarding — full journey", async ({ page }) => {
      test.slow();

      const result = await runProtocol(page, P001_ADMIN_ONBOARDING);

      // Log step results
      for (const step of result.output.steps) {
        console.log(
          `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
        );
      }

      // Generate outputs regardless of pass/fail (partial results are useful)
      const docsPath = generateDocs(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [DOCS] Generated: ${docsPath}`);

      const missionPath = generateMissionDraft(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [MISSION] Generated: ${missionPath}`);

      const auditPath = generateAudit(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [AUDIT] Generated: ${auditPath}`);

      // Assert success
      expect(result.success).toBe(true);
      expect(result.output.friction_data.failed_gates).toHaveLength(0);
    });
  });
});
