---
title: Mobile Chat Enhancements Handoff
status: done
updated: 2026-03-28
created: 2026-03-28
module: communication
tags: [mobile, chat, presence, channels, handoff]
---

# Handoff: Mobile Chat Enhancements

## Summary

Added chat features to the mobile app's channel screen: new conversation creation, online presence tracking, conversation pinning, featured channels, settings access, and logout. Also fixed critical bugs found by System Council review, seeded database with realistic data, and fixed shared bugs affecting both web and mobile.

## What Was Built

### 1. New Conversation (Bottom Sheet)

- `src/components/chat/NewConversationSheet.tsx` — @gorhom/bottom-sheet with search + profile list
- Queries workspace profiles filtered by `status IN ('active', 'trainee')`
- Creates DM via `create_dm_conversation` RPC (atomic: conversation + both participants)
- Idempotent: returns existing DM if found between same pair
- Triggered by `+` icon in channel header

### 2. Active Now (Presence)

- `src/hooks/realtime/use-online-profiles.ts` — Supabase Realtime presence channel (`online:{workspaceId}`)
- `src/components/chat/ActiveNowRow.tsx` — horizontal avatar strip with green online dot
- Tap → opens/creates DM with that person
- Auto-cleanup on disconnect (Supabase presence)

### 3. Pin Conversations

- `src/hooks/stores/use-pinned-conversations.ts` — Zustand + MMKV (device-local)
- `src/components/chat/ConversationContextMenu.tsx` — long-press (400ms) modal with Pin/Unpin + Mute
- Pinned conversations appear in "Festet" section at top of channel list

### 4. Featured Channels

- Migration: `20260328190000_chat_conversation_is_featured.sql` — `is_featured BOOLEAN NOT NULL DEFAULT FALSE`
- Channels with `is_featured = true` shown in "Anbefalt" section
- No admin UI yet — set via direct DB for now

### 5. Channel Header

- Replaced NotificationBell with Settings gear (only on channel screen, bell remains on all other screens)
- Added `+` icon for new conversation
- Header: Burger | "Kanaler" | `+` `⚙`

### 6. Logout

- Fixed SettingsSheet logout action: was `router.push("/(app)/(me)")`, now calls `supabase.auth.signOut()`

### 7. Section Ordering (use-conversations.ts)

Updated `useGroupedConversations` to support pinned + featured sections:

1. Festet (pinned)
2. Anbefalt (featured)
3. Aktive vakter (during shift)
4. Kanaler
5. Direktmeldinger

### 8. Database Seeding

Added to `seed.sql`:

- 20 schedule_shift rows (Anna 10, Erik 3, Ole 5, Kari 3, 2 open)
- 3 payroll.period + 3 payroll.calculation + 15 payroll.calculation_line
- 9 payroll.timebank_entry
- 5 schedule_absence (vacation + sick)
- 7 channels + 20 channel_members + 22 channel_messages

### 9. Bug Fixes

- **push_dispatch trigger**: `trigger_push_deviation_reported()` used `id` instead of `profile_id`
- **Migration ordering**: 9 migrations renamed to fix FK dependency order
- **UUID format**: Seed data used non-hex prefixes (ss, pp, etc.) → fixed
- **Removed DEV_CONVERSATIONS**: Hardcoded string IDs ("dev-dm-1") caused UUID parse errors
- **Web CreateChannel**: `is_active` → `status` filter (column doesn't exist on profile)
- **Payslip/Timebank screens**: Added back buttons
- **Home screen scroll**: Wrapped phase content in ScrollView

## Migrations

| File                                               | What                                         |
| -------------------------------------------------- | -------------------------------------------- |
| `20260328190000_chat_conversation_is_featured.sql` | `is_featured` boolean on `chat_conversation` |
| `20260328191000_create_dm_conversation_rpc.sql`    | Atomic DM creation with auth validation      |

## Council Review Findings (All Fixed)

| Issue                                              | Fix                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `source_type = 'direct'` violates CHECK constraint | Changed to `NULL` for DMs                                         |
| RPC callable by `anon` (no REVOKE)                 | Added `REVOKE FROM PUBLIC` + `GRANT TO authenticated`             |
| RPC has no caller validation                       | Added auth.uid() check + workspace membership validation          |
| `profile.is_active` doesn't exist                  | Changed to `.in("status", ["active", "trainee"])` in mobile + web |
| Hardcoded `#10b981` for online dot                 | Changed to `theme.colors.success`                                 |
| Unnecessary type cast for `is_featured`            | Removed — field is on the type from database.types.ts             |

## Critical Architecture Issue: Dual Chat Schema

**The mobile app uses `chat_conversation` / `chat_message` / `chat_participant` (old schema).**
**The web dashboard uses `channel` / `channel_message` / `channel_member` (new schema).**

Messages sent from mobile do NOT appear on web and vice versa. They are completely separate tables.

### What Needs to Happen

Migrate mobile hooks to the `channel` schema. The web already has working RPCs:

- `get_my_channels` — replaces `useGroupedConversations`
- `get_channel_messages` — replaces `useMessages`
- `create_channel` — replaces `create_dm_conversation`

Files to rewrite:

- `src/hooks/queries/use-conversations.ts` → use `get_my_channels` RPC
- `src/hooks/queries/use-messages.ts` → use `get_channel_messages` RPC
- `src/hooks/mutations/use-send-message.ts` → insert to `channel_message`
- `src/lib/sync/action-map.ts` → update `send_message` action
- `app/(app)/(chat)/[id].tsx` → update realtime subscription table

### What Can Be Kept

- `ActiveNowRow` — presence is independent of chat schema
- `NewConversationSheet` — just needs to call `create_channel` RPC instead
- `ConversationContextMenu` — pin/mute UX stays the same
- `use-pinned-conversations` — MMKV store is schema-agnostic (stores IDs)

## Known Issues / Debt

1. **Settings screen is cosmetic** — all toggles use local useState, no persistence
2. **Mute toggle is a TODO** — context menu has `onToggleMute` but no DB write
3. **`is_featured` has no admin UI** — must be set via SQL
4. **Hardcoded Norwegian strings** — new components don't use `strings` constant consistently
5. **No `emit()` on mobile DM creation** — telemetry convention violation
6. **Presence ghost profiles** — app backgrounding on iOS can leave stale presence for 30-60s
7. **No ADR for chat architecture** — dual schema decision should be documented

## New Files

```
apps/mobile/src/components/chat/ActiveNowRow.tsx
apps/mobile/src/components/chat/ConversationContextMenu.tsx
apps/mobile/src/components/chat/NewConversationSheet.tsx
apps/mobile/src/hooks/realtime/use-online-profiles.ts
apps/mobile/src/hooks/stores/use-pinned-conversations.ts
supabase/migrations/20260328190000_chat_conversation_is_featured.sql
supabase/migrations/20260328191000_create_dm_conversation_rpc.sql
```

## Modified Files (Key)

```
apps/mobile/app/(app)/(chat)/index.tsx — header, sections, ActiveNow, ContextMenu, NewConvSheet
apps/mobile/src/hooks/queries/use-conversations.ts — pinned + featured sections
apps/mobile/src/components/home/SettingsSheet.tsx — logout fix + supabase import
apps/web/src/app/dashboard/komm/_components/CreateChannel.tsx — is_active → status fix
supabase/seed.sql — shifts, payroll, timebank, absence, channels data
packages/supabase/src/database.types.ts — regenerated with new RPC + column
```
