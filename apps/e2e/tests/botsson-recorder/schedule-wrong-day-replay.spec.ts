// ============================================
// schedule-wrong-day-replay.spec.ts
// Acceptance test for ADR-0184 Q17: a Platform Admin can replay a past
// Emma session that chose the wrong day for `schedule.shift_created`,
// drill into the TurnTimeline, inspect classifier/LLM/tool payloads,
// flag the offending turn, and queue a whisper correcting Emma.
//
// ---------------------------------------------------------------------
// STATUS (2026-04-23): pending-infra — end-to-end runtime required.
//
// Phase 2 composition IS landed. TurnTimeline + AdminActionDrawer are
// both composed into GuardianMonitor (see GuardianMonitor.tsx:
// "Replay" tab renders TurnTimeline; "Actions" button opens
// AdminActionDrawer). The failing dependency for green is purely
// runtime: this test requires
//
//   (a) Supabase Local up (Docker + `npx supabase start`)
//   (b) Next dev server (apps/web:3060)
//   (c) Stage-engine (services/stage-engine:5010) with LLM keys
//   (d) A LIVE session in the Guardian WebSocket stream AND matching
//       rows in agent_session_recording for that same session_id
//
// (a)–(c) are provisioning; (d) is the hard part — SessionList only
// renders rows coming from `useGuardianSocket()` (live WS stream). We
// cannot seed a "live" session without the stage-engine side creating
// it, which means an LLM turn must actually complete before the admin
// can drill in.
//
// Concrete drift FIXED in this revision (compared to the original
// Phase 1e draft):
//   - Guardian layout is tabbed (Oversikt / Live Monitor / Analyse).
//     Must switch to "Live Monitor" before SessionList renders.
//   - AdminActionDrawer trigger aria-label is "Open admin actions
//     drawer" (not a generic /admin/i regex match). Dialog aria-label
//     is "Session admin actions".
//   - Phase-badge text on TurnCard is emitted from the recorder schema
//     enum; values stayed stable (classifier_output, llm_request).
//   - Drawer closes on whisper success; textarea value asserted empty.
//
// To flip this test to green, in order:
//   1. Run `npx supabase start` + seed (pnpm seed).
//   2. Start stage-engine: `op run --env-file=.env.template -- pnpm
//      --filter stage-engine dev` (needs Anthropic key).
//   3. Start web dev server on port 3060.
//   4. Produce ≥1 assistant turn via Botsson Arena (this creates both
//      a Guardian-WS session AND recorder rows).
//   5. Remove the `test.skip()` gate below.
//
// The SessionList regex `/\dt$/` matches "5t" / "12t" style turn-count
// pills in the list row — those pills only render when recorder rows
// exist for the session.
// ============================================

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";

// Keep the skip until the E2E harness has a stage-engine runner
// (tracked under Phase 2d — "E2E recorder harness"). The test itself
// is otherwise ready; selectors are verified against the current DOM.
const SKIP_UNTIL_HARNESS = true;

test.describe("Platform Admin — schedule wrong-day replay (ADR-0184 Q17)", () => {
  test.skip(
    SKIP_UNTIL_HARNESS,
    "Requires live stage-engine + live Botsson session + recorder rows. Green gate: start full local stack + produce ≥1 assistant turn. See file header for detailed steps.",
  );

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin drills a flagged session → expands turn → flags + whispers", async ({ page }) => {
    // 1. Navigate to Guardian monitor. Guardian page defaults to the
    //    "Oversikt" tab — we must switch to "Live Monitor" to see
    //    SessionList. Tab trigger text is Norwegian; aria-label in
    //    Radix Tabs follows the label.
    await page.goto("/platform-admin/guardian", { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: /live monitor/i }).click();

    // 2. Find a session in the left rail that has recorder turns.
    //    SessionList rows are <button type="button"> with the turn-count
    //    pill `5t` rendered only when recorder aggregate has rows. The
    //    pill appears inside the row's bottom-right cluster; hasText
    //    with `/\dt$/` matches the trailing text.
    const sessionRow = page.getByRole("button").filter({ hasText: /\dt$/ }).first();
    await expect(sessionRow).toBeVisible({ timeout: 10_000 });
    await sessionRow.click();

    // 3. Switch the right-pane tab to "Replay" so TurnTimeline renders.
    //    The tab button text is plain "Replay" (see GuardianMonitor.tsx).
    await page.getByRole("button", { name: "Replay" }).click();

    // 4. TurnCard phase badges match the recorder enum. classifier_output
    //    is emitted by agent-router.ts per ADR-0184 §3.2 — verifies the
    //    classifier hop was captured.
    const classifierBadge = page.getByText("classifier_output").first();
    await expect(classifierBadge).toBeVisible({ timeout: 5_000 });

    // 5. Expand the LLM request turn. Clicking the card toggles the
    //    expanded region (AnimatePresence + layout animation).
    const llmRow = page.getByText("llm_request").first();
    await expect(llmRow).toBeVisible();
    await llmRow.click();

    // 6. Expanded JSON must expose the schedule.shift_created tool call —
    //    this is why an admin would come to this screen in the first
    //    place for the wrong-day bug.
    await expect(page.getByText(/schedule\.shift_created/).first()).toBeVisible();

    // 7. Flag the turn. The per-turn flag button is absolute-positioned
    //    with aria-label="Flag turn" and opacity 0 on the card, 100 on
    //    group-hover. window.prompt() blocks UI; register dialog handler
    //    BEFORE click.
    const flagTurn = page.getByRole("button", { name: "Flag turn" }).first();
    page.once("dialog", (dialog) => dialog.accept("wrong date selected — admin replay"));
    await flagTurn.click();

    // 8. AdminActionDrawer opens via the "Actions" toolbar button above
    //    the tab bar in the right pane. Its aria-label is
    //    "Open admin actions drawer". The drawer dialog announces as
    //    "Session admin actions".
    await page.getByRole("button", { name: /open admin actions drawer/i }).click();
    await expect(page.getByRole("dialog", { name: /session admin actions/i })).toBeVisible();

    // 9. Whisper textarea + submit. Placeholder text comes from
    //    AdminActionDrawer.tsx. The button label toggles
    //    "Send whisper" ↔ "Sender..." during submit.
    const whisperBox = page.getByPlaceholder(/Skriv en instruks/i);
    await whisperBox.fill("Brukeren mente tirsdag 29. april — ikke onsdag 30.");
    await page.getByRole("button", { name: "Send whisper" }).click();

    // 10. Success signal: drawer clears whisper text on 2xx response.
    //     A non-OK response pops window.alert instead — the textarea
    //     stays populated, and this assertion would time out, which is
    //     the correct failure mode.
    await expect(whisperBox).toHaveValue("", { timeout: 5_000 });
  });
});
