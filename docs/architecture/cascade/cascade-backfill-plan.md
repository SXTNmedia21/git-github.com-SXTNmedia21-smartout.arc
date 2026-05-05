---
title: "Cascade Backfill Plan — schedule_template.department_id"
status: draft
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, migration, backfill]
---

# Cascade Backfill Plan — schedule_template.department_id

## Context

A1 migration adds `schedule_template.department_id` UUID FK alongside the existing
`schedule_template.department` TEXT column. Existing rows have only the TEXT column populated.

## Backfill Rules

1. `schedule_template.department_id` is the future runtime field
2. Existing rows may have only `department` TEXT
3. No new code should depend on TEXT when FK exists
4. TEXT column is NOT dropped — preserved for fallback until backfill is complete

## Backfill Migration (future, not in this plan)

A later migration will:

1. Map text department names to `department.department_id` via `department.name` or `department.slug`
2. Populate `department_id` FK for all matched rows
3. Identify ambiguous/unmapped rows (text doesn't match any department) and flag for manual resolution
4. Only after 100% backfill: consider dropping TEXT column

## Backfill SQL (draft)

```sql
-- Draft: update matched rows
UPDATE schedule_template st
SET department_id = d.department_id
FROM department d
WHERE st.workspace_id = d.workspace_id
  AND lower(trim(st.department)) = lower(trim(d.name))
  AND st.department_id IS NULL;

-- Identify unmatched rows
SELECT st.schedule_template_id, st.department, st.workspace_id
FROM schedule_template st
WHERE st.department IS NOT NULL
  AND st.department_id IS NULL;
```

## Drop Criteria

The TEXT column may be dropped only when ALL are true:

- [ ] Backfill complete (zero rows with department TEXT but no department_id)
- [ ] Zero runtime reads of `schedule_template.department` TEXT remain
- [ ] One full `supabase db reset` + smoke test passes without TEXT column
- [ ] Production telemetry shows no TEXT-column access for one release window
