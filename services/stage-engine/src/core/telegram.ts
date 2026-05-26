// ============================================
// telegram.ts
// Plain HTTP client for the Telegram Bot API using fetch().
// No external dependencies — all calls go directly to api.telegram.org.
// Connected to: src/routes/adapters/telegram.ts (webhook handler),
//               src/core/agent-router.ts (escalation dispatch)
// ============================================

import { emit } from "@smartout/telemetry";
import { getSecrets } from "../secrets.js";
import type {
  TelegramApiResponse,
  TelegramMessage,
  SendMessageOptions,
} from "../types/telegram.js";

// Telegram's hard limit on message text length
const TELEGRAM_MAX_LENGTH = 4096;

// All characters that must be escaped in MarkdownV2 mode
const MARKDOWN_V2_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

/** Action button for escalation messages */
export type EscalationAction = {
  label: string;
  callbackData: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes all MarkdownV2 special characters in a string so it can be safely
 * embedded in a MarkdownV2 message without breaking formatting.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL_CHARS, "\\$&");
}

/**
 * Derives the bot token from pre-loaded secrets. Throws with a clear message
 * if the token is missing — callers should handle this gracefully.
 */
function getBotToken(): string {
  const token = getSecrets().telegramBotToken;
  if (!token) throw new Error("[telegram] Bot token not configured");
  return token;
}

/**
 * Returns the admin chat ID from pre-loaded secrets. Throws if missing.
 */
function getAdminChatId(): string {
  const chatId = getSecrets().telegramAdminChatId;
  if (!chatId) throw new Error("[telegram] Admin chat ID not configured");
  return chatId;
}

/**
 * Generic Telegram Bot API caller.
 * POSTs to https://api.telegram.org/bot{token}/{method} with a JSON body.
 * Logs errors but never throws — returns the parsed API response including
 * error details so callers can decide how to surface failures.
 *
 * @param method - Telegram API method name (e.g. "sendMessage")
 * @param body   - Request payload (will be JSON-serialized)
 * @returns      Parsed TelegramApiResponse, or a synthetic error object on
 *               network/parse failure.
 */
async function callApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TelegramApiResponse<T>;

    if (!data.ok) {
      console.error(`[telegram] ${method} failed: ${data.description ?? "unknown error"}`);
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    console.error(`[telegram] ${method} threw: ${message}`);
    return { ok: false, description: message };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a text message to the admin Telegram chat.
 * Automatically splits messages that exceed 4096 characters into sequential
 * chunks — Telegram rejects messages longer than this limit.
 *
 * @param text     - Message text to send
 * @param options  - Optional overrides: parse_mode, reply_markup
 * @returns        Response from the LAST chunk sent (or the single response
 *                 for short messages). Useful for grabbing the message_id.
 */
export async function sendTelegramMessage(
  text: string,
  options?: Partial<Omit<SendMessageOptions, "chat_id" | "text">>,
): Promise<TelegramApiResponse<TelegramMessage>> {
  const chatId = getAdminChatId();

  // Split into 4096-char chunks if the text is too long
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += TELEGRAM_MAX_LENGTH) {
    chunks.push(text.slice(offset, offset + TELEGRAM_MAX_LENGTH));
  }

  let lastResponse: TelegramApiResponse<TelegramMessage> = { ok: false, description: "no chunks" };

  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
      ...options,
    };

    lastResponse = await callApi<TelegramMessage>("sendMessage", body);
  }

  // Telemetry: admin Telegram message sent — workspace_id + actor_id are null
  // because this is the platform-admin channel (no per-workspace context at this layer).
  // Fire-and-forget: telemetry failure must never break the primary Telegram path.
  void emit({
    event: "telegram message_sent",
    workspace_id: null,
    actor_id: null,
    properties: { data: { text: text.slice(0, 200) } },
  }).catch(() => {
    // Telemetry must never throw into the primary path.
  });

  return lastResponse;
}

/**
 * Sends a poll to the admin Telegram chat.
 *
 * @param question       - Poll question (max 300 chars per Telegram limits)
 * @param optionLabels   - Array of option strings (2–10 options)
 * @param allowsMultiple - Whether the voter can select multiple answers
 */
export async function sendTelegramPoll(
  question: string,
  optionLabels: string[],
  allowsMultiple = false,
): Promise<TelegramApiResponse> {
  const chatId = getAdminChatId();

  return callApi("sendPoll", {
    chat_id: chatId,
    question,
    options: optionLabels,
    is_anonymous: false,
    allows_multiple_answers: allowsMultiple,
  });
}

/**
 * Answers an inline keyboard callback query.
 * Must be called within 10 seconds of receiving the update or Telegram will
 * show a timeout indicator to the user.
 *
 * @param callbackQueryId - The callback_query.id from the incoming update
 * @param text            - Optional toast text shown to the user (up to 200 chars)
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<TelegramApiResponse> {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text !== undefined) body.text = text;

  return callApi("answerCallbackQuery", body);
}

/**
 * Edits the text of a previously sent message in the admin chat.
 * Useful for updating status messages without spamming new ones.
 *
 * @param messageId - The message_id of the message to edit
 * @param text      - New text content
 * @param parseMode - Optional parse mode for the new text
 */
export async function editMessageText(
  messageId: number,
  text: string,
  parseMode?: "MarkdownV2" | "HTML",
): Promise<TelegramApiResponse> {
  const chatId = getAdminChatId();

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };

  if (parseMode !== undefined) body.parse_mode = parseMode;

  return callApi("editMessageText", body);
}

/**
 * Registers a webhook URL with Telegram.
 * Telegram will POST all updates to this URL until it is changed or deleted.
 * Call this once at startup or whenever the deployment URL changes.
 *
 * @param url - The HTTPS URL Telegram should POST updates to
 */
export async function registerWebhook(url: string): Promise<TelegramApiResponse> {
  return callApi("setWebhook", { url });
}

/**
 * Sends a structured escalation message with inline action buttons to the
 * admin chat. Used by the guardian system to surface critical events that
 * require a human decision.
 *
 * @param title    - Short headline for the escalation (e.g. "Shift gap detected")
 * @param body     - Detailed description of what happened and why it matters
 * @param severity - "low" | "medium" | "high" | "critical" — surfaced in the text
 * @param actions  - Inline keyboard buttons the admin can tap to respond
 */
export async function sendTelegramEscalation(
  title: string,
  body: string,
  severity: "low" | "medium" | "high" | "critical",
  actions: EscalationAction[],
): Promise<TelegramApiResponse<TelegramMessage>> {
  const severityIcon: Record<string, string> = {
    low: "ℹ️",
    medium: "⚠️",
    high: "🔴",
    critical: "🚨",
  };

  const icon = severityIcon[severity] ?? "⚠️";
  const text = `${icon} *${escapeMarkdownV2(title)}*\n\n${escapeMarkdownV2(body)}`;

  // Build one button per action, each in its own row for readability
  const inlineKeyboard = actions.map((action) => [
    { text: action.label, callback_data: action.callbackData },
  ]);

  return sendTelegramMessage(text, {
    parse_mode: "MarkdownV2",
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}
