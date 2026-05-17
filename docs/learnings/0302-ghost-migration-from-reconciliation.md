---
title: "L-0302 — Ghost migration from 2026-05-13 manual reconciliation"
id: L-0302
status: accepted
created: 2026-05-17
updated: 2026-05-17
module: ci
tags: [db, supabase, migration, ghost-migration, drift, ci, production, incident]
related:
  - ADR-0361 (CI coherence gate that encodes this class)
  - ADR-0265 (enforced deployment pipeline)
  - L-0299 (pipe-mask — sibling: CI signal drops)
  - L-0301 (quotepath fix — sibling: same main-push CI incident batch)
  - L-0042 (migration timestamp ordering)
---

# L-0302 — Ghost migration from 2026-05-13 manual reconciliation

## What happened

### Timeline

| Time (Oslo) | Event |
|---|---|
| 2026-05-13 ~17:00 | PR #381 merged: first production release, 1229 commits, 5 new migrations applied. Operator reconciled 17 pre-existing migrations via `supabase migration repair --status applied` to align the fresh prod ledger with local history. |
| 2026-05-13 ~18:00 | Smoke probe 5/5 green. Release declared successful. |
| 2026-05-17 ~19:00 | User attempts to create an invitation from the dashboard. |
| 2026-05-17 19:30 | Error: `Failed to create invitation: Could not find the 'metadata' column of 'invitation' in the schema cache` |
| 2026-05-17 19:35 | Investigation: prod `supabase_migrations.schema_migrations` contains `20260310120000_invitation_metadata`. Migration file exists in repo. Column `invitation.metadata` does NOT exist in prod. |
| 2026-05-17 19:45 | Repair: `supabase migration repair --status reverted 20260310120000 --linked` → `supabase db push --linked`. Migration applies. Column now exists. |
| 2026-05-17 20:00 | Smoke green. Invitation creation works. |
| 2026-05-17 20:30 | Extended audit: `scripts/audit-ghost-migrations.sh` reveals 4 more ghost-class items + 1 legacy table + RLS drift on 2 tables. |
| 2026-05-17 21:00 | Forward-only migration `20260620100000_align_prod_drift_2026_05_17.sql` written and merged (`b54fcf801`). All 7 drift items resolved. |

## Root cause

### The reconciliation pattern

When creating a brand-new Supabase Cloud project for the first production
release (2026-05-13), the project's `schema_migrations` ledger starts empty.
The production database had been built by applying migrations in prior
development/preview environments, so the _schema_ matched the local
migration files — but the _ledger_ did not.

To prevent Supabase CLI from re-running all 600+ historical migrations on
the new project, the operator marked the already-applied migrations as
applied in the ledger:

```bash
# ci.yml line ~330-334 (at the 2026-05-13 state, now removed):
# Ghost-repair loop removed 2026-05-13: prod schema_migrations was manually
# reconciled using supabase migration repair --status applied for timestamps
# 20230101000000 through 20260310115900.
```

This is a valid pattern **when the database genuinely contains the DDL from
those migrations**. The failure mode occurs when one or more migrations in
the range were not actually applied — perhaps because they were written after
the production schema was last reset, or because the production database was
created from a dump rather than by running migrations sequentially.

In this case, `20260310120000_invitation_metadata.sql` (among others) was
marked applied but had never run. The `metadata` column was missing.

### The specific ghost

```sql
-- supabase/migrations/20260310120000_invitation_metadata.sql
ALTER TABLE public.invitation ADD COLUMN metadata jsonb;
```

After `repair --status applied`, the ledger said: "this migration has run."
`supabase db push --linked --include-all` saw it as applied and skipped it.
The column never appeared. PostgREST's schema cache reflected reality
(column absent), not the ledger's claim.

## Why CI did not catch it

`supabase db push --linked --include-all` consults `schema_migrations` to
determine which migration files to execute. If timestamp `20260310120000`
is already in the ledger, the push **skips the file entirely**, regardless
of whether the DDL was ever applied.

The main-push CI log on 2026-05-13 showed:

```
Applying migration 20260514000010_...
Applying migration 20260514000020_...
...
Applied 5 new migration(s).
```

Everything before `20260514000010` was in the ledger → skipped. No signal.
No error. Push reported success. The ghost existed silently.

There was no post-push schema diff step in CI. The existing `Migration State`
job (ADR-0265) checked whether the latest local migration timestamp matched
the latest prod ledger timestamp — a ledger-vs-ledger check that cannot
detect a ghost (the ghost is _in_ the ledger, just without the DDL).

**The gap:** ledger truth ≠ schema truth. CI was checking ledger truth only.

## The repair procedure

When `db push --include-all` skips a migration that was recorded as applied
but whose DDL is missing, the repair is:

```bash
# Step 1: Remove the false "applied" ledger entry.
supabase migration repair --status reverted <timestamp> --linked

# Step 2: Push the now-unrecorded migration. CLI will see it as new.
supabase db push --linked

# Step 3: Verify the object exists.
# (query prod or run smoke probe)
```

