---
title: "Journey — Employee reads channel (WhatsApp-feel)"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile]
---

# Journey: Employee reads channel

**Precondition:** Employee is signed in, has profile.status=active in workspace, channel has 50+ messages spanning 5+ days.

1. Employee opens Chat tab → System loads channel list → Employee sees inbox with unread badges.
2. Employee taps a channel → System opens ConversationScreen, fetches messages via Supabase → Employee sees inverted FlatList of messages.
3. Scrolling through history → System groups messages by date locally → Employee sees `DateDivider` pills between days ("I DAG", "I GÅR", "torsdag 15. mai").
4. Own messages render right with `bg-secondary`, asymmetric tail-corner bottom-right, time + read-receipt glyph inline bottom-right of bubble.
5. Other-party messages render left with `bg-muted`, asymmetric tail-corner bottom-left, sender name above, time inline bottom-right of bubble.
6. As messages scroll into viewport → `onViewableItemsChanged` marks them read → System calls `mark-read` mutation → `emit('chat.message_read', ...)` fires.

**Postcondition:** Channel inbox unread badge cleared. `channel_message_read` rows inserted for every viewed message.

**Error paths:**
- Network down → optimistic UI keeps bubbles rendered; mark-read mutation queued by offline-queue (existing infra).
- Empty workspace_id at mutation site → `getProfileContext()` throws → no corrupt telemetry (ADR-0134).
