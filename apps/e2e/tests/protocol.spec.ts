import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";
import { generateDocsFromIR } from "../generators/docs-generator";
import { generateMissionFromIR } from "../generators/mission-generator";
import { generateAuditFromIR } from "../generators/audit-generator";

/**
 * Protocol Verification Tests
 *
 * Each journey is a complete user flow with verification gates between steps.
 * After execution, generators produce docs, mission drafts, and UX audits.
 * Results are persisted to journey_test_run with test_type='protocol'.
 *
 * M3.5 (ADR-0178): samples authored as `JourneyIR` v2 directly. The
 * migration adapter is retired (ADR-0174 C.11 closed at M3.5 exit).
 *
 * Run with: pnpm --filter e2e test:protocol
 */
test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test.skip(
      true,
      "P-001 references data-testid attributes (onboarding-hero, onboarding-manual-mode, " +
        "onboarding-step-business, etc.) that do not yet exist on the onboarding page. " +
        "Add data-testid attributes to the onboarding components before re-enabling.",
    );

    test("P-001: Admin Onboarding — full journey", async ({ page }) => {
      test.slow();

      const ir = P001_ADMIN_ONBOARDING;
      const result = await runProtocol(page, ir);

      // Log step results
      for (const step of result.output.steps) {
        console.log(
          `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
        );
      }

      // Generate outputs regardless of pass/fail (partial results are useful)
      const docsPath = generateDocsFromIR(ir, result.output);
      console.log(`  [DOCS] Generated: ${docsPath}`);

      const missionPath = generateMissionFromIR(ir, result.output);
      console.log(`  [MISSION] Generated: ${missionPath}`);

      const auditPath = generateAuditFromIR(ir, result.output);
      console.log(`  [AUDIT] Generated: ${auditPath}`);

      // Assert success
      expect(result.success).toBe(true);
      expect(result.output.friction_data.failed_gates).toHaveLength(0);
    });
  });
});
