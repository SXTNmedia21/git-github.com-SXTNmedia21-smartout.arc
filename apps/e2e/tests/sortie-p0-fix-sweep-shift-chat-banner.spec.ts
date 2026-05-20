// =============================================================================
// sortie-p0-fix-sweep-shift-chat-banner.spec.ts
//
// P0-C — Coverage intent for:
//   ShiftChatUnavailableBanner rendered in punch-clock.tsx chat tab.
//   TextInput / send button NOT rendered in the chat tab area.
//
// INFRA BLOCKER — ALL TESTS IN THIS FILE ARE SKIPPED.
//
// Why skipped:
//   This P0 fix involves React Native component rendering inside a mobile app
//   (punch-clock.tsx chat tab → ShiftChatUnavailableBanner component).
//   The Playwright suite in apps/e2e/ does NOT have React Native component
//   rendering infrastructure. The mobile-pwa project (apps/e2e/tests/mobile-pwa/)
//   tests the mobile app through Expo Web (React Native Web), which renders RN
//   components in a browser — BUT:
//
//   1. The chat tab within punch-clock is behind an authenticated shift context
//      that requires an active shift to be clocked in. The mobile-pwa test
//      helpers (signIn) get us to the shift-hub but do NOT clock in / navigate
//      to a shift-in-progress punch-clock view.
//
//   2. The ShiftChatUnavailableBanner test needs to assert ABSENCE of
//      TextInput / send-button elements. React Native Web renders TextInput
//      as <input> but the locator strategy for "no send button" requires a
//      stable test-id on the punch-clock chat tab area — which is not currently
//      assigned (no data-testid attributes in punch-clock.tsx).
//
//   3. The mobile-pwa project in Playwright is declared under the 'mobile-pwa'
//      project config (playwright.config.ts) which uses a mobile viewport.
//      These tests are in the default 'web' project. Cross-project interaction
//      requires separate test files in the mobile-pwa directory.
//
// Tracking gap: p0-c-shift-chat-banner-mobile-pwa-e2e
//
// Required infra to unlock:
//   A. Add data-testid="shift-chat-tab-area" to the punch-clock.tsx chat tab
//      container (2-line diff, no behavior change).
//   B. Add a mobile-pwa test helper that clocks in to an active shift and
//      navigates to the punch-clock view.
//   C. Move the actual test assertions to a new file in
//      apps/e2e/tests/mobile-pwa/p0c-shift-chat-banner.spec.ts.
//
// Once infra is ready, the assertions should be:
//   - page.locator('[data-testid="shift-chat-tab-area"]') is visible
//   - page.getByText("Skiftchat oppdateres for øyeblikket") is visible
//   - page.locator('input[type="text"]') inside shift-chat-tab-area is NOT visible
//   - page.locator('[data-testid="shift-chat-send-btn"]') is NOT visible (if testid added)
//   - Message list (if conversation has messages) still loads (read-only, no send)
//
// ADR refs: ADR-0132, ADR-0298.
// =============================================================================

import { test } from "@playwright/test";

// ---------------------------------------------------------------------------
// SKIPPED — infra blocker documented above
// ---------------------------------------------------------------------------

test.describe("P0-C: ShiftChatUnavailableBanner — shift-chat tab", () => {
  test("banner copy 'Skiftchat oppdateres for øyeblikket' visible + no TextInput/send button", async () => {
    test.skip(
      true,
      "P0-C: INFRA BLOCKER — React Native component rendering not available in Playwright web project. " +
        "Tracking gap: p0-c-shift-chat-banner-mobile-pwa-e2e. " +
        "Required: (A) data-testid on punch-clock chat tab area, " +
        "(B) mobile-pwa helper to navigate to punch-clock in-progress view, " +
        "(C) move assertions to apps/e2e/tests/mobile-pwa/p0c-shift-chat-banner.spec.ts.",
    );
  });

  test("no TextInput in chat tab area after P0-C fix", async () => {
    test.skip(
      true,
      "P0-C: INFRA BLOCKER — same as above. " +
        "Tracking gap: p0-c-shift-chat-banner-mobile-pwa-e2e.",
    );
  });

  test("message list still loads in read-only mode", async () => {
    test.skip(
      true,
      "P0-C: INFRA BLOCKER — same as above. " +
        "Tracking gap: p0-c-shift-chat-banner-mobile-pwa-e2e.",
    );
  });
});
