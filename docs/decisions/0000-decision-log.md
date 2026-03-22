---
title: Decision Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [decisions]
---

# Decision Log — website-factory

| #   | Date       | Decision                                                                 | Status   |
| --- | ---------- | ------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-22 | Dedicated `websites` PostgreSQL schema for bounded context isolation     | Accepted |
| 2   | 2026-03-22 | Website section trigger resolves workspace via page join (not direct FK) | Accepted |
| 3   | 2026-03-22 | PostgREST needs explicit `--schema websites` for RPC/type gen            | Accepted |
| 4   | 2026-03-22 | 2-column editor with preview as separate tab (no inline WYSIWYG)         | Accepted |
| 5   | 2026-03-22 | 20 templates across 3 tiers (Basic/Pro/Premium)                          | Accepted |
| 6   | 2026-03-22 | System-connected sections use bridge pattern (live data, not copies)     | Accepted |
| 7   | 2026-03-22 | Hours bridge is bidirectional, menu bridge is read-only                  | Accepted |
| 8   | 2026-03-22 | Spokesperson requires GDPR-compliant approval flow via mobile app        | Accepted |
| 9   | 2026-03-22 | Spokesperson data: content in section JSONB, workflow in dedicated table | Accepted |
| 10  | 2026-03-22 | dnd-kit for drag-to-reorder (already in codebase, no new deps)           | Accepted |
| 11  | 2026-03-22 | AI writing panel stubbed with static suggestions (backend not ready)     | Accepted |
| 12  | 2026-03-22 | notifications added to EventDestination type for spokesperson flow       | Accepted |
