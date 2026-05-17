---
id: L-0272
title: "session_note column naming surprises (content/created_by/department_session_id)"
status: accepted
date: 2026-05-15
discovered_in: feat/dagslinjen-quickadd (Track E + F)
related_adrs: [ADR-0331, ADR-0332]
tags: [schema, naming, supabase, drift]
---

# session_note column naming surprises

## Discovery

During Track E (DailyNoteSheet audience picker) and Track F
(note-fanout-scheduler Edge Function) build, multiple agents independently
assumed `session_note` followed a "natural" naming pattern that did not match
the actual schema.

Three columns broke build/typecheck on first attempts:

| Assumed name             | Actual name                | Where it bit         |
| ------------------------ | -------------------------- | -------------------- |
| `body`                   | `content`                  | Track E + F          |
| `created_by_profile_id`  | `created_by`               | Track E              |
| `session_id`             | `department_session_id`    | Track F edge handler |

## Why these traps existed

- `session_note.content` originates from a 2026-04-22 migration. Most newer
  domain tables use `body` (e.g. `announcement.body`, `wallpost.body`).
- `created_by` (not `created_by_profile_id`) is older naming convention;
  newer tables (2026-04+) standardized on `_profile_id` suffix.
- `department_session_id` is verbose because `department_session` and
  `session` (engine_sessions schema) are different concepts in this DB.

## Lesson

When writing INSERT/SELECT for any table older than ~2 months: read
`packages/supabase/src/database.types.ts` for that table's exact `Row`
shape FIRST. Do not pattern-match column names from sibling tables.

## Application

- Track E: `create-targeted-note-action.ts:155` uses `content` + `created_by`.
- Track F: `note-fanout-scheduler/index.ts:62` selects
  `department_session_id` not `session_id`.

## Promote to ADR?

No — this is local schema-drift caused by build-history layering. Documented
in `smartout-database-guide` skill as a "traps to remember" entry will be
sufficient. Not worth ADR-promotion.
