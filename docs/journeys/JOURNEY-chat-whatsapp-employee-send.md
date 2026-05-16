---
title: "Journey — Employee sends message + sees receipt progression"
feature: chat-whatsapp-phase1
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile]
---

# Journey: Employee sends message + sees receipt progression

**Precondition:** Employee inside a ConversationScreen, channel has 1+ other member.

1. Employee types in composer → System keeps draft in local state.
2. Employee taps send → System optimistically inserts message in cache → Bubble renders right with state=`pending` → Employee sees `ClockIcon` inline bottom-right.
3. Supabase insert resolves → ReadReceipt updates → Employee sees single `Check` (state=`sent`).
4. Other party's client receives via Realtime → System receives presence ack OR delivered-ack event → ReadReceipt → `CheckCheck` muted (state=`delivered`).
5. Other party opens conversation, scrolls message into viewport, marks read → Realtime publishes read-event → Sender's ReadReceipt → `CheckCheck` brand-orange fill (state=`read`).

**Postcondition:** Sender sees end-state read-receipt. Receiver has `channel_message_read` row inserted.

**Error paths:**
- Send fails (network) → Bubble stays `pending` with retry affordance.
- Send rejected by RLS → toast "Kunne ikke sende — sjekk tilgangen" + bubble removed from optimistic cache.
- Delivered ack never arrives (other party offline indefinitely) → state stays `sent` — acceptable, matches WhatsApp.
