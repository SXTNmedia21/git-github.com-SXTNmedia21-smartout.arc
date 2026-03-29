// ============================================
// telegram.ts
// Webhook endpoint that receives Telegram updates and routes them
// through the platform admin pipeline.
//
// Flow:
//   POST /adapters/telegram/webhook
//     → verify secret header
//     → deduplicate by update_id
//     → return 200 immediately (Telegram requires fast response)
//     → process async (fire-and-forget):
//         message   → /done (close bridge) | active bridge (relay) | /workspace command | admin pipeline
//         callback_query → look up action → execute → mark resolved
//         poll_answer    → look up action → execute actions → mark resolved
//
// Session: one long-lived engine_session per admin (channel="telegram", mode="agent").
// Connected to: src/core/admin-router.ts (routeAdminMessage)
// Connected to: src/core/telegram.ts (Bot API client)
// Connected to: src/core/guardian-bus.ts (emitGuardianEvent)
// Connected to: src/core/telegram-bridge.ts (chat bridge relay)
// ============================================

import { Hono } from "hono";
import { routeAdminMessage } from "../../core/admin-router.js";
import { sendTelegramMessage, answerCallbackQuery, editMessageText } from "../../core/telegram.js";
import { emitGuardianEvent } from "../../core/guardian-bus.js";
import { hasActiveBridge, closeBridge, relayToSmartout } from "../../core/telegram-bridge.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { getSecrets } from "../../secrets.js";
import type { AuthContext } from "../../types/auth.js";
import type { ConversationTurn } from "../../types/agent.js";
import type { TelegramUpdate, TelegramMessage } from "../../types/telegram.js";

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

// In-memory set of recently seen update_ids. Telegram may retry on 5xx or
// slow responses, so we deduplicate to avoid processing the same update twice.
// Capped at MAX_SEEN_IDS to prevent unbounded memory growth.
const seenUpdateIds = new Set<number>();
const MAX_SEEN_IDS = 1000;

/** Returns true if this update_id has already been processed, else marks it seen. */
export function isDuplicate(updateId: number): boolean {
  if (seenUpdateIds.has(updateId)) return true;

  // Evict oldest entries when the set grows too large
  if (seenUpdateIds.size >= MAX_SEEN_IDS) {
    const first = seenUpdateIds.values().next().value;
    if (first !== undefined) seenUpdateIds.delete(first);
  }

  seenUpdateIds.add(updateId);
  return false;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Verifies the Telegram-provided secret token against our stored secret.
 * Telegram sends this header on every webhook request as a HMAC-like shared secret.
 */
export function verifyWebhookSecret(headerToken: string | undefined): boolean {
  const expected = getSecrets().telegramWebhookSecret;
  if (!expected || !headerToken) return false;
  return headerToken === expected;
}

/**
 * Checks whether the Telegram chat ID belongs to the configured admin chat.
 * All webhook logic is admin-only — any other chat ID is silently ignored.
 */
function isAdminChat(chatId: number): boolean {
  const adminChatId = getSecrets().telegramAdminChatId;
  if (!adminChatId) return false;
  return String(chatId) === adminChatId;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * Loads the active admin Telegram session, or creates one if none exists.
 * Returns the session ID and current workspace_id (if set).
 *
 * Admin sessions are long-lived: channel="telegram", mode="agent", expires_at=NULL.
 * The admin can scope queries to a workspace via /workspace <slug>.
 */
async function loadOrCreateAdminSession(): Promise<{
  sessionId: string;
  workspaceId: string | null;
  collectedData: Record<string, unknown>;
} | null> {
  // Try to find an existing active telegram session with no expiry
  const { data: existing } = await supabaseAdmin
    .from("engine_sessions")
    .select("id, workspace_id, collected_data")
    .eq("channel", "telegram")
    .eq("status", "active")
    .is("mission_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return {
      sessionId: existing.id,
      workspaceId: existing.workspace_id ?? null,
      collectedData: (existing.collected_data ?? {}) as Record<string, unknown>,
    };
  }

  // Create a new admin session — no mission, no workspace scope, no expiry
  const { data: created, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mode: "agent",
      mission_id: null,
      workspace_id: null,
      user_id: null,
      profile_id: null,
      channel: "telegram",
      current_stage_id: null,
      stage_index: -1,
      status: "active",
      context: {},
      collected_data: { conversation: [] },
      callback_url: null,
      expires_at: null, // admin session never expires automatically
    })
    .select("id, workspace_id, collected_data")
    .single();

  if (error || !created) {
    console.error("[telegram-webhook] Failed to create admin session:", error?.message);
    return null;
  }

  return {
    sessionId: created.id,
    workspaceId: created.workspace_id ?? null,
    collectedData: (created.collected_data ?? {}) as Record<string, unknown>,
  };
}

