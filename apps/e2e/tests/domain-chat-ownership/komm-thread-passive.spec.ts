import { test } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectOrbActive, expectOrbPassive } from "../../helpers/orb";

/**
 * DomainChatOwnership — komm/thread surface.
 *
 * /dashboard/komm/thread/[channelId] only accepts channel_type='query_thread'
 * (helpdesk tickets). The TicketConversationView declares DomainChatOwnership,
 * which suppresses the Botsson Orb to passive mode (ADR-0238).
 *
 * Discovery strategy: navigate to /dashboard/help where ActiveTicketBadge
 * renders a link to /dashboard/komm/thread/<id> when a ticket is assigned
 * to the current user. If no ticket link is found, skip with a gap message —
 * the test must not fail for empty data.
 */
test.describe("DomainChatOwnership — komm/thread surface", () => {
  test("declares ownership → Orb passive on /dashboard/komm/thread/<id>", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to /dashboard/help — ActiveTicketBadge renders thread links
    // when a helpdesk ticket is assigned to the admin profile.
    await page.goto("/dashboard/help");
    await page.waitForLoadState("domcontentloaded");

    // Discover first thread href from the help surface.
    // ActiveTicketBadge uses data-testid="active-ticket-badge" with nested
    // <a href="/dashboard/komm/thread/<id>">. Fall back to any matching
    // anchor on the page (e.g. QueueSheet links loaded via desks).
    const threadHref = await page
      .locator('a[href*="/dashboard/komm/thread/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (!threadHref) {
      // No helpdesk ticket seeded in the admin workspace — document the gap
      // and skip rather than failing. Seed a query_thread ticket to enable
      // this test in CI (see HANDOFF gap note).
      test.skip(true, "no query_thread ticket found in admin workspace — seed required to enable");
      return;
    }

    // Navigate to the thread surface.
    await page.goto(threadHref);

    // TicketConversationView declares DomainChatOwnership → Orb passive.
    await expectOrbPassive(page);

    // Cleanup: navigating away decrements the ownership counter to 0 → Orb active.
    await page.goto("/dashboard");
    await expectOrbActive(page);
  });
});
