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
routeAdminMessage() — admin-specific pipeline
  (no workspace scope, god-mode authority, admin tool set, admin persona)
```

Follows the existing Ultravox voice adapter pattern in `services/stage-engine/src/routes/adapters/`.

### Admin Pipeline vs Employee Pipeline (Council Decision)

The existing `routeAgentMessage()` pipeline is workspace-scoped at every layer:

- `chat.ts` rejects requests without workspace_id (403)
- `agent-router.ts` requires workspaceId for authority, context, and tool selection
- `createAgentSession()` takes `workspaceId: string` (not nullable)
- Intent classifier categorizes into employee-facing capabilities

Pontus is a platform admin, not an employee. His messages cross workspace boundaries.

**Decision:** Create a separate lightweight `routeAdminMessage()` pipeline that:

- Does NOT require workspace_id
- Skips workspace-scoped authority loading (god-mode = full access)
- Has its own admin tool set (Telegram tools + cross-workspace query tools)
- Has its own system prompt (admin persona, not employee-facing Botsson)
- Accepts an optional `workspaceId` parameter for workspace-scoped queries (e.g., `/workspace sjohuset` command to set context)
- Reuses the LLM call infrastructure — just skips the workspace plumbing

**ADR required:** Platform-admin pipeline vs workspace-scoped pipeline (ADR-0059 or next available).

**Learning:** Nullable DB column != nullable pipeline. TypeScript types, function signatures, and middleware guards form an independent enforcement chain. Always trace the full call path before assuming a schema change enables a new use case.

## 1. Inbound: Telegram → WalkAi

### Webhook Handler

Route: `POST /adapters/telegram/webhook`

Auth: Webhook route skips the global auth middleware (same pattern as WebSocket routes in `index.ts`). Self-authenticated via `X-Telegram-Bot-Api-Secret-Token`.

Flow:

1. Verify webhook via `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`
2. **Idempotency check:** Store `update_id` in a Set/LRU cache. Reject duplicates. Telegram may retry webhooks on timeout — duplicate actions (e.g., approving an absence twice) must be prevented.
3. Parse Telegram update (message, callback_query, poll_answer)
4. Reject if `chat.id !== TELEGRAM_ADMIN_CHAT_ID` (single-user guard)
5. Route by update type:
   - `message` → check for active chat bridge first, then admin chat
   - `callback_query` → button action handler
   - `poll_answer` → poll resolution handler
6. For messages: load or create `engine_session` (channel = `'telegram'`, mode = `'agent'`)
7. Call `routeAdminMessage()` with message content + session
8. Format response (Markdown → Telegram MarkdownV2, chunked if >4096 chars)
9. Send reply via `sendMessage` Bot API call
10. Return 200 immediately (Telegram requires fast response)

### Session Management

- One long-lived session per admin chat — reused across messages
- Session lookup: query `engine_sessions` where `channel = 'telegram'` and `status = 'active'`
- If no active session exists, create one with `workspace_id = NULL` (allowed since migration 20260330)
- No auto-expiry — Pontus explicitly ends sessions if needed
- **Conversation windowing:** Max 50 turns in context. Older turns are summarized into a context note and archived. Prevents unbounded JSONB growth in `collected_data.conversation[]`.

### Profile Linking

No database table — `TELEGRAM_ADMIN_CHAT_ID` env var maps to Pontus's profile.
Profile lookup: query `user_identity` by `is_godmode = true`.

### Workspace Context Switching

Pontus can scope queries to a specific workspace using a `/workspace <slug>` command:

```
/workspace sjohuset    → sets workspace context for subsequent queries
/workspace clear       → removes workspace context (platform-level)
```

The admin pipeline passes `workspaceId` (when set) to tools that need it, but never requires it.

## 2. Outbound: WalkAi → Telegram

### Architecture Decision: Plain Functions, Not Capabilities

Council finding: Telegram outbound tools are delivery mechanisms, not domain capabilities. They should NOT be registered in the AI capability system (`CapabilityName`, `registry.ts`). Instead:

- **Outbound functions** live in `services/stage-engine/src/core/telegram.ts` as plain TypeScript functions
- **Admin tools** (for the LLM to call) are defined inline in the `routeAdminMessage()` pipeline, separate from the employee tool registry
- Event handlers and engine-dispatch call the plain functions directly

This avoids polluting the employee capability system with platform-admin infrastructure.

### 2.1 Event Notifications

Function: `sendTelegramNotification(text, parseMode?)`

Admin tool (for LLM): `send_telegram_message`

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

**Telemetry-to-Telegram routing:** A new handler in the Stage Engine subscribes to specific telemetry events (configurable list) and calls `sendTelegramNotification()` directly. Events to subscribe defined in a config object, not hardcoded.

### 2.2 Escalations

Function: `sendTelegramEscalation(title, body, severity, actions)`

Admin tool (for LLM): `escalate_to_admin`

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
      action_type: z.string(),
      action_payload: z.record(z.unknown()),
    })).max(8),
  }),
}
```