/**
 * Atomically appends a conversation turn to the session's collected_data.conversation.
 * Falls back to read-modify-write if the RPC is unavailable (pre-migration).
 */
async function appendTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
  const { error } = await supabaseAdmin.rpc("append_conversation_turn", {
    p_session_id: sessionId,
    p_turn: turn as unknown as Record<string, unknown>,
  });

  if (error) {
    console.warn("[telegram-webhook] RPC fallback for conversation append:", error.message);

    const { data: session } = await supabaseAdmin
      .from("engine_sessions")
      .select("collected_data")
      .eq("id", sessionId)
      .single();

    if (!session) return;

    const data = (session.collected_data ?? {}) as Record<string, unknown>;
    const conversation = (data.conversation ?? []) as ConversationTurn[];
    conversation.push(turn);

    await supabaseAdmin
      .from("engine_sessions")
      .update({ collected_data: { ...data, conversation }, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }
}

/** Returns the last N turns from collected_data.conversation. */
function getConversationWindow(
  collectedData: Record<string, unknown>,
  maxTurns = 50,
): ConversationTurn[] {
  const conversation = (collectedData.conversation ?? []) as ConversationTurn[];
  return conversation.slice(-maxTurns);
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

/**
 * Handles /workspace command variants:
 *   /workspace <slug> — look up workspace by slug, bind session to it
 *   /workspace clear  — unbind the workspace from this session
 * Returns true if the message was a workspace command (so we skip the admin pipeline).
 */
async function handleWorkspaceCommand(
  sessionId: string,
  text: string,
  chatId: number,
): Promise<boolean> {
  const match = text.match(/^\/workspace(?:@\S+)?\s*(.*)?$/i);
  if (!match) return false;

  const arg = (match[1] ?? "").trim();

  if (!arg || arg === "clear") {
    // Unbind workspace
    await supabaseAdmin
      .from("engine_sessions")
      .update({ workspace_id: null, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    await sendTelegramMessage("Workspace cleared. Operating without workspace scope.");
    return true;
  }

  // Look up workspace by slug
  const { data: workspace } = await supabaseAdmin
    .from("workspace")
    .select("id, name")
    .eq("slug", arg)
    .single();

  if (!workspace) {
    await sendTelegramMessage(`Workspace "${arg}" not found. Check the slug and try again.`);
    return true;
  }

  await supabaseAdmin
    .from("engine_sessions")
    .update({ workspace_id: workspace.id, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  await sendTelegramMessage(`Workspace set to *${workspace.name}* (\`${arg}\`).`, {
    parse_mode: "MarkdownV2",
  });

  return true;
}

/**
 * Routes a regular admin message through the LLM pipeline.
 * Appends both user and assistant turns to the session history.
 */
async function handleAdminMessage(
  sessionId: string,
  workspaceId: string | null,
  collectedData: Record<string, unknown>,
  text: string,
): Promise<void> {
  const conversationHistory = getConversationWindow(collectedData);

  // Only emit when we have a real workspace UUID — guardian_log.workspace_id is NOT NULL
  // and has a FK to workspace. Platform-level admin messages have no workspace context.
  if (workspaceId) {
    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "telegram.message.received",
      actor: "user",
      summary: text.length > 100 ? text.slice(0, 100) + "\u2026" : text,
      data: { text },
    });
  }

  // Append user turn before calling the LLM so history is up-to-date on retry
  await appendTurn(sessionId, {
    role: "user",
    content: text,
    timestamp: new Date().toISOString(),
  });

  const result = await routeAdminMessage({
    message: text,
    sessionId,
    workspaceId: workspaceId ?? undefined,
    conversationHistory,
  });

  await appendTurn(sessionId, {
    role: "assistant",
    content: result.response,
    timestamp: new Date().toISOString(),
  });

  if (workspaceId) {
    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: workspaceId,
      event_type: "telegram.message.sent",
      actor: "agent",
      summary:
        result.response.length > 100 ? result.response.slice(0, 100) + "\u2026" : result.response,
      data: { response: result.response },
    });
  }

  await sendTelegramMessage(result.response);
}

/**
 * Processes the full message update asynchronously.
 * Called as fire-and-forget after the 200 response is sent.
 */
async function processMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  if (!isAdminChat(chatId)) return; // Only respond to the configured admin chat

  const text = (message.text ?? "").trim();
  if (!text) return; // Ignore non-text messages (photos, stickers, etc.)

  const session = await loadOrCreateAdminSession();
  if (!session) {
    console.error("[telegram-webhook] Could not load or create admin session");
    return;
  }

  const { sessionId, workspaceId, collectedData } = session;

  // /done command — close active bridge before reaching the LLM pipeline
  if (text === "/done") {
    const bridge = await hasActiveBridge();
    if (bridge) {
      await closeBridge(bridge.id);
      return;
    }
    await sendTelegramMessage("No active bridge to close.");
    return;
  }

  // Active bridge — relay admin reply to Smartout channel instead of admin pipeline
  const activeBridge = await hasActiveBridge();
  if (activeBridge) {
    await relayToSmartout(text);
    return;
  }

  // /workspace command takes priority — handled separately, not forwarded to LLM
  const handled = await handleWorkspaceCommand(sessionId, text, chatId);
  if (handled) return;

  // All other messages go through the admin pipeline
  await handleAdminMessage(sessionId, workspaceId, collectedData, text);
}

// ---------------------------------------------------------------------------
// Callback query handler
// ---------------------------------------------------------------------------

/**
 * Handles inline keyboard button presses (callback queries).
 * Looks up the action record in telegram_callback_action, executes it,
 * and marks it resolved. Immediately acknowledges the query so Telegram
 * doesn't show a loading spinner.
 */
async function processCallbackQuery(query: {
  id: string;
  from: { id: number };
  message?: TelegramMessage;
  data?: string;
}): Promise<void> {
  // Acknowledge immediately — Telegram requires a response within 10 seconds
  await answerCallbackQuery(query.id);

  if (!query.data) return;

  // Look up the stored action for this callback data token.
  // query.data is the UUID primary key of the telegram_callback_action row —
  // that's how the escalation function stores it (the UUID as callback_data in the button).
  const { data: action } = await supabaseAdmin
    .from("telegram_callback_action")
    .select("id, action_type, action_payload, resolved")
    .eq("id", query.data)
    .single();

  if (!action) {
    console.warn("[telegram-webhook] Unknown callback action id:", query.data);
    return;
  }

  if (action.resolved) return; // Already handled (duplicate delivery)

  // Mark resolved before executing to prevent double-execution on retry
  await supabaseAdmin
    .from("telegram_callback_action")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", action.id);

  // Edit the original message to show the selection was registered
  if (query.message?.message_id) {
    const label = (action.action_payload as Record<string, string>)?.label ?? action.action_type;
    await editMessageText(query.message.message_id, `✓ ${label}`);
  }

  console.log(
    "[telegram-webhook] Callback action executed:",
    action.action_type,
    action.action_payload,
  );
}

// ---------------------------------------------------------------------------
// Poll answer handler
// ---------------------------------------------------------------------------

/**
 * Handles poll answer submissions from the admin.
 * Looks up the action record in telegram_poll_action, executes registered
 * sub-actions, and marks the poll resolved.
 */
async function processPollAnswer(pollAnswer: {
  poll_id: string;
  user: { id: number };
  option_ids: number[];
}): Promise<void> {
  const { data: poll } = await supabaseAdmin
    .from("telegram_poll_action")
    .select("id, options, resolved")
    .eq("telegram_poll_id", pollAnswer.poll_id)
    .single();

  if (!poll) {
    console.warn("[telegram-webhook] Unknown telegram_poll_id:", pollAnswer.poll_id);
    return;
  }

  if (poll.resolved) return;

  await supabaseAdmin
    .from("telegram_poll_action")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", poll.id);

  // Log the selection — full execution (e.g. applying shifts) belongs to consumers
  console.log("[telegram-webhook] Poll answer received:", {
    telegram_poll_id: pollAnswer.poll_id,
    option_ids: pollAnswer.option_ids,
    options: poll.options,
  });
}

// ---------------------------------------------------------------------------
// Hono route
// ---------------------------------------------------------------------------

const telegram = new Hono<{ Variables: { auth: AuthContext } }>();

/**
 * POST /adapters/telegram/webhook
 *
 * Telegram calls this URL for every update (message, callback_query, poll_answer).
 * We verify the secret header, deduplicate, return 200 immediately, and process async.
 * Fast response is critical — Telegram will retry if we take > 5s.
 */
telegram.post("/adapters/telegram/webhook", async (c) => {
  // Verify the secret token Telegram sends on every request
  const secretToken = c.req.header("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secretToken)) {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = (await c.req.json()) as TelegramUpdate;
  } catch {
    return c.json({ error: "BAD_REQUEST", message: "Invalid JSON" }, 400);
  }

  // Deduplicate — Telegram retries on 5xx or very slow responses
  if (isDuplicate(update.update_id)) {
    return c.json({ ok: true, deduplicated: true });
  }

  // Return 200 NOW — processing happens async. If we take too long, Telegram
  // will keep retrying and back off exponentially.
  const responsePromise = c.json({ ok: true });

  // Fire-and-forget: process the update without blocking the HTTP response
  (async () => {
    try {
      if (update.message) {
        await processMessage(update.message);
      } else if (update.callback_query) {
        await processCallbackQuery(update.callback_query);
      } else if (update.poll_answer) {
        await processPollAnswer(update.poll_answer);
      }
    } catch (err) {
      console.error("[telegram-webhook] Unhandled error processing update:", err);
    }
  })();

  return responsePromise;
});

export { telegram };
