---
title: "ADR-0361 — CI Migration Coherence Check (baseline-comparison gate)"
id: ADR_0361
status: accepted
created: 2026-05-17
updated: 2026-05-17
module: ci
tags: [ci, supabase, migrations, drift, ghost-migration, schema, baseline, production]
supersedes: []
related: [ADR_0265, L-0042, L-0299, L-0301, L-0302]
---

# ADR-0361 — CI Migration Coherence Check

## Status

Accepted. Implemented in `feat/ci-migration-coherence-check` (commits
`72e471557`, `bd683da95`). Active on main-push from merge date forward.

## Context

### The 2026-05-17 production incident

At 19:30 (Europe/Oslo) on 2026-05-17, a user hit:

```
Failed to create invitation: Could not find the 'metadata' column
of 'invitation' in the schema cache
```

PostgREST's schema cache reflected actual database state — the `metadata`
column on the `invitation` table did not exist on production. The column
was defined in migration `20260310120000_invitation_metadata.sql`. That
migration was **recorded** in `supabase_migrations.schema_migrations` (the
ledger) but its DDL had never been applied.

Repair required:

```bash
supabase migration repair --status reverted 20260310120000 --linked
supabase db push --linked
```

The migration file was not changed. Only the ledger had lied.

### Root cause: 2026-05-13 manual reconciliation

