---
title: Learning Log
status: done
updated: 2026-03-25
created: 2026-03-24
module: communications
tags: [learnings]
---

# Learning Log — notification-system

| #   | Date       | Learning                                                                                                                          | Impact                                                                 |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | 2026-03-24 | Nested $$ dollar-quotes in pg_cron DO blocks cause PostgreSQL parse errors — use tagged dollar-quotes ($cmd$/$sql$)               | Migration patterns for all future cron registrations                   |
| 2   | 2026-03-24 | npx supabase gen types outputs WARN lines to stdout when env vars are missing — must redirect stderr or use 2>/dev/null           | database.types.ts corruption risk if not handled                       |
| 3   | 2026-03-24 | @smartout/supabase/client uses browser APIs (localStorage, cookies) — cannot be used in React Native                              | Mobile hooks must use platform-specific Supabase client                |
| 4   | 2026-03-24 | Supabase-generated types use boolean                                                                                              | null for columns with DEFAULT — TypeScript spread doesn't narrow nulls | Must use explicit null-coalescing (??) per field when merging with defaults |
| 5   | 2026-03-24 | notification_preference.user_id FK to user_identity means outbox consumer needs profile→user_identity join to resolve preferences | Join path documented in spec — important for consumer performance      |
