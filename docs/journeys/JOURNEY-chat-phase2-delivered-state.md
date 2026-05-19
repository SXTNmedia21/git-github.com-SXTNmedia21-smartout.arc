---
title: "Journey — Employee sees delivered → read progression"
feature: chat-whatsapp-phase2
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, presence, realtime]
---

# Journey: Employee sees delivered → read progression on own messages

**Precondition:** Employee sent message to channel with 1+ other member. Phase 1 ships sent/read only — Phase 2 adds delivered.

1. Employee sends message → Optimistic insert → ReadReceipt `pending` (Clock icon).
2. Supabase insert resolves → ReadReceipt → `sent` (single Check, muted).
3. Other party's client has ConversationScreen mounted OR app foregrounded → broadcasts `presence:joined:${channelId}` with unread message_ids.
4. Sender's `use-channel-read-receipts` receives presence-join event → marks own outbound messages as `delivered` → ReadReceipt → `delivered` (CheckCheck, muted).
5. Other party scrolls message into viewport → mark-read mutation inserts `channel_message_read` row → Realtime INSERT event fires.
6. Sender's client receives INSERT → marks message as `read` → ReadReceipt → `read` (CheckCheck filled brand-orange).

**Postcondition:** Sender sees full 4-state progression: pending → sent → delivered → read.

**Error paths:**
- Other party never opens app → delivered never fires; state stuck at `sent` (acceptable, matches WhatsApp offline behavior).
- Presence broadcast lost → next message will re-trigger join; eventual consistency.
- Message hard-deleted (T6 work) → read-receipt row dropped via DELETE sub; sender's state regresses `read` → `sent`.
