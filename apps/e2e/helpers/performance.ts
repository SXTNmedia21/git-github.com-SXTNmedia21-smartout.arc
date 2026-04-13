import { expect, type Page } from "@playwright/test";

/**
 * Performance gates for UX quality.
 *
 * | Gate                    | CI target | Dev multiplier | Rationale                        |
 * |-------------------------|-----------|----------------|----------------------------------|
 * | Login → dashboard       | < 2s      | ×3 → 6s        | First impression after auth      |
 * | Page navigation         | < 1s      | ×4 → 4s        | Sidebar clicks must feel instant |
 * | API content visible     | < 2s      | ×3 → 6s        | Data lists, tables, cards        |
 * | Wizard step transition  | < 500ms   | ×4 → 2s        | Already loaded, just swapping    |
 * | Full page cold load     | < 3s      | ×3.3 → 10s     | First load with SSR              |
 *
 * Dev mode (no CI env var) applies looser thresholds because Next.js compiles
 * routes on-demand, adding 3-8s of JIT compilation overhead that does not
 * occur in production. The tight CI thresholds are what actually enforce the
 * UX quality bar.
 */

const isDev = !process.env.CI;

export const PERF_GATES = {
  /** Login animation + redirect + dashboard render */
  loginToDashboard: isDev ? 6000 : 2000,
  /** Sidebar navigation → target page content visible */
  pageNavigation: isDev ? 4000 : 1000,
  /** API-driven content (lists, tables) after page frame renders */
  apiContent: isDev ? 6000 : 2000,
  /** Setup wizard step-to-step transition */
  wizardStep: isDev ? 2000 : 500,
  /** Cold page load (first visit, no cache) */
  coldPageLoad: isDev ? 10000 : 3000,
};

/**
 * Measures time from now until a locator becomes visible.
 * Fails the test if it exceeds the gate threshold.
 */
export async function expectVisibleWithin(
  page: Page,
  selector: string,
  gateMs: number,
  label?: string,
) {
  const start = Date.now();
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible({ timeout: gateMs + 1000 });
  const elapsed = Date.now() - start;

  const tag = label ?? selector;
  expect(
    elapsed,
    `Performance gate failed: "${tag}" took ${elapsed}ms (limit: ${gateMs}ms)`,
  ).toBeLessThanOrEqual(gateMs);
}

/**
 * Measures navigation time: click an element → target content visible.
 */
export async function expectNavigationWithin(
  page: Page,
  clickSelector: string,
  targetSelector: string,
  gateMs: number,
  label?: string,
) {
  const link = page.locator(clickSelector).first();
  await expect(link).toBeVisible({ timeout: 5000 });

  const start = Date.now();
  await link.click();
  const target = page.locator(targetSelector).first();
  await expect(target).toBeVisible({ timeout: gateMs + 1000 });
  const elapsed = Date.now() - start;

  const tag = label ?? `${clickSelector} → ${targetSelector}`;
  expect(
    elapsed,
    `Performance gate failed: "${tag}" took ${elapsed}ms (limit: ${gateMs}ms)`,
  ).toBeLessThanOrEqual(gateMs);
}

/**
 * Measures cold page load: goto → content visible.
 */
export async function expectColdLoadWithin(
  page: Page,
  url: string,
  contentSelector: string,
  gateMs: number,
  label?: string,
) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  const content = page.locator(contentSelector).first();
  await expect(content).toBeVisible({ timeout: gateMs + 1000 });
  const elapsed = Date.now() - start;

  const tag = label ?? `${url} → ${contentSelector}`;
  expect(
    elapsed,
    `Performance gate failed: "${tag}" took ${elapsed}ms (limit: ${gateMs}ms)`,
  ).toBeLessThanOrEqual(gateMs);
}
