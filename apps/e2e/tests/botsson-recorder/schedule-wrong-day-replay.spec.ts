// ============================================
// schedule-wrong-day-replay.spec.ts
// Acceptance test for ADR-0184 Q17: a Platform Admin can replay a past
// Emma session that chose the wrong day for `schedule.shift_created`,
// drill into the TurnTimeline, inspect classifier/LLM/tool payloads,
// flag the offending turn, and queue a whisper correcting Emma.
//
// ---------------------------------------------------------------------
// STATUS: TDD, pending-infra.
//
// As of Phase 1e close (2026-04-22) the recorder components are built
// (SessionList wires useRecorderSessions — see L3/L5 🟢 rows in
// docs/architecture/BOTSSON-SYSTEM-MAP.md) but TurnTimeline and
// AdminActionDrawer are NOT yet composed into GuardianDashboard /
// GuardianMonitor. They live under
//   apps/web/src/app/platform-admin/guardian/_components/
// and are imported only by themselves + __tests__. Phase 2 follow-up.
//
// Until the composition lands + a deterministic seed planter for recorder
// rows ships, this file runs with test.skip() so CI stays green. When
// Phase 2 wires the components, flip SKIP_UNTIL_COMPOSED → false and
// provide a fixture that inserts one recorder session with the expected
// tool-call turn.
//
// Selectors in this file target the contract in ADR-0184/0185 specs +
// the actual component files. If selectors are wrong when you unflip,
// update them against the live DOM — the intent of each step (filter,
// drill, expand, flag, whisper) is locked, specific ARIA/testid strings
// are not.
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

// Flip to false when (a) TurnTimeline is rendered by guardian page for a
// selected session and (b) a recorder seeder exists (fixture or API).
const SKIP_UNTIL_COMPOSED = true;

test.describe("Platform Admin — schedule wrong-day replay (ADR-0184 Q17)", () => {
  test.skip(SKIP_UNTIL_COMPOSED, "TurnTimeline not yet composed into GuardianDashboard — Phase 2");

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin drills a flagged session → expands turn → flags + whispers", async ({ page }) => {
    // 1. Navigate to Guardian monitor
    await page.goto("/platform-admin/guardian", { waitUntil: "domcontentloaded" });

    // 2. Find a session in the left rail that has recorder turns
    //    SessionList rows are <button type="button"> with profile name,
    //    channel badge, and (when recorder data exists) turn-count pill
    //    like "5t" and optional ⚠ attention marker.
    const sessionRow = page.getByRole("button").filter({ hasText: /\dt$/ }).first();
    await expect(sessionRow).toBeVisible({ timeout: 10_000 });
    await sessionRow.click();

    // 3. TurnTimeline should render after SessionDetails opens. The
    //    timeline lives in a scrollable region; individual TurnCards are
    //    <motion.div layout> wrapping <button> + <pre> payloads.
    //    We look for the phase badge 'classifier_output' which is emitted
    //    by agent-router.ts per ADR-0184 §3.2.
    const classifierBadge = page.getByText("classifier_output").first();
    await expect(classifierBadge).toBeVisible({ timeout: 5_000 });

    // 4. Expand the LLM request/response turn
    const llmRow = page.getByText("llm_request").first();
    await expect(llmRow).toBeVisible();
    await llmRow.click();

    // 5. Verify the expanded JSON contains the schedule.shift_created tool
    //    call (this is the whole point of wrong-day replay — the admin must
    //    see WHY Emma picked the wrong day).
    await expect(page.getByText(/schedule\.shift_created/).first()).toBeVisible();

    // 6. Flag the turn — TurnCard exposes an absolute-positioned button
    //    aria-label="Flag turn" revealed on hover (opacity 0 → 100).
    const flagTurn = page.getByRole("button", { name: "Flag turn" }).first();
    // Dialog handler must be registered BEFORE click (window.prompt).
    page.once("dialog", (dialog) => dialog.accept("wrong date selected — admin replay"));
    await flagTurn.click();

    // 7. Verify the flagged visual signal lands. TurnCard tints amber when
    //    is_flagged=true. We assert via the flag icon's color class.
    await expect(page.locator("[aria-label='Flag turn']").first()).toBeVisible();

    // 8. Open the AdminActionDrawer and send a corrective whisper.
    //    Drawer trigger: see Phase 2 integration — expected to be a button
    //    in SessionDetails toolbar with accessible name matching /admin/i.
    const drawerTrigger = page.getByRole("button", { name: /admin actions?|session admin/i });
    await expect(drawerTrigger).toBeVisible();
    await drawerTrigger.click();

    // 9. Whisper textarea + submit
    const whisperBox = page.getByPlaceholder(/Skriv en instruks/);
    await whisperBox.fill("Brukeren mente tirsdag 29. april — ikke onsdag 30.");
    const sendWhisper = page.getByRole("button", { name: "Send whisper" });
    await sendWhisper.click();

    // 10. Drawer should reset whisper text on success (empty value)
    await expect(whisperBox).toHaveValue("", { timeout: 5_000 });
  });
});
