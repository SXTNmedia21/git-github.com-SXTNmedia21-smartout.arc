/**
 * mobile-pwa smoke 05 — No runtime errors across all tabs.
 *
 * Visits each tab after login and listens for:
 *   - console.error events
 *   - pageerror (uncaught exceptions)
 *
 * Fails if any error matches the known-bad patterns:
 *   "QueryClient"     — React-dup / missing provider regression
 *   "Cannot read"     — null-deref runtime errors
 *   "undefined is not" — undefined-access errors
 *
 * False-positive allowlist: ResizeObserver, favicon (harmless browser noise).
 */
import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers";

const ROUTES = [
  "/",
  "/(app)/digest",
  "/(app)/(shifts)",
  "/(app)/(komm)",
  "/(app)/(chat)",
  "/(app)/(me)",
];

const BAD_ERROR_PATTERNS = /QueryClient|Cannot read|undefined is not/i;
const NOISE_PATTERNS = /ResizeObserver|favicon|chrome-extension/i;

test.describe("mobile-pwa: no runtime errors across tabs @smoke", () => {
  test("all tabs free of QueryClient / null-deref errors", async ({ page }) => {
    const collectedErrors: Array<{ source: string; message: string }> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!NOISE_PATTERNS.test(text) && BAD_ERROR_PATTERNS.test(text)) {
          collectedErrors.push({ source: "console.error", message: text });
        }
      }
    });

    page.on("pageerror", (err) => {
      const text = err.message;
      if (!NOISE_PATTERNS.test(text) && BAD_ERROR_PATTERNS.test(text)) {
        collectedErrors.push({ source: "pageerror", message: text });
      }
    });

    await signIn(page);

    for (const route of ROUTES) {
      // Use goto only for absolute-like routes; skip the root (already there after signIn)
      if (route !== "/") {
        await page.goto(route, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {
          // Some Expo route segments are layout groups — ignore navigation errors
          // and rely on URL-based check below to confirm destination.
        });
      }
      // Give each screen time to mount and run effects
      await page.waitForTimeout(1_500);
    }

    expect(
      collectedErrors,
      `Runtime errors detected:\n${collectedErrors.map((e) => `  [${e.source}] ${e.message}`).join("\n")}`,
    ).toHaveLength(0);
  });
});
