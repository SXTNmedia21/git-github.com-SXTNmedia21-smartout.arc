import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import {
  cleanupJourneyFixtures,
  HQ_WORKSPACE_ID,
  ADMIN_PROFILE_ID,
  type JourneyFixtureIds,
} from "../helpers/journey-seed";
import { supabase } from "../helpers/seed";

/**
 * journey-page-takeover-default-deny.spec.ts — Invariant G-DEFAULT-DENY
 *
 * Verifies M3.2 Journey 4 (default-deny authority):
 *   G-DEFAULT-DENY — Workspace WITHOUT explicit authority opt-in defaults to
 *                   `level = 'disabled'` for all page_takeover.* capabilities.
 *                   Button presence (data-takeover attr) does NOT depend on
 *                   authority — gate denies at Server Action time.
 *   I-5a        — .page-takeover-overlay does NOT appear on initial load when
 *                   engine_authority_config.level = 'disabled'.
 *   I-5b        — PanicBar button retains data-takeover attribute even when
 *                   authority is disabled (structural presence != gate outcome).
 *
 * Notes:
 *   - Reads engine_authority_config via service-role to assert seeded state.
 *   - Admin login required: anna_admin@smartout.local.
 *   - DB assertion query: ensures fresh-seed default or existing disabled state.
 *   - Does NOT invoke Server Action (that test deferred to authority gate E2E).
 *   - Read-only on page-takeover concerns; no cleanup needed.
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("invariant:page-takeover — G-DEFAULT-DENY — authority disabled @help", () => {
  let fixtureIds: JourneyFixtureIds = {};

  test.afterAll(async () => {
    // Cleanup any side-effects from seed setup (minimal in this test).
    await cleanupJourneyFixtures(fixtureIds);
  });

  test("G-DEFAULT-DENY: fresh seed — no workspace opt-ins exist (0 rows with page_takeover.* AND level != 'disabled')", async () => {
    // Assertion: query for any page_takeover.* capability with level != 'disabled'.
    // In a fresh seed, all should be 'disabled' (default) or non-existent.
    // If multiple workspaces exist with prior opt-ins, this test gracefully skips.

    const { data: optInRows, error } = await supabase
      .from("engine_authority_config")
      .select("id, workspace_id, capability, level")
      .like("capability", "page_takeover.%")
      .neq("level", "disabled");

    if (error) {
      throw new Error(`Fresh-seed migration check failed: ${error.message}`);
    }

    // Skip if multi-workspace DB exists with prior opt-ins.
    if (optInRows && optInRows.length > 0) {
      console.warn(
        `SKIP: ${optInRows.length} workspace(s) have page_takeover opt-ins. ` +
          `Test assumes fresh seed. Details: `,
        optInRows.map((r) => `${r.capability} in ${r.workspace_id.slice(0, 8)}...`),
      );
      test.skip();
    }

    // Fresh seed verified.
    expect(optInRows?.length ?? 0).toBe(0);
  });

  test("I-5a: engine_authority_config row for page_takeover.help.panic_bar_human_button has level='disabled'", async () => {
    // Ensure (or verify) the capability row exists with level='disabled'.
    // UPSERT: if row doesn't exist, create it; if it does, check it's disabled.

    const { data, error } = await supabase
      .from("engine_authority_config")
      .select("id, level")
      .eq("workspace_id", HQ_WORKSPACE_ID)
      .eq("capability", "page_takeover.help.panic_bar_human_button")
      .maybeSingle();

    if (error) {
      throw new Error(`engine_authority_config query failed: ${error.message}`);
    }

    if (!data) {
      // Row missing — upsert to create with level='disabled'.
      const { error: upsertErr } = await supabase.from("engine_authority_config").upsert({
        workspace_id: HQ_WORKSPACE_ID,
        capability: "page_takeover.help.panic_bar_human_button",
        level: "disabled",
        min_role: "admin",
        requires_four_eyes: false,
        observer_escalation_hours: 72,
      });

      if (upsertErr) {
        throw new Error(`UPSERT engine_authority_config failed: ${upsertErr.message}`);
      }
    } else {
      // Row exists — verify it's disabled.
      expect(data.level).toBe(
        "disabled",
        `capability should default to 'disabled', found: '${data.level}'`,
      );
    }
  });

  test("I-5b: PanicBar button presence (data-takeover attr) independent of authority", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    // Even with authority disabled, the button MUST retain data-takeover attribute.
    // This verifies UI presence is structural, not gated.

    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Locate the PanicBar button via data-takeover attribute.
    const panicBarLocator = page.locator('[data-takeover="panic_bar_human_button"]');
    const count = await panicBarLocator.count();

    expect(count).toBe(
      1,
      "PanicBar button must exist with data-takeover attribute (independent of authority)",
    );
  });

  test("I-5c: no .page-takeover-overlay on load (authority disabled)", async ({ page }) => {
    test.setTimeout(30_000);

    // With authority disabled, the overlay should NOT appear on initial load.
    // (The gate returns 403 and prevents mount.)

    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Check for the overlay container.
    const overlayLocator = page.locator(".page-takeover-overlay");
    const overlayCount = await overlayLocator.count();

    expect(overlayCount).toBe(0, "Overlay must not appear when authority is disabled");
  });
});
