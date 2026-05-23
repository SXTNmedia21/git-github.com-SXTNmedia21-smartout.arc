// =============================================================================
// tests/inline-confirm-card-send-message/helpers.ts
//
// Shared seed + assertion helpers for the three InlineConfirmCard Phase 2-a
// (send_message surface) specs.
//
// Seed responsibilities:
//   ensureSendMessageSeed()        — channel (department type) + channel_member + authority config.
//   seedForeignChannel()           — INSERT a channel in workspace W2 for tamper-defense test.
//   cleanupSendMessageMessages()   — delete channel_message rows created during the test run.
//   assertActivityTrailEvent()     — poll activity_trail for shown + a follow-up event.
//   assertNoChannelMessage()       — assert zero rows in channel_message for a proposal_id.
//   assertChannelMessage()         — poll channel_message for a row matching the proposal_id.
//   dumpLogsOnFailure()            — dump stage-engine logs for post-failure inspection.
//
// SEED IDs: deterministic UUIDs to guarantee idempotent test runs.
//   SEED_CHANNEL_ID  — W1 "Vakter" department channel (primary test channel)
//   SEED_CHANNEL_W1  — alias for clarity (same value as SEED_CHANNEL_ID)
//
// Schema notes (commit 436a31b0e):
//   - channel_message uses `content` (NOT `body`)
//   - channel_message uses `client_message_id` (UUID, UNIQUE index)
//   - channel uses `channel_type` enum ('department'|'direct'|'custom'|etc)
//   - is_direct column does NOT exist
//
// Telemetry note: inline_confirm_card.shown fires server-side; .cancelled fires
// browser-side via /api/telemetry proxy. activity_trail may lag up to 15s.
// All DB assertion helpers poll with configurable timeout.
//
// ADR refs: ADR-0134 (telemetry), ADR-0151 (server-derived workspace_id),
//           ADR-0398 (InlineConfirmCard HITL primitive),
//           ADR-0403 (send_message editable_fields whitelist),
//           L-0177 (silent-fallback ban).
// =============================================================================

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { supabase } from "../../helpers/seed";
import {
  SEED_WORKSPACE_ID,
  SEED_PROFILE_ID,
  dumpStageEngineLogs,
} from "../../helpers/botsson-harness";
import {
  ensureCommChannelAndMembership,
  ensureCommAuthoritySeeded,
  SEED_CHANNEL_ID,
} from "../../helpers/communication-harness";

export { SEED_WORKSPACE_ID, SEED_PROFILE_ID, SEED_CHANNEL_ID };

// ---------------------------------------------------------------------------
// Deterministic seed IDs — send_message surface (Phase 2-a)
// ---------------------------------------------------------------------------

/**
 * The primary W1 test channel — "Vakter", channel_type="department".
 * Aliased from SEED_CHANNEL_ID for readability in send_message specs.
 */
export const SEED_CHANNEL_W1 = SEED_CHANNEL_ID;

/**
 * Foreign W2 channel UUID — used exclusively in the tamper-defense spec.
 * This UUID must NOT exist in W1's workspace scope.
 * W2 workspace ID (foreign, not seeded in local dev):
 */
export const FOREIGN_WORKSPACE_ID = "ffffffff-0000-0000-0000-000000000002";
export const FOREIGN_CHANNEL_W2 = "c0ff0000-e2e0-0000-0000-000000000099";

// ---------------------------------------------------------------------------
// Seed / teardown
// ---------------------------------------------------------------------------

/**
 * Idempotent setup: ensures the test seed profile has:
 *   - A "Vakter" channel with membership (channel_type="department")
 *   - Authority config at 'suggest' level (exposes send_message to LLM)
 *
 * Reuses Phase 1's ensureCommChannelAndMembership helper (which inserts
 * SEED_CHANNEL_ID with channel_type='custom'). For send_message tests the
 * exact channel_type does not affect routing — "Gruppe" chip is shown for
 * any non-direct channel_type.
 *
 * Call in beforeAll.
 */
