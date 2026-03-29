---
title: Telegram WalkAi Adapter Implementation Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: stage-engine
tags: [telegram, walkai, adapter, implementation]
---

# Telegram WalkAi Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect platform admin (Pontus) to WalkAi/Mr. Botsson via Telegram for event notifications, escalations, decision resolution, polls, and employee chat bridging.

**Architecture:** Telegram webhook → Stage Engine adapter route → `routeAdminMessage()` (new lightweight admin pipeline, no workspace scope) → LLM with admin tools → Telegram Bot API response. Chat bridge uses PG NOTIFY for message relay. All outbound functions are plain TypeScript (not AI capabilities).

**Tech Stack:** Hono routes, Telegram Bot API (plain fetch), Supabase (engine_sessions, PG NOTIFY), OpenRouter LLM, Zod validation

**Spec:** `docs/superpowers/specs/2026-03-28-telegram-walkai-adapter-design.md`

---

## File Structure

### New Files

| File                                                           | Responsibility                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `services/stage-engine/src/routes/adapters/telegram.ts`        | Webhook handler: signature verification, update routing, auth bypass, message/callback/poll dispatch                            |
| `services/stage-engine/src/core/telegram.ts`                   | Telegram Bot API client: sendMessage, sendPoll, answerCallbackQuery, setWebhook + message formatting (Markdown → MarkdownV2)    |
| `services/stage-engine/src/core/admin-router.ts`               | `routeAdminMessage()`: lightweight admin pipeline — no workspace scope, god-mode authority, admin tool set, admin system prompt |
| `services/stage-engine/src/core/telegram-bridge.ts`            | Chat bridge lifecycle: open/close bridge, PG NOTIFY listener, message relay in both directions                                  |
| `services/stage-engine/src/types/telegram.ts`                  | Telegram API types: TelegramUpdate, TelegramMessage, TelegramCallbackQuery, TelegramPollAnswer, inline keyboard types           |
| `supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql`      | Channel constraint update + 3 tables (telegram_chat_bridge, telegram_poll_action, telegram_callback_action) + PG NOTIFY trigger |
| `services/stage-engine/src/__tests__/telegram-webhook.test.ts` | Unit tests for webhook verification, update routing, session management                                                         |
| `services/stage-engine/src/__tests__/admin-router.test.ts`     | Unit tests for admin pipeline                                                                                                   |
| `services/stage-engine/src/__tests__/telegram-bridge.test.ts`  | Unit tests for chat bridge lifecycle                                                                                            |

### Modified Files

| File                                         | Change                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `services/stage-engine/src/index.ts`         | Import + mount telegram routes, add auth middleware bypass, add PG NOTIFY listener setup   |
| `services/stage-engine/src/types/session.ts` | Add `'telegram'` to `SessionChannel` union                                                 |
| `services/stage-engine/src/types/agent.ts`   | Add `'telegram'` to `AgentChatRequest.channel`                                             |
| `services/stage-engine/src/secrets.ts`       | Add `telegramBotToken` + `telegramWebhookSecret` + `telegramAdminChatId` to ServiceSecrets |
| `packages/telemetry/src/registry.ts`         | Add 10 Telegram event interfaces + SmartoutEvent union entries + EVENT_ROUTING entries     |
| `.env.template`                              | Add 3 Telegram env vars                                                                    |

---

## Task 1: Database Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Telegram WalkAi Adapter — admin command & control bot
-- Adds 'telegram' channel, chat bridge state, poll action mapping, callback action lookup

-- 1. Expand engine_sessions channel constraint to include 'telegram'
ALTER TABLE engine_sessions DROP CONSTRAINT engine_sessions_channel_check;
ALTER TABLE engine_sessions ADD CONSTRAINT engine_sessions_channel_check
  CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous', 'telegram'));