**Callback data size limit:** Telegram limits `callback_data` to 64 bytes. Actions are stored in a lookup table (`telegram_callback_action`), and `callback_data` contains only a short UUID reference (36 bytes). When Pontus taps a button:

1. `callback_query` arrives at webhook
2. Look up action by UUID from `telegram_callback_action`
3. Validate action_type against allowed list (Zod schema per action_type)
4. Execute the action via `routeAdminMessage()` (preserves authority checks and audit trail)
5. Edit original message to show resolved state
6. Answer callback query (removes loading spinner)
7. Emit telemetry: `telegram.escalation.resolved`

**Action execution contract:** All callback actions route through `routeAdminMessage()`. No direct DB mutations from button presses. This ensures authority checks, telemetry, and audit trail are preserved.

### 2.3 Polls

Function: `sendTelegramPoll(question, options, allowsMultiple)`

Admin tool (for LLM): `send_admin_poll`

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
2. Store option-to-action mapping in `telegram_poll_action` table
3. When `poll_answer` update arrives at webhook:
   - Check idempotency (update_id dedup)
   - Look up mapping by `telegram_poll_id`
   - Validate action_type + payload against Zod schemas
   - Execute action(s) for selected option(s) via `routeAdminMessage()`
   - Mark poll as resolved
   - Send confirmation message
   - Emit telemetry: `telegram.poll.resolved`

## 3. Chat Bridge: Smartout ↔ Telegram

### Opening a Bridge

Admin tool (for LLM): `bridge_chat_to_telegram`

```typescript
{
  name: 'bridge_chat_to_telegram',
  description: 'Connect a Smartout chat thread to Telegram for direct employee communication',
  schema: z.object({
    channel_id: z.string().uuid().describe('Smartout channel ID'),
    context: z.string().optional().describe('Why the bridge was opened — shown to admin'),
  }),
}
```

Flow:

1. Insert row into `telegram_chat_bridge` (session_id, channel_id, telegram_chat_id, status=active)
2. Subscribe to new messages on `channel_message` where `channel_id` matches (see Relay Mechanism below)
3. Send Telegram message: "Connected to [Employee Name]. Type to reply. /done to close."
4. If `context` provided, include it: "Context: Employee missed shift, needs absence approval"
5. Emit telemetry: `telegram.bridge.opened`

### Message Relay Mechanism

**Option A (recommended): DB trigger → engine_event → Stage Engine handler**

Instead of Supabase Realtime subscriptions (which are designed for client-side use and add reconnection complexity), use:

1. A DB trigger on `channel_message` INSERT that fires `pg_notify('telegram_bridge', ...)`
2. Stage Engine listens via `pg_listen` on the `telegram_bridge` channel
3. Handler checks if the message's `channel_id` has an active bridge
4. If yes: format and forward to Telegram via `sendMessage`

This is more reliable than Realtime — no WebSocket reconnection concerns, no service-role Realtime config needed, survives brief service restarts (messages queue in PG notify buffer).

**Smartout → Telegram:**

