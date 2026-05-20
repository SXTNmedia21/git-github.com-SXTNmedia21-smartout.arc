---
title: "Plan — ci-migration-coherence-check"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: ci
tags: [plan, ci, migrations, supabase, drift, ghost-migration]
related:
  - L-0042 (migration timestamp ordering)
  - L-0301 (format check quotepath)
  - ADR-0265 (enforced deployment pipeline)
  - HANDOFF-ci-migration-coherence-check (will document the 2026-05-17 incident)
---

# Plan — ci-migration-coherence-check

> Branch: `feat/ci-migration-coherence-check` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-3` | Base: `development` | Module: ci | Started: 2026-05-17

## Goal

Add a CI gate that catches ghost migrations (recorded in `schema_migrations`
but DDL not applied) via post-`db-push` schema diff, so the 2026-05-17
production incident (invitation.metadata missing) cannot recur silently.

## The problem (root-cause)

2026-05-17 19:30 production: `Failed to create invitation: Could not find the 'metadata' column of 'invitation' in the schema cache`.

- Migration `20260310120000_invitation_metadata.sql` was recorded in prod
  `supabase_migrations.schema_migrations` but DDL never ran
- PostgREST returned cache error because column genuinely did not exist
- Repair: `supabase migration repair --status reverted` + `supabase db push --linked`. Migration file unchanged — only ledger lied
- Origin: 2026-05-13 reconciliation manually marked 17 migrations applied
  per `ci.yml:330-334` comment ("Ghost-repair loop removed 2026-05-13: prod schema_migrations was manually reconciled")

Why CI did not catch it:

- `supabase db push --linked --include-all` SKIPS migrations already in
  `schema_migrations`
- Main-push log shows: started applying at `20260514000010`, skipped
  everything before. No drift signal possible from current pipeline.

## The fix

New CI job `migration-coherence-check` runs after `db-push` on main-push,
executes `supabase db diff --linked`, FAILS the job if diff non-empty.

## Tasks

### Phase 1 — CI gate (~1h)

- [ ] Add `migration-coherence` job to `.github/workflows/ci.yml` after `db-push`
- [ ] Runs only on `github.ref == 'refs/heads/main' && github.event_name == 'push'`
- [ ] Uses `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` + `SUPABASE_PROD_REF` secrets
- [ ] `supabase link` → `supabase db diff --linked --schema public,payroll,websites,timesheet`
- [ ] Non-empty diff → `::error::Migration coherence failed` + print diff + exit 1
- [ ] Verify locally first: run against current prod (post-repair) state — must be empty diff

### Phase 2 — Audit script (~1-2h)

- [ ] `scripts/audit-ghost-migrations.sh` (READ-ONLY)
- [ ] Query prod `supabase_migrations.schema_migrations` via REST/SQL
- [ ] List local `supabase/migrations/*.sql` ordered by timestamp
- [ ] For each "recorded as applied" migration, run targeted db diff (or just check that key created identifiers from the migration body exist in prod via REST)
- [ ] Report timestamps that are recorded but produce non-empty diff → likely ghost
- [ ] Output: JSON list to `artifacts/ghost-migrations.json` + summary to stdout
- [ ] Repair instructions in script header

### Phase 3 — Docs (~30m)

- [ ] `docs/decisions/0361-ci-migration-coherence-check.md` (proposed → accepted on merge)
  - Status, context, decision, alternatives considered (#1 schema-diff selected, #2 fingerprint rejected, #3 idempotent re-apply rejected, #4 self-healing rejected)
- [ ] `docs/learnings/0302-ghost-migration-from-reconciliation.md`
  - The 2026-05-17 incident timeline
  - Why `db push --include-all` cannot detect ghosts
  - The repair procedure used
  - Encoded into the new CI gate

### Phase 4 — Verify + handoff (~30m)

- [ ] Push to development → CI green
- [ ] `pnpm ci:local` green (or expected SKIPs for cloud-only gates)
- [ ] HANDOFF doc with decisions + journeys + acceptance + next steps
- [ ] Close-feature via standard procedure

## Acceptance criteria

1. CI workflow has new `migration-coherence` job, depends on `db-push`
2. Test: push to main → CI Migration Coherence job runs → green on clean state, fails on synthetic drift
3. `scripts/audit-ghost-migrations.sh` runs locally, reports current ghost-migration count for prod
4. ADR-0361 + L-0302 committed to development
5. HANDOFF doc complete with journeys + decisions + learnings

## Risks

| Risk | Mitigation |
|---|---|
| `supabase db diff` produces false positives (cosmetic ordering) | Test against clean post-repair state first; tighten schema filter if needed |
| Adds 10-15s to main-push pipeline | Acceptable — only main-push, not every PR |
| Audit script reveals 10+ ghosts from 2026-05-13 | Serial repair sortie via established CLI procedure |
| `db diff` requires direct PG, not pooler | Same env as `db push` already uses |

## Out of scope

- Real-time alerting on schema drift between deploys (future ADR)
- Schema replication dev↔prod
- Replacing `db push` with another migration tool
- Self-healing auto-repair (too dangerous on prod)