-- 2. Chat bridge state — tracks active Telegram↔Smartout chat bridges
CREATE TABLE telegram_chat_bridge (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  channel_id       UUID NOT NULL REFERENCES channel(id),
  telegram_chat_id BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

-- Deny-all RLS (service_role only — platform admin infrastructure)
ALTER TABLE telegram_chat_bridge ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_chat_bridge
  BEFORE UPDATE ON telegram_chat_bridge
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Poll action mapping — stores poll option→action mappings until answered
CREATE TABLE telegram_poll_action (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_poll_id TEXT NOT NULL UNIQUE,
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  options          JSONB NOT NULL,  -- [{index, label, action_type, action_payload}]
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE telegram_poll_action ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_poll_action
  BEFORE UPDATE ON telegram_poll_action
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Callback action lookup — stores inline button actions (64-byte callback_data limit)
CREATE TABLE telegram_callback_action (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type      TEXT NOT NULL,
  action_payload   JSONB NOT NULL,
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE telegram_callback_action ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_callback_action
  BEFORE UPDATE ON telegram_callback_action
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Bridge relay trigger — PG NOTIFY on new channel_message for active bridges
CREATE OR REPLACE FUNCTION notify_telegram_bridge()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('telegram_bridge', json_build_object(
    'channel_id', NEW.channel_id,
    'sender_profile_id', NEW.sender_profile_id,
    'content', NEW.content,
    'id', NEW.id
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_telegram_bridge
  AFTER INSERT ON channel_message
  FOR EACH ROW EXECUTE FUNCTION notify_telegram_bridge();
```

- [ ] **Step 2: Run the migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql
```

Expected: All statements execute without error.

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add telegram adapter tables and channel constraint

Add telegram_chat_bridge, telegram_poll_action, telegram_callback_action.
Expand engine_sessions channel CHECK to include 'telegram'.
Add PG NOTIFY trigger on channel_message for bridge relay.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TypeScript Types

**Files:**

- Create: `services/stage-engine/src/types/telegram.ts`
- Modify: `services/stage-engine/src/types/session.ts`
- Modify: `services/stage-engine/src/types/agent.ts`

- [ ] **Step 1: Create Telegram API types**

Create `services/stage-engine/src/types/telegram.ts`:

```typescript
// ============================================
// telegram.ts
// Type definitions for the Telegram Bot API webhook payloads.
// Only the subset we consume — not the full Telegram API.
// Connected to: src/routes/adapters/telegram.ts (webhook handler)
// ============================================

/** Telegram user object */
export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

/** Telegram chat object */
export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  last_name?: string;
  username?: string;
};

/** Telegram message object */
export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
};

/** Callback query from inline keyboard button press */
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
};

/** Poll answer from the admin */
export type TelegramPollAnswer = {
  poll_id: string;
  user: TelegramUser;
  option_ids: number[];
};

/** Webhook update — the top-level object Telegram sends */
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  poll_answer?: TelegramPollAnswer;
};

/** Inline keyboard button */
export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

/** Inline keyboard markup for message replies */
export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

/** Options for sendMessage */
export type SendMessageOptions = {
  chat_id: number | string;
  text: string;
  parse_mode?: "MarkdownV2" | "HTML";
  reply_markup?: InlineKeyboardMarkup;
};

/** Options for sendPoll */
export type SendPollOptions = {
  chat_id: number | string;
  question: string;
  options: string[];
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
};

/** Generic Telegram Bot API response */
export type TelegramApiResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};
```

- [ ] **Step 2: Add 'telegram' to SessionChannel**

In `services/stage-engine/src/types/session.ts`, line 15:

```typescript
// Before:
export type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous";

// After:
export type SessionChannel = "voice" | "sms" | "chat" | "email" | "autonomous" | "telegram";
```

- [ ] **Step 3: Add 'telegram' to AgentChatRequest.channel**

In `services/stage-engine/src/types/agent.ts`, line 14:

```typescript
// Before:
  channel?: "chat" | "voice";

// After:
  channel?: "chat" | "voice" | "telegram";
```

- [ ] **Step 4: Verify typecheck**

```bash
cd services/stage-engine && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/types/telegram.ts services/stage-engine/src/types/session.ts services/stage-engine/src/types/agent.ts
git commit -m "feat(stage-engine): add Telegram types and extend channel unions

Add TelegramUpdate, TelegramMessage, TelegramCallbackQuery, TelegramPollAnswer
types. Extend SessionChannel and AgentChatRequest.channel with 'telegram'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Secrets + Environment Variables

**Files:**

- Modify: `services/stage-engine/src/secrets.ts`
- Modify: `.env.template`

- [ ] **Step 1: Extend ServiceSecrets type and loadSecrets()**

In `services/stage-engine/src/secrets.ts`:

```typescript
// Line 10-13 — extend type:
type ServiceSecrets = {
  ultravoxApiKey: string | null;
  openrouterApiKey: string | null;
  telegramBotToken: string | null;
  telegramWebhookSecret: string | null;
  telegramAdminChatId: string | null;
};

// Line 43-46 — add to Promise.all in loadSecrets():
const [
  vaultUltravox,
  vaultOpenrouter,
  vaultTelegramToken,
  vaultTelegramSecret,
  vaultTelegramChatId,
] = await Promise.all([
  getServiceKey("ultravox"),
  getServiceKey("openrouter"),
  getServiceKey("telegram_bot_token"),
  getServiceKey("telegram_webhook_secret"),
  getServiceKey("telegram_admin_chat_id"),
]);

// Line 49-51 — add env fallbacks:
const ultravoxApiKey = vaultUltravox ?? process.env.ULTRAVOX_API_KEY ?? null;
const openrouterApiKey = vaultOpenrouter ?? process.env.OPENROUTER_API_KEY ?? null;
const telegramBotToken = vaultTelegramToken ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
const telegramWebhookSecret = vaultTelegramSecret ?? process.env.TELEGRAM_WEBHOOK_SECRET ?? null;
const telegramAdminChatId = vaultTelegramChatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID ?? null;

// Line 52 — update _secrets assignment:
_secrets = {
  ultravoxApiKey,
  openrouterApiKey,
  telegramBotToken,
  telegramWebhookSecret,
  telegramAdminChatId,
};

// Lines 54-58 — add to sources/missing logging:
if (vaultTelegramToken) sources.push("telegram (vault)");
else if (telegramBotToken) sources.push("telegram (env)");
```

- [ ] **Step 2: Add env vars to .env.template**

After the `ULTRAVOX_API_KEY` line (around line 110):

```
# Telegram Bot API (admin command & control)
TELEGRAM_BOT_TOKEN="op://smartout_ai/Telegram/bot_token"
TELEGRAM_WEBHOOK_SECRET="op://smartout_ai/Telegram/webhook_secret"
TELEGRAM_ADMIN_CHAT_ID="op://smartout_ai/Telegram/admin_chat_id"
```

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/secrets.ts .env.template
git commit -m "feat(stage-engine): add Telegram secrets and env vars

Load telegram_bot_token, telegram_webhook_secret, telegram_admin_chat_id
from Vault with env var fallback. Add op:// refs to .env.template.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Telegram Bot API Client

**Files:**

- Create: `services/stage-engine/src/core/telegram.ts`

- [ ] **Step 1: Write test for sendMessage**

Create `services/stage-engine/src/__tests__/telegram-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock secrets
vi.mock("../secrets.js", () => ({
  getSecrets: () => ({
    telegramBotToken: "test-bot-token",
    telegramWebhookSecret: "test-secret",
    telegramAdminChatId: "123456789",
  }),
}));

// Import after mocks
const { sendTelegramMessage, sendTelegramPoll, answerCallbackQuery, escapeMarkdownV2 } =
  await import("../core/telegram.js");

describe("Telegram Bot API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends a text message to admin chat", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });

    const result = await sendTelegramMessage("Hello admin");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe("123456789");
    expect(body.text).toBe("Hello admin");
    expect(result.ok).toBe(true);
  });

  it("chunks messages over 4096 chars", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    });

    const longText = "a".repeat(5000);
    await sendTelegramMessage(longText);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("escapes MarkdownV2 special characters", () => {
    const escaped = escapeMarkdownV2("Hello_world*bold*[link](url)");
    expect(escaped).toBe("Hello\\_world\\*bold\\*\\[link\\]\\(url\\)");
  });

  it("sends a poll", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { poll: { id: "poll123" } } }),
    });

    const result = await sendTelegramPoll("Who to call?", ["Anna", "Erik", "Mia"]);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendPoll");
    const body = JSON.parse(opts.body);
    expect(body.question).toBe("Who to call?");
    expect(body.options).toEqual([{ text: "Anna" }, { text: "Erik" }, { text: "Mia" }]);
    expect(result.ok).toBe(true);
  });

  it("answers a callback query", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });

    await answerCallbackQuery("callback-123", "Action completed");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/answerCallbackQuery");
    const body = JSON.parse(opts.body);
    expect(body.callback_query_id).toBe("callback-123");
    expect(body.text).toBe("Action completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-client.test.ts
```

Expected: FAIL — module `../core/telegram.js` not found.

- [ ] **Step 3: Implement the Telegram client**

Create `services/stage-engine/src/core/telegram.ts`:

```typescript
// ============================================
// telegram.ts
// Telegram Bot API client — plain HTTP fetch calls.
// Outbound functions for sending messages, polls, escalations.
// No npm dependency — Telegram Bot API is a simple REST API.
// Connected to: src/routes/adapters/telegram.ts (webhook handler calls these)
// Connected to: src/secrets.ts (bot token, admin chat ID)
// ============================================

import { getSecrets } from "../secrets.js";
import type {
  TelegramApiResponse,
  TelegramMessage,
  InlineKeyboardMarkup,
  SendPollOptions,
} from "../types/telegram.js";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4096;

/** Characters that must be escaped in Telegram MarkdownV2 */
const MARKDOWN_V2_SPECIAL = /([_*\[\]()~`>#+\-=|{}.!\\])/g;

/**
 * Escape special characters for Telegram MarkdownV2 format.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL, "\\$1");
}

/**
 * Call the Telegram Bot API.
 */
async function callApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramApiResponse<T>> {
  const token = getSecrets().telegramBotToken;
  if (!token) {
    console.error("[telegram] Bot token not configured");
    return { ok: false, description: "Bot token not configured" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return (await response.json()) as TelegramApiResponse<T>;
  } catch (err) {
    console.error(`[telegram] API call ${method} failed:`, err);
    return { ok: false, description: String(err) };
  }
}

/**
 * Get the admin chat ID from secrets.
 */
function getAdminChatId(): string {
  const chatId = getSecrets().telegramAdminChatId;
  if (!chatId) throw new Error("[telegram] TELEGRAM_ADMIN_CHAT_ID not configured");
  return chatId;
}

/**
 * Send a text message to the admin. Automatically chunks if over 4096 chars.
 */
export async function sendTelegramMessage(
  text: string,
  options?: {
    parseMode?: "MarkdownV2" | "HTML";
    replyMarkup?: InlineKeyboardMarkup;
  },
): Promise<TelegramApiResponse<TelegramMessage>> {
  const chatId = getAdminChatId();

  // Chunk long messages
  if (text.length > MAX_MESSAGE_LENGTH) {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, MAX_MESSAGE_LENGTH));
      remaining = remaining.slice(MAX_MESSAGE_LENGTH);
    }

    let lastResult: TelegramApiResponse<TelegramMessage> = { ok: false };
    for (const chunk of chunks) {
      lastResult = await callApi<TelegramMessage>("sendMessage", {
        chat_id: chatId,
        text: chunk,
        ...(options?.parseMode && { parse_mode: options.parseMode }),
      });
    }
    return lastResult;
  }

  return callApi<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    ...(options?.parseMode && { parse_mode: options.parseMode }),
    ...(options?.replyMarkup && { reply_markup: options.replyMarkup }),
  });
}

/**
 * Send a poll to the admin chat.
 */
export async function sendTelegramPoll(
  question: string,
  optionLabels: string[],
  allowsMultiple = false,
): Promise<TelegramApiResponse<{ poll: { id: string } }>> {
  const chatId = getAdminChatId();

  return callApi<{ poll: { id: string } }>("sendPoll", {
    chat_id: chatId,
    question,
    options: optionLabels.map((text) => ({ text })),
    is_anonymous: false,
    allows_multiple_answers: allowsMultiple,
  } satisfies SendPollOptions);
}

/**
 * Answer a callback query (removes loading state from inline button).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<TelegramApiResponse<boolean>> {
  return callApi<boolean>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text && { text }),
  });
}

/**
 * Edit a sent message (used to update escalation buttons after action).
 */
export async function editMessageText(
  messageId: number,
  text: string,
  parseMode?: "MarkdownV2" | "HTML",
): Promise<TelegramApiResponse<TelegramMessage>> {
  return callApi<TelegramMessage>("editMessageText", {
    chat_id: getAdminChatId(),
    message_id: messageId,
    text,
    ...(parseMode && { parse_mode: parseMode }),
  });
}

/**
 * Register the webhook URL with Telegram. Idempotent — safe to call repeatedly.
 */
export async function registerWebhook(url: string): Promise<TelegramApiResponse<boolean>> {
  const secret = getSecrets().telegramWebhookSecret;

  return callApi<boolean>("setWebhook", {
    url,
    ...(secret && { secret_token: secret }),
    allowed_updates: ["message", "callback_query", "poll_answer"],
  });
}

/**
 * Send an escalation message with inline action buttons.
 * Actions are stored in telegram_callback_action and referenced by short UUID.
 */
export async function sendTelegramEscalation(
  title: string,
  body: string,
  severity: "info" | "warning" | "critical",
  actions: Array<{ label: string; callbackId: string }>,
): Promise<TelegramApiResponse<TelegramMessage>> {
  const severityEmoji =
    severity === "critical" ? "\u{1F534}" : severity === "warning" ? "\u{1F7E1}" : "\u{1F535}";
  const text = `${severityEmoji} *${escapeMarkdownV2(title)}*\n\n${escapeMarkdownV2(body)}`;

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      actions.map((a) => ({
        text: a.label,
        callback_data: a.callbackId,
      })),
    ],
  };

  return sendTelegramMessage(text, { parseMode: "MarkdownV2", replyMarkup });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-client.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/telegram.ts services/stage-engine/src/__tests__/telegram-client.test.ts
git commit -m "feat(stage-engine): add Telegram Bot API client

Plain fetch calls to Telegram API — sendMessage, sendPoll,
answerCallbackQuery, editMessageText, registerWebhook, sendEscalation.
Auto-chunks messages over 4096 chars. MarkdownV2 escaping.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Admin Router Pipeline

**Files:**

- Create: `services/stage-engine/src/core/admin-router.ts`
- Test: `services/stage-engine/src/__tests__/admin-router.test.ts`

- [ ] **Step 1: Write test for admin router**

Create `services/stage-engine/src/__tests__/admin-router.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM call
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Admin response" }),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn().mockReturnValue((model: string) => ({ modelId: model })),
}));

