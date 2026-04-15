---
title: CI — pgTAP workflow
status: done
updated: 2026-04-15
created: 2026-04-15
module: infra
tags: [ci, supabase, pgtap, testing, shift-lifecycle]
---

# CI — pgTAP workflow

Reference: `docs/plans/PLAN-secure-shift-lifecycle.md` WS-B3.
Prior audit: `docs/audits/AUDIT-supabase-preview-ci-2026-04-15.md` (WS-B1/B2).

## Purpose

Run all pgTAP suites on every pull request that touches `supabase/` so database
regressions are caught before merge. Complements the Supabase GitHub App's
managed preview branching (which only verifies `db reset`, not pgTAP suites).

## Workflow

File: `.github/workflows/pgtap.yml`

- **Trigger:** `pull_request` against `main`, `development`, `preview` when any
  of these paths change:
  - `supabase/migrations/**`
  - `supabase/tests/**`
  - `supabase/seed.sql`
  - `supabase/config.toml`
  - `.github/workflows/pgtap.yml`
- **Runner:** `ubuntu-latest`, timeout 15 min, `permissions: contents: read`.
- **Steps:**
  1. Checkout.
  2. Install Supabase CLI via `supabase/setup-cli@v1`.
  3. `npx supabase start` — boots Postgres + applies all migrations + runs seed.
  4. Sanity check (`SELECT version()`, count migrations).
  5. Run each pgTAP suite with `psql --set ON_ERROR_STOP=1 -f …`:
     - `supabase/tests/gate-action.sql`
     - `supabase/tests/derivation.sql`
     - `supabase/tests/lifecycle-processes.sql`
     - `supabase/tests/lifecycle-capability.sql`
  6. On failure: capture `supabase status`, `docker ps -a`, and every
     `supabase_*` container log into `artifacts/pgtap/` and upload as the
     `pgtap-failure-logs` artifact (7-day retention).
  7. Always: `supabase stop --no-backup`.

Each suite runs in its own step so a failure isolates to a named step in the
GitHub UI. `ON_ERROR_STOP=1` ensures a failed assertion exits non-zero.

## Adding new pgTAP suites

1. Add `supabase/tests/<new-suite>.sql`. Wrap the suite in `BEGIN; … ROLLBACK;`
   if you want hermetic isolation between suites (current suites follow this
   pattern — see `gate-action.sql`).
2. Add a new `Run pgTAP — <new-suite>` step to `.github/workflows/pgtap.yml`
   immediately after the existing suite steps, in the order you want them to
   run. Keep one suite per step so the GitHub UI shows which one failed.
3. Document the suite's intent in a header comment at the top of the SQL file,
   and cross-reference the relevant ADR.

## Local reproduction

Start Supabase Local and run any suite directly:

```bash
npx supabase start                       # boots local DB with all migrations + seed
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  --set ON_ERROR_STOP=1 \
  -f supabase/tests/gate-action.sql
```

To run all four suites sequentially (mirrors CI):

```bash
for s in gate-action derivation lifecycle-processes lifecycle-capability; do
  psql "postgresql://postgres:postgres@localhost:54322/postgres" \
    --set ON_ERROR_STOP=1 \
    -f "supabase/tests/${s}.sql" || { echo "FAIL: $s"; break; }
done
```

Alternative (inside the running Supabase DB container):

```bash
docker exec -i "$(docker ps -qf name=supabase_db)" \
  psql -U postgres -d postgres \
  --set ON_ERROR_STOP=1 \
  < supabase/tests/gate-action.sql
```

## Branch protection

The workflow runs automatically on every qualifying PR, but GitHub will not
block merges on it until it is added as a required status check. Pontus to
configure:

- **Repo → Settings → Branches → Branch protection rules** for `development`,
  `preview`, `main`.
- Under **Require status checks to pass**, add `pgTAP Suites` (the job name).
- Recommended alongside existing required checks (`Lint`, `Type Check`,
  `Build`, etc.).

Until branch protection is updated, a red pgTAP run is advisory only.

## Why not `supabase test db`?

The Supabase CLI does ship a `supabase test db` runner for pgTAP, but:

- It discovers tests by filename pattern and does not report per-file step
  granularity the way individual `psql -f` steps do in GitHub Actions.
- Our current suites are written as self-contained scripts with `BEGIN … ROLLBACK`
  transactions, already idempotent, and are documented to run via `psql -f` in
  the audit (`AUDIT-supabase-preview-ci-2026-04-15.md`). Keeping the CI invocation
  identical to the documented local invocation avoids drift.

If suite count grows beyond ~10, revisit `supabase test db` for convenience.
