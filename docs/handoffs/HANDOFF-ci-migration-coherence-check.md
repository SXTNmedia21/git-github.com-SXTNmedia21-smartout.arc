---
title: "HANDOFF — CI Migration Coherence Check"
status: complete
updated: 2026-05-17
created: 2026-05-17
module: ci
tags: [ci, db, migrations, supabase, drift, ghost-migration, handoff]
---

# HANDOFF — CI Migration Coherence Check

> Branch: `feat/ci-migration-coherence-check`
> Worktree: `/home/sxtnl/wsl/smartout.ai-wt-3`
> Base: `development`
> Commits: 6 (plan + gate v1 + repair migration + gate v2 + audit script + ADR/L docs)

---

## Summary

Added a `migration-coherence` CI job that runs after `db-push` on every main-push and
fails the build if the live production schema diverges from a committed baseline. The
gate was prompted by a 2026-05-17 production incident where a `metadata` column on the
`invitation` table was missing from prod despite being recorded as applied in the
migration ledger — a "ghost migration" created during the 2026-05-13 first production
release. The sortie also includes a forward-only repair migration that resolved 7 drift
items found during the extended audit, a READ-ONLY audit script for future drift
investigation, ADR-0361, and learning L-0302.

---

## Background

### The 2026-05-17 Production Incident

**Timeline:**

| Time (Oslo) | Event |
|---|---|
| 2026-05-13 ~17:00 | PR #381 merged — first production release. Operator reconciled 17 pre-existing migrations in the fresh prod ledger via `supabase migration repair --status applied`. |
| 2026-05-13 ~18:00 | Smoke 5/5 green. Release declared successful. |
| 2026-05-17 ~19:00 | User attempts to create an invitation from the dashboard. |
| 2026-05-17 19:30 | Error: `Failed to create invitation: Could not find the 'metadata' column of 'invitation' in the schema cache` |
| 2026-05-17 19:35 | Investigation: prod ledger contains `20260310120000_invitation_metadata`. Column `invitation.metadata` does NOT exist. Ledger lied. |
| 2026-05-17 19:45 | Repair: `migration repair --status reverted 20260310120000 --linked` → `db push --linked`. Column applied. |
| 2026-05-17 20:00 | Smoke green. Invitation creation works. |
| 2026-05-17 20:30 | Extended audit via `scripts/audit-ghost-migrations.sh` reveals 4 more ghost-class items + 1 legacy table + RLS drift on 2 tables. |
| 2026-05-17 21:00 | Forward-only repair migration `20260620100000_align_prod_drift_2026_05_17.sql` written + merged (`b54fcf801`). All 7 items resolved. |

### Root Cause

During the 2026-05-13 first production release, the fresh Supabase Cloud project's
`schema_migrations` ledger was empty. To avoid re-running 600+ historical migrations,
the operator marked 17 timestamps as applied via `repair --status applied`. This is
valid when the database genuinely contains the DDL — but in this case,
`20260310120000_invitation_metadata.sql` (among others) had never actually run. The
ledger said "applied"; the schema said "absent."

`supabase db push --linked --include-all` trusts the ledger — it skips any migration
already recorded. No CI gate ran `supabase db diff` after the push. The ghost existed
silently for 4 days.

### Prior Repair of `20260310120000_invitation_metadata`

