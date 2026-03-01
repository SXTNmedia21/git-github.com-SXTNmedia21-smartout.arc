---
title: Learning Log
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: [learnings]
---

# Learning Log — landing-analytics

| #   | Date       | Learning                                                                                                                                        | Impact                                     |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | 2026-03-01 | database.types.ts must be regenerated after migration for new tables — use UntypedClient cast as temporary workaround                           | Type safety gap until migration applied    |
| 2   | 2026-03-01 | navigator.sendBeacon requires Blob with content-type for JSON payloads                                                                          | Affects session_end reliability            |
| 3   | 2026-03-01 | Supabase JS client `.upsert()` with `onConflict` cannot do partial updates (only full row) — use insert-then-update-on-conflict pattern instead | Affects visitor upsert logic               |
| 4   | 2026-03-01 | sessionStorage keys work well as once-per-session event guards (scroll thresholds)                                                              | Reusable pattern for any per-session dedup |
