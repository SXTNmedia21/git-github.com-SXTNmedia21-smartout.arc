---
title: Telegram WalkAi Adapter
status: draft
updated: 2026-03-28
created: 2026-03-28
module: stage-engine
tags: [telegram, walkai, adapter, botsson, escalation]
---

# Telegram WalkAi Adapter — Design Spec

## Purpose

Connect Pontus (platform admin) to WalkAi / Mr. Botsson via Telegram. Single-user admin bot — not a product feature for customers.

Three capabilities:

1. **Inbound** — Pontus talks to WalkAi from Telegram (queries, commands, decisions)
2. **Outbound** — WalkAi pushes event notifications, escalations, and polls to Telegram
3. **Chat bridge** — Botsson connects Pontus to a Smartout employee chat via Telegram relay

## Architecture

```
Telegram Bot API
    ↕ (webhook + HTTP)
Caddy reverse proxy
    ↕
Stage Engine (Hono, port 3000)
  /adapters/telegram/webhook
    ↕
agent-router.chat() — full WalkAi pipeline
  (intent → context → authority → tools → LLM → response)
```

Follows the existing Ultravox voice adapter pattern in `services/stage-engine/src/routes/adapters/`.

## 1. Inbound: Telegram → WalkAi

### Webhook Handler

Route: `POST /adapters/telegram/webhook`

Flow:

1. Verify webhook via `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`
2. Parse Telegram update (message, callback_query, poll_answer)
3. Reject if `chat.id !== TELEGRAM_ADMIN_CHAT_ID` (single-user guard)
4. Route by update type:
   - `message` → agent chat
   - `callback_query` → button action handler
   - `poll_answer` → poll resolution handler
5. For messages: load or create `engine_session` (channel = `'telegram'`, mode = `'agent'`)
6. Call `agent-router.chat()` with message content + session
7. Format response (Markdown → Telegram MarkdownV2, chunked if >4096 chars)
8. Send reply via `sendMessage` Bot API call
9. Return 200 immediately (Telegram requires fast response)

### Session Management

- One long-lived session per admin chat — reused across messages
- Session lookup: query `engine_sessions` where `channel = 'telegram'` and `status = 'active'`
- If no active session exists, create one with `workspace_id = NULL` (platform-level admin context)
- No auto-expiry — Pontus explicitly ends sessions if needed
- Conversation history persists in `collected_data.conversation[]`

### Profile Linking

No database table — `TELEGRAM_ADMIN_CHAT_ID` env var maps to Pontus's profile.
Profile lookup: query `user_identity` by godmode flag or hardcoded admin user_id from env.

## 2. Outbound: WalkAi → Telegram

### 2.1 Event Notifications

Tool: `send_telegram_message`

```typescript
{
  name: 'send_telegram_message',
  description: 'Send a notification or message to the platform admin via Telegram',
  schema: z.object({
    text: z.string().describe('Message content (Markdown supported)'),
    parse_mode: z.enum(['MarkdownV2', 'HTML']).default('MarkdownV2').optional(),
  }),
}
```

Used by: telemetry event handlers, engine-dispatch actions, proactive agent alerts.

### 2.2 Escalations

Tool: `escalate_to_admin`

```typescript
{
  name: 'escalate_to_admin',
  description: 'Send an escalation to the admin with action buttons',
  schema: z.object({
    title: z.string().describe('Escalation title'),
    body: z.string().describe('Context and details'),
    severity: z.enum(['info', 'warning', 'critical']),
    actions: z.array(z.object({
      label: z.string(),
      action_type: z.string(),  // e.g. 'approve_absence', 'flag_no_show'
      action_payload: z.record(z.unknown()),
    })).max(8),  // Telegram inline keyboard limit per row
  }),
}
```

Renders as a Telegram message with inline keyboard buttons. When Pontus taps a button:

