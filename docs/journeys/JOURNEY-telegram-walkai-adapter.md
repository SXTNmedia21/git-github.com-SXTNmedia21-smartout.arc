---
title: "User Journeys — Telegram WalkAi Adapter"
status: done
updated: 2026-03-28
created: 2026-03-28
module: stage-engine
tags: [telegram, walkai, admin, journeys]
---

# User Journeys — Telegram WalkAi Adapter

## Journey: Platform Admin — Chat with WalkAi via Telegram

**Precondition:** Pontus has Telegram bot configured (BotFather), bot token + webhook secret + chat ID stored in 1Password vault. Stage Engine deployed with webhook registered.

1. Pontus opens Telegram, sends a message to the SmartoutBot
2. Telegram delivers webhook to `POST /adapters/telegram/webhook`
3. Stage Engine verifies secret token header, deduplicates by update_id
4. System loads or creates an `engine_session` (channel=telegram, mode=agent, workspace_id=NULL)
5. Message routes through `routeAdminMessage()` (no workspace scope, god-mode)
6. LLM (Claude Sonnet via OpenRouter) generates response
7. Response sent back via Telegram Bot API `sendMessage`
8. Pontus sees the response in Telegram

**Postcondition:** Conversation persists in engine_session.collected_data.conversation (windowed to 50 turns).

**Error paths:**

- Wrong secret token → 401, message rejected
- Non-admin chat ID → message silently ignored (logged as warning)
- LLM error → error message sent to Telegram: "Error processing message: {error}"
- Duplicate update_id → silently skipped (idempotency)

---

## Journey: Platform Admin — Set Workspace Context

**Precondition:** Active Telegram session exists.

1. Pontus sends `/workspace sjohuset` in Telegram
2. System looks up workspace by slug
3. If found: updates session's workspace_id, sends confirmation: "Workspace set to: Sjohuset (sjohuset)"
4. If not found: sends "Workspace 'sjohuset' not found."

**Postcondition:** Subsequent queries are scoped to the selected workspace.

1. Pontus sends `/workspace clear`
2. System sets session workspace_id to NULL
3. Sends confirmation: "Workspace context cleared."

**Postcondition:** Queries return to platform-level (cross-workspace).

---

## Journey: Platform Admin — Receive Escalation via Telegram

**Precondition:** System event triggers an escalation (e.g., employee no-show).

1. WalkAi calls `sendTelegramEscalation()` with title, body, severity, and action buttons
2. System stores each action in `telegram_callback_action` table (UUID as key)
3. Telegram message sent with inline keyboard buttons (each button's callback_data = action UUID)
4. Pontus sees escalation with severity emoji and action buttons
5. Pontus taps an action button (e.g., "Flag no-show")
6. Telegram sends callback_query to webhook
7. System looks up action by UUID in `telegram_callback_action`
8. Action executed through `routeAdminMessage()`, marked as resolved
9. Original message edited to show "Resolved: {action_type}"
10. Callback query answered (removes loading spinner)

**Postcondition:** Action executed, escalation resolved, original message updated.

**Error paths:**

- Action already resolved → "Action expired or already resolved" toast
- Action UUID not found → "Action expired or already resolved" toast
- Duplicate callback (Telegram retry) → idempotent (update_id dedup)

---

## Journey: Platform Admin — Respond to Poll

**Precondition:** WalkAi sends a poll (e.g., "Who to call in for Saturday?").

1. WalkAi calls `sendTelegramPoll()` with question, options, and action mappings
2. System stores option-to-action mapping in `telegram_poll_action` table
3. Poll sent via Telegram native poll API (non-anonymous, single or multiple choice)
4. Pontus votes on option(s)
5. Telegram sends poll_answer to webhook
6. System looks up mapping by telegram_poll_id
7. Actions for selected option(s) executed via `routeAdminMessage()`
8. Poll marked as resolved
9. Confirmation message sent: "Poll resolved. Executed: {selected options}"

**Postcondition:** Actions executed for all selected options, poll marked resolved.

**Error paths:**

- Unknown poll_id → silently ignored (logged as warning)
- Poll already resolved → silently ignored

---

## Journey: Platform Admin — Bridge Chat with Employee

**Precondition:** Active Telegram session. An employee is chatting in Smartout.

1. WalkAi calls `openBridge(sessionId, channelId, context)` (triggered by escalation or admin request)
2. System closes any existing active bridge
3. New bridge row created in `telegram_chat_bridge`
4. Pontus sees: "Bridge opened to: {channel name}. Type to reply. /done to close."
5. Employee sends a message in Smartout app
6. `channel_message` INSERT triggers PG NOTIFY
7. Stage Engine PG NOTIFY listener receives the notification
8. `relayToTelegram()` checks active bridge matches channel, looks up sender name
9. Pontus sees: "[Employee Name]: {message}"
10. Pontus types a reply in Telegram
11. Webhook receives the message, detects active bridge
12. `relayToSmartout()` inserts into `channel_message` as admin
13. Employee sees the reply in Smartout app

**Postcondition:** Bidirectional chat between Telegram and Smartout channel.

1. Pontus sends `/done` in Telegram
2. System closes the bridge (status=closed, closed_at set)
3. Pontus sees: "Bridge closed."

**Postcondition:** Bridge closed, messages no longer relayed.

**Error paths:**

- `/done` with no active bridge → "No active bridge to close."
- PG NOTIFY connection drops → auto-reconnect after 5 seconds
- Stage Engine restarts → PG NOTIFY listener re-established on startup
- Admin messages not echoed back (sender_id null → skip in relayToTelegram)
- Opening new bridge auto-closes previous (only one active at a time)
