---
title: Learning Log
status: done
updated: 2026-03-22
created: 2026-03-20
module: payroll
tags: [learnings]
---

# Learning Log

| #   | Date       | Learning                                                                                                                                                                        | Impact                                                  |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 2026-03-20 | `company.contact_name` doesn't exist on the company table — the actual column is `daglig_leder`. The placeholder `kunde_daglig_leder` has never worked in production.           | Bug fix shipped in this branch                          |
| 2   | 2026-03-20 | `Record<string, string>` indexing returns `string \| undefined` under strict TS — truthiness check in `if` doesn't narrow for assignment. Fix: extract to local variable first. | Pattern for all strict-mode Record access               |
| 3   | 2026-03-20 | `npx supabase gen types` captures npm warnings in stdout. Must redirect stderr: `2>/dev/null >` to get clean output.                                                            | Prevents lint-staged failures on generated files        |
| 4   | 2026-03-20 | Next.js web app needs explicit `@smartout/utils` workspace dependency even when only used via dynamic `import()` — TypeScript still needs the types at compile time.            | Always add workspace deps to consuming package.json     |
| 5   | 2026-03-22 | `supabase.schema("payroll").from("table")` works for cross-schema queries. Type gen needs `--schema public --schema payroll`. Cross-schema FKs auto-update on `SET SCHEMA`.     | Pattern for all future dedicated schemas                |
| 6   | 2026-03-22 | `pg_type WHERE typname LIKE 'payroll_%'` returns 2x expected count because PostgreSQL creates array types for each enum. Filter with `typtype = 'e'` for actual enum count.     | Always filter pg_type by typtype when counting          |
| 7   | 2026-03-22 | `absence_status` enum is `pending/approved/rejected` only — no `cancelled`. Employee withdrawal must use `rejected` until migration adds the value.                             | Check enum values before assuming status options        |
| 8   | 2026-03-22 | `schedule_absence.absence_type` is a free-text string, not a UUID FK to `payroll.absence_type.id`. Instance counting must match on name, not ID.                                | Always verify FK vs free-text before writing filters    |
| 9   | 2026-03-22 | Payroll UX needs explicit trust labeling — live estimates that don't match final payslips create employee distrust. Three tiers (estimate/recorded/settled) prevent this.       | Apply trust model to any financial UI                   |
| 10  | 2026-03-22 | Planday shows balance FIRST in absence request flow (not form-first). Tripletex consolidates vacation days alongside payslip. Both patterns validated by competitor research.   | Research competitor UX before designing financial flows |

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
