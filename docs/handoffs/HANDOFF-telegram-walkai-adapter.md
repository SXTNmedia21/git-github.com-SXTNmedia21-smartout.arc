---
title: "Handoff — telegram-walkai-adapter"
feature: telegram-walkai-adapter
branch: feat/telegram-walkai-adapter
closed: 2026-03-28
module: stage-engine
---

# Handoff — telegram-walkai-adapter

## Summary

Telegram adapter for the Stage Engine that connects Pontus (platform admin) to WalkAi/Mr. Botsson via Telegram. Single-user admin bot — not a product feature for customers. Supports inbound chat, outbound escalations with inline buttons, native polls with action mapping, and bidirectional chat bridge to Smartout employee channels via PG NOTIFY relay.

## What Was Done

- [x] Database migration: 3 tables (telegram_chat_bridge, telegram_poll_action, telegram_callback_action) + channel constraint + PG NOTIFY trigger
- [x] Telegram Bot API client: sendMessage (auto-chunking), sendPoll, answerCallbackQuery, editMessageText, registerWebhook, sendEscalation
- [x] Admin router pipeline: routeAdminMessage() — separate from workspace-scoped routeAgentMessage() (ADR-0059)
- [x] Webhook handler: POST /adapters/telegram/webhook with secret verification, update_id deduplication, async processing
- [x] /workspace command: set/clear workspace context per session
- [x] Chat bridge: open/close bridge, PG NOTIFY listener for message relay, echo prevention
- [x] Telemetry: 10 events registered in registry.ts
- [x] 47 unit tests across 4 test files
- [x] ADR-0059: Platform Admin Pipeline Separation
- [x] Post-implementation council review: 6 column name bugs found and fixed

## Decisions Made

| Decision                                         | Reason                                                                         | Impact                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Separate routeAdminMessage() pipeline (ADR-0059) | Existing pipeline hard-requires workspaceId at every layer                     | Two parallel pipelines: admin (no workspace) + employee (workspace-scoped) |
| Plain functions, not AI capabilities             | Admin tools are delivery mechanisms, not domain capabilities                   | No CapabilityName or registry changes needed                               |
| PG NOTIFY over Supabase Realtime for bridge      | Realtime designed for client-side; PG NOTIFY is more reliable server-to-server | Requires pg npm package and raw DB connection                              |
| Deny-all RLS on all tables                       | Platform admin infrastructure, not tenant-scoped                               | Service role only access                                                   |
| In-memory update_id deduplication                | Simple, sufficient for single-user admin bot                                   | Resets on restart (acceptable)                                             |

## Learnings

| Learning                                                       | Context                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Nullable DB column != nullable pipeline                        | Migration made workspace_id nullable, but TypeScript types, function signatures, and middleware all independently enforce non-null |
| Subagent implementers drift from schema column names           | 6 column mismatches found by council — mocked Supabase tests are blind to column names                                             |
| Post-implementation council is essential for DB-heavy adapters | Unit tests with mocked Supabase cannot verify column alignment                                                                     |
| emitGuardianEvent != emit() from @smartout/telemetry           | Guardian bus broadcasts to WebSocket clients; telemetry registry routes to PostHog/activity_trail. Different systems.              |

## Known Issues / Debt

- Telemetry uses emitGuardianEvent (WebSocket broadcast) instead of emit() from @smartout/telemetry — the 10 registered events are typed but not routed through the full pipeline (PostHog, activity_trail). Acceptable for v1 admin-only bot.
- PG NOTIFY trigger fires on ALL channel_message inserts globally — could add WHERE guard for performance if chat volume grows.
- No admin LLM tools yet — routeAdminMessage() is pure conversation. Tools (query workspace data, manage shifts, etc.) can be added incrementally.
- PG NOTIFY reconnect uses fixed 5s delay — no exponential backoff.

## Next Steps

- Store Telegram bot token, webhook secret, and admin chat ID in 1Password vault
- Deploy Stage Engine with new routes
- Call registerWebhook() once to register with Telegram
- Add admin LLM tools incrementally (query shifts, manage employees, etc.)
- Consider migrating emitGuardianEvent to proper emit() calls if activity trail tracking is needed
