---
title: "Journey — Manager scrolls long thread (sticky date pill)"
feature: chat-whatsapp-phase2
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile, scroll]
---

# Journey: Manager scrolls long thread — date pill sticks

**Precondition:** Manager opens channel with 200+ messages across 4+ weeks.

1. Manager opens channel → ConversationBody renders inverted FlatList, latest messages at bottom.
2. Manager swipes up to load older history → Pagination prepends older messages.
3. As scroll crosses day boundaries → Current day's date pill sticks to top of viewport (subtle elevation via `colors.scrim` shadow).
4. As scroll continues past day → Next-older day's pill animates in to replace.
5. Manager identifies a message → Sees inline date pill above message OR sticky pill at top giving day context.

**Postcondition:** Manager always knows what day they're reading. No "wall of bubbles" without temporal anchor.

**Error paths:**
- Pagination fails → Sticky pill stays last-known; toast + retry button at top.
- Single-day thread → No sticky behavior, single inline pill (matches Phase 1 fallback).
