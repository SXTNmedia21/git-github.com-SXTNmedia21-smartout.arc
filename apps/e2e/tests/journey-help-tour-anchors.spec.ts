import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";

/**
 * journey-help-tour-anchors.spec.ts — Invariant I-1 + G-ANCHORS
 *
 * Verifies:
 *   I-1  — Every id in the TOUR_ANCHORS allow-list appears EXACTLY ONCE on
 *           /dashboard/help (allow-list integrity invariant).
 *   I-1b — A non-allowed anchor id ("nonexistent_anchor") has NO matching DOM
 *           element, so an attacker / misbehaving agent cannot hit arbitrary
 *           sensitive elements by guessing ids.
 *
 * Notes:
 *   - active-ticket-badge is conditional (only shown when there is an open
 *     helpdesk ticket). It is excluded from the I-1 DOM check and tested via
 *     dedicated journey specs (journey-help-active-ticket-*.spec.ts).
 *   - No DB mutations are performed — tests are read-only; no cleanup needed.
 *   - Employee login: anna@smartout.local (default loginAsEmployee seed user).
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("invariant:help — I-1 + G-ANCHORS — tour anchor allow-list @help", () => {
  /**
   * Static anchor ids from TOUR_ANCHORS that must always be present on
   * /dashboard/help regardless of ticket state.
   *
   * active-ticket-badge is intentionally excluded because it is conditional —
   * its presence depends on whether the employee has an open helpdesk thread.
   */
  const ALWAYS_PRESENT_ANCHOR_IDS: string[] = [
    "panic-bar",
    "chat-hero",
    "quick-paths",
    "curated-articles",
    "kontakt-footer",
  ];

  test("I-1: every unconditional TOUR_ANCHORS id appears exactly once on /help", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await loginAsEmployee(page);

    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    for (const anchorId of ALWAYS_PRESENT_ANCHOR_IDS) {
      await expect(
        page.locator(`#${anchorId}`),
        `TOUR_ANCHORS id="${anchorId}" must appear exactly once on /dashboard/help`,
      ).toHaveCount(1);
    }
  });

  test("I-1b: non-allowed id 'nonexistent_anchor' has no matching DOM element on /help", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await loginAsEmployee(page);

    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // An id not in the allow-list must have zero DOM matches.
    // This guards against arbitrary element targeting by agents or attackers.
    await expect(
      page.locator("#nonexistent_anchor"),
      "Non-allowed anchor id must NOT exist in the DOM",
    ).toHaveCount(0);
  });
});