1. `callback_query` arrives at webhook
2. Parse `callback_data` (JSON-encoded action reference)
3. Execute the action via agent-router or direct DB mutation
4. Edit original message to show resolved state
5. Answer callback query (removes loading spinner)

### 2.3 Polls

Tool: `send_admin_poll`

```typescript
{
  name: 'send_admin_poll',
  description: 'Send a poll to the admin with options mapped to workflow actions',
  schema: z.object({
    question: z.string(),
    options: z.array(z.object({
      label: z.string(),
      action_type: z.string(),
      action_payload: z.record(z.unknown()),
    })).min(2).max(10),
    allows_multiple: z.boolean().default(false),
  }),
}
```

Flow:

1. Send poll via `sendPoll` Bot API
2. Store option→action mapping in `telegram_poll_action` table
3. When `poll_answer` update arrives at webhook:
   - Look up mapping by `telegram_poll_id`
   - Execute action(s) for selected option(s)
   - Mark poll as resolved
   - Send confirmation message

## 3. Chat Bridge: Smartout ↔ Telegram

### Opening a Bridge

Tool: `bridge_chat_to_telegram`

```typescript
{
  name: 'bridge_chat_to_telegram',
  description: 'Connect a Smartout chat thread to Telegram for direct employee communication',
  schema: z.object({
    channel_id: z.string().uuid().describe('Smartout comm_channel ID'),
    context: z.string().optional().describe('Why the bridge was opened — shown to admin'),
  }),
}
```

Flow:

1. Insert row into `telegram_chat_bridge` (session_id, channel_id, telegram_chat_id, status=active)
2. Subscribe to Supabase Realtime on `comm_channel_message` where `channel_id` matches
3. Send Telegram message: "Connected to [Employee Name]. Type to reply. /done to close."
4. If `context` provided, include it: "Context: Employee missed shift, needs absence approval"

### Message Relay (Active Bridge)

**Smartout → Telegram:**

- Realtime subscription fires on new `comm_channel_message`
- Format: `"[Employee Name]: message content"`
- Forward to Telegram via `sendMessage`

**Telegram → Smartout:**

- Inbound message arrives at webhook
- Check for active bridge (query `telegram_chat_bridge` where status=active)
- If bridge active: insert message into `comm_channel_message` as Pontus's profile
- If no bridge: route to normal WalkAi chat flow

### Closing a Bridge

Tool: `close_chat_bridge`

```typescript
{
  name: 'close_chat_bridge',
  description: 'Close an active Telegram chat bridge',
  schema: z.object({
    bridge_id: z.string().uuid().optional().describe('Specific bridge to close. Omit to close all active.'),
  }),
}
```

Also triggered by:

- Pontus typing `/done` in Telegram while bridge is active
- Inactivity timeout (configurable, e.g. 30 minutes)

### Bridge Recovery on Restart

On Stage Engine startup, query `telegram_chat_bridge WHERE status = 'active'` and re-subscribe to Realtime for each active bridge. Ensures bridges survive service restarts.

Flow:

1. Update `telegram_chat_bridge` set status=closed, closed_at=now()
2. Unsubscribe from Realtime channel
3. Send Telegram confirmation: "Bridge closed."

## 4. Database Migration

Schema: `public` — small integration (2 tables), tightly coupled to existing `engine_sessions` and `comm_channel`.

```sql
-- 1. Add 'telegram' to engine_sessions channel constraint
ALTER TABLE engine_sessions DROP CONSTRAINT engine_sessions_channel_check;
ALTER TABLE engine_sessions ADD CONSTRAINT engine_sessions_channel_check
  CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous', 'telegram'));

-- 2. Chat bridge state
CREATE TABLE telegram_chat_bridge (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  channel_id       UUID NOT NULL REFERENCES comm_channel(id),
  telegram_chat_id BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

-- Deny-all RLS (service_role only)
ALTER TABLE telegram_chat_bridge ENABLE ROW LEVEL SECURITY;

-- Updated-at trigger
CREATE TRIGGER set_updated_at_telegram_chat_bridge
  BEFORE UPDATE ON telegram_chat_bridge
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Poll action mapping
CREATE TABLE telegram_poll_action (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_poll_id TEXT NOT NULL UNIQUE,
  session_id       UUID NOT NULL REFERENCES engine_sessions(id),
  options          JSONB NOT NULL,  -- [{index, label, action_type, action_payload}]
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

-- Deny-all RLS (service_role only)
ALTER TABLE telegram_poll_action ENABLE ROW LEVEL SECURITY;
```

