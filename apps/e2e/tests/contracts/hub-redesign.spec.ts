/**
 * Phase E2E — Journey 1: Contract Hub Redesign (tabs-in-hub)
 *
 * Covers JOURNEY-contract-hub-redesign + council Gate 2 verdict row #1:
 *   - `/dashboard/contracts` renders 3 tabs: Kontrakter | Maler | Bindinger
 *   - Clicking Maler sets `?tab=maler` in the URL
 *   - Clicking Bindinger sets `?tab=bindinger`
 *   - Default tab is Kontrakter (no query param)
 *   - The ambient Botsson chip dispatches `botsson:open` CustomEvent
 *   - Three telemetry events land in activity_trail:
 *       - contract.hub_viewed (on mount)
 *       - contract.tab_switched (on tab click)
 *       - contract.botsson_chip_invoked (on chip click)
 *
 * Auth: loginAsAdmin → workspace `b0000000-0000-0000-0000-000000000000` (seed).
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectTelemetryEvent, telemetryTimestamp } from "../../helpers/telemetry";

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

test.describe("contracts hub redesign — tabs + chip + telemetry", () => {
  test.beforeEach(async ({ page }) => {
    // Suppress the setup-wizard redirect so /dashboard/contracts is reachable.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("setup_dismissed", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("hub renders 3 tabs, switches with URL state, emits telemetry", async ({ page }) => {
    test.setTimeout(60_000);

    const since = telemetryTimestamp();

    await loginAsAdmin(page);
    await page.goto("/dashboard/contracts");
    await page.waitForLoadState("domcontentloaded");

    // ── Tabs are visible ────────────────────────────────────────────────
    const kontrakterTab = page.getByRole("tab", { name: /kontrakter/i }).first();
    const malerTab = page.getByRole("tab", { name: /maler/i }).first();
    const bindingerTab = page.getByRole("tab", { name: /bindinger/i }).first();

    await expect(kontrakterTab).toBeVisible({ timeout: 15_000 });
    await expect(malerTab).toBeVisible();
    await expect(bindingerTab).toBeVisible();

    // ── hub_viewed emits on mount ────────────────────────────────────────
    await expectTelemetryEvent("contract.hub_viewed", SEED_WORKSPACE_ID, { since });

    // ── Click Maler → ?tab=maler + tab_switched event ───────────────────
    const malerSwitchTs = telemetryTimestamp();
    await malerTab.click();
    await expect(page).toHaveURL(/\?tab=maler/, { timeout: 5_000 });

    await expectTelemetryEvent("contract.tab_switched", SEED_WORKSPACE_ID, {
      since: malerSwitchTs,
    });

    // ── Click Bindinger → ?tab=bindinger ────────────────────────────────
    await bindingerTab.click();
    await expect(page).toHaveURL(/\?tab=bindinger/, { timeout: 5_000 });

    // ── Back to Kontrakter strips the query param ───────────────────────
    await kontrakterTab.click();
    await expect(page).toHaveURL(/\/dashboard\/contracts(?!\?tab=)/, { timeout: 5_000 });
  });

  test("Botsson ambient chip dispatches botsson:open + emits chip_invoked", async ({ page }) => {
    test.setTimeout(60_000);

    await loginAsAdmin(page);
    await page.goto("/dashboard/contracts");
    await page.waitForLoadState("domcontentloaded");

    // Install a listener before clicking so we can capture the event detail.
    await page.evaluate(() => {
      // Use an any-typed global bridge; Playwright reads it after the click.
      (window as unknown as { __botssonEvents: unknown[] }).__botssonEvents = [];
      window.addEventListener("botsson:open", (e: Event) => {
        const custom = e as CustomEvent<unknown>;
        (window as unknown as { __botssonEvents: unknown[] }).__botssonEvents.push(custom.detail);
      });
    });

    const chipTs = telemetryTimestamp();

    // The chip is rendered as a button with aria-label carrying the
    // translated "Spør Botsson" label — we match by Sparkles icon + text
    // with a generous regex to survive copy changes.
    const chip = page.getByRole("button", { name: /spør botsson|ask botsson/i }).last();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await chip.click();

    // The custom event should have fired with the hub primeContext.
    const events = await page.evaluate(
      () => (window as unknown as { __botssonEvents: unknown[] }).__botssonEvents,
    );
    expect(events.length).toBeGreaterThanOrEqual(1);

    const first = events[0] as { view?: string; primeContext?: { module?: string } };
    expect(first?.view).toBe("admin-chat");
    expect(first?.primeContext?.module).toBe("contracts");

    // Telemetry must land.
    await expectTelemetryEvent("contract.botsson_chip_invoked", SEED_WORKSPACE_ID, {
      since: chipTs,
    });
  });
});
