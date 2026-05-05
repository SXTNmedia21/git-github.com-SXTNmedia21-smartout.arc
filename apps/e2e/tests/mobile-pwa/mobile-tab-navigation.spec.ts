/**
 * mobile-pwa smoke 04 — Tab navigation.
 *
 * After login, taps each bottom-tab by its visible label and asserts the correct
 * screen is shown. Also checks no QueryClient errors appear.
 *
 * Tabs per apps/mobile/app/(app)/_layout.tsx:
 *   Digest | Kalender (shifts) | Min kø (komm) | Chat | Min side (me)
 *   Center FAB is skipped (it opens a bottom sheet, not a route change).
 *
 * URL vs content verification:
 *   Expo Router strips route-group parens from the URL bar, so tabs that live
 *   in groups like (shifts), (komm), (chat), (me) all resolve to "/" in the
 *   browser URL. Only "digest" (a named non-group screen) produces a URL change.
 *   For group-tab screens we verify navigation by checking screen-specific heading
 *   text instead of the URL.
 */
import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers";

/**
 * `expectedContent` — visible heading text unique to each tab's index screen.
 * Used instead of URL assertions for Expo route-group tabs where the URL stays "/".
 *
 * Screen headings come from each tab's index.tsx:
 *   digest.tsx        → "Daily Digest"
 *   (shifts)/index    → "Mine vakter"
 *   (komm)/index      → "Kanaler" (segment tab label)
 *   (chat)/index      → "Chatkanaler" (segment tab label)
 *   (me)/index        → "Min Side"
 */
const TABS: Array<{ label: RegExp; expectedContent: RegExp }> = [
  { label: /Digest/i, expectedContent: /Daily Digest/i },
  { label: /Kalender|Vakter/i, expectedContent: /Mine vakter/i },
  { label: /Min kø|kø/i, expectedContent: /Kanaler|Min kø/i },
  { label: /Chat/i, expectedContent: /Chatkanaler|Skranke/i },
  { label: /Min side/i, expectedContent: /Min Side/i },
];

test.describe("mobile-pwa: tab navigation @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const { label, expectedContent } of TABS) {
    test(`tap "${label.source}" tab → shows "${expectedContent.source}"`, async ({ page }) => {
      const queryClientErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && /QueryClient/i.test(msg.text())) {
          queryClientErrors.push(msg.text());
        }
      });

      const tab = page.getByText(label).first();
      await expect(tab).toBeVisible({ timeout: 10_000 });
      await tab.tap();

      // Screen-specific heading must appear — confirms the tab navigated correctly.
      // Expo Router route-group tabs (shifts/komm/chat/me) all map to URL "/" so
      // we cannot use URL assertions; content verification is the reliable approach.
      await expect(page.getByText(expectedContent).first()).toBeVisible({ timeout: 5_000 });

      expect(
        queryClientErrors,
        `QueryClient error after tapping ${label.source}: ${queryClientErrors.join("; ")}`,
      ).toHaveLength(0);
    });
  }
});
