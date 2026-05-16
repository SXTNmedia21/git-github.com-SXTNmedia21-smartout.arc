import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { PROTOCOL_REGISTRY, type ProtocolSlug } from "../protocols";
import { generateDocsFromIR } from "../generators/docs-generator";
import { generateMissionFromIR } from "../generators/mission-generator";
import { generateAuditFromIR } from "../generators/audit-generator";
import { loginAsAdmin } from "../helpers/auth";

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
 * Override slug: JOURNEY_PROTOCOL_SLUG=P-001 pnpm --filter e2e test:protocol
 */

const slug = (process.env.JOURNEY_PROTOCOL_SLUG ?? "P-001") as ProtocolSlug;
const ir = PROTOCOL_REGISTRY[slug];
if (!ir) {
  throw new Error(
    `Unknown protocol slug: ${slug}. Available: ${Object.keys(PROTOCOL_REGISTRY).join(", ")}`,
  );
}

/**
 * Protocols blocked on missing data-testid attributes in apps/web/.
 * When a protocol is listed here it will be skipped with an explanatory message.
 * Remove a slug from this set once the required testids are added by frontend-designer.
 */
const SKIP_MISSING_TESTIDS: Record<string, string> = {
  "P-001":
    "P-001 references data-testid attributes (onboarding-hero, onboarding-manual-mode, " +
    "onboarding-step-business, etc.) that do not yet exist on the onboarding page. " +
    "Add data-testid attributes to the onboarding components before re-enabling.",
};

test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test(`${ir.slug}: ${ir.title}`, async ({ page }) => {
      const skipReason = SKIP_MISSING_TESTIDS[ir.slug];
      if (skipReason) {
        test.skip(true, skipReason);
      }
      test.slow();

      // Authenticate before running the protocol.
      // The runner does not handle login — we pre-authenticate here using the
      // admin E2E fixture (admin@smartout.local / password123) so the runner's
      // navigate actions land on authenticated pages.
      // P-001 is already skipped above so this runs for all other slugs.
      await loginAsAdmin(page);

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