vi.mock("../secrets.js", () => ({
  getSecrets: () => ({
    openrouterApiKey: "test-key",
    telegramBotToken: "test-token",
    telegramWebhookSecret: "test-secret",
    telegramAdminChatId: "123456789",
  }),
}));

const { routeAdminMessage } = await import("../core/admin-router.js");

describe("routeAdminMessage", () => {
  it("returns a response without requiring workspaceId", async () => {
    const result = await routeAdminMessage({
      message: "What is the system status?",
      sessionId: "test-session-id",
      conversationHistory: [],
    });

    expect(result.response).toBe("Admin response");
    expect(result.session_id).toBe("test-session-id");
  });

  it("passes workspace context when provided", async () => {
    const { generateText } = await import("ai");

    const result = await routeAdminMessage({
      message: "Show shifts for today",
      sessionId: "test-session-id",
      workspaceId: "workspace-123",
      conversationHistory: [],
    });

    expect(result.response).toBe("Admin response");
    // The system prompt should include workspace context
    const callArgs = vi.mocked(generateText).mock.calls[0][0];
    expect(callArgs.system).toContain("workspace");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/stage-engine && npx vitest run src/__tests__/admin-router.test.ts
```

Expected: FAIL — module `../core/admin-router.js` not found.

- [ ] **Step 3: Implement admin-router**

Create `services/stage-engine/src/core/admin-router.ts`:

```typescript
// ============================================
// admin-router.ts
// Lightweight message pipeline for platform admin (god-mode) conversations.
// Unlike routeAgentMessage(), this does NOT require workspace_id,
// skips workspace-scoped authority loading, and uses admin-specific tools.
// Connected to: src/routes/adapters/telegram.ts (inbound Telegram messages)
// Connected to: src/core/telegram.ts (outbound Telegram API calls)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { supabaseAdmin } from "../lib/supabase.js";
import { getSecrets } from "../secrets.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;

function getOpenRouter() {
  if (!_openrouter) {
    const apiKey = getSecrets().openrouterApiKey;
    if (!apiKey) throw new Error("OpenRouter API key not available");
    _openrouter = createOpenRouter({ apiKey });
  }
  return _openrouter;
}

type AdminRouterInput = {
  message: string;
  sessionId: string;
  workspaceId?: string;
  conversationHistory: ConversationTurn[];
};

/**
 * Build the admin system prompt.
 * Pontus is the platform owner — god-mode access, cross-workspace visibility.
 */
function buildAdminPrompt(workspaceId?: string): string {
  const parts = [
    "You are Mr. Botsson, Smartout's AI assistant. You are talking to Pontus, the platform owner and admin.",
    "Pontus has god-mode access to all workspaces and data.",
    "Be direct, concise, and helpful. Use Norwegian or English based on the message language.",
    "You can query any workspace data, manage operations, and execute admin actions.",
  ];

  if (workspaceId) {
    parts.push(
      `Current workspace context: ${workspaceId}. Scope queries to this workspace unless asked otherwise.`,
    );
  } else {
    parts.push("No workspace context set. Pontus can set one with /workspace <slug>.");
  }

  parts.push(
    "Available commands:",
    "- /workspace <slug> — set workspace context for subsequent queries",
    "- /workspace clear — remove workspace context",
    "- /done — close active chat bridge",
  );

  return parts.join("\n\n");
}

/**
 * Route a platform admin message through the lightweight admin pipeline.
 * No workspace scope required. No authority checks (god-mode).
 */
export async function routeAdminMessage(input: AdminRouterInput): Promise<AgentChatResponse> {
  const { message, sessionId, workspaceId, conversationHistory } = input;

  const systemPrompt = buildAdminPrompt(workspaceId);

  const messages = conversationHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: message });

  // Admin tools context — workspace is optional
  const toolContext = {
    workspaceId: workspaceId ?? "",
    profileId: "",
    sessionId,
    supabaseAdmin,
    broadcast: () => {},
  };

  // For now, no tools — just LLM conversation. Tools will be added in Task 8.
  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4"),
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(5),
  });

  return {
    session_id: sessionId,
    response: result.text,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/stage-engine && npx vitest run src/__tests__/admin-router.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/admin-router.ts services/stage-engine/src/__tests__/admin-router.test.ts
git commit -m "feat(stage-engine): add admin router pipeline

Lightweight routeAdminMessage() for god-mode admin conversations.
No workspace scope required, no authority checks.
Tools will be added in a follow-up task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Webhook Handler + Route Registration

**Files:**

- Create: `services/stage-engine/src/routes/adapters/telegram.ts`
- Modify: `services/stage-engine/src/index.ts`
- Test: `services/stage-engine/src/__tests__/telegram-webhook.test.ts`

- [ ] **Step 1: Write webhook test**

Create `services/stage-engine/src/__tests__/telegram-webhook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../secrets.js", () => ({
  getSecrets: () => ({
    telegramBotToken: "test-token",
    telegramWebhookSecret: "test-webhook-secret",
    telegramAdminChatId: "123456789",
    openrouterApiKey: "test-key",
  }),
}));

vi.mock("../core/telegram.js", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  answerCallbackQuery: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../core/admin-router.js", () => ({
  routeAdminMessage: vi.fn().mockResolvedValue({
    session_id: "sess-1",
    response: "Test response",
  }),
}));

vi.mock("../core/guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  },
}));

import { verifyWebhookSecret } from "../routes/adapters/telegram.js";

describe("Telegram webhook", () => {
  it("rejects requests with wrong secret token", () => {
    expect(verifyWebhookSecret("wrong-secret")).toBe(false);
  });

  it("accepts requests with correct secret token", () => {
    expect(verifyWebhookSecret("test-webhook-secret")).toBe(true);
  });

  it("rejects messages from non-admin chat IDs", () => {
    const isAdmin = (chatId: number) => String(chatId) === "123456789";
    expect(isAdmin(999999)).toBe(false);
    expect(isAdmin(123456789)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-webhook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the webhook handler**

Create `services/stage-engine/src/routes/adapters/telegram.ts`:

```typescript
// ============================================
// telegram.ts
// Telegram webhook adapter for the Stage Engine.
// Receives webhook updates from Telegram, routes messages through
// the admin pipeline, and sends responses back via Bot API.
// Connected to: src/core/admin-router.ts (message processing)
// Connected to: src/core/telegram.ts (Bot API client)
// Connected to: src/core/telegram-bridge.ts (chat bridge relay)
// ============================================

import { Hono } from "hono";
import { routeAdminMessage } from "../../core/admin-router.js";
import { sendTelegramMessage, answerCallbackQuery, editMessageText } from "../../core/telegram.js";
import { emitGuardianEvent } from "../../core/guardian-bus.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { getSecrets } from "../../secrets.js";
import type { AuthContext } from "../../types/auth.js";
import type { ConversationTurn } from "../../types/agent.js";
import type { TelegramUpdate, TelegramMessage } from "../../types/telegram.js";

const telegram = new Hono<{ Variables: { auth: AuthContext } }>();

// In-memory deduplication — LRU of recent update_ids
const recentUpdateIds = new Set<number>();
const MAX_DEDUP_SIZE = 1000;

function isDuplicate(updateId: number): boolean {
  if (recentUpdateIds.has(updateId)) return true;
  recentUpdateIds.add(updateId);
  if (recentUpdateIds.size > MAX_DEDUP_SIZE) {
    const first = recentUpdateIds.values().next().value;
    if (first !== undefined) recentUpdateIds.delete(first);
  }
  return false;
}

/**
 * Verify the webhook secret token from Telegram.
 * Telegram sends this as X-Telegram-Bot-Api-Secret-Token header.
 */
export function verifyWebhookSecret(headerToken: string | undefined): boolean {
  const expected = getSecrets().telegramWebhookSecret;
  if (!expected || !headerToken) return false;
  return headerToken === expected;
}

/**
 * Check if a chat ID is the admin chat.
 */
function isAdminChat(chatId: number): boolean {
  const adminId = getSecrets().telegramAdminChatId;
  return adminId !== null && String(chatId) === adminId;
}

/**
 * Load or create a Telegram admin session.
 */
async function getOrCreateSession(): Promise<{
  id: string;
  workspaceId: string | null;
  conversationHistory: ConversationTurn[];
}> {
  // Try to find existing active telegram session
  const { data: existing } = await supabaseAdmin
    .from("engine_sessions")
    .select("id, workspace_id, collected_data")
    .eq("channel", "telegram")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    const collectedData = (existing.collected_data ?? {}) as Record<string, unknown>;
    const conversation = (collectedData.conversation ?? []) as ConversationTurn[];

    // Conversation windowing — keep last 50 turns
    const windowed = conversation.slice(-50);

    return {
      id: existing.id,
      workspaceId: existing.workspace_id,
      conversationHistory: windowed,
    };
  }

  // Create new session — no workspace_id (platform admin)
  const { data: session, error } = await supabaseAdmin
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
      context: { platform_admin: true },
      collected_data: { conversation: [] },
      callback_url: null,
      expires_at: null,
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error(`Failed to create Telegram session: ${error?.message}`);
  }

  return { id: session.id, workspaceId: null, conversationHistory: [] };
}