- DB trigger fires on new `channel_message`
- Format: `"[Employee Name]: message content"`
- Forward to Telegram via `sendTelegramNotification()`
- Emit telemetry: `telegram.bridge.message_relayed`

**Telegram → Smartout:**

- Inbound message arrives at webhook
- Check for active bridge (query `telegram_chat_bridge` where status=active)
- If bridge active: insert message into `channel_message` using `supabaseAdmin` (service_role) as Pontus's profile
- If no bridge: route to normal admin chat flow
- Emit telemetry: `telegram.bridge.message_relayed`

**Bridge profile attribution:** Pontus uses `is_godmode` identity. Messages are inserted via service_role with Pontus's `user_identity.id` as sender. The `channel_message.sender_profile_id` is set to NULL with a `sender_name` override field, or Pontus's profile is auto-created in the target workspace on bridge open. Decision: use service_role insert with `sender_name = 'Pontus (Admin)'` to avoid creating fake profiles.

### Closing a Bridge

Admin tool (for LLM): `close_chat_bridge`

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

On Stage Engine startup, query `telegram_chat_bridge WHERE status = 'active'` and re-establish `pg_listen` for the bridge channel. Since we use PG NOTIFY (not Realtime subscriptions), recovery is just re-listening — no per-bridge subscription needed.

### Bridge Concurrency

Only one bridge active at a time for v1. If Pontus opens a new bridge, the previous one auto-closes. This avoids routing ambiguity (which bridge gets the inbound message?).

Flow:

1. Update `telegram_chat_bridge` set status=closed, closed_at=now()
2. Stop relaying messages for that channel
3. Send Telegram confirmation: "Bridge closed."
4. Emit telemetry: `telegram.bridge.closed`

## 4. Database Migration

Schema: `public` — small integration (3 tables), tightly coupled to existing `engine_sessions` and `channel`. No distinct domain boundary warrants a dedicated schema.

```sql
-- 1. Add 'telegram' to engine_sessions channel constraint
ALTER TABLE engine_sessions DROP CONSTRAINT engine_sessions_channel_check;
ALTER TABLE engine_sessions ADD CONSTRAINT engine_sessions_channel_check
  CHECK (channel IN ('voice', 'sms', 'chat', 'email', 'autonomous', 'telegram'));

-- 2. Chat bridge state
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

ALTER TABLE telegram_chat_bridge ENABLE ROW LEVEL SECURITY;

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
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE telegram_poll_action ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_telegram_poll_action
  BEFORE UPDATE ON telegram_poll_action
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Callback action lookup (for inline keyboard buttons)
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

-- 5. Bridge relay trigger (PG NOTIFY)
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

No workspace_id on any table — this is platform-admin infrastructure, not tenant-scoped. All tables use deny-all RLS (service_role only).

## 5. Telemetry Events

All events registered in `packages/telemetry/src/registry.ts`:

| Event                             | When                                  | Destinations                    |
| --------------------------------- | ------------------------------------- | ------------------------------- |
| `telegram.session.created`        | New admin session created             | Logger, activity_trail          |
| `telegram.message.received`       | Inbound message from Telegram         | Logger, activity_trail          |
| `telegram.message.sent`           | Outbound message/notification sent    | Logger, activity_trail          |
| `telegram.escalation.sent`        | Escalation with buttons pushed        | Logger, activity_trail          |
| `telegram.escalation.resolved`    | Callback button action executed       | Logger, activity_trail, PostHog |
| `telegram.poll.sent`              | Poll sent to admin                    | Logger, activity_trail          |
| `telegram.poll.resolved`          | Poll answered + action executed       | Logger, activity_trail, PostHog |
| `telegram.bridge.opened`          | Chat bridge created                   | Logger, activity_trail          |
| `telegram.bridge.closed`          | Chat bridge closed                    | Logger, activity_trail          |
| `telegram.bridge.message_relayed` | Message forwarded in either direction | Logger                          |

## 6. Infrastructure

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

## 7. TypeScript Type Updates

The following types must be updated to include `'telegram'`:

| File                                         | Type                       | Change                                                               |
| -------------------------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `services/stage-engine/src/types/session.ts` | `SessionChannel`           | Add `'telegram'` to union                                            |
| `services/stage-engine/src/types/agent.ts`   | `AgentChatRequest.channel` | Add `'telegram'` to union (or make it passthrough to SessionChannel) |

NOT updated (Telegram tools are NOT capabilities):

- `packages/ai/src/capabilities/types.ts` — `CapabilityName` stays unchanged
- `packages/ai/src/capabilities/registry.ts` — no registration

## 8. Files

### New Files

| File                                                      | Purpose                                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `services/stage-engine/src/routes/adapters/telegram.ts`   | Webhook handler, message formatter, callback/poll handlers, auth bypass                                          |
| `services/stage-engine/src/core/telegram.ts`              | Bot API client, outbound functions (sendNotification, sendEscalation, sendPoll), bridge relay, pg_listen handler |
| `services/stage-engine/src/core/admin-router.ts`          | `routeAdminMessage()` — lightweight admin pipeline (no workspace scope, god-mode authority, admin tools)         |
| `supabase/migrations/YYYYMMDDHHMMSS_telegram_adapter.sql` | Channel constraint + 3 tables + bridge trigger                                                                   |

### Modified Files

| File                                         | Change                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/stage-engine/src/index.ts`         | Mount telegram routes (same as Ultravox), auth middleware bypass for webhook path, pg_listen setup, optional webhook registration on startup |
| `services/stage-engine/src/types/session.ts` | Add `'telegram'` to `SessionChannel`                                                                                                         |
| `services/stage-engine/src/types/agent.ts`   | Add `'telegram'` to channel type                                                                                                             |
| `packages/telemetry/src/registry.ts`         | Register 10 telegram events                                                                                                                  |
| `infra/Caddyfile`                            | Add telegram route                                                                                                                           |
| `.env.template`                              | Add 3 telegram env vars                                                                                                                      |

