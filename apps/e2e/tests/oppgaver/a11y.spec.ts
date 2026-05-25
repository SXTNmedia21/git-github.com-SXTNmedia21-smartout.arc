/**
 * P11 — Manager Timeline WCAG 2.1 AA axe scan.
 *
 * Gated behind E2E_OPPGAVER=1.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const RUN = process.env.E2E_OPPGAVER === "1";

test.describe("/dashboard/oppgaver — a11y", () => {
  test.skip(!RUN, "Set E2E_OPPGAVER=1 to run (requires seeded dev DB).");

  test("WCAG 2.1 AA — 0 violations", async ({ page }) => {
    await page.goto("/dashboard/oppgaver");
    await page.waitForSelector('[role="region"][aria-label*="Manager Timeline"]');
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations).toEqual([]);
  });
});
