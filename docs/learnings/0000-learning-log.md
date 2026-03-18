---
title: Learning Log
status: in_progress
updated: 2026-04-18
created: 2026-03-18
module: development
tags: [learnings]
---

# Learning Log

| #   | Date       | Learning                                                                                                                                                                         | Impact                                                            |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 2026-04-18 | Parallel subagents produce typeerrors at merge — each agent can't see others' code. Fix: run typecheck-gate after every block merge + dedicated fix-agent. Took 3 min per block. | Process: always budget a fix pass after parallel work             |
| 2   | 2026-04-18 | `react-native-screens` crashes Expo web with `featureFlags.experiment` undefined. Fix: `npx expo install react-native-screens` to get web-compatible version.                    | Expo web: always install screens explicitly                       |
| 3   | 2026-04-18 | Supabase CLI `npx supabase gen types` doesn't include custom schemas by default. Need `--schema=public --schema=timesheet`.                                                      | DB: always specify all schemas in type generation                 |
| 4   | 2026-04-18 | `profile` table uses `display_name`, not `first_name`/`last_name`. 21 type errors from agents assuming separate name fields.                                                     | Convention: always check database.types.ts before writing queries |
| 5   | 2026-04-18 | Claude Code background processes (`run_in_background`) die when output pipe closes. Expo dev server must run in user's own terminal.                                             | Tooling: long-running servers can't be started via Agent tool     |
