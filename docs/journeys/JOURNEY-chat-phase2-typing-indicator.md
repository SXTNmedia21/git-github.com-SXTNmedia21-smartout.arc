---
title: "Journey — Employee sees typing indicator from other party"
feature: chat-whatsapp-phase2
status: draft
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, presence, realtime]
---

# Journey: Employee sees "Anna skriver…" indicator

**Precondition:** Employee inside ConversationScreen. Other party (Anna) also in same channel.

1. Anna starts typing on her client → Her `MessageInput` `onChange` debounce 1s → broadcasts `typing:start` on Realtime channel `typing:${channelId}` with her `profile_id`.
2. Employee's client subscribed via `use-typing-indicator(channelId)` → receives broadcast → adds Anna's profile_id to `typingSet`.
3. `TypingIndicator` component above composer renders `"Anna skriver…"` with 3-dot pulse animation.
4. Anna stops typing for 3s → Her client broadcasts `typing:stop` OR debounced absence → Employee's client removes Anna from `typingSet`.
5. Indicator fades out via `motion.exitMs`.

**Postcondition:** Indicator accurately reflects active typers. No false positives, no stuck indicators.

**Error paths:**
- Broadcast packet lost → indicator may show stuck; safety timeout 5s auto-removes typer.
- Multiple typers → "Anna og Bob skriver…" or "3 personer skriver…".
- Self-typing → never shown (filter own profile_id at hook level).
