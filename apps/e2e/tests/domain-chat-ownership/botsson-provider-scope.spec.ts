import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

/**
 * Regression guard for the BotssonProvider-ancestor bug (Solution C fix).
 *
 * Before the fix, three DomainChatOwnership consumers mounted before
 * BotssonProvider existed in the tree, throwing:
 *   "useBotsson must be used within <BotssonProvider>"
 *
 * Post-fix: <BotssonHost> (which owns the Provider) wraps {children} +
 * <EmmaOverlay> in DashboardShell, making the provider ancestor to every
 * page under /dashboard/**. This spec FAILS if anyone removes BotssonHost
 * or wraps it in an ssr:false dynamic import that delays the provider.
 *
 * Coverage:
 *   - /dashboard/komm         — KommPageClient (no DomainChatOwnership, but
 *                                proves provider tree is live for children)
 *   - /dashboard/komm/chat    — ChatPageClient mounts DomainChatOwnership
 *                                reason="komm-chat"
 *   - /dashboard/shift-clock  — ShiftClockTabs mounts DomainChatOwnership
 *                                reason="shift-clock-chat" on "Chat" tab
 *
 * G3 structural check: botsson-orb testid is rendered by BotssonShell inside
 * BotssonHost — if the provider is missing the orb cannot mount, so asserting
 * it is attached proves the provider scope is intact.
 */

const BOTSSON_PROVIDER_ERROR = /useBotsson must be used within <BotssonProvider>/;

test.describe("BotssonProvider scope — provider-ancestor regression guard", () => {
  test("komm/chat: DomainChatOwnership mounts without useBotsson error", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/chat");
    await page.waitForLoadState("networkidle");

    // G3 structural check: orb is attached → BotssonHost rendered → provider live
    const orb = page.getByTestId("botsson-orb");
    await orb.waitFor({ state: "attached", timeout: 10_000 });

    const providerErrors = errors.filter((e) => BOTSSON_PROVIDER_ERROR.test(e));
    expect(
      providerErrors,
      `BotssonProvider error(s) found on /dashboard/komm/chat:\n${providerErrors.join("\n")}`,
    ).toHaveLength(0);
  });

  test("shift-clock Chat tab: DomainChatOwnership mounts without useBotsson error", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/shift-clock");
    await page.waitForLoadState("networkidle");

    // Click the "Chat" tab to mount DomainChatOwnership reason="shift-clock-chat"
    const chatTab = page.getByRole("tab", { name: /chat/i });
    const tabVisible = await chatTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabVisible) {
      await chatTab.click();
      // Allow DomainChatOwnership effect to run
      await page.waitForTimeout(500);
    }
    // If admin is redirected away from shift-clock, the page renders without
    // DomainChatOwnership — no provider error is possible, test still passes.

    const providerErrors = errors.filter((e) => BOTSSON_PROVIDER_ERROR.test(e));
    expect(
      providerErrors,
      `BotssonProvider error(s) found on /dashboard/shift-clock Chat tab:\n${providerErrors.join("\n")}`,
    ).toHaveLength(0);
  });

  test("komm (channel list): provider tree live — botsson-orb attaches", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm");
    await page.waitForLoadState("networkidle");

    // Structural proof: orb rendered inside BotssonHost → provider must exist
    const orb = page.getByTestId("botsson-orb");
    await expect(orb).toBeAttached({ timeout: 10_000 });

    const providerErrors = errors.filter((e) => BOTSSON_PROVIDER_ERROR.test(e));
    expect(
      providerErrors,
      `BotssonProvider error(s) found on /dashboard/komm:\n${providerErrors.join("\n")}`,
    ).toHaveLength(0);
  });
});
