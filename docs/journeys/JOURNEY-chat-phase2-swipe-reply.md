---
title: "Journey — Employee swipes message to reply"
feature: chat-whatsapp-phase2
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, gesture]
---

# Journey: Employee swipes a message to reply

**Precondition:** Employee inside ConversationScreen with 3+ messages.

1. Employee touches a message → System recognizes pan gesture start.
2. Employee drags horizontally toward bubble's own side (right for own, left for other) → Bubble translates with finger, max 64px.
3. Cross 48px threshold → Haptic fires, reply-icon (Lucide CornerUpLeft) fades in behind bubble.
4. Employee releases → Bubble springs back via `nativeTheme.motion.springSnappy`; `onSwipeReply(message)` fires.
5. ConversationBody's `handleSwipeReply` populates composer's reply-quote header.
6. Reply-quote header populated in composer. Full reply-link DB persistence is Phase 3 (requires `channel_message.replied_to_message_id` column + migration).

**Postcondition:** Reply quoted in composer, ready to type and send with visual quote context shown to both parties.

**Error paths:**
- Cross threshold then drag back → no haptic-fire-back; gesture cancels, spring back, no callback.
- Vertical drag dominant → FlatList scroll wins, gesture cancels.
- Network down at send → composer keeps draft, retry affordance.