The initial repair happened directly via CLI (Pontus authorized in-session, prior to
this sortie's commits):

```bash
supabase migration repair --status reverted 20260310120000 --linked
supabase db push --linked
```

The migration file was not changed. Only the ledger entry was corrected, then the
normal push path applied the DDL. This repair is OUT OF GIT — it was performed on the
live prod database before the coherence gate existed.

---

## Decisions Made

### D1 — Baseline-comparison gate over hard-fail on any diff

**Decision:** The CI `migration-coherence` job compares the live `supabase db diff
--linked` output against a **committed baseline file**
(`supabase/migration-coherence-baseline.sql`) rather than failing on any non-empty
diff.

**Why:** After the forward-only repair migration, `supabase db diff` still produces
~1656 lines of diff on a post-repair, known-correct prod state. This is entirely
migra-tool cosmetic noise: `pg_get_functiondef()` serializes function bodies with
different whitespace and quoting than the original migration source SQL. A hard-fail
gate would be permanently red. The baseline-comparison approach provides the same
ghost-detection guarantee with zero false positives on known cosmetic noise.

**Reference:** ADR-0361 §Alternatives Considered — Alternative 1.

---

### D2 — Forward-only repair migration as the repair principle

**Decision:** All 7 drift items (4 ghost functions, 1 view drift, 2 RLS policy drifts,
1 legacy table drop) were resolved in a single forward-only migration
(`20260620100000_align_prod_drift_2026_05_17.sql`) rather than via multiple
`migration repair` calls.

**Why:** Running `repair --status reverted` for each item individually would require
6+ separate push operations and risks partial state if any step fails. A single
forward-only migration aligns all drift in one atomic push through the normal
development → preview → main pipeline. This honors the forward-only discipline
(L-0042, ADR-0265) and creates a permanent audit record of what was fixed.

**Reference:** ADR-0361 §The extended audit (Phase 1.5); L-0302 §The 7-item
forward-only migration.

---

### D3 — Audit script not wired into CI (READ-ONLY, on-demand only)

**Decision:** `scripts/audit-ghost-migrations.sh` is a READ-ONLY investigative tool,
not a CI gate.

**Why:** The audit script runs a deeper fingerprint-based analysis (checking that key
DDL identifiers from each migration body exist in prod) that produces a candidate ghost
list. This is investigative, not blocking — it is slow, produces false positives for
migrations that legitimately use non-deterministic identifiers, and requires linked prod
access. The CI gate (D1) handles the blocking function; the audit script handles the
one-time investigation function.

**Reference:** ADR-0361 §Audit script.

---

### D4 — Gate depends on `db-push`, runs main-push only

**Decision:** The `migration-coherence` job is declared `needs: [db-push]` and
conditioned on `github.ref == 'refs/heads/main' && github.event_name == 'push'`.

**Why:** Schema drift is a prod concern, not a PR concern. PR builds do not have prod
access (no `SUPABASE_PROD_REF` secret in fork contexts), and checking drift against dev
local state would catch nothing meaningful. The gate must run after `db-push` succeeds
(so the latest migrations are applied) and only on main-push (the event that touches
prod). This matches the scope of ADR-0265 which gates other prod-only checks at the
same event boundary.

**Reference:** ADR-0361 §Design principles 3 + 4.

---

## Artifacts Shipped

### Commit `c4d7749b3` — docs(plan): ci-migration-coherence-check sortie — plan + 3 journeys

Plan document + 3 user journeys written before implementation.

Files:
- `docs/plans/PLAN-ci-migration-coherence-check.md`
- `docs/journeys/JOURNEY-ci-migration-coherence-check.md`

---

### Commit `72e471557` — feat(ci): migration-coherence job — drift detection post db-push

First implementation of the CI gate (v1). Hard-fail on any non-empty diff (later
superseded by v2).

Files:
- `.github/workflows/ci.yml` — Added `migration-coherence` job (~30 lines)

---

### Commit `b54fcf801` — feat(db): align prod schema drift — 7 forward-only fixes (L-0302)

Forward-only repair migration addressing all 7 drift items found by the extended audit.
Applied to production on the same day.

Files:
- `supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql` — ~120 lines

Drift items addressed:
1. `decrypt_envelope` function body missing (ghost: `20231115180000`)
2. `lookup_workspace_by_code` function missing (ghost: `20240101000001`)
3. `search_workspaces` function missing (ghost: `20240101000002`)
4. `v_current_plan_preview` view definition drift (`20241215100000`)
5. Drop legacy table `hookresponser`
6. RLS policy `Update own profile` on `profile` (policy text drift)
7. RLS policy `Public profiles visible` on `profile` (policy drift)

---

### Commit `bd683da95` — feat(ci): baseline-comparison for migration-coherence gate

Final CI gate implementation (v2). Replaces hard-fail with baseline-comparison. Also
commits the baseline file generated from a known-clean post-repair prod state.

Files:
- `.github/workflows/ci.yml` — Updated `migration-coherence` job with `diff -u
  "$BASELINE" <(echo "$CURRENT")` comparison logic
- `supabase/migration-coherence-baseline.sql` — ~1656 lines of known cosmetic noise
  (17 function diffs + 1 view recreate)

---

### Commit `6b305882e` — feat(ci): audit-ghost-migrations.sh — one-time scan for residual drift

READ-ONLY audit script for investigating ghost migrations in production.

Files:
- `scripts/audit-ghost-migrations.sh` — ~120 lines

The script:
- Queries prod `schema_migrations` for recorded timestamps
- Checks key DDL fingerprints (column exists, function exists, view exists) for each
  migration body
- Outputs a candidate ghost list with repair instructions to stdout
- Never writes to production (READ-ONLY)

---

### Commit `582bd3f2b` — docs(adr): ADR-0361 + L-0302 — CI migration coherence + ghost migration class

Architecture decision record and learning document.

Files:
- `docs/decisions/0361-ci-migration-coherence-check.md` — ~395 lines
- `docs/learnings/0302-ghost-migration-from-reconciliation.md` — ~260 lines

---

## Learnings

### L-0302 — Ghost migration from 2026-05-13 manual reconciliation

Full document: `docs/learnings/0302-ghost-migration-from-reconciliation.md`

**Class:** Ghost migrations — ledger entries with no corresponding schema DDL.

**Mechanism:** `supabase migration repair --status applied` marks a migration as applied
in `schema_migrations` without verifying the DDL exists. `supabase db push
--include-all` then trusts the ledger and skips the file. The column/function/view
never appears. PostgREST's schema cache reflects reality (absent), not the ledger's
claim (applied).

**How `db push --include-all` skips recorded entries:** The Supabase CLI reads
`schema_migrations` before deciding which files to run. Any timestamp already present
in the ledger is marked "already applied" and skipped, regardless of whether the DDL
was ever executed. This is the intended behavior for routine operations where the ledger
is maintained by the CLI — but creates a blind spot when the ledger has been modified
by hand (e.g., bulk `repair --status applied` during a new-project bootstrap).

**Rule going forward:** Any use of `migration repair --status applied` for a batch of
migrations MUST be followed by a schema-truth verification:

```bash
supabase db diff --linked --schema public,payroll,websites,timesheet
# Diff should be empty (or match known baseline) after marking migrations applied.
```

---

## Acceptance Criteria Status

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | CI workflow has new `migration-coherence` job, depends on `db-push` | **PASS** | `bd683da95`. Job defined at `ci.yml` line ~397, `needs: [db-push]`, condition `main && push`. |
| 2 | Push to main → CI Migration Coherence job runs green on clean state, fails on synthetic drift | **PARTIAL** | Gate is wired and logic verified locally. Full end-to-end CI run requires an actual main-push post-merge. No synthetic drift test committed (would require temporary prod schema change — out of scope for this sortie). |
| 3 | `scripts/audit-ghost-migrations.sh` runs locally, reports current ghost-migration count for prod | **PASS** | `6b305882e`. Script ran post-repair (all 7 items resolved). Current state: audit script returns clean on post-repair prod. |
| 4 | ADR-0361 + L-0302 committed to development | **PASS** | `582bd3f2b`. Both docs committed on branch, merge to development pending close-feature. |
| 5 | HANDOFF doc complete with journeys + decisions + learnings | **PASS** | This document. Journeys at `docs/journeys/JOURNEY-ci-migration-coherence-check.md`. |

---

## Known Debt / Out of Scope

### Audit script not yet run post-merge

The audit script was run against prod during the sortie (2026-05-17 evening) and all
identified ghosts were resolved in `b54fcf801`. However, a final post-merge run on the
production state after `development → preview → main` push is recommended to confirm
the repair migration was applied correctly and no residual ghosts remain from the
pre-repair audit window.

**Recommendation:** Run `bash scripts/audit-ghost-migrations.sh` once after the first
main-push that includes this sortie.

---

### 17 cosmetic function diffs + 1 view diff in baseline

The committed baseline (`supabase/migration-coherence-baseline.sql`, ~1656 lines)
captures the known migra-tool cosmetic noise on a post-repair prod state. These are
semantically inert — the functions execute identically — but `pg_get_functiondef()`
serialization differs from the original migration source SQL. The baseline is the
accepted contract for this noise level.

A follow-up sortie could harden these by rewriting the 17 function migrations to match
exactly what `pg_get_functiondef` produces, reducing the baseline to zero lines. This
would make the gate simpler (diff must be empty) but risks introducing cosmetic rewrites
that change function semantics — non-trivial risk for security-sensitive functions like
`decrypt_envelope`. Deferred.

---

### Manual repair of `20260310120000_invitation_metadata` was OUT OF GIT

The initial invitation.metadata repair (Step 1: `migration repair --status reverted` +
Step 2: `db push --linked`) was performed directly via CLI on 2026-05-17 evening,
before this sortie's commits. The migration file `20260310120000_invitation_metadata.sql`
was not changed. The repair modified only the prod `schema_migrations` ledger, then
`db push` applied the DDL. There is no git commit recording this repair — the forward
evidence is:

- `20260620100000_align_prod_drift_2026_05_17.sql` (in git, applied via pipeline) covers
  the other 6 items
- The invitation.metadata repair is documented in L-0302 timeline
- The committed baseline file in `bd683da95` captures prod state AFTER the repair,
  confirming the column exists

---

### `migration repair --status applied` pattern not blocked in CI

This sortie adds detection but not prevention. If a future operator runs
`migration repair --status applied` without verifying DDL, the coherence gate will
catch the ghost on the next main-push — but the ghost will have existed for up to one
sprint (development → preview → main cycle). A future hardening could add a pre-push
hook that warns on bulk `migration repair` usage, or a CI check that audits the repair
history. Out of scope for this sortie.

---

## Next Steps

1. **Run the audit script post-merge** — after `feat/ci-migration-coherence-check`
   merges to `development → preview → main`, run:
   ```bash
   bash scripts/audit-ghost-migrations.sh
   ```
   Confirm output is clean (no residual ghosts from before `b54fcf801`).

2. **Promote through pipeline** — standard `close-feature.sh` merge to development,
   then `promote-preview.sh` HOP A, then PR `preview → main` (HOP B). On the first
   main-push after merge, verify the `Migration Coherence` CI job runs green.

3. **Regenerate baseline when intentional schema changes occur** — if a new function
   is added, or a view is recreated in a way that changes migra-tool output, the
   baseline drifts. Regenerate per ADR-0361 §Operational Procedure:
   ```bash
   supabase link --project-ref "$SUPABASE_PROD_REF" --password "$SUPABASE_DB_PASSWORD"
   supabase db diff --linked --schema public,payroll,websites,timesheet 2>&1 \
     | awk '/^Finished supabase db diff/{found=1; next} found' \
     | awk '/^Found drop statements/{exit} {print}' \
     > supabase/migration-coherence-baseline.sql
   ```
   Review the new baseline, confirm cosmetic-only, commit, push through pipeline.

4. **Consider follow-up sortie to harden baseline to zero** — rewrite the 17 cosmetic
   function migrations to match `pg_get_functiondef` output, enabling a hard-fail gate
   (no baseline needed). Non-trivial risk; schedule after stable period on production.

---

## Verification Commands

Run these post-merge to confirm the sortie is correctly applied:

```bash
# 1. Confirm migration-coherence job exists in CI workflow
grep -n "migration-coherence" .github/workflows/ci.yml

# 2. Confirm repair migration is present
ls -la supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql

# 3. Confirm baseline file is present and non-empty
wc -l supabase/migration-coherence-baseline.sql

# 4. Confirm audit script is executable
bash scripts/audit-ghost-migrations.sh --help 2>&1 || head -5 scripts/audit-ghost-migrations.sh

# 5. Confirm ADR-0361 is in decision log
grep "ADR-0361" docs/decisions/0000-decision-log.md
```

---

## File List

| File | Action | LOC (approx) |
|---|---|---|
| `docs/plans/PLAN-ci-migration-coherence-check.md` | New — sortie plan | ~109 |
| `docs/journeys/JOURNEY-ci-migration-coherence-check.md` | New — 3 user journeys | ~120 |
| `.github/workflows/ci.yml` | Modified — `migration-coherence` job added (v1 then v2) | +~60 net |
| `supabase/migrations/20260620100000_align_prod_drift_2026_05_17.sql` | New — forward-only 7-item repair | ~120 |
| `supabase/migration-coherence-baseline.sql` | New — cosmetic noise baseline | ~1656 |
| `scripts/audit-ghost-migrations.sh` | New — READ-ONLY ghost audit tool | ~120 |
| `docs/decisions/0361-ci-migration-coherence-check.md` | New — ADR-0361 | ~395 |
| `docs/learnings/0302-ghost-migration-from-reconciliation.md` | New — L-0302 | ~260 |
| `docs/HANDOFF-ci-migration-coherence-check.md` | New — this document | ~310 |

**Total new files:** 8 + 1 modified
**Approximate total new LOC:** ~3150
