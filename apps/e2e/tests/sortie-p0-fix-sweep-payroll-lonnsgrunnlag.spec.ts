// =============================================================================
// sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts
//
// P0-D — Coverage intent for:
//   Mobile renders payroll screens using "lønnsgrunnlag" terminology.
//   All 7 occurrences of "lønnsslipp" renamed to "lønnsgrunnlag" across 5 files:
//     apps/mobile/src/constants/strings.ts (empty-state, load-error, section titles)
//     + other payroll-adjacent files on feat/mobile-p0-fix-sweep.
//
// INFRA BLOCKER — ALL TESTS IN THIS FILE ARE SKIPPED.
//
// Why skipped:
//   Verifying UI string rendering in React Native requires one of:
//     1. React Native Testing Library unit tests (apps/mobile/src/__tests__/)
//     2. Detox E2E tests against the native build
//     3. Playwright against Expo Web (mobile-pwa project)
//
//   The apps/e2e/ Playwright suite uses the 'web' project by default.
//   The mobile-pwa project (Expo Web, port 8083) CAN render payroll screens —
//   BUT the payroll feature is behind an authenticated workspace that requires:
//     A. A completed onboarding + active workspace.
//     B. Navigation to /payroll (or equivalent Expo Router path).
//     C. Stable test-ids or text locators on the payroll screen containers.
//
//   The mobile-pwa helpers (_helpers.ts) bring us to shift-hub but do NOT
//   navigate to the payroll screen. No mobile-pwa payroll navigation helper
//   exists in apps/e2e/helpers/.
//
//   Additionally, the string-level assertion ("does NOT contain lønnsslipp")
//   across multiple screen states (empty, load-error, list) requires either:
//     - A dedicated page-object for the payroll screen
//     - Or snapshot tests in apps/mobile/src/__tests__/
//
//   The cleanest fix at low cost is a unit test:
//     apps/mobile/src/__tests__/payroll-strings.test.ts
//     → import STRINGS from '@/constants/strings'
//     → expect(STRINGS.payroll.emptyState).not.toContain('lønnsslipp')
//     → expect(STRINGS.payroll.emptyState).toMatch(/lønnsgrunnlag/i)
//
// Tracking gap: p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e
//
// Required infra to unlock Playwright variant:
//   A. Add data-testid="payroll-screen" + data-testid="payroll-empty-state" to
//      the mobile payroll screen (2-4 line diff, no behavior change).
//   B. Add mobile-pwa helper that navigates to the payroll screen.
//   C. Move assertions to apps/e2e/tests/mobile-pwa/p0d-payroll-lonnsgrunnlag.spec.ts.
//
// Once infra is ready OR unit test is added, the assertions should be:
//   EMPTY STATE:
//     - contains "lønnsgrunnlag" (case-insensitive)
//     - does NOT contain "lønnsslipp"
//   LOAD ERROR STATE:
//     - contains "lønnsgrunnlag"
//     - does NOT contain "lønnsslipp"
//   LIST STATE (with payroll periods):
//     - all section/card titles use "lønnsgrunnlag", not "lønnsslipp"
//
// ADR refs: ADR-0298 (payroll positioning: lønnsgrunnlag not lønnsslipp).
//           See also: feedback_lonnsgrunnlag_not_lonnsslipp.md in claude-mem.
// =============================================================================

import { test } from "@playwright/test";

// ---------------------------------------------------------------------------
// SKIPPED — infra blocker documented above
// ---------------------------------------------------------------------------

test.describe("P0-D: Payroll screen — lønnsgrunnlag terminology", () => {
  test("empty state contains 'lønnsgrunnlag' and does NOT contain 'lønnsslipp'", async () => {
    test.skip(
      true,
      "P0-D: INFRA BLOCKER — mobile payroll screen navigation not available in Playwright web project. " +
        "Tracking gap: p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e. " +
        "Lowest-cost alternative: unit test in apps/mobile/src/__tests__/payroll-strings.test.ts " +
        "importing STRINGS and asserting .not.toContain('lønnsslipp') on all payroll string keys. " +
        "Required for Playwright: (A) data-testids on payroll screen, " +
        "(B) mobile-pwa navigation helper to /payroll, " +
        "(C) move test to apps/e2e/tests/mobile-pwa/p0d-payroll-lonnsgrunnlag.spec.ts.",
    );
  });

  test("load-error state contains 'lønnsgrunnlag' and does NOT contain 'lønnsslipp'", async () => {
    test.skip(
      true,
      "P0-D: INFRA BLOCKER — same as above. " +
        "Tracking gap: p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e.",
    );
  });

  test("payroll list with results — all titles use 'lønnsgrunnlag', not 'lønnsslipp'", async () => {
    test.skip(
      true,
      "P0-D: INFRA BLOCKER — same as above. " +
        "Tracking gap: p0-d-payroll-lonnsgrunnlag-mobile-pwa-e2e.",
    );
  });
});