## 9. Security

- **Single-user guard:** All inbound messages rejected unless `chat.id === TELEGRAM_ADMIN_CHAT_ID`
- **Webhook verification:** `X-Telegram-Bot-Api-Secret-Token` validated on every request
- **Auth middleware bypass:** Webhook route skips JWT/API key auth (self-authenticated via secret token)
- **Bot token:** 1Password vault, never in code or logs
- **Deny-all RLS:** All 3 new tables use deny-all RLS — service_role access only
- **No user-facing exposure:** This adapter has no dashboard UI, no API routes, no customer access
- **Bridge uses service_role:** Chat bridge inserts messages via supabaseAdmin, which is safe because the bridge is single-user admin-only with sender attribution
- **Webhook idempotency:** `update_id` deduplication prevents duplicate action execution from Telegram retries
- **Callback action validation:** All action_types validated against Zod schema before execution. Actions route through `routeAdminMessage()`, never direct DB mutations.

## 10. Scope Boundaries

**In scope:**

- Telegram webhook adapter in Stage Engine
- Admin pipeline (`routeAdminMessage()`) — lightweight, no workspace requirement
- 5 admin tools for LLM (send_message, escalate, bridge, close_bridge, poll)
- Plain outbound functions for event handlers to call directly
- Chat bridge with PG NOTIFY relay
- Poll + callback action support with lookup tables
- Migration for channel constraint + 3 tables + bridge trigger
- Telemetry: 10 events registered
- ADR: Platform-admin pipeline separation

**Out of scope:**

- Customer-facing Telegram integration (future product feature)
- Telegram group management (only 1:1 admin chat)
- Media/file handling (text-only for v1)
- Notification system integration (this bypasses `notification_outbox` — direct Telegram via functions)
- Dashboard UI for managing the bot
- Multiple concurrent chat bridges (v1 = one bridge at a time)

## 11. Dependencies

- No new npm packages — Telegram Bot API is a simple HTTP API (fetch calls)
- PG NOTIFY/LISTEN available via the existing Supabase connection
- Agent-router pipeline unchanged — Telegram uses a separate admin pipeline
- Existing `channel` and `channel_message` tables used for bridge (no schema changes to those tables)
