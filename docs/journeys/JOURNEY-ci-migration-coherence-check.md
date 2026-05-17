---
title: "Journey — ci-migration-coherence-check"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: ci
tags: [journey, ci, migrations, drift, ghost-migration]
---

# Journey — ci-migration-coherence-check

## Journey 1: SRE/Developer pushes change with hidden schema drift

**Precondition:** Prod has a ghost migration (recorded in `schema_migrations` but DDL not actually applied). May exist from 2026-05-13 reconciliation or any future `migration repair` without re-push.

1. Developer merges feature PR to `development`
2. Developer merges `development → preview` via `promote-preview.sh`
3. Operator opens HOP B PR `preview → main`, all 14 required CI checks green
4. Operator merges to `main`
5. Main-push CI runs:
   - `Lint`, `Type Check`, `Build`, etc. → green
   - `Migration Deploy` (db push) → green (skips ghost migration silently)
   - **NEW: `Migration Coherence` → runs `supabase db diff --linked`**
   - Diff is non-empty (prod schema missing the ghost's DDL)
   - Job FAILS with `::error::Migration coherence failed`
   - Diff content visible in job log
6. Operator sees red check, investigates, repairs via:
   ```bash
   supabase migration repair --status reverted <ts>
   supabase db push --linked --include-all
   ```
7. Push empty commit to main to retrigger CI
8. `Migration Coherence` now green

**Postcondition:** Ghost migration eliminated. Prod schema matches local. Next deploy can proceed.

**Error paths:**

- `supabase db diff` itself errors (network, auth, timeout) → job exits non-zero with clear error → operator runs `db diff` locally to confirm
- False positive (cosmetic ordering) → operator inspects diff, decides: ignore prefix or commit micro-migration to align — does NOT bypass the gate
- Diff is empty but invite still fails → not a ghost-migration class; investigate PostgREST cache or app code separately

---

## Journey 2: Operator responds to drift alert

**Precondition:** `Migration Coherence` job has failed on a main-push.

1. Operator opens GitHub Actions UI → failed run → `Migration Coherence` job log
2. Job log shows:
   ```
   ::error::Migration coherence failed — prod schema does not match local migrations
   ==================== DRIFT DIFF ====================
   <SQL diff content>
   ====================================================
   ```
3. Operator reads diff, classifies:
   - **Ghost migration** (recorded but DDL missing) → `migration repair --status reverted <ts>` + `db push`
   - **Manual prod DDL touch** (someone ran SQL in Dashboard) → write a new migration matching what was done, push it
   - **Out-of-order push** (rare) → investigate `schema_migrations` ordering
4. Operator applies repair via CLI (NOT via SQL Editor — migration file is source of truth)
5. Operator pushes empty commit `ci: re-run migration coherence after repair`
6. Main-push CI runs, Migration Coherence now green

**Postcondition:** Drift fixed. Repair documented in handoff or Linear ticket.

**Error paths:**

- Operator does not have prod vault access → `unset OP_SERVICE_ACCOUNT_TOKEN` + `op signin --account sxtn`
- `supabase migration repair` fails with "no such migration" → check that local migration file exists; if not, the diff revealed manual DDL → write the matching migration instead

---

## Journey 3: One-time audit of existing ghost migrations from 2026-05-13

**Precondition:** Sortie shipped. Pipeline gate active going forward. But the historical 2026-05-13 reconciliation may have left up to 17 ghost migrations.

1. Operator runs `scripts/audit-ghost-migrations.sh` locally with prod credentials
2. Script reports list of timestamps where:
   - Migration is in prod `schema_migrations`, AND
   - Running it in isolation against prod schema produces non-empty diff
3. For each ghost found:
   - Document in Linear ticket (tag: `ci-migration-coherence`, label: `production`)
   - Repair via `migration repair --status reverted <ts>` + `db push --include-all`
   - Verify column/table/index/policy from the migration body now exists in prod
4. After all repairs: `audit-ghost-migrations.sh` returns zero ghosts
5. Now `Migration Coherence` gate stays green permanently

**Postcondition:** Historical ghost migrations cleared. Pipeline self-defends going forward.

**Error paths:**

- Audit finds 0 ghosts → 2026-05-13 reconciliation was actually clean OR ghosts are below `db diff` resolution (no missing DDL artifacts). Either way, gate covers future cases.
- Audit finds 10+ ghosts → triage by impact: revenue-path migrations first (invitation, contract, payroll, schedule), governance migrations second, internal-tooling migrations last.
- Repair fails mid-list → STOP, do not continue. One bad repair can compound; investigate root cause before resuming.
