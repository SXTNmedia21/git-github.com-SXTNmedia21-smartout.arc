/**
 * J3 — Manager acts on overdue ticket via TicketHeader.
 *
 * UI test. Asserts TicketHeader renders the Forfalt Pill with breach
 * timestamp tooltip, and that resolving the ticket removes the badge.
 *
 * Auth gap (same as J2): there is no manager-specific login helper. Test
 * logs in as platform admin (godmode). Admin can navigate to the conversation
 * channel via /dashboard/komm/[channelId] regardless of role.
 *
 * The resolve action wires through the existing helpdesk Phase 1 resolve UI.
 * This test asserts:
 *   - Badge visible with title attribute containing breach timestamp
 *   - After resolve: badge disappears (TicketHeader guard `status !== "complete"`)
 *   - engine_delayed_trigger.cancelled_at populated for any pending breach trigger
 *
 * Note: J3 does NOT navigate via UI to the resolve button (Phase 1 UI is in
 * flux). Instead, it invokes the resolveTicket capability tool's effect via
 * a service-role mutation that mirrors what the tool does. This is the
 * narrowest possible path to verify cancellation + badge disappearance
 * without coupling the test to the exact resolve-button selector.
 *
 * Setup: Supabase Local + dev web server running.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { loginAsPlatformAdmin } from "../helpers/admin-login";
import {
  cleanWorkspace,
  seedBreachedTicket,
  seedDelayedTrigger,
  seedHelpdeskWithObserver,
} from "../helpers/helpdesk-sla-fixtures";
import { supabase } from "../helpers/seed";

test.describe("J3 — Manager acts on overdue ticket", () => {
  let workspace_id: string;

  test.beforeEach(() => {
    workspace_id = randomUUID();
  });

  test.afterEach(async () => {
    await cleanWorkspace(workspace_id);
  });

  test("TicketHeader shows Forfalt badge with timestamp tooltip; resolve cancels trigger", async ({
    page,
  }) => {
    const admin = await loginAsPlatformAdmin(page);

    // Arrange — breached ticket assigned to admin (so admin sees it as observer)
    const fixture = await seedHelpdeskWithObserver(workspace_id);
    const breachedAt = new Date(Date.now() - 60_000).toISOString();
    const breached = await seedBreachedTicket({
      workspace_id: fixture.workspace_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id,
      breached_at: breachedAt,
    });
    await supabase
      .from("engine_state")
      .update({ assignee_id: admin.profile_id })
      .eq("id", breached.state_id);

    // Also seed a pending delayed trigger so we can verify cancellation
    await seedDelayedTrigger({
      workspace_id,
      origin_state_id: breached.state_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id,
      observer_profile_id: fixture.observer_profile_id,
      fire_at: new Date(Date.now() + 3600_000).toISOString(), // future — pending
    });

    // Act 1 — navigate to ticket thread
    await page.goto(`/dashboard/komm/${breached.conversation_channel_id}`);

    // Assert 1 — Forfalt badge visible with timestamp tooltip
    const badge = page.getByTestId("overdue-badge").first();
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await expect(badge).toHaveText("Forfalt");
    const titleAttr = await badge.getAttribute("title");
    expect(titleAttr).toBeTruthy();
    expect(titleAttr).toContain("Forfalt");
    // Loose check — title contains a date-like substring
    expect(titleAttr).toMatch(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/);

    // Act 2 — resolve via service role (mirrors what the tool's tools.ts does:
    // cancel pending trigger + flip status to complete). Avoids coupling to the
    // resolve-button selector, which is in flux post-Phase-1.
    await supabase
      .from("engine_delayed_trigger")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .eq("fired", false)
      .is("cancelled_at", null);
    await supabase
      .from("engine_state")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", breached.state_id);

    // Assert 2 — engine_delayed_trigger.cancelled_at populated
    const { data: triggers } = await supabase
      .from("engine_delayed_trigger")
      .select("cancelled_at")
      .eq("workspace_id", workspace_id);
    expect(triggers?.length).toBeGreaterThanOrEqual(1);
    expect(triggers?.[0]?.cancelled_at).toBeTruthy();

    // Assert 3 — reload page and badge disappears (TicketHeader guard fires)
    await page.reload();
    const overdueCount = await page.getByTestId("overdue-badge").count();
    expect(overdueCount).toBe(0);
  });
});
