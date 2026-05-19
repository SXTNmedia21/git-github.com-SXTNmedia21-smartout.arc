---
title: "Journey — Employee long-presses to react (motion polish)"
feature: chat-whatsapp-phase2
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, gesture, motion]
---

# Journey: Employee long-presses a message to react

**Precondition:** Employee inside ConversationScreen with messages visible.

1. Employee long-presses a bubble → Bubble scales to 1.05 with `motion.springSnappy` immediately on press start.
2. Long-press threshold reached → Haptic fires.
3. ReactionBar mounts above bubble with opacity 0 → 1 + translateY 8px → 0 via `motion.springSnappy`.
4. Employee taps a reaction → ReactionBar dispatches `onReaction`, bubble's reaction pill row updates.
5. Employee taps outside → ReactionBar fades out (opacity 1 → 0 + translateY 0 → 8px), bubble scales back to 1.0.

**Postcondition:** Reaction recorded in `channel_message_reaction` (existing table). Bubble shows reaction pill.

**Error paths:**
- Long-press cancelled (drag during press) → ReactionBar never mounts, bubble springs back.
- Reaction RLS-rejected → Toast, optimistic pill rolls back.
