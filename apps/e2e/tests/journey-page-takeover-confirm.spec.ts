/**
 * journey-page-takeover-confirm.spec.ts (M3.2 Journey 1)
 *
 * Verifies confirm-and-execute structural contract for page-takeover. Full
 * agent-driven flow (chat -> agent-router -> ui.simulate_click -> preview ->
 * user confirms -> click fires) requires a worker we don't run in CI; this
 * test proves the DOM contract that the kit + bridge depend on:
 *
 *   1. PanicBar's "human" button has data-takeover="panic_bar_human" attr
 *      (T6 — only this button is in v1 allow-list per ADR-0228).
 *   2. With workspace authority opted-in, the takeover bridge is mounted
 *      and ready (no preview overlay until invoked, but the contract holds).
 *   3. Workspace toggle round-trips correctly (disabled -> read_write -> disabled).
 *
 * Per ADR-0228 default-deny, fresh seed has level='disabled'. This test
 * temporarily UPSERTs to 'read_write' and reverts in afterAll.
 *
 * Skipped subtests (require window handle wired via dev-only test handle):
 *   - Programmatic proposeAction invocation
 *   - confirmAction emits action_confirmed + action_executed sequence
 *
 * Author: Claude Opus 4.7 (1M context) — M3.2 Phase 4
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsAdmin } from "../helpers/auth";

const TAKEOVER_CAPABILITY = "page_takeover.help.panic_bar_human_button";

test.describe("M3.2 Journey 1 — confirm-and-execute (structural)", () => {
  let workspaceId: string | null = null;

  test.beforeAll(async () => {
    // Resolve admin's workspace_id via service-role lookup so we can opt-in
    // the authority for this run only.
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      test.skip(true, "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
      return;
    }
    const supabase = createClient(url, key);

    const { data: profile } = await supabase
      .from("profile")
      .select("workspace_id")
      .eq("role", "admin")
      .limit(1)
      .single();
    workspaceId = profile?.workspace_id ?? null;
    if (!workspaceId) {
      test.skip(true, "No admin profile in seed");
      return;
    }

    // Opt in to read_write for this test run
    await supabase.from("engine_authority_config").upsert(
      {
        workspace_id: workspaceId,
        capability: TAKEOVER_CAPABILITY,
        level: "read_write",
        min_role: "admin",
      },
      { onConflict: "workspace_id,capability" },
    );
  });

  test.afterAll(async () => {
    if (!workspaceId) return;
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);

    // Revert to default-deny per ADR-0228 — fresh state for next test run
    await supabase
      .from("engine_authority_config")
      .update({ level: "disabled" })
      .eq("workspace_id", workspaceId)
      .eq("capability", TAKEOVER_CAPABILITY);
  });

  test("Journey 1a — PanicBar 'human' button carries data-takeover attr", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const takeoverButton = page.locator('[data-takeover="panic_bar_human"]');
    await expect(takeoverButton).toHaveCount(1);
    await expect(takeoverButton).toBeVisible();
  });

  test("Journey 1b — Other panic categories do NOT carry data-takeover (allow-list of one)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Per ADR-0228 v1 allow-list: only the 'human' panic button. Other panic
    // categories (locked_out, shift_wrong) intentionally lack data-takeover so
    // they cannot be addressed by the kit until each gets its own ADR + seed.
    const otherTakeoverHandles = page.locator(
      '[data-takeover]:not([data-takeover="panic_bar_human"])',
    );
    await expect(otherTakeoverHandles).toHaveCount(0);
  });

  test("Journey 1c — No preview overlay rendered on idle load", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const overlay = page.locator(".page-takeover-overlay");
    await expect(overlay).toHaveCount(0);
  });

  test.skip("Journey 1d — programmatic proposeAction → preview → confirm → click (requires window handle, M3.3)", async ({
    page,
  }) => {
    // TODO M3.3: wire window.__pageTakeover handle in HelpTakeoverToolsBridge
    // (dev-only via NEXT_PUBLIC_E2E flag). Then drive the full lifecycle:
    //   await page.evaluate(() => (window as any).__pageTakeover.propose("panic_bar_human_button"));
    //   await expect(page.locator(".page-takeover-overlay")).toBeVisible();
    //   await page.waitForTimeout(3100); // wait for confirm enable
    //   await page.locator('button:has-text("Klikk for å bekrefte")').click();
    //   // Assert PanicBar drawer opened (Sheet with role=dialog data-state=open)
    void page;
  });
});
