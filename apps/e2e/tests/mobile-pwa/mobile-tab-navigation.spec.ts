/**
 * mobile-pwa smoke 04 — Tab navigation.
 *
 * After login, taps each bottom-tab by its visible label and asserts the URL
 * changes to the correct segment. Also checks no QueryClient errors appear.
 *
 * Tabs per apps/mobile/app/(app)/_layout.tsx:
 *   Digest | Kalender (shifts) | Min kø (komm) | Chat | Min side (me)
 *   Center FAB is skipped (it opens a bottom sheet, not a route change).
 */
import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers";

const TABS: Array<{ label: RegExp; expectedUrlPart: string }> = [
  { label: /Digest/i, expectedUrlPart: "digest" },
  { label: /Kalender|Vakter/i, expectedUrlPart: "shifts" },
  { label: /Min kø|kø/i, expectedUrlPart: "komm" },
  { label: /Chat/i, expectedUrlPart: "chat" },
  { label: /Min side/i, expectedUrlPart: "me" },
];

test.describe("mobile-pwa: tab navigation @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const { label, expectedUrlPart } of TABS) {
    test(`tap "${label.source}" tab → URL contains "${expectedUrlPart}"`, async ({ page }) => {
      const queryClientErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && /QueryClient/i.test(msg.text())) {
          queryClientErrors.push(msg.text());
        }
      });

      const tab = page.getByText(label).first();
      await expect(tab).toBeVisible({ timeout: 10_000 });
      await tab.tap();

      // Allow route transition
      await page.waitForTimeout(1_000);

      expect(
        page.url(),
        `Expected URL to contain "${expectedUrlPart}", got: ${page.url()}`,
      ).toContain(expectedUrlPart);

      expect(
        queryClientErrors,
        `QueryClient error after tapping ${label.source}: ${queryClientErrors.join("; ")}`,
      ).toHaveLength(0);
    });
  }
});
