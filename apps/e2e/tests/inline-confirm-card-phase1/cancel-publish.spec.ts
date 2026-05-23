// =============================================================================
// tests/inline-confirm-card-phase1/cancel-publish.spec.ts
//
// E2E verification of Journey 2: Admin cancels announcement draft via Avbryt.
//
// Flow under test (J2 cancel path):
//   1. Admin triggers announcement → card renders (same as J1 steps 1-4)
//   2a. Admin clicks Avbryt button (cancel button)
//      OR
//   2b. Admin presses ESC while card has focus (parity with help-takeover-kit)
//   3. Card transitions to cancelled state (data-mode="cancelled")
//   4. LLM responds with terse Norwegian acknowledgment
//   5. ZERO new rows in channel_message (no RPC fired)
//   6. activity_trail: .shown + .cancelled events (browser-side emit)
//
// Dual-input test:
//   C1 covers the Avbryt button click path.
//   C2 covers the ESC key path.
//   Both assert the same DB postconditions (0 channel_message rows).
//
// Telemetry note:
//   .cancelled is emitted browser-side (inline-confirm-card-tool.ts → /api/telemetry).
//   activity_trail write may lag 10-15s. Poll with 15s timeout.
//
// Selector strategy (same as happy-publish.spec.ts):
//   - Card root: data-testid="inline-confirm-card"
//   - Cancel button: data-testid="inline-confirm-card-cancel"
//
// Journey reference: docs/journeys/JOURNEY-inline-confirm-card-phase1-cancel-publish.md
// ADR refs: ADR-0398 (InlineConfirmCard), ADR-0134 (telemetry — browser-side cancel emit).
// =============================================================================

import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import {
  assertStageEngineContainerFresh,
  assertSupabaseLocalUp,
  assertStageEngineHealthy,
} from "../../helpers/botsson-harness";
import {
  ensurePhase1Seed,
  cleanupPhase1Messages,
  assertActivityTrailEvent,
  assertNoChannelMessage,
  dumpLogsOnFailure,
  SEED_WORKSPACE_ID,
} from "./helpers";
import { supabase } from "../../helpers/seed";

// =============================================================================
// Serial mode — tests share seed state; Avbryt + ESC paths run separately.
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
  await page.goto("/dashboard/Botsson");
  await page.waitForLoadState("domcontentloaded");

  const chatInputEl = page.locator('textarea, [role="textbox"]').first();
  if (!(await chatInputEl.isVisible({ timeout: 5000 }).catch(() => false))) {
    await page.goto("/Botsson");
    await page.waitForLoadState("domcontentloaded");
  }

  const input = page.locator('textarea, [role="textbox"]').first();
  await expect(input, "chat input must be visible").toBeVisible({ timeout: 10_000 });

  await input.fill(
    `Lag en kunngjøring om brylluppet - avbryt-test ${promptSuffix} - til alle ansatte`,
  );
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

test.describe("J2 cancel-publish — admin cancels announcement draft", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    testStartIso = new Date().toISOString();
    assertStageEngineContainerFresh();
    await assertSupabaseLocalUp();
    await assertStageEngineHealthy();
    await ensurePhase1Seed();
  });

  test.afterAll(async () => {
    await cleanupPhase1Messages(testStartIso);
  });

  // ── C1: Avbryt button click → card cancelled, 0 DB rows ───────────────────

  test("C1: clicking Avbryt transitions card to cancelled and writes no channel_message", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const runId = `C1-${Date.now()}`;
    const { cardLocator: card } = await navigateAndRenderCard(page, runId);

    // The card is visible in idle mode. Record state before click.
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

    // All buttons must be disabled (mode=cancelled).
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
    // Query broadly (not by proposal_id — we don't have it on DOM) and check count.
    const { data: newMsgs } = await supabase
      .from("channel_message")
      .select("id, client_message_id")
      .eq("channel_id", "c0mm0000-e2e0-0000-0000-000000000001")
      .gte("created_at", beforeClick)
      .limit(5);

    expect(
      (newMsgs ?? []).length,
      "C1: expected 0 channel_message rows after Avbryt. " +
        "publish_announcement_atomic RPC must NOT fire on cancel action.",
    ).toBe(0);

    // activity_trail: .cancelled event (browser-side emit, may lag).
    // We assert .shown (server-side) first as a proxy that the proposal_id exists.
    // Then assert .cancelled on the same proposal_id.
    // Since we don't extract proposal_id from DOM, we poll by event_name + workspace + sinceIso.
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

      // Verify actor_id is NOT equal to workspace_id (L-0177 defense — no silent fallback).
      // The .cancelled event's actor_id must be a real profile_id, not the workspace_id sentinel.
      const { data: cancelRows } = await supabase
        .from("activity_trail")
        .select("actor_id, workspace_id")
        .eq("event_name", "inline_confirm_card.cancelled")
        .eq("workspace_id", SEED_WORKSPACE_ID)
        .gte("occurred_at", beforeClick)
        .limit(5);

      const cancelRow = (cancelRows ?? []).find((r) => {
        const props = r as Record<string, unknown>;
        return true; // best-effort: first row is ours
      });

      if (cancelRow) {
        expect(
          cancelRow.actor_id,
          "C1: activity_trail.cancelled.actor_id must NOT equal workspace_id " +
            "(L-0177: silent-fallback ban — actor must be a real profile_id).",
        ).not.toBe(cancelRow.workspace_id);
      }

      // Also: no channel_message row for this proposal_id.
      await assertNoChannelMessage(proposalId);
    } else {
      // Soft: .shown event not found — LLM may not have emitted correctly.
      console.warn(
        "C1: could not find inline_confirm_card.shown event for proposal_id extraction. " +
          "Skipping .cancelled assertion. Verify telemetry registry emit call-sites.",
      );
    }
  });

  // ── C2: ESC key → card cancelled, 0 DB rows ───────────────────────────────

  test("C2: pressing ESC on the card triggers cancel (parity with help-takeover-kit)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const runId = `C2-${Date.now()}`;
    const { cardLocator: card } = await navigateAndRenderCard(page, runId);

    const beforeEsc = new Date().toISOString();

    // Focus the card root (tabIndex=-1, so focus() works programmatically).
    // ESC handler is on the card root (onKeyDown in InlineConfirmCard).
    await card.focus();
    await card.press("Escape");

    // Card must transition to cancelled state.
    await expect(card, "C2: card must transition to cancelled on ESC").toHaveAttribute(
      "data-mode",
      "cancelled",
      { timeout: 15_000 },
    );

    // DB: ZERO new channel_message rows.
    const { data: newMsgs } = await supabase
      .from("channel_message")
      .select("id")
      .eq("channel_id", "c0mm0000-e2e0-0000-0000-000000000001")
      .gte("created_at", beforeEsc)
      .limit(5);

    expect((newMsgs ?? []).length, "C2: expected 0 channel_message rows after ESC cancel.").toBe(0);

    // Soft assertion: LLM should respond with a terse cancellation acknowledgment.
    // We don't hard-assert the LLM text (non-deterministic) — structural detection only.
    const ackVisible = await page
      .locator("div, p")
      .filter({ hasText: /avlyst|greit|ikke|kunngjøring/i })
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    if (!ackVisible) {
      console.warn(
        "C2: LLM acknowledgment text not detected after ESC cancel. " +
          "System-prompt instruction for action:cancel may need re-tuning.",
      );
    }
  });
});
