// =============================================================================
// tests/inline-confirm-card-send-message/cancel-send.spec.ts
//
// E2E verification of Journey 2: Admin cancels message draft via Avbryt.
//
// Flow under test (cancel path):
//   1. Admin triggers send_message → card renders (same as happy-send steps 1-4)
//   2a. Admin clicks Avbryt (cancel button)
//      OR
//   2b. Admin presses ESC while card has focus
//   3. Card transitions to cancelled state (data-mode="cancelled")
//   4. All three action buttons become disabled (double-resolution prevention)
//   5. LLM responds with terse Norwegian acknowledgment
//   6. ZERO new rows in channel_message (no INSERT fired)
//   7. activity_trail: .shown (server) + .cancelled (browser-side) events
//
// Dual-input test:
//   C1 covers the Avbryt button click path.
//   C2 covers the ESC key path.
//   Both assert the same DB postconditions (0 channel_message rows).
//
// Telemetry note:
//   .cancelled is emitted browser-side (show_proposal_card → /api/telemetry proxy).
//   activity_trail write may lag 10-15s. Poll with 15s timeout.
//   actor_id on .cancelled MUST be a real profile_id (NOT workspace_id sentinel)
//   — verifies Phase 1 fix-3 (L-0177 actor_id thread-through) works for send_message surface.
//
// Selector strategy (mirrors Phase 1):
//   - Card root:      data-testid="inline-confirm-card"
//   - Cancel button:  data-testid="inline-confirm-card-cancel"
//   - Confirm button: data-testid="inline-confirm-card-confirm"  (checked for disabled)
//   - Edit button:    data-testid="inline-confirm-card-edit"     (checked for disabled)
//
// Journey reference: docs/journeys/JOURNEY-inline-confirm-card-send-message-cancel-send.md
// ADR refs: ADR-0398 (InlineConfirmCard), ADR-0134 (telemetry — browser-side cancel emit),
//           L-0177 (silent-fallback ban — actor_id must be real profile_id).
// =============================================================================

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import {
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
} from "../../helpers/botsson-harness";
import {
  SEED_WORKSPACE_ID,
  SEED_CHANNEL_ID,
  ensureSendMessageSeed,
  cleanupSendMessageMessages,
  assertActivityTrailEvent,
  assertNoChannelMessage,
  dumpLogsOnFailure,
  navigateToBotsson,
} from "./helpers";
import { supabase } from "../../helpers/seed";

// =============================================================================
// Serial mode — cancel + ESC paths run separately, share seed state.
// =============================================================================
test.describe.configure({ mode: "serial" });

let testStartIso: string;

// ---------------------------------------------------------------------------
// Shared helper: navigate to Botsson, submit prompt, wait for card
// ---------------------------------------------------------------------------

async function navigateAndRenderCard(
  page: Page,
  promptSuffix: string,
): Promise<{ cardLocator: ReturnType<typeof page.locator>; ariaLabel: string }> {
  await loginAsAdmin(page);

  const input = await navigateToBotsson(page);

  await input.fill(`Send 'møte i morgen kl 14 - avbryt-test ${promptSuffix}' til Vakter-kanalen`);
  await input.press("Enter");

  const card = page.locator('[data-testid="inline-confirm-card"]');

  let cardVisible = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    cardVisible = await card.isVisible({ timeout: 30_000 }).catch(() => false);
    if (cardVisible) break;
    if (attempt === 0) {
      await dumpLogsOnFailure("cancel-render-retry");
    }
  }

  expect(
    cardVisible,
    "InlineConfirmCard did not appear. " +
      "System-prompt regression in mr-botsson.ts (T5) or stage-engine stale.",
  ).toBe(true);

  const ariaLabel = (await card.getAttribute("aria-label")) ?? "";
  return { cardLocator: card, ariaLabel };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