During the first production release (2026-05-13, PR #381), 17 migrations
were manually marked as applied via `supabase migration repair --status
applied` to reconcile the ledger with the state of a freshly-created
production project (see ci.yml comment at line 330-334 at that time, now
removed). The intent was to skip running historical migrations that
pre-dated the production database. The operator ran `repair --status
applied` without verifying that each migration's DDL had actually been
executed — a valid pattern when the production database had genuinely been
built from those migrations, but a silent failure when it had not.

This created **ghost migrations**: ledger entries with no corresponding
schema state.

### Why CI did not catch it

`supabase db push --linked --include-all` consults `schema_migrations` to
decide which files to run. A migration already in the ledger (even falsely)
is **skipped**. At the 2026-05-13 release, CI showed push success for all
migrations starting from `20260514000010` — everything before that
timestamp was already in the ledger, so CI had no mechanism to detect that
the DDL for `20260310120000_invitation_metadata.sql` was absent.

No existing CI gate ran `supabase db diff` after the push to verify that
the local migration sources and the actual prod schema were coherent.

### The extended audit (Phase 1.5)

Running `scripts/audit-ghost-migrations.sh` against production after
the invitation repair revealed 4 additional ghost-class issues beyond the
original `invitation_metadata` ghost:

| ID | Type | Description |
|---|---|---|
| `20231115180000` | Ghost (procedure) | `decrypt_envelope` function body missing |
| `20240101000001` | Ghost (function) | `lookup_workspace_by_code` function missing |
| `20240101000002` | Ghost (function) | `search_workspaces` function missing |
| `20241215100000` | View drift | `v_current_plan_preview` definition out of sync |

Plus legacy table `hookresponser` and RLS policy drift on 2 tables
(`profile.Update own profile`, `profile.Public profiles visible`).

All seven items were aligned in a single forward-only migration committed in
`b54fcf801` (`supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql`).

### Residual cosmetic noise

After the repair migration, `supabase db diff --linked` still produces a
non-empty diff (~1656 lines). Inspection shows this is entirely
**migra-tool cosmetic noise**: `pg_get_functiondef()` serializes function
bodies with different whitespace and quoting than the original migration
source SQL. There are 17 such function diffs and 1 view recreate. The diff
is **semantically inert** — the functions execute identically — but a naive
"diff must be empty" gate would always fail.

This creates a tradeoff: hard-fail on any diff is too noisy; allowing any
diff is too permissive. The solution is a **committed baseline**.

## Decision

Add a `migration-coherence` CI job that runs on every main-push, after
`db-push` succeeds, and compares the live `supabase db diff --linked`
output against a **committed baseline file**
(`supabase/migration-coherence-baseline.sql`).

The gate fails if the current diff **diverges from the baseline** — i.e.,
if there is new drift that was not present when the baseline was last
committed. The gate passes if the diff is identical to the baseline (zero
new drift, only known cosmetic noise tolerated).

### Design principles

1. **Baseline comparison, not zero-diff.** The baseline captures the known
   migra-tool cosmetic noise. New drift (ghost migrations, manual DDL,
   out-of-order pushes) produces a _delta_ from the baseline, which is what
   the gate fails on.

2. **Forward-only repair, not auto-fix.** When the gate fails, the operator
   writes a forward-only migration to align prod with local source of truth,
   pushes through the pipeline, and the gate re-evaluates. CI never writes
   to production automatically.

3. **Main-push only.** The gate runs only on `github.ref ==
   'refs/heads/main'` push events. PR builds do not run it (they have no
   prod access, and schema drift is a prod concern, not a PR concern).

4. **Depends on `db-push`.** The job is declared `needs: [db-push]` so it
   always runs after migrations have been applied, not before.

5. **Baseline regeneration is explicit.** When the cosmetic baseline
   legitimately changes (e.g., a new function added, a view recreated), the
   operator regenerates the baseline, commits it, and merges. There is no
   auto-baseline update.

### Job definition

Location: `.github/workflows/ci.yml` job `migration-coherence` (line ~397).

```yaml
migration-coherence:
  name: Migration Coherence
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  needs: [db-push]
  steps:
    - uses: actions/checkout@v4
    - uses: supabase/setup-cli@v1
      with:
        version: latest
    - name: Compare local migrations vs prod schema
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
        SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROD_REF }}
      run: |
        BASELINE=supabase/migration-coherence-baseline.sql
        supabase link --project-ref "$SUPABASE_PROJECT_REF" \
                      --password "$SUPABASE_DB_PASSWORD"

        RAW=$(supabase db diff --linked \
          --schema public,payroll,websites,timesheet 2>&1)

        CURRENT=$(echo "$RAW" \
          | awk '/^Finished supabase db diff/{found=1; next} found' \
          | awk '/^Found drop statements/{exit} {print}')

        DELTA=$(diff -u "$BASELINE" <(echo "$CURRENT") || true)

        if [ -n "$DELTA" ]; then
          echo "::error::Migration coherence failed — diff vs baseline non-empty"
          echo "$DELTA"
          exit 1
        fi
        echo "✓ Prod schema diff matches committed baseline (known cosmetic only)"
```

### Baseline file

`supabase/migration-coherence-baseline.sql` — committed in `bd683da95`.
Contains the 17 migra-tool function diffs + 1 view recreate that are
cosmetically expected after the 2026-05-17 repair. ~1656 lines. Generated
by capturing `supabase db diff --linked` output on a known-clean prod state
and extracting the SQL section after the CLI setup chatter.

### Audit script

`scripts/audit-ghost-migrations.sh` — committed in `6b305882e`. READ-ONLY.
Identifies migration timestamps recorded in prod `schema_migrations` whose
DDL fingerprints (key identifiers like `ALTER TABLE x ADD COLUMN y`) are
absent from prod. Generates a candidate ghost list and repair instructions.
Run locally on demand; not wired into CI (audit is investigative, not
blocking).

## Alternatives considered

### Alternative 1 — Hard-fail on any non-empty diff (rejected)

Simplest implementation: `supabase db diff --linked` non-empty → fail.

**Rejected** because `supabase db diff` currently produces a 1656-line diff
on a post-repair, known-correct prod state. This is entirely migra-tool
cosmetic output (`pg_get_functiondef` serialization format differs from
original migration source SQL). A hard-fail gate would be permanently red.
Reducing the cosmetic noise to zero would require either rewriting 17
function migrations to match exactly what `pg_get_functiondef` produces
(risky: cosmetic rewrites must not change semantics) or replacing migra with
a different diff tool that uses AST comparison (significant scope creep).

The baseline-comparison approach provides the same ghost-detection guarantee
with zero false positives on known cosmetic noise.

### Alternative 2 — Schema fingerprint comparison (rejected)

Hash the expected schema state from migration sources, hash the live prod
schema, compare hashes. Fail on mismatch.

**Rejected** because:
- Does not catch trigger drift, policy drift, or view drift unless the
  fingerprint captures all object types. `pg_dump --schema-only` is the
  closest tool, but it includes OIDs, sequence state, and other non-stable
  fields that make fingerprints non-deterministic across restores.
- The baseline-comparison approach is a superset: it catches exactly what
  `supabase db diff` considers drift, which already covers tables, columns,
  functions, views, triggers, and policies.

### Alternative 3 — Idempotent re-apply all migrations (rejected)

Instead of diffing, re-run all 600+ migrations against a shadow copy of
prod and verify they apply cleanly.

**Rejected** because:
- 600+ migrations would add 10-20 minutes to main-push.
- Several historical migrations have idempotency issues (pre-date the
  `CREATE OR REPLACE` discipline enforced later). Running them against a
  live prod shadow risks introducing errors in the shadow that would produce
  false-positive failures.
- Cloning a prod shadow database for every main-push requires infrastructure
  not currently in place.

### Alternative 4 — Self-healing auto-repair (rejected)

If the gate detects drift, CI automatically writes a repair migration,
commits it, and retries the push.

**Rejected** because:
- Auto-generating DDL against production is high-risk. A missed edge case
  (e.g., generating `DROP COLUMN` instead of `ADD COLUMN`, or generating
  a migration that changes semantics while fixing cosmetics) could corrupt
  production silently.
- The forward-only migration discipline (L-0042, ADR-0265) requires human
  review of every schema change before it reaches production.
- The repair procedure is simple enough (write migration, PR, merge) that
  automation adds risk without proportional benefit.

## Consequences

### Positive

- **Ghost-migration class caught at first main-push.** The 2026-05-17
  incident (`invitation.metadata` missing) cannot recur silently. Any
  migration recorded in the ledger without corresponding DDL will produce
  a diff that diverges from the baseline, and the gate will fail.

- **Manual prod DDL immediately visible.** Any SQL Editor change or
  `supabase migration repair` without a corresponding migration file will
  surface in the next main-push gate run.

- **Out-of-order push caught.** If a migration is applied to prod without
  going through the pipeline (e.g., emergency hotfix applied directly), the
  diff will diverge.

- **Baseline is a living contract.** The committed baseline file documents
  exactly what the known cosmetic noise looks like. Future agents and
  developers can read it to understand which diffs are expected and which
  are new drift.

### Negative

- **Baseline regeneration required on intentional schema changes.** When
  the production schema legitimately evolves in a way that changes the
  migra-tool cosmetic output (e.g., a function is added or replaced with
  different internal formatting), the operator must regenerate the baseline
  and commit it. This is a low-frequency operation but an explicit step.

- **~15 seconds added to main-push pipeline.** `supabase link` + `db diff`
  adds approximately 10-15 seconds. This is acceptable for a main-push gate
  (ADR-0265 explicitly accepts smoke-probe overhead of similar magnitude on
  the same event).

- **Requires direct PG access from CI.** The `db diff` command uses a
  direct PostgreSQL connection (not pooler). Same network path as `db push`
  already uses — no new infrastructure required.

- **Gate does not run on PRs.** PRs build against development, not
  production, so the gate cannot catch drift introduced between development
  and production during the review period. The gate fires only on merge to
  main. This is the intended scope.

## Operational procedure

### Gate is green

No action. Known cosmetic baseline matches live prod. Continue.

### Gate is red — "Migration coherence failed — diff vs baseline non-empty"

The CI job prints the delta (unified diff of baseline vs current diff).
Read the delta carefully:

**If the delta shows a new column/table/function that should exist (ghost):**

1. Identify the migration file that should have created the object.
2. Verify the object does not exist on prod:
   ```bash
   supabase db remote commit   # or query prod directly
   ```
3. Write a forward-only migration that creates/restores the missing object:
   ```sql
   -- supabase/migrations/YYYYMMDDHHMMSS_repair_ghost_<name>.sql
   -- Repair: <migration_id> was recorded but DDL was never applied.
   -- This migration re-applies the DDL from the original file.
   ALTER TABLE public.invitation ADD COLUMN IF NOT EXISTS metadata jsonb;
   ```
4. Push through `development → preview → main` pipeline.
5. Re-run the gate (next main-push).

**If the delta shows unexpected drift from manual prod DDL:**

1. Determine whether the prod DDL should be preserved (in which case write
   a migration to codify it) or reverted (write a migration to undo it).
2. Never run `supabase migration repair` without a corresponding forward
   migration that makes the DDL match the ledger.
3. Push the repair migration through the pipeline.

**If the delta is cosmetic (new function added to baseline):**

1. Regenerate the baseline from a known-clean prod state:
   ```bash
   supabase link --project-ref "$SUPABASE_PROD_REF" \
                 --password "$SUPABASE_DB_PASSWORD"
   supabase db diff --linked \
     --schema public,payroll,websites,timesheet 2>&1 \
   | awk '/^Finished supabase db diff/{found=1; next} found' \
   | awk '/^Found drop statements/{exit} {print}' \
   > supabase/migration-coherence-baseline.sql
   ```
2. Review the new baseline: confirm it contains only cosmetic diffs.
3. Commit the updated baseline file.
4. Push through the pipeline.

### Using the audit script

For deeper investigation (multiple potential ghosts):

```bash
bash scripts/audit-ghost-migrations.sh
```

Output: candidate ghost migration list with repair instructions.
Script is READ-ONLY — it never writes to production. Run locally after
`supabase link`.

## Implementation summary

| Artifact | Commit | Description |
|---|---|---|
| `.github/workflows/ci.yml` | `72e471557` | Hard-fail gate v1 (baseline-comparison gate v2 supersedes) |
| `.github/workflows/ci.yml` | `bd683da95` | Baseline-comparison gate v2 (final implementation) |
| `supabase/migration-coherence-baseline.sql` | `bd683da95` | Committed cosmetic baseline (1656 lines) |
| `supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql` | `b54fcf801` | 7-item repair migration (ghost functions + view + RLS drift) |
| `scripts/audit-ghost-migrations.sh` | `6b305882e` | READ-ONLY ghost-migration audit tool |
| `docs/learnings/0302-ghost-migration-from-reconciliation.md` | this commit | Incident capture + class documentation |

## References

- **ADR-0265** — Enforced Deployment Pipeline (parent; `db-push` job this
  gate depends on)
- **ADR-0360** — Preview tier without persistent Branch DB (context for
  2026-05-13 first prod release scope)
- **L-0042** — Migration timestamp ordering (forward-only discipline)
- **L-0299** — promote-preview pipe-mask hides script failure (sibling:
  CI exit-code masking class)
- **L-0301** — Format Check exit 123 on non-ASCII filenames (sibling:
  same main-push CI incident batch)
- **L-0302** — Ghost migration from reconciliation (this incident's learning
  doc)
- `supabase/migration-coherence-baseline.sql` — the committed cosmetic baseline
- `scripts/audit-ghost-migrations.sh` — READ-ONLY audit tool
