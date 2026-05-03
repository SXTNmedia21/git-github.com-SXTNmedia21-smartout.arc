/**
 * Phase E2E — Journey 1: Contract Hub (single-pane, shipped architecture)
 *
 * Covers JOURNEY-contract-hub-redesign post-Phase-2 reality:
 *   - `/dashboard/contracts` renders a single-pane hub: PageTabNav (Ansatte-modul
 *     nav) + KontrakterTab only. The 3-tab layout (Kontrakter | Maler | Bindinger)
 *     has been removed from the hub.
 *   - Maler moved to `/dashboard/settings#contract-templates`.
 *   - Bindinger has no current surface (tracked, deferred — see bindings-tab.spec.ts).
 *   - `?tab=maler` / `?tab=bindinger` URL params are gone.
 *   - KontrakterTab renders bucket sub-filters:
 *       all | ready_for_action | waiting_employee | completed
 *     Clicking a bucket triggers `contract.tab_switched` telemetry with
 *     `data.from = "kontrakter:all"` and `data.to = "kontrakter:ready_for_action"`.
 *   - The ambient Botsson chip dispatches `botsson:open` CustomEvent.
 *
 * Telemetry events:
 *   - contract.hub_viewed        (on mount)
 *   - contract.tab_switched      (on bucket sub-filter click, not hub-tab click)
 *   - contract.botsson_chip_invoked (on chip click)
 *
 * Auth: loginAsAdmin → workspace `b0000000-0000-0000-0000-000000000000` (seed).
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectTelemetryEvent, telemetryTimestamp } from "../../helpers/telemetry";
import { supabase } from "../../helpers/seed";

const SEED_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";

test.describe("contracts hub — single-pane + bucket sub-tabs + chip + telemetry", () => {
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

  test("hub renders KontrakterTab, emits hub_viewed, no Maler/Bindinger hub tabs", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const since = telemetryTimestamp();

    await loginAsAdmin(page);
    await page.goto("/dashboard/contracts");
    await page.waitForLoadState("domcontentloaded");

    // ── hub_viewed emits on mount ────────────────────────────────────────
    await expectTelemetryEvent("contract.hub_viewed", SEED_WORKSPACE_ID, { since });

    // ── Bucket sub-filters (KontrakterTab) are visible ──────────────────
    // shadcn Tabs renders TabsTrigger elements; match i18n Norwegian text.
    const allBucketTab = page.getByRole("tab", { name: /alle/i }).first();
    const readyTab = page.getByRole("tab", { name: /klar til handling/i }).first();
    const waitingTab = page.getByRole("tab", { name: /venter på ansatt/i }).first();
    const completedTab = page.getByRole("tab", { name: /fullført/i }).first();

    await expect(allBucketTab).toBeVisible({ timeout: 15_000 });
    await expect(readyTab).toBeVisible();
    await expect(waitingTab).toBeVisible();
    await expect(completedTab).toBeVisible();

    // ── Maler and Bindinger are NOT top-level hub tabs ───────────────────
    // They should not appear as role="tab" with those names on this page.
    await expect(page.getByRole("tab", { name: /^maler$/i })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /^bindinger$/i })).toHaveCount(0);

    // ── URL must NOT change when navigating between bucket sub-filters ───
    // (no ?tab= param — bucket state is local to KontrakterTab)
    const bucketSwitchTs = telemetryTimestamp();
    await readyTab.click();
    // Give any router push time to fire (it won't, but we want to be sure)
    await page.waitForTimeout(800);
    await expect(page).not.toHaveURL(/\?tab=/);

    // ── contract.tab_switched fires when switching from "all" to "ready_for_action" ──
    const trailRow = await expectTelemetryEvent("contract.tab_switched", SEED_WORKSPACE_ID, {
      since: bucketSwitchTs,
      timeout: 8_000,
    });

    // Verify the from/to payload stored in the `data` column of activity_trail.
    // expectTelemetryEvent returns the first matching row — fetch a fresh copy
    // with the data column to assert from/to values.
    if (trailRow) {
      const { data: fullRow } = await supabase
        .from("activity_trail")
        .select("data")
        .eq("id", (trailRow as { id: number }).id)
        .single();
      const payload = fullRow?.data as { from?: string; to?: string } | null;
      expect(payload?.from).toBe("kontrakter:all");
      expect(payload?.to).toBe("kontrakter:ready_for_action");
    }
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