No workspace_id on either table — this is platform-admin infrastructure, not tenant-scoped.

## 5. Infrastructure

### Environment Variables

Add to `.env.template`:

```
TELEGRAM_BOT_TOKEN=op://smartout_ai/telegram-bot/token
TELEGRAM_WEBHOOK_SECRET=op://smartout_ai/telegram-bot/webhook-secret
TELEGRAM_ADMIN_CHAT_ID=op://smartout_ai/telegram-bot/admin-chat-id
```

### Caddy Route

Add to `infra/Caddyfile`:

```
handle /engine/adapters/telegram/* {
    reverse_proxy stage-engine:3000
}
```

### Webhook Registration

On Stage Engine startup (or via a one-time script):

```typescript
await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `https://${PUBLIC_DOMAIN}/engine/adapters/telegram/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query", "poll_answer"],
  }),
});
```

Called once at deploy. Idempotent — safe to call repeatedly.

## 6. Files

### New Files

| File                                                      | Purpose                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `services/stage-engine/src/routes/adapters/telegram.ts`   | Webhook handler, Bot API client, message formatter, callback/poll handlers                                     |
| `services/stage-engine/src/core/telegram-bridge.ts`       | Chat bridge lifecycle, Realtime subscription management, relay logic                                           |
| `packages/ai/src/capabilities/telegram.ts`                | 5 tools: send_telegram_message, escalate_to_admin, bridge_chat_to_telegram, close_chat_bridge, send_admin_poll |
| `supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql` | Channel constraint + 2 tables                                                                                  |

### Modified Files

| File                                                 | Change                                     |
| ---------------------------------------------------- | ------------------------------------------ |
| `packages/ai/src/capabilities/registry.ts`           | Register telegram capability               |
| `services/stage-engine/src/routes/adapters/index.ts` | Mount telegram routes                      |
| `infra/Caddyfile`                                    | Add telegram route                         |
| `.env.template`                                      | Add 3 telegram env vars                    |
| `services/stage-engine/src/index.ts`                 | Webhook registration on startup (optional) |

## 7. Security

- **Single-user guard:** All inbound messages rejected unless `chat.id === TELEGRAM_ADMIN_CHAT_ID`
- **Webhook verification:** `X-Telegram-Bot-Api-Secret-Token` validated on every request
- **Bot token:** 1Password vault, never in code or logs
- **Deny-all RLS:** Both new tables use deny-all RLS — service_role access only
- **No user-facing exposure:** This adapter has no dashboard UI, no API routes, no customer access

## 8. Scope Boundaries

**In scope:**

- Telegram webhook adapter in Stage Engine
- 5 WalkAi tools for outbound communication
- Chat bridge with Realtime relay
- Poll support with action mapping
- Migration for channel constraint + 2 tables

**Out of scope:**

- Customer-facing Telegram integration (future product feature)
- Telegram group management (only 1:1 admin chat)
- Media/file handling (text-only for v1)
- Notification system integration (this bypasses `notification_outbox` — direct Telegram via tools)
- Dashboard UI for managing the bot

## 9. Dependencies

- No new npm packages — Telegram Bot API is a simple HTTP API (fetch calls)
- Supabase Realtime client already available in Stage Engine
- Agent-router pipeline unchanged — Telegram is just another channel
