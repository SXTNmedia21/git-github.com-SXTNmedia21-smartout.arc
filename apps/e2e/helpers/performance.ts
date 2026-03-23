import { expect, type Page } from "@playwright/test";

/**
 * Performance gates for UX quality.
 *
 * | Gate                    | Target  | Rationale                        |
 * |-------------------------|---------|----------------------------------|
 * | Login → dashboard       | < 2s    | First impression after auth      |
 * | Page navigation         | < 1s    | Sidebar clicks must feel instant |
 * | API content visible     | < 2s    | Data lists, tables, cards        |
 * | Wizard step transition  | < 500ms | Already loaded, just swapping    |
 * | Full page cold load     | < 3s    | First load with SSR              |
 */

export const PERF_GATES = {
  /** Login animation + redirect + dashboard render */
  loginToDashboard: 2000,
  /** Sidebar navigation → target page content visible */
  pageNavigation: 1000,
  /** API-driven content (lists, tables) after page frame renders */
  apiContent: 2000,
  /** Setup wizard step-to-step transition */
  wizardStep: 500,
  /** Cold page load (first visit, no cache) */
  coldPageLoad: 3000,
} as const;

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
