// ============================================
// whisper-never-user-facing.spec.ts
// ADR-0078 + ADR-0185 enforcement — whispers written by Platform Admin are
// metadata-only system-prompt context. They must NEVER appear in assistant
// output (chat response, voice transcript, notification, any DOM surface
// the end-user can see).
//
// This test drives the invariant end-to-end:
//   1. Admin writes a whisper containing a distinct token
//   2. User opens Botsson Arena in another tab + triggers a turn
//   3. Assistant response is inspected for the token — MUST NOT contain it
//   4. Full DOM of the user-facing page is inspected — same invariant
//
// ---------------------------------------------------------------------
// STATUS: TDD, pending-infra.
//
// AdminActionDrawer (whisper entry surface) is built but not yet composed
// into GuardianDashboard. Botsson Arena voice↔stage-engine loop on web is
// live, but the user-side assertion requires a seeded active session the
// whisper can attach to + a deterministic turn trigger. Once Phase 2 wires
// the drawer into the page and a session-seeder exists, flip
// SKIP_UNTIL_COMPOSED → false.
//
// The token used (XYZ_WHISPER_PROBE_42) is intentionally unique so a simple
// substring search is sufficient — any implementation that leaks the
// whisper content will fail unambiguously.
//
// If you ever observe this test PASSING when skip is lifted: the whisper
// pipeline is leaking user-facing content. Investigate prompt-builder.ts +
// agent-router.ts before shipping anything else.
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

const SKIP_UNTIL_COMPOSED = true;
const WHISPER_TOKEN = "XYZ_WHISPER_PROBE_42";

test.describe("Whisper isolation (ADR-0078 + ADR-0185)", () => {
  test.skip(SKIP_UNTIL_COMPOSED, "AdminActionDrawer not wired into Guardian page — Phase 2");

  test("whisper token never leaks to user-facing assistant output", async ({ page, context }) => {
    // 1. Admin writes whisper
    await loginAsAdmin(page);
    await page.goto("/platform-admin/guardian", { waitUntil: "domcontentloaded" });

    // Select the first active session
    const firstSession = page.getByRole("button").filter({ hasText: /\dt$/ }).first();
    await expect(firstSession).toBeVisible({ timeout: 10_000 });
    await firstSession.click();

    // Open the admin drawer + send whisper
    const drawerTrigger = page.getByRole("button", { name: /admin actions?|session admin/i });
    await drawerTrigger.click();
    const whisperBox = page.getByPlaceholder(/Skriv en instruks/);
    await whisperBox.fill(`Intern note, husk dette tokenet: ${WHISPER_TOKEN}`);
    await page.getByRole("button", { name: "Send whisper" }).click();
    // Drawer clears textarea on success → confirms POST returned 200
    await expect(whisperBox).toHaveValue("", { timeout: 5_000 });

    // 2. User opens Botsson Arena in a separate tab (shares cookies via
    //    BrowserContext but we treat it as the end-user surface).
    const userPage = await context.newPage();
    await userPage.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Open the Botsson sticky and switch to chat view. In the live UI the
    // sticky opens the Arena — we target an accessible anchor that owns the
    // morphing overlay. Selector is intentionally permissive — the Arena
    // root is expected to expose role="region" aria-label="Botsson Arena"
    // per the design brief.
    await userPage
      .getByRole("button", { name: /botsson|emma/i })
      .first()
      .click();

    // Send a user message — triggers the next turn which should consume
    // the admin whisper (prompt-builder injects the unconsumed whisper).
    const chatInput = userPage.getByPlaceholder(/Skriv til Emma|Skriv en melding/i).first();
    await chatInput.fill("Hei, hva bør jeg gjøre nå?");
    await userPage.getByRole("button", { name: /send/i }).first().click();

    // 3. Wait for an assistant message bubble. Selector contract:
    //    [data-role="agent"] is the canonical marker in BotssonChat.
    const agentBubble = userPage.locator("[data-role='agent']").last();
    await expect(agentBubble).toBeVisible({ timeout: 30_000 });

    // 4. The token MUST NOT appear in the assistant response.
    const responseText = (await agentBubble.textContent()) ?? "";
    expect(responseText).not.toContain(WHISPER_TOKEN);

    // 5. Defence in depth — the full DOM must not contain the token either.
    //    Catches accidental leakage through tool-result rendering, log view,
    //    toast notifications, data-attributes, etc.
    const fullDom = await userPage.content();
    expect(fullDom).not.toContain(WHISPER_TOKEN);
  });
});