export async function ensureSendMessageSeed(): Promise<void> {
  await ensureCommChannelAndMembership(SEED_WORKSPACE_ID, SEED_PROFILE_ID);
  await ensureCommAuthoritySeeded(SEED_WORKSPACE_ID);
}

/**
 * Seed a foreign channel in workspace W2 for the tamper-defense spec.
 * Used to prove that cross-workspace channel_id is rejected by RLS.
 *
 * IMPORTANT: The foreign workspace (FOREIGN_WORKSPACE_ID) is NOT a real
 * workspace in local dev seed. The channel row is inserted via service-role
 * (bypasses RLS) to simulate W2 data that W1 admin cannot access.
 *
 * Returns the foreign channel_id (FOREIGN_CHANNEL_W2).
 */
export async function seedForeignChannel(): Promise<string> {
  const { error } = await supabase.from("channel").upsert(
    {
      id: FOREIGN_CHANNEL_W2,
      workspace_id: FOREIGN_WORKSPACE_ID,
      channel_type: "department",
      name: "Vakter-W2",
      description: "Foreign workspace channel — tamper-defense test only",
      is_archived: false,
      is_read_only: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    console.warn(
      `seedForeignChannel: channel upsert failed: ${error.message}. ` +
        "Tamper-defense test will still verify W1 isolation via RLS rejection.",
    );
  }

  return FOREIGN_CHANNEL_W2;
}

/**
 * Delete channel_message rows created in the seed channel since `sinceIso`.
 * Scoped to the seed channel to avoid disturbing other tests.
 * Safe to call in afterAll — no-ops if nothing was written.
 */
export async function cleanupSendMessageMessages(sinceIso: string): Promise<void> {
  await supabase
    .from("channel_message")
    .delete()
    .eq("channel_id", SEED_CHANNEL_ID)
    .gte("created_at", sinceIso);
}

// ---------------------------------------------------------------------------
// Activity trail polling
// ---------------------------------------------------------------------------

type PollOpts = { timeoutMs?: number; intervalMs?: number };

/**
 * Poll activity_trail for a row matching event_name + proposal_id.
 * Returns the matched row or throws with a descriptive message.
 *
 * proposalId="ANY" is a wildcard — matches any proposal_id in the window.
 * Used for soft-fallback paths where proposal_id is not yet extracted from DOM.
 */
export async function assertActivityTrailEvent(
  eventName: string,
  proposalId: string,
  sinceIso: string,
  opts: PollOpts & { workspaceId?: string; actorId?: string } = {},
): Promise<{ event_name: string; properties: unknown; actor_id: string; workspace_id: string }> {
  const { timeoutMs = 15_000, intervalMs = 600, workspaceId = SEED_WORKSPACE_ID, actorId } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("activity_trail")
      .select("event_name, properties, actor_id, workspace_id")
      .eq("event_name", eventName)
      .eq("workspace_id", workspaceId)
      .gte("occurred_at", sinceIso)
      .limit(10);

    const rows = data ?? [];

    const match = rows.find((r) => {
      const props = r.properties as Record<string, unknown>;
      // "ANY" is a wildcard — matches any proposal_id.
      const proposalMatch = proposalId === "ANY" ? true : props?.["proposal_id"] === proposalId;
      const actorMatch = actorId === undefined || r.actor_id === actorId;
      return proposalMatch && actorMatch;
    });

    if (match) return match;
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `assertActivityTrailEvent: no "${eventName}" row with proposal_id=${proposalId} ` +
      `within ${timeoutMs}ms after ${sinceIso}`,
  );
}

// ---------------------------------------------------------------------------
// channel_message assertions
// ---------------------------------------------------------------------------

/**
 * Assert ZERO rows in channel_message with client_message_id = proposalId.
 * Immediate read — no polling (absence is instant once the test action resolves).
 */
