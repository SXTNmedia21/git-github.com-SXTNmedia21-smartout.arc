---
title: Learning Log
status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: operations
tags: [learnings]
---

# Learning Log — shift-clock

| #   | Date       | Learning                                                                                                                                                                                      | Impact                                                                                                   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | 2026-03-24 | PostgREST `upsert` with `onConflict` does not work with partial unique indexes (WHERE clause). The upsert silently succeeds as a no-op — no error, no insert, no update.                      | Must use plain `insert` when the uniqueness constraint is a partial index.                               |
| 2   | 2026-03-24 | RLS policies that query their own table create infinite recursion. `channel_member_jwt_select` queried `channel_member` inside its own SELECT policy.                                         | Replace self-referencing RLS with workspace-scoped policies using `get_workspace_ids_for_user()`.        |
| 3   | 2026-03-24 | Supabase Edge Functions have short lifespan — WebSocket `subscribe()` never resolves before termination.                                                                                      | Use REST broadcast API (`/realtime/v1/api/broadcast`) instead of Realtime WebSocket from edge functions. |
| 4   | 2026-03-24 | LiveKit SDK v2 `canPublishSources` expects TrackSource enum values, not strings. Passing strings causes "Cannot convert TrackSource" crash.                                                   | Use `canPublish: true` boolean instead of `canPublishSources` array.                                     |
| 5   | 2026-03-24 | `setMicrophoneEnabled(true)` after async operations loses browser user gesture context, causing NotAllowedError.                                                                              | Wrap in try/catch — user can toggle manually via ControlBar.                                             |
| 6   | 2026-03-24 | Supabase CLI v2 shows `sb_publishable_`/`sb_secret_` format keys, but edge functions runtime still injects JWT-format keys via `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` automatically. | No manual key configuration needed for edge functions.                                                   |

status: in_progress
updated: 2026-03-24
created: 2026-03-24
module: ui
tags: [learnings]

---

# Learning Log — unified-wizard-shell

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |
