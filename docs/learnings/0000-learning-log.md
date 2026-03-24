---
title: Learning Log
status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [learnings]
---
# Learning Log — livekit-webhook-deployment

| # | Date | Learning | Impact |
|---|------|----------|--------|
| 1 | 2026-03-24 | PostgREST `upsert` with `onConflict` does not work with partial unique indexes (WHERE clause). The upsert silently succeeds as a no-op — no error, no insert, no update. | Must use plain `insert` when the uniqueness constraint is a partial index. Add error handling to catch silent failures. |
