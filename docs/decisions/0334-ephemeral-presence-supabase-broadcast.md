---
id: ADR-0334
title: "Ephemeral presence via Supabase broadcast (vs channel_presence table)"
status: proposed
date: 2026-05-16
deciders: [Pontus, Claude]
tags: [mobile, realtime, presence, chat]
supersedes: null
superseded_by: null
created: 2026-05-16
updated: 2026-05-16
module: mobile
---

# ADR-0334: Ephemeral presence via Supabase broadcast (vs channel_presence table)

## Context

Phase 2 of the chat-whatsapp feature added two presence-like behaviors:

1. **Typing indicator** — `use-emit-typing` broadcasts every 2s while the user types; `use-typing-indicator` displays who is currently typing above the composer.
2. **Delivered-state ack** — When a receiver opens a channel, `ConversationBody` broadcasts a one-shot `presence-join` event so the sender's `use-channel-read-receipts` hook can promote outbound message states from `sent` → `delivered`.

Both behaviors require "who is active right now" semantics. The `channel_presence` table exists in the schema (added 2026-04-22, columns: `profile_id`, `channel_id`, `status` enum `online/away/offline`, `last_seen_at`) but has been unused since creation.

## Decision

Use **Supabase Realtime broadcast** for ephemeral presence (typing indicator + delivered-ack). Reserve the `channel_presence` table for future **durable status** work (online/away/offline indicators that must survive page refresh or be queryable).

Two broadcast channels per active conversation:
- `chat-typing:${channelId}` — typing presence; payload `{ profile_id, expires_at }` every 2s
- `chat-presence:${channelId}` — one-shot delivered-ack; payload `{ profile_id, unread_message_ids }`

Both channels share the same subscribe/lifecycle pattern used by `use-channel-read-receipts` (postgres_changes INSERT/DELETE on `channel_message_read`).

## Rationale

| Criterion | Broadcast | `channel_presence` table |
|-----------|-----------|--------------------------|
| Migration required | No | Yes (INSERT + DELETE or UPSERT + TTL logic) |
| RLS surface change | No | Yes (new policy surface) |
| GC / expiry | Sender-side expiry timestamp | Requires DELETE or TTL column |
| Survives disconnect | No (acceptable for typing + delivered) | Yes (required for online/away/offline) |
| Queryable in SQL | No | Yes |
| Suitable for analytics | No | Yes |

Broadcast is strictly correct for the two Phase 2 use cases: both are ephemeral by nature and neither needs to survive a reconnect or appear in queries.

## Consequences

- Presence state lost on disconnect — acceptable for typing + delivered, **NOT** acceptable for persistent online-status (use table when that lands).
- Broadcast packets can be lost (no retry, no replay); sender re-broadcasts on next state change (2s debounce keeps indicator alive during active typing).
- Per-conversation channel count: 2 broadcast channels + 1 postgres_changes channel per active chat. Monitor Supabase channel limits on workspaces with large active user counts.
- `channel_presence` table remains inert until a future ADR explicitly activates it for durable status.

## Alternatives considered

1. **`channel_presence` table for everything** — Heavier. Requires UPSERT + DELETE flow, additional RLS dual-auth surface, GC logic for stale rows. Premature for Phase 2 scope.
2. **PostgreSQL LISTEN/NOTIFY directly** — Bypasses Supabase abstraction, harder to test in isolation, exposes internal plumbing to mobile client.
3. **Polling** — Unacceptable latency and server load for real-time typing indicators.

## When to revisit

- If presence state needs to persist across reconnects (e.g. "Anna was last seen 5 min ago").
- If presence state needs to appear in SQL queries or joins.
- If Supabase channel count per connection becomes a bottleneck (current: 2+1 per conversation).

At that point, activate `channel_presence` table with a dedicated ADR covering UPSERT semantics, TTL, and RLS policy additions.
