---
title: "Journey — Employee sees typing indicator from other party"
feature: chat-whatsapp-phase2
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, presence, realtime]
---

# Journey: Employee sees "Anna skriver…" indicator

**Precondition:** Employee inside ConversationScreen. Other party (Anna) also in same channel.

1. Anna starts typing on her client → Her `MessageInput` `onChange` debounce 2s → broadcasts `typing` event on Realtime channel `chat-typing:${channelId}` with payload `{ profile_id, expires_at: now + 4000 }`.
2. Employee's client subscribed via `use-typing-indicator(channelId)` → receives broadcast → adds Anna's profile_id to `typingSet` and schedules auto-removal timer at `expires_at` (~4s).
3. `TypingIndicator` component above composer renders `"Anna skriver…"` with fade-in animation (`nativeTheme.motion.enterMs` = 500ms).
4. Anna keeps typing → her client re-broadcasts every 2s, resetting the 4s expiry timer on the receiver side. Continuous typing keeps the indicator alive.
5. Anna stops typing → after 4s the auto-removal timer fires on the receiver → Anna removed from `typingSet` → indicator fades out (`nativeTheme.motion.exitMs` = 250ms).

**Postcondition:** Indicator accurately reflects active typers. No false positives, no stuck indicators beyond 4s expiry.

**Error paths:**
- Broadcast packet lost → indicator expires naturally after 4s (expiry-based, not stop-event-based).
- Multiple typers → "Anna og Bob skriver…" or "3 personer skriver…".
- Self-typing → never shown (filter own profile_id at hook level).
