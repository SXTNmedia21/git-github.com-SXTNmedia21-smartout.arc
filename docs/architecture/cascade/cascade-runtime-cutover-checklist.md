---
title: "Cascade Runtime Truth Cutover Checklist"
status: in_progress
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, migration, legacy, cleanup]
---

# Cascade Runtime Truth Cutover Checklist

## Runtime Truth Rules After A1/A2

### All runtime operating-hours reads MUST use:

- `department_operating_hours`
- `department_hours_override`
- `resolveEffectiveHours()` — never interpret raw open_time/close_time directly

### No runtime code may read:

- `company_opening_hours` (table)
- `operating_hours` (table)
- `season.opening_hours` (JSONB column)

### `company_opening_hours` is allowed ONLY in:

- `/join` wizard (onboarding intake)
- Bootstrap transformation code (setup wizard reads it as input, writes to `department_operating_hours`)

### New schedule-template reads MUST use:

- `schedule_template.department_id` (UUID FK)

### `schedule_template.department` TEXT may only remain for:

- Legacy display fallback (existing templates without FK)
- One-time backfill tooling

## Verification Checklist

For each legacy structure, grep the codebase and classify every hit:

- [ ] `rg "company_opening_hours" --type ts --type tsx --type sql` — classify each as: allowed intake / must refactor / deferred
- [ ] `rg "(?<!department_)operating_hours" --type ts --type tsx --type sql -P` — uses negative lookbehind to exclude `department_operating_hours` hits
- [ ] `rg "season\.(opening_hours|openingHours)" --type ts --type tsx` — classify season-level hours references
- [ ] `rg "schedule_template\.department[^_]" --type ts --type tsx` — matches `.department` but not `.department_id`

### Classification key:

- **Allowed legacy intake** — onboarding/join wizard reads, no action needed
- **Must refactor now** — runtime read/write that should use new truth source
- **Deferred but runtime-safe** — admin/reporting read that doesn't affect scheduling truth