The migration file itself is never modified. The ledger is corrected, then
the normal push path applies the DDL.

**Important:** `--status reverted` removes the ledger entry. The next `db
push` will treat the migration as unrun and apply it. If the DDL is
idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`), this is safe. If the DDL
is not idempotent and some partial state exists, write a forward-only
migration instead (see ADR-0361 Operational Procedure).

## The 7-item forward-only migration

After the initial invitation.metadata repair, `scripts/audit-ghost-migrations.sh`
identified additional drift. Rather than running `migration repair` for each
item individually (which would require 6+ separate push operations), a single
forward-only migration was written to align all drift in one push:

```sql
-- supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql
-- Forward-only migration: aligns production schema with local source of
-- truth following the 2026-05-17 ghost-migration incident audit.
--
-- 7 items addressed:
--   1. decrypt_envelope function (ghost: 20231115180000)
--   2. lookup_workspace_by_code function (ghost: 20240101000001)
--   3. search_workspaces function (ghost: 20240101000002)
--   4. v_current_plan_preview view (definition drift: 20241215100000)
--   5. Drop legacy table hookresponser
--   6. RLS policy Update own profile on profile (policy text drift)
--   7. RLS policy Public profiles visible on profile (policy drift)
```

Committed in `b54fcf801`. Applied to prod on next main-push through the
normal `development → preview → main` pipeline.

## Encoded into ADR-0361 — the CI gate

The `migration-coherence` CI job (ADR-0361) was designed specifically to
prevent this class of failure from recurring silently. After every main-push
`db-push` step succeeds, the gate runs:

```bash
supabase db diff --linked --schema public,payroll,websites,timesheet
```

The output is compared against a committed baseline
(`supabase/migration-coherence-baseline.sql`). If the live diff **diverges
from the baseline** (new columns absent, functions missing, view drift not in
baseline), the gate fails with:

```
::error::Migration coherence failed — diff vs baseline non-empty
```

A ghost migration produces exactly this signal: the ledger says the DDL ran,
`db push` skipped the file, the column/function/view is absent, and `db diff`
shows it as a pending addition — which would not appear in the clean-state
baseline.

The gate cannot prevent the 2026-05-13 reconciliation pattern from being
used again, but it catches the consequence (the ghost DDL gap) at the next
main-push, not weeks later in production.

## Lessons

### 1. Migration ledger ≠ schema truth

`supabase_migrations.schema_migrations` records operator intent (or operator
claims), not schema reality. A row in the ledger is a promise, not a proof.
The only source of truth for schema state is the database itself.

**When to verify schema truth:**
- After any `supabase migration repair --status applied` run: confirm the
  objects the migration was supposed to create actually exist.
- After any database restore from dump: the dump may post-date some
  migrations, leaving gaps.
- Before marking a block of migrations applied en masse: spot-check a sample
  for key DDL (table column, function, view) existence.

### 2. `db push --include-all` has a blind spot

`supabase db push --linked --include-all` is a fast-path that trusts the
ledger. Its correctness guarantee is:

> "Given a correct ledger, apply all unrecorded migrations."

It does NOT guarantee:

> "Given any ledger state, verify that all recorded migrations' DDL exists."

The fast-path is appropriate for routine development (where the ledger is
maintained by the CLI and can be trusted) but has a blind spot when the
ledger has been modified by hand. For production releases where the ledger
was bootstrapped from scratch or manually modified, a post-push `db diff`
was always necessary — it was just not wired in.

### 3. Manual `migration repair --status applied` without DDL verification is the silent failure class

The reconciliation operator ran:

```bash
supabase migration repair --status applied 20230101000000 --linked
supabase migration repair --status applied 20230201000000 --linked
# ... 15 more
```

Each command says: "production database already has what this migration
provides." For 16 out of 17, that was true. For 1 out of 17, it was not.
There was no verification step, and the CLI provides no feedback to catch
the mismatch.

**Rule going forward:** Any use of `migration repair --status applied` for a
batch of migrations MUST be followed by a schema-truth check:

```bash
# After repair, verify at minimum:
# 1. Key objects from first and last migration in the batch exist.
# 2. Run db diff and confirm it is empty (or matches known baseline).
supabase db diff --linked --schema public,payroll,websites,timesheet
```

If the diff is non-empty after marking migrations applied, the DDL from the
non-empty migrations must be applied manually or via a repair forward
migration before the ledger is trusted.

## Related learnings

- **L-0299** — promote-preview pipe-mask hides script failure. Sibling: CI
  signal (exit code) decouples from semantic execution state. The common
  thread is: tooling reported success, but the actual outcome differed from
  what "success" means.

- **L-0301** — Format Check exit 123 on non-ASCII filenames. Sibling: same
  main-push CI incident batch (2026-05-17 HOP B). Different mechanism,
  same operational context.

- **L-0042** — Migration timestamp ordering. The forward-only migration
  discipline this learning reinforces: never modify existing migration files;
  always append new migrations to repair drift.

---

> Register in `docs/learnings/0000-learning-log.md`.
