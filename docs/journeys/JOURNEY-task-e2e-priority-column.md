---
title: "JOURNEY — task e2e: priority-column schema vs test align (J1)"
status: in_progress
updated: 2026-05-26
created: 2026-05-26
module: task
journey-id: J1
sortie: task-e2e-spec-fixes
---

# JOURNEY J1 — `priority` column schema vs test align

## Symptom

CI e2e-task run `26427088999` (2026-05-26 01:35) — 6+ failures all with:

```
Error: seedTask failed: Could not find the 'priority' column of 'session_task' in the schema cache
Error: seedSessionTask failed: Could not find the 'priority' column of 'session_task' in the schema cache
```

Affected helpers:
- `apps/e2e/tests/sortie-p0-fix-sweep-task-complete-source.spec.ts:106` (seedTask)
- `apps/e2e/tests/sortie-p0-fix-sweep-task-created-canonical.spec.ts` (seedSessionTask)

## Diagnose path

1. Sjekk `supabase/migrations/` for `session_task` DDL — finnes `priority` kolonne?
   - JA → migrasjon ikke applied i CI, undersøk hvorfor (gap i timestamp?)
   - NEI → seedTask helpers refererer til kolonne som aldri ble migrert

2. Hvis NEI: avgjør intent
   - Var `priority` planlagt og avlyst? → fjern fra seedTask helpers
   - Er det reell intent (compliance-required tasks bruker priority=2 per cron-overdue test) → add migration `XXXXXX_add_session_task_priority.sql`

## Acceptance

- `pg_dump --schema-only` i CI viser `session_task.priority`
- ELLER seedTask/seedSessionTask helpers inserter ikke `priority`
- Run `e2e-task.yml` viser 0 occurrences av "Could not find the 'priority' column"

## Sannsynlig root cause

Per `supabase/functions/session-task-overdue-cron/index.ts` — cron-koden bruker `priority` (T8 test: "compliance-required tasks use priority=2"). Så kolonnen ER tiltenkt. Migrasjon mangler, ELLER eksisterer men er etter en gap-timestamp blokkert av lint.

## Estimat

15-30 min. Mest sannsynlig 1-fil migration eller helper-edit.