export async function assertNoChannelMessage(proposalId: string): Promise<void> {
  const { data, error } = await supabase
    .from("channel_message")
    .select("id")
    .eq("client_message_id", proposalId)
    .limit(5);

  expect(
    error,
    `assertNoChannelMessage: DB error querying channel_message: ${error?.message ?? "unknown"}`,
  ).toBeNull();
  expect(
    data ?? [],
    `assertNoChannelMessage: expected 0 rows with client_message_id=${proposalId}, ` +
      `found ${(data ?? []).length}. A send_message INSERT fired despite cancel action.`,
  ).toHaveLength(0);
}

/**
 * Assert ZERO rows in channel_message for a given workspace_id.
 * Used in cancel and tamper-defense specs to verify no commit occurred.
 * Scoped to sinceIso to avoid false positives from prior test data.
 */
export async function assertNoChannelMessageInWorkspace(
  workspaceId: string,
  sinceIso: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("channel_message")
    .select("id, workspace_id, client_message_id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", sinceIso)
    .limit(5);

  expect(
    error,
    `assertNoChannelMessageInWorkspace: DB error: ${error?.message ?? "unknown"}`,
  ).toBeNull();
  expect(
    data ?? [],
    `assertNoChannelMessageInWorkspace: expected 0 rows for workspace=${workspaceId} ` +
      `since ${sinceIso}, found ${(data ?? []).length}.`,
  ).toHaveLength(0);
}

/**
 * Poll channel_message for a row with client_message_id = proposalId.
 * Used after confirm action to verify the INSERT committed.
 * Returns the matched row.
 */
export async function assertChannelMessage(
  proposalId: string,
  opts: PollOpts & { expectedWorkspaceId?: string } = {},
): Promise<{ id: string; workspace_id: string; client_message_id: string; content: string }> {
  const { timeoutMs = 15_000, intervalMs = 600, expectedWorkspaceId = SEED_WORKSPACE_ID } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("channel_message")
      .select("id, workspace_id, client_message_id, content")
      .eq("client_message_id", proposalId)
      .limit(2);

    if (data && data.length > 0) {
      const row = data[0]!;
      expect(
        row.workspace_id,
        `assertChannelMessage: workspace_id mismatch — expected ${expectedWorkspaceId}, ` +
          `got ${row.workspace_id}. A cross-workspace write occurred (ADR-0151 violation).`,
      ).toBe(expectedWorkspaceId);
      return row;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `assertChannelMessage: no channel_message row with client_message_id=${proposalId} ` +
      `within ${timeoutMs}ms. send_message INSERT did not commit.`,
  );
}

// ---------------------------------------------------------------------------
// Log dump helper
// ---------------------------------------------------------------------------

export async function dumpLogsOnFailure(context: string): Promise<void> {
  try {
    const logs = await dumpStageEngineLogs();
    console.error(`[${context}] stage-engine logs:\n${logs}`);
  } catch {
    console.error(`[${context}] could not dump stage-engine logs`);
  }
}

// ---------------------------------------------------------------------------
// Navigation helper — reused across specs
// ---------------------------------------------------------------------------

/**
 * Navigate to the BotssonChat surface (admin arena).
 * Tries /dashboard/Botsson first, falls back to /Botsson playground route.
 * Returns the chat input locator once visible.
 */
export async function navigateToBotsson(page: Page): Promise<ReturnType<typeof page.locator>> {
  await page.goto("/dashboard/Botsson");
  await page.waitForLoadState("domcontentloaded");

  const chatInputEl = page.locator('textarea, [role="textbox"]').first();
  const chatInputVisible = await chatInputEl.isVisible({ timeout: 5000 }).catch(() => false);

  if (!chatInputVisible) {
    await page.goto("/Botsson");
    await page.waitForLoadState("domcontentloaded");
  }

  const input = page.locator('textarea, [role="textbox"]').first();
  await expect(input, "BotssonChat input must be visible").toBeVisible({ timeout: 10_000 });
  return input;
}