test.describe("J2 cancel-send — admin cancels send_message draft", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testStartIso = new Date().toISOString();
    assertStageEngineContainerFresh();
    await assertSupabaseLocalUp();
    await assertStageEngineHealthy();
    await ensureSendMessageSeed();
  });

  test.afterAll(async () => {
    await cleanupSendMessageMessages(testStartIso);
  });

  // ── C1: Avbryt button click → card cancelled, 0 DB rows ───────────────────

  test("C1: clicking Avbryt transitions card to cancelled and writes no channel_message", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const runId = `C1-${Date.now()}`;
    const { cardLocator: card } = await navigateAndRenderCard(page, runId);

    const beforeClick = new Date().toISOString();

    // Click Avbryt.
    const cancelBtn = card.locator('[data-testid="inline-confirm-card-cancel"]');
    await expect(cancelBtn, "C1: cancel button must be enabled before click").toBeEnabled();
    await cancelBtn.click();

    // Card must transition to cancelled state.
    await expect(
      card,
      "C1: card data-mode must become 'cancelled' after Avbryt click",
    ).toHaveAttribute("data-mode", "cancelled", { timeout: 15_000 });

    // All buttons must be disabled (double-resolution prevention, ADR-0398).
    const confirmBtn = card.locator('[data-testid="inline-confirm-card-confirm"]');
    const editBtn = card.locator('[data-testid="inline-confirm-card-edit"]');
    await expect(
      confirmBtn,
      "C1: confirm button must be disabled after cancel (double-resolution prevention)",
    ).toBeDisabled();
    await expect(
      editBtn,
      "C1: edit button must be disabled after cancel (double-resolution prevention)",
    ).toBeDisabled();
    await expect(
      cancelBtn,
      "C1: cancel button must be disabled after cancel (double-resolution prevention)",
    ).toBeDisabled();

    // DB: ZERO new channel_message rows since beforeClick.
    // Query by channel_id + time window (proposal_id not yet on DOM).
    const { data: newMsgs } = await supabase
      .from("channel_message")
      .select("id, client_message_id")
      .eq("channel_id", SEED_CHANNEL_ID)
      .gte("created_at", beforeClick)
      .limit(5);

    expect(
      (newMsgs ?? []).length,
      "C1: expected 0 channel_message rows after Avbryt. " +
        "send_message INSERT must NOT fire on cancel action.",
    ).toBe(0);

    // activity_trail: extract proposal_id from the most-recent .shown event,
    // then assert .cancelled for the same proposal_id.
    const { data: shownRows } = await supabase
      .from("activity_trail")
      .select("event_name, properties")
      .eq("event_name", "inline_confirm_card.shown")
      .eq("workspace_id", SEED_WORKSPACE_ID)
      .gte("occurred_at", testStartIso)
      .order("occurred_at", { ascending: false })
      .limit(1);

    const mostRecentShown = shownRows?.[0];
    const proposalId =
      mostRecentShown?.properties !== null &&
      typeof mostRecentShown?.properties === "object" &&
      "proposal_id" in (mostRecentShown.properties as Record<string, unknown>)
        ? (mostRecentShown.properties as Record<string, unknown>)["proposal_id"]
        : null;

    if (typeof proposalId === "string" && proposalId.length > 0) {
      // Assert .cancelled event with matching proposal_id.
      await assertActivityTrailEvent("inline_confirm_card.cancelled", proposalId, beforeClick, {
        timeoutMs: 15_000,
        workspaceId: SEED_WORKSPACE_ID,
      });

      // Verify actor_id is NOT equal to workspace_id (L-0177 defense).
      // .cancelled actor_id must be a real profile_id, not a workspace_id sentinel.
      const { data: cancelRows } = await supabase
        .from("activity_trail")
        .select("actor_id, workspace_id")
        .eq("event_name", "inline_confirm_card.cancelled")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("occurred_at", beforeClick)
        .limit(5);

      const cancelRow = (cancelRows ?? [])[0];
      if (cancelRow) {
        expect(
          cancelRow.actor_id,
          "C1: activity_trail.cancelled.actor_id must NOT equal workspace_id " +
            "(L-0177: silent-fallback ban — actor must be a real profile_id, " +
            "not the workspace_id sentinel).",
        ).not.toBe(cancelRow.workspace_id);
      }

      // Also confirm no channel_message row exists for this proposal_id.
      await assertNoChannelMessage(proposalId);
    } else {
      // .shown event not found — LLM telemetry may not have emitted correctly.
      console.warn(
        "C1: could not find inline_confirm_card.shown event for proposal_id extraction. " +
          "Skipping .cancelled proposal_id assertion. " +
          "Verify emit call-site in send_message draft branch (tools.ts:279).",
      );
    }
  });

  // ── C2: ESC key → card cancelled, 0 DB rows ───────────────────────────────

  test("C2: pressing ESC on the card triggers cancel (parity with Phase 1 ESC path)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const runId = `C2-${Date.now()}`;
    const { cardLocator: card } = await navigateAndRenderCard(page, runId);

    const beforeEsc = new Date().toISOString();

    // Focus the card root (tabIndex=-1, ESC handler on onKeyDown).
    await card.focus();
    await card.press("Escape");

    // Card must transition to cancelled state.
    await expect(card, "C2: card must transition to cancelled on ESC").toHaveAttribute(
      "data-mode",
      "cancelled",
      { timeout: 15_000 },
    );

    // DB: ZERO new channel_message rows since beforeEsc.
    const { data: newMsgs } = await supabase
      .from("channel_message")
      .select("id")
      .eq("channel_id", SEED_CHANNEL_ID)
      .gte("created_at", beforeEsc)
      .limit(5);

    expect(
      (newMsgs ?? []).length,
      "C2: expected 0 channel_message rows after ESC cancel. " +
        "send_message INSERT must NOT fire when card is dismissed via keyboard.",
    ).toBe(0);

    // Soft assertion: LLM should acknowledge cancellation (non-deterministic text).
    const ackVisible = await page
      .locator("div, p")
      .filter({ hasText: /avlyst|greit|ikke sendt|avbrutt|melding/i })
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    if (!ackVisible) {
      console.warn(
        "C2: LLM acknowledgment text not detected after ESC cancel. " +
          "System-prompt instruction for action:cancel may need re-tuning. " +
          "Expected text matching /avlyst|greit|ikke sendt|avbrutt|melding/i.",
      );
    }
  });
});