/**
 * Append a conversation turn to the session.
 */
async function appendTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
  const { error } = await supabaseAdmin.rpc("append_conversation_turn", {
    p_session_id: sessionId,
    p_turn: turn as unknown as Record<string, unknown>,
  });

  if (error) {
    console.warn("[telegram] Failed to append turn via RPC, using fallback:", error.message);
    const { data: session } = await supabaseAdmin
      .from("engine_sessions")
      .select("collected_data")
      .eq("id", sessionId)
      .single();

    if (!session) return;

    const collectedData = (session.collected_data ?? {}) as Record<string, unknown>;
    const conversation = (collectedData.conversation ?? []) as ConversationTurn[];
    conversation.push(turn);

    await supabaseAdmin
      .from("engine_sessions")
      .update({
        collected_data: { ...collectedData, conversation },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }
}

/**
 * Handle a text message from Telegram.
 */
async function handleMessage(msg: TelegramMessage): Promise<void> {
  if (!msg.text || !msg.chat) return;

  const text = msg.text.trim();
  if (!text) return;

  // Check for /workspace command
  const workspaceMatch = text.match(/^\/workspace\s+(\S+)/);

  const session = await getOrCreateSession();

  if (workspaceMatch) {
    const slug = workspaceMatch[1];
    if (slug === "clear") {
      await supabaseAdmin
        .from("engine_sessions")
        .update({ workspace_id: null, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      await sendTelegramMessage("Workspace context cleared.");
      return;
    }

    // Look up workspace by slug
    const { data: workspace } = await supabaseAdmin
      .from("workspace")
      .select("workspace_id, name")
      .eq("slug", slug)
      .single();

    if (!workspace) {
      await sendTelegramMessage(`Workspace "${slug}" not found.`);
      return;
    }

    await supabaseAdmin
      .from("engine_sessions")
      .update({ workspace_id: workspace.workspace_id, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    await sendTelegramMessage(`Workspace set to: ${workspace.name} (${slug})`);
    return;
  }

  // Append user turn
  const userTurn: ConversationTurn = {
    role: "user",
    content: text,
    timestamp: new Date().toISOString(),
  };
  await appendTurn(session.id, userTurn);

  emitGuardianEvent({
    session_id: session.id,
    workspace_id: session.workspaceId ?? "platform",
    event_type: "telegram.message.received",
    actor: "user",
    summary: text.length > 100 ? text.slice(0, 100) + "\u2026" : text,
    data: { text },
  });

  // Route through admin pipeline
  const response = await routeAdminMessage({
    message: text,
    sessionId: session.id,
    workspaceId: session.workspaceId ?? undefined,
    conversationHistory: session.conversationHistory,
  });

  // Append assistant turn
  const assistantTurn: ConversationTurn = {
    role: "assistant",
    content: response.response,
    timestamp: new Date().toISOString(),
  };
  await appendTurn(session.id, assistantTurn);

  emitGuardianEvent({
    session_id: session.id,
    workspace_id: session.workspaceId ?? "platform",
    event_type: "telegram.message.sent",
    actor: "agent",
    summary:
      response.response.length > 100
        ? response.response.slice(0, 100) + "\u2026"
        : response.response,
    data: { text: response.response },
  });

  // Send response to Telegram
  await sendTelegramMessage(response.response);
}

/**
 * Handle a callback query (inline button press).
 */
async function handleCallbackQuery(
  callbackQueryId: string,
  data: string | undefined,
  messageId?: number,
): Promise<void> {
  if (!data) {
    await answerCallbackQuery(callbackQueryId, "No action data");
    return;
  }

  // Look up callback action by ID
  const { data: action } = await supabaseAdmin
    .from("telegram_callback_action")
    .select("*")
    .eq("id", data)
    .eq("resolved", false)
    .single();

  if (!action) {
    await answerCallbackQuery(callbackQueryId, "Action expired or already resolved");
    return;
  }

  // Mark as resolved
  await supabaseAdmin
    .from("telegram_callback_action")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", data);

  // Execute the action through admin router
  const session = await getOrCreateSession();
  await routeAdminMessage({
    message: `Execute action: ${action.action_type} with payload: ${JSON.stringify(action.action_payload)}`,
    sessionId: session.id,
    conversationHistory: [],
  });

  // Update the original message to show resolved state
  if (messageId) {
    await editMessageText(messageId, `Resolved: ${action.action_type}`);
  }

  await answerCallbackQuery(callbackQueryId, "Action executed");

  emitGuardianEvent({
    session_id: session.id,
    workspace_id: session.workspaceId ?? "platform",
    event_type: "telegram.escalation.resolved",
    actor: "user",
    summary: `Resolved: ${action.action_type}`,
    data: { action_type: action.action_type, action_payload: action.action_payload },
  });
}

/**
 * Handle a poll answer.
 */
async function handlePollAnswer(pollId: string, optionIds: number[]): Promise<void> {
  const { data: pollAction } = await supabaseAdmin
    .from("telegram_poll_action")
    .select("*")
    .eq("telegram_poll_id", pollId)
    .eq("resolved", false)
    .single();

  if (!pollAction) return;

  const options = pollAction.options as Array<{
    index: number;
    label: string;
    action_type: string;
    action_payload: Record<string, unknown>;
  }>;

  // Execute actions for selected options
  const selected = options.filter((o) => optionIds.includes(o.index));
  const session = await getOrCreateSession();

  for (const option of selected) {
    await routeAdminMessage({
      message: `Execute poll action: ${option.action_type} with payload: ${JSON.stringify(option.action_payload)}`,
      sessionId: session.id,
      conversationHistory: [],
    });
  }

  // Mark poll as resolved
  await supabaseAdmin
    .from("telegram_poll_action")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", pollAction.id);

  await sendTelegramMessage(`Poll resolved. Executed: ${selected.map((s) => s.label).join(", ")}`);

  emitGuardianEvent({
    session_id: session.id,
    workspace_id: session.workspaceId ?? "platform",
    event_type: "telegram.poll.resolved",
    actor: "user",
    summary: `Poll resolved: ${selected.map((s) => s.label).join(", ")}`,
    data: { poll_id: pollId, selected_options: selected },
  });
}

// ── Webhook Route ──────────────────────────────

telegram.post("/adapters/telegram/webhook", async (c) => {
  const headerToken = c.req.header("x-telegram-bot-api-secret-token");

  if (!verifyWebhookSecret(headerToken)) {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }

  const update = (await c.req.json()) as TelegramUpdate;

  // Idempotency — reject duplicate update_ids
  if (isDuplicate(update.update_id)) {
    return c.json({ ok: true });
  }

  // Return 200 immediately — process async (Telegram requires fast response)
  const processAsync = async () => {
    try {
      if (update.message) {
        if (!isAdminChat(update.message.chat.id)) {
          console.warn("[telegram] Rejected message from non-admin chat:", update.message.chat.id);
          return;
        }
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(
          update.callback_query.id,
          update.callback_query.data,
          update.callback_query.message?.message_id,
        );
      } else if (update.poll_answer) {
        await handlePollAnswer(update.poll_answer.poll_id, update.poll_answer.option_ids);
      }
    } catch (err) {
      console.error("[telegram] Handler error:", err);
      // Try to notify admin of the error
      try {
        await sendTelegramMessage(`Error processing message: ${String(err)}`);
      } catch {
        // Swallow — don't let error notification errors cascade
      }
    }
  };

  // Fire and forget — don't await
  processAsync();

  return c.json({ ok: true });
});

export { telegram };
```

- [ ] **Step 4: Mount routes in index.ts**

In `services/stage-engine/src/index.ts`:

Add import (after line 22):

```typescript
import { telegram } from "./routes/adapters/telegram.js";
```

Add auth middleware bypass (after line 42):

```typescript
// Skip auth for Telegram webhook — authenticated via secret token in the handler
app.use("/adapters/telegram/*", async (_c, next) => next());
```

Mount route (after line 55):

```typescript
app.route("/", telegram);
```

- [ ] **Step 5: Run tests**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-webhook.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Typecheck**

```bash
cd services/stage-engine && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add services/stage-engine/src/routes/adapters/telegram.ts services/stage-engine/src/index.ts services/stage-engine/src/__tests__/telegram-webhook.test.ts
git commit -m "feat(stage-engine): add Telegram webhook handler and route

Webhook receives Telegram updates, verifies secret token, deduplicates
by update_id, routes messages through admin pipeline, handles callback
queries and poll answers. Auth middleware bypassed for webhook path.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Telemetry Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add Telegram event interfaces**

In `packages/telemetry/src/registry.ts`, after the Entity Drawer events section (around line 2011), add:

```typescript
// ─── Telegram Events ────────────────────────────
export interface TelegramSessionCreated extends BaseEvent {
  event: "telegram session_created";
  properties: { data: { session_id: string } };
}

export interface TelegramMessageReceived extends BaseEvent {
  event: "telegram message_received";
  properties: { data: { text: string } };
}

export interface TelegramMessageSent extends BaseEvent {
  event: "telegram message_sent";
  properties: { data: { text: string } };
}

export interface TelegramEscalationSent extends BaseEvent {
  event: "telegram escalation_sent";
  properties: { data: { title: string; severity: string } };
}

export interface TelegramEscalationResolved extends BaseEvent {
  event: "telegram escalation_resolved";
  properties: { data: { action_type: string } };
}

export interface TelegramPollSent extends BaseEvent {
  event: "telegram poll_sent";
  properties: { data: { question: string; option_count: number } };
}

export interface TelegramPollResolved extends BaseEvent {
  event: "telegram poll_resolved";
  properties: { data: { poll_id: string; selected_options: string[] } };
}

export interface TelegramBridgeOpened extends BaseEvent {
  event: "telegram bridge_opened";
  properties: { data: { channel_id: string } };
}

export interface TelegramBridgeClosed extends BaseEvent {
  event: "telegram bridge_closed";
  properties: { data: { channel_id: string; duration_ms: number } };
}

export interface TelegramBridgeMessageRelayed extends BaseEvent {
  event: "telegram bridge_message_relayed";
  properties: { data: { direction: "smartout_to_telegram" | "telegram_to_smartout" } };
}
```

- [ ] **Step 2: Add to SmartoutEvent union**

In the `SmartoutEvent` type (around line 2232), add before the semicolon:

```typescript
  | TelegramSessionCreated
  | TelegramMessageReceived
  | TelegramMessageSent
  | TelegramEscalationSent
  | TelegramEscalationResolved
  | TelegramPollSent
  | TelegramPollResolved
  | TelegramBridgeOpened
  | TelegramBridgeClosed
  | TelegramBridgeMessageRelayed;
```

- [ ] **Step 3: Add to EVENT_ROUTING**

At the end of EVENT_ROUTING (before the closing `}`), add the `"telegram"` category to the category union if not present, then add routing entries:

```typescript
  "telegram session_created": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram message_received": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram message_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram escalation_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram escalation_resolved": {
    destinations: ["logger", "activity_trail", "posthog"],
    category: "telegram",
  },
  "telegram poll_sent": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram poll_resolved": {
    destinations: ["logger", "activity_trail", "posthog"],
    category: "telegram",
  },
  "telegram bridge_opened": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram bridge_closed": {
    destinations: ["logger", "activity_trail"],
    category: "telegram",
  },
  "telegram bridge_message_relayed": {
    destinations: ["logger"],
    category: "telegram",
  },
```

Also add `"telegram"` to the `EventCategory` type (search for `type EventCategory`):

```typescript
// Find the line like:
| "entity_drawer"
// Add after it:
| "telegram"
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter telemetry typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 10 Telegram adapter events

Add event interfaces, SmartoutEvent union entries, and EVENT_ROUTING
for telegram session, message, escalation, poll, and bridge events.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Chat Bridge (PG NOTIFY)

**Files:**

- Create: `services/stage-engine/src/core/telegram-bridge.ts`
- Modify: `services/stage-engine/src/index.ts` (add pg_listen setup)
- Modify: `services/stage-engine/src/routes/adapters/telegram.ts` (check bridge before routing)

- [ ] **Step 1: Write bridge test**

Create `services/stage-engine/src/__tests__/telegram-bridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../secrets.js", () => ({
  getSecrets: () => ({
    telegramBotToken: "test-token",
    telegramAdminChatId: "123456789",
  }),
}));

vi.mock("../core/telegram.js", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock("../core/guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));

const { hasActiveBridge, closeBridge } = await import("../core/telegram-bridge.js");

describe("Telegram bridge", () => {
  it("returns false when no active bridge exists", async () => {
    const result = await hasActiveBridge();
    expect(result).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-bridge.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the bridge**

Create `services/stage-engine/src/core/telegram-bridge.ts`:

```typescript
// ============================================
// telegram-bridge.ts
// Chat bridge lifecycle — connects a Smartout channel to Telegram.
// Uses PG NOTIFY for message relay (not Supabase Realtime).
// Only one bridge active at a time (v1 — single admin).
// Connected to: supabase migration (trg_notify_telegram_bridge trigger)
// Connected to: src/core/telegram.ts (sendTelegramMessage)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { sendTelegramMessage } from "./telegram.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { getSecrets } from "../secrets.js";

type ActiveBridge = {
  id: string;
  channelId: string;
  sessionId: string;
};

/**
 * Check if there is an active chat bridge.
 * Returns the bridge record if active, null otherwise.
 */
export async function hasActiveBridge(): Promise<ActiveBridge | null> {
  const { data } = await supabaseAdmin
    .from("telegram_chat_bridge")
    .select("id, channel_id, session_id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!data) return null;
  return { id: data.id, channelId: data.channel_id, sessionId: data.session_id };
}

/**
 * Open a new chat bridge. Closes any existing active bridge first.
 */
export async function openBridge(
  sessionId: string,
  channelId: string,
  context?: string,
): Promise<string> {
  // Close any existing bridge
  await supabaseAdmin
    .from("telegram_chat_bridge")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active");

  const adminChatId = getSecrets().telegramAdminChatId;
  if (!adminChatId) throw new Error("TELEGRAM_ADMIN_CHAT_ID not configured");

  const { data: bridge, error } = await supabaseAdmin
    .from("telegram_chat_bridge")
    .insert({
      session_id: sessionId,
      channel_id: channelId,
      telegram_chat_id: Number(adminChatId),
      status: "active",
    })
    .select()
    .single();

  if (error || !bridge) throw new Error(`Failed to create bridge: ${error?.message}`);

  // Look up channel name for the notification
  const { data: channel } = await supabaseAdmin
    .from("channel")
    .select("name")
    .eq("id", channelId)
    .single();

  let msg = `Bridge opened to: ${channel?.name ?? channelId}. Type to reply. /done to close.`;
  if (context) msg += `\n\nContext: ${context}`;

  await sendTelegramMessage(msg);

  emitGuardianEvent({
    session_id: sessionId,
    workspace_id: "platform",
    event_type: "telegram.bridge.opened",
    actor: "system",
    summary: `Bridge opened to channel ${channelId}`,
    data: { channel_id: channelId, context },
  });

  return bridge.id;
}

/**
 * Close an active bridge.
 */
export async function closeBridge(bridgeId?: string): Promise<void> {
  const query = supabaseAdmin
    .from("telegram_chat_bridge")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active");

  if (bridgeId) query.eq("id", bridgeId);

  await query;

  await sendTelegramMessage("Bridge closed.");

  emitGuardianEvent({
    session_id: "",
    workspace_id: "platform",
    event_type: "telegram.bridge.closed",
    actor: "user",
    summary: "Chat bridge closed",
    data: { bridge_id: bridgeId ?? "all" },
  });
}

/**
 * Relay a message from Smartout to Telegram via PG NOTIFY handler.
 * Called when a channel_message is inserted and an active bridge exists for that channel.
 */
export async function relayToTelegram(
  channelId: string,
  senderProfileId: string | null,
  content: string,
): Promise<void> {
  const bridge = await hasActiveBridge();
  if (!bridge || bridge.channelId !== channelId) return;

  // Look up sender name
  let senderName = "Unknown";
  if (senderProfileId) {
    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("display_name")
      .eq("profile_id", senderProfileId)
      .single();
    if (profile?.display_name) senderName = profile.display_name;
  }

  // Don't relay messages from the admin (prevent echo loop)
  // Admin messages have no sender_profile_id (inserted via service_role with sender_name)
  if (!senderProfileId) return;

  await sendTelegramMessage(`[${senderName}]: ${content}`);

  emitGuardianEvent({
    session_id: bridge.sessionId,
    workspace_id: "platform",
    event_type: "telegram.bridge.message_relayed",
    actor: "system",
    summary: `Message from ${senderName} relayed to Telegram`,
    data: { direction: "smartout_to_telegram", sender: senderName },
  });
}

/**
 * Relay a Telegram message to Smartout channel.
 * Inserts as service_role with sender_name override.
 */
export async function relayToSmartout(text: string): Promise<boolean> {
  const bridge = await hasActiveBridge();
  if (!bridge) return false;

  const { error } = await supabaseAdmin.from("channel_message").insert({
    channel_id: bridge.channelId,
    sender_profile_id: null,
    sender_name: "Pontus (Admin)",
    content: text,
    message_type: "text",
  });

  if (error) {
    console.error("[telegram-bridge] Failed to relay to Smartout:", error.message);
    return false;
  }

  emitGuardianEvent({
    session_id: bridge.sessionId,
    workspace_id: "platform",
    event_type: "telegram.bridge.message_relayed",
    actor: "user",
    summary: "Message from Telegram relayed to Smartout",
    data: { direction: "telegram_to_smartout" },
  });

  return true;
}
```

- [ ] **Step 4: Update webhook handler to check bridge first**

In `services/stage-engine/src/routes/adapters/telegram.ts`, update the `handleMessage` function. Add at the top of the function, before the workspace command check:

```typescript
// Check for /done command — closes active bridge
if (text === "/done") {
  const bridge = await hasActiveBridge();
  if (bridge) {
    await closeBridge(bridge.id);
    return;
  }
  await sendTelegramMessage("No active bridge to close.");
  return;
}

// Check for active bridge — relay to Smartout instead of admin chat
const activeBridge = await hasActiveBridge();
if (activeBridge) {
  await relayToSmartout(text);
  return;
}
```

Add imports at the top of the file:

```typescript
import { hasActiveBridge, closeBridge, relayToSmartout } from "../../core/telegram-bridge.js";
```

- [ ] **Step 5: Add PG NOTIFY listener in index.ts**

In `services/stage-engine/src/index.ts`, add after line 67 (after `injectWebSocket(server)`):

```typescript
// PG NOTIFY listener for Telegram chat bridge relay
import { relayToTelegram } from "./core/telegram-bridge.js";

async function setupPgNotifyListener() {
  try {
    // Use raw pg connection for LISTEN (supabaseAdmin doesn't support it)
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    await client.query("LISTEN telegram_bridge");
    console.log("[telegram] PG NOTIFY listener active for chat bridge relay");

    client.on("notification", async (msg) => {
      if (msg.channel !== "telegram_bridge" || !msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload);
        await relayToTelegram(payload.channel_id, payload.sender_profile_id, payload.content);
      } catch (err) {
        console.error("[telegram] Bridge relay error:", err);
      }
    });

    // Reconnect on error
    client.on("error", (err) => {
      console.error("[telegram] PG NOTIFY connection error:", err);
      setTimeout(setupPgNotifyListener, 5000);
    });
  } catch (err) {
    console.warn("[telegram] PG NOTIFY listener setup failed (bridge relay unavailable):", err);
  }
}

setupPgNotifyListener();
```

- [ ] **Step 6: Run tests**

```bash
cd services/stage-engine && npx vitest run src/__tests__/telegram-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 7: Typecheck**

```bash
cd services/stage-engine && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add services/stage-engine/src/core/telegram-bridge.ts services/stage-engine/src/routes/adapters/telegram.ts services/stage-engine/src/index.ts services/stage-engine/src/__tests__/telegram-bridge.test.ts
git commit -m "feat(stage-engine): add Telegram chat bridge with PG NOTIFY relay

Bridge connects Smartout channel_message to Telegram for admin.
Uses PG NOTIFY instead of Realtime subscriptions for reliability.
/done command closes bridge. Only one active bridge at a time.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final Integration + Typecheck

**Files:**

- Check all modified files compile together

- [ ] **Step 1: Full typecheck across monorepo**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Run all Stage Engine tests**

```bash
cd services/stage-engine && npx vitest run
```

Expected: All tests pass (existing + new).

- [ ] **Step 3: Commit any fixes if needed**

---

## Task 10: ADR — Platform Admin Pipeline Separation

**Files:**

- Create: `docs/decisions/0059-platform-admin-pipeline.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

Create `docs/decisions/0059-platform-admin-pipeline.md`:

```markdown
---
title: "ADR-0059: Platform Admin Pipeline Separation"
status: accepted
updated: 2026-03-28
created: 2026-03-28
module: stage-engine
tags: [adr, admin, pipeline, telegram, walkai]
---

# ADR-0059: Platform Admin Pipeline Separation

## Context

The Telegram adapter needs a message processing pipeline for the platform admin (Pontus). The existing `routeAgentMessage()` pipeline is workspace-scoped at every layer:

- `chat.ts` rejects requests without workspace_id (403)
- `agent-router.ts` requires workspaceId for authority loading, context collection, and tool selection
- `createAgentSession()` takes `workspaceId: string` (not nullable)
- Intent classifier categorizes into employee-facing capabilities

The platform admin is not an employee. His messages cross workspace boundaries.

## Decision

Create a separate lightweight `routeAdminMessage()` pipeline that:

1. Does NOT require workspace_id (accepts optional workspace context)
2. Skips workspace-scoped authority loading (god-mode = full access)
3. Has its own admin tool set (separate from employee capabilities)
4. Has its own system prompt (admin persona, not employee-facing)
5. Reuses the LLM infrastructure but skips workspace plumbing

## Rationale

- **Nullable DB column != nullable pipeline.** Migration 20260330 made `engine_sessions.workspace_id` nullable, but the TypeScript layer independently enforces non-null at every step.
- **A sentinel "system workspace" would violate tenant isolation semantics** and require `WHERE workspace_id != SENTINEL` guards in every downstream consumer.
- **Admin and employee are fundamentally different contexts** — different authority model, different tools, different intent space.

## Consequences

- Two message pipelines: `routeAgentMessage()` (workspace-scoped) and `routeAdminMessage()` (platform-scoped)
- Admin tools are plain functions, not registered capabilities
- Admin sessions have `workspace_id = NULL` in the database
- Future admin features can extend `routeAdminMessage()` without touching the employee pipeline
```

- [ ] **Step 2: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```markdown
| 0059 | Platform Admin Pipeline Separation | accepted | 2026-03-28 | stage-engine | routeAdminMessage() separate from workspace-scoped routeAgentMessage() |
```

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/0059-platform-admin-pipeline.md docs/decisions/0000-decision-log.md
git commit -m "docs(decisions): ADR-0059 platform admin pipeline separation

Separate routeAdminMessage() from workspace-scoped routeAgentMessage().
Admin is god-mode, cross-workspace, with own tool set and prompt.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                                 | Files                       |
| ---- | ------------------------------------ | --------------------------- |
| 1    | Database migration                   | 1 SQL + types regen         |
| 2    | TypeScript types                     | 3 files (new + 2 modified)  |
| 3    | Secrets + env vars                   | 2 files modified            |
| 4    | Telegram Bot API client              | 1 new + 1 test              |
| 5    | Admin router pipeline                | 1 new + 1 test              |
| 6    | Webhook handler + route registration | 1 new + 1 modified + 1 test |
| 7    | Telemetry events                     | 1 file modified             |
| 8    | Chat bridge (PG NOTIFY)              | 1 new + 2 modified + 1 test |
| 9    | Full integration typecheck           | Verification only           |
| 10   | ADR                                  | 2 docs                      |

Total: 4 new source files, 6 modified files, 4 test files, 1 migration, 2 docs.
