---
title: "Journey — Manager scrolls long thread"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [journey, chat, mobile]
---

# Journey: Manager scrolls a long thread

**Precondition:** Manager has access to channel with 200+ messages across 3+ weeks.

1. Manager opens channel → System renders most recent messages first (inverted FlatList).
2. Manager swipes up to load older history → System paginates via Supabase → Older messages prepend.
3. As scroll crosses day boundaries → `DateDivider` rows appear inline ("torsdag 15. mai", "onsdag 14. mai", "tirsdag 13. mai").
4. Phase 1 ships inline dividers only. Sticky-on-scroll deferred to Phase 2 (gestures phase).
5. Manager identifies an old message → reads context from inline date pill above it.

**Postcondition:** Manager has temporal context for every visible message group. No "wall of bubbles" effect.

**Error paths:**
- Pagination fails → toast + retry button at top of list.
- Date locale missing → falls back to ISO date — degraded but readable.
