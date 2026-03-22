---
title: Learning Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [learnings]
---

# Learning Log — walkie-talkie

| #   | Date       | Learning                                                                                           | Impact                                                 |
| --- | ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | 2026-03-22 | supabase gen types outputs warnings to stdout — must redirect stderr                               | Fixed: use `2>/dev/null` to get clean types file       |
| 2   | 2026-03-22 | Worktrees need `pnpm install` + `npx turbo build --filter='./packages/*'` before dev server works  | Required for all internal package resolution           |
| 3   | 2026-03-22 | Partial unique indexes can't use ON CONFLICT ON CONSTRAINT — need WHERE NOT EXISTS guard           | Used in auto-create triggers for dept/team channels    |
| 4   | 2026-03-22 | profile table has no unique constraint on (workspace_id, user_id) — Botsson seed needs guard query | Can't use ON CONFLICT for idempotent profile insertion |
