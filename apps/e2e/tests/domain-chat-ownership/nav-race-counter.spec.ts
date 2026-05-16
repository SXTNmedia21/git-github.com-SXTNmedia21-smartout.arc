import { test } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { expectOrbActive, expectOrbPassive } from "../../helpers/orb";

test.describe("DomainChatOwnership — multi-owner counter integrity", () => {
  test("rapid navigation komm/chat → komm/thread → schedule leaves counter at zero", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Baseline
    await expectOrbActive(page);

    // Owner 1: komm/chat (reason="komm-chat") → counter = 1
    await page.goto("/dashboard/komm/chat");
    await expectOrbPassive(page);

    // Discover a channelId for thread
    const channelHref = await page
      .locator('a[href^="/dashboard/komm/thread/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    test.skip(
      !channelHref,
      "no channels seeded — cannot test thread phase of nav-race",
    );

    // Owner 2: komm/thread (reason="komm-thread")
    // During navigation: chat-page unmounts (counter -1), thread page mounts (counter +1)
    // Final state on /dashboard/komm/thread/<id>: counter = 1, Orb passive
    await page.goto(channelHref!);
    await expectOrbPassive(page);

    // Navigate to non-owning page: cleanup must decrement counter to 0
    await page.goto("/dashboard/schedule");
    await expectOrbActive(page);

    // Second pass: verify no state leak — repeat the sequence
    await page.goto("/dashboard/komm/chat");
    await expectOrbPassive(page);
    await page.goto("/dashboard/schedule");
    await expectOrbActive(page);
  });
});
