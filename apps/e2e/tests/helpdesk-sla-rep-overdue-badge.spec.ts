/**
 * J2 — Rep sees overdue badge on Min kø.
 *
 * UI test. Asserts MinKoSection renders the calm "Forfalt" Pill on desk rows
 * containing breached tickets, and omits it on non-breached rows.
 *
 * Auth gap: there is no rep-specific login helper. Test logs in as platform
 * admin (godmode visibility). Admin sees Min kø rows for assignee_id matching
 * their own profile. To work around: we seed the breached ticket with
 * assignee_id = the admin's profile_id (resolved from loginAsPlatformAdmin
 * return value). This is acceptable for badge visibility test because
 * MinKoSection's data path is identical regardless of role — only the
 * assignee_id filter changes.
 *
 * Spec §1.4 calm queue: assertion ensures no text-destructive / text-amber /
 * text-red class on the badge.
 *
 * Setup: Supabase Local + dev web server running.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { loginAsPlatformAdmin } from "../helpers/admin-login";
import {
  cleanWorkspace,
  seedBreachedTicket,
  seedHelpdeskWithObserver,
  seedTicket,
} from "../helpers/helpdesk-sla-fixtures";
import { supabase } from "../helpers/seed";

test.describe("J2 — Rep sees overdue badge", () => {
  let workspace_id: string;

  test.beforeEach(() => {
    workspace_id = randomUUID();
  });

  test.afterEach(async () => {
    await cleanWorkspace(workspace_id);
  });

  test("MinKoSection renders Forfalt badge on breached desk row", async ({ page }) => {
    const admin = await loginAsPlatformAdmin(page);

    // Arrange — fresh workspace, but assignee_id = admin profile so the
    // MinKoSection query (filtered by assignee_id) picks it up.
    const fixture = await seedHelpdeskWithObserver(workspace_id);
    const breached = await seedBreachedTicket({
      workspace_id: fixture.workspace_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id, // unused for assignee — we override below
    });
    // Re-assign the seeded ticket to the admin so it appears in their queue.
    await supabase
      .from("engine_state")
      .update({ assignee_id: admin.profile_id })
      .eq("id", breached.state_id);

    // Act
    await page.goto("/dashboard/komm");

    // Assert 1 — MinKoSection desk row visible
    const deskRow = page.getByText("HR-skranken").first();
    await expect(deskRow).toBeVisible({ timeout: 10_000 });

    // Assert 2 — Forfalt pill visible
    const overdueBadge = page.getByTestId("overdue-badge").first();
    await expect(overdueBadge).toBeVisible();
    await expect(overdueBadge).toHaveText("Forfalt");

    // Assert 3 — calm queue (Spec §1.4): no red/amber/destructive class
    const badgeClass = (await overdueBadge.getAttribute("class")) ?? "";
    expect(badgeClass).not.toMatch(/text-destructive|text-amber|text-red/);
  });

  test("MinKoSection does NOT render badge on non-breached desk row", async ({ page }) => {
    const admin = await loginAsPlatformAdmin(page);

    const fixture = await seedHelpdeskWithObserver(workspace_id);
    const ticket = await seedTicket({
      workspace_id: fixture.workspace_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id,
    });
    // Re-assign to admin (no sla_breached_at set)
    await supabase
      .from("engine_state")
      .update({ assignee_id: admin.profile_id })
      .eq("id", ticket.state_id);

    await page.goto("/dashboard/komm");

    const deskRow = page.getByText("HR-skranken").first();
    await expect(deskRow).toBeVisible({ timeout: 10_000 });

    // Negative assertion — badge must NOT be present in this scope
    const overdueCount = await page.getByTestId("overdue-badge").count();
    expect(overdueCount).toBe(0);
  });
});
