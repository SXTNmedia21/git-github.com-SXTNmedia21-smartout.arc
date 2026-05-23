// =============================================================================
// tests/inline-confirm-card-phase1/helpers.ts
//
// Shared seed + assertion helpers for the three InlineConfirmCard Phase 1 specs.
//
// Seed responsibilities:
//   ensurePhase1Seed()         — channel + channel_member + authority config.
//   cleanupPhase1Seed()        — delete channel_message rows seeded by tests.
//   assertActivityTrailPair()  — poll activity_trail for shown + a follow-up event.
//   assertNoChannelMessage()   — assert zero rows in channel_message for a proposal_id.
//   assertChannelMessage()     — poll channel_message for a row matching the proposal_id.
//   resolveSessionId()         — derive sessionId from BFF body or DB fallback.
//   postBotssonChat()          — low-level BFF call (no client-tool roundtrip).
//   dumpLogsOnFailure()        — dump stage-engine logs for post-failure inspection.
//
// SEED IDs: we reuse the communication-harness SEED_CHANNEL_ID so the existing
//   channel + member row is available without double-seeding.
//
// Telemetry note: inline_confirm_card.shown fires server-side; .cancelled fires
// browser-side via /api/telemetry proxy. activity_trail may lag up to 15s.
// All DB assertion helpers poll with configurable timeout.
//
// ADR refs: ADR-0134 (telemetry), ADR-0151 (server-derived workspace_id),
//           ADR-0398 (InlineConfirmCard HITL primitive), L-0177 (silent-fallback ban).
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
// Seed / teardown
// ---------------------------------------------------------------------------

/**
 * Idempotent setup: ensures the test seed profile has:
 *   - A news channel with membership (ensureCommChannelAndMembership)
 *   - Authority config at 'suggest' level (ensureCommAuthoritySeeded)
 *
 * Call in beforeAll.
 */
export async function ensurePhase1Seed(): Promise<void> {
  await ensureCommChannelAndMembership(SEED_WORKSPACE_ID, SEED_PROFILE_ID);
  await ensureCommAuthoritySeeded(SEED_WORKSPACE_ID);
}

/**
 * Delete channel_message rows for the seed channel created during the test run.
 * Scoped to rows created since `sinceIso` to avoid disrupting other tests.
 * Safe to call in afterAll — no-ops if nothing was written.
 */
export async function cleanupPhase1Messages(sinceIso: string): Promise<void> {
  await supabase
    .from("channel_message")
    .delete()
    .eq("channel_id", SEED_CHANNEL_ID)
    .gte("created_at", sinceIso);
}

// ---------------------------------------------------------------------------
// BFF helpers
// ---------------------------------------------------------------------------

/**
 * POST a single turn to /api/botsson/chat.
 * Does NOT handle client_tool_calls — returns raw JSON body.
 * For roundtrips, call the UI chat form directly (page interaction).
 */
export async function postBotssonChat(
  page: Page,
  payload: {
    userMessage?: string;
    client_tool_results?: Array<{ tool_call_id: string; result: string; is_error?: boolean }>;
    sessionId?: string;
    workspaceId?: string;
    channelId?: string;
  },
): Promise<{
  text?: string;
  sessionId?: string;
  client_tool_calls?: Array<{ name: string; tool_call_id: string; arguments: unknown }>;
  error?: string;
}> {
  const res = await page.request.post("/api/botsson/chat", {
    data: {
      workspaceId: payload.workspaceId ?? SEED_WORKSPACE_ID,
      ...(payload.userMessage !== undefined && { userMessage: payload.userMessage }),
      ...(payload.client_tool_results !== undefined && {
        client_tool_results: payload.client_tool_results,
      }),
      ...(payload.sessionId !== undefined && { sessionId: payload.sessionId }),
      ...(payload.channelId !== undefined && { channelId: payload.channelId }),
    },
    headers: { "content-type": "application/json" },
  });

  if (!res.ok()) {
    const raw = await res.text().catch(() => "");
    throw new Error(`/api/botsson/chat ${res.status()}: ${raw.slice(0, 300)}`);
  }

  return res.json() as Promise<{
    text?: string;
    sessionId?: string;
    client_tool_calls?: Array<{ name: string; tool_call_id: string; arguments: unknown }>;
    error?: string;
  }>;
}

/**
 * Resolve sessionId from BFF body or DB fallback.
 * Matches the pattern in botsson-harness-e2e.spec.ts.
 */
export async function resolveSessionId(
  bffBody: { sessionId?: string },
  sinceIso: string,
): Promise<string | null> {
  if (bffBody.sessionId) return bffBody.sessionId;

  const { data } = await supabase
    .from("engine_sessions")
    .select("id")
    .eq("profile_id", SEED_PROFILE_ID)
    .eq("workspace_id", SEED_WORKSPACE_ID)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Activity trail polling
// ---------------------------------------------------------------------------

type PollOpts = { timeoutMs?: number; intervalMs?: number };

/**
 * Poll activity_trail for a row matching event_name + proposal_id.
 * Returns the matched row or throws with a descriptive message.
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
    const query = supabase
      .from("activity_trail")
      .select("event_name, properties, actor_id, workspace_id")
      .eq("event_name", eventName)
      .eq("workspace_id", workspaceId)
      .gte("occurred_at", sinceIso)
      .limit(10);

    const { data } = await query;
    const rows = data ?? [];

    const match = rows.find((r) => {
      const props = r.properties as Record<string, unknown>;
      // "ANY" is a wildcard — matches any proposal_id. Used by soft-fallback
      // paths in tests where the exact proposal_id is not yet known (T9/F4).
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
      `found ${(data ?? []).length}. A publish_announcement RPC fired despite cancel action.`,
  ).toHaveLength(0);
}

/**
 * Poll channel_message for a row with client_message_id = proposalId.
 * Used after confirm action to verify the RPC commit succeeded.
 * Returns the matched row.
 */
export async function assertChannelMessage(
  proposalId: string,
  opts: PollOpts & { expectedWorkspaceId?: string } = {},
): Promise<{ id: string; workspace_id: string; client_message_id: string }> {
  const { timeoutMs = 15_000, intervalMs = 600, expectedWorkspaceId = SEED_WORKSPACE_ID } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await supabase
      .from("channel_message")
      .select("id, workspace_id, client_message_id")
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
      `within ${timeoutMs}ms. Publish RPC did not commit.`,
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
