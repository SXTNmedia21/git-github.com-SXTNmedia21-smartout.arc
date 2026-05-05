---
title: "Pipeline cutover divergence — main and preview have fully disjoint histories"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, deploy, pipeline, divergence, pr-309, migration-cutover, scenario-k]
---

# Pipeline Cutover Divergence — HOP B Blocked by Disjoint Histories

## TL;DR for tired-Pontus

- PR #309 (preview→main) shows CONFLICTING/DIRTY because **preview and main share zero git commits** — the 2026-04-20 Scenario K hard-reset broke the ancestry chain permanently.
- Development HEAD is `0694ba54b` (has `[deploy]`). CI was `in_progress` at last check — wait for green, then HOP A runs cleanly.
- HOP B cannot go through GitHub PR in normal flow. Requires a **local merge with `--allow-unrelated-histories`** done by Pontus from his workstation.
- Production DB is at `20260515130400`. **94 migrations** need to apply on HOP B merge. 16 of those lack idempotency guards.
- Tonight: HOP A only. HOP B + DB push = fresh session tomorrow with clear head.

---

## Section 1 — Divergence Anatomy

### Branch commit counts (verified 2026-05-04)

| Branch | Commits | Oldest commit date | Shares commits with main |
|--------|---------|-------------------|--------------------------|
| `main` | 2566 | initial commit (pre-2026) | — |
| `development` | 769 | 2026-04-20 | **0 shared** |
| `preview` | 761 | 2026-04-20 | **0 shared** |

All three branches have **zero common commits**. `git merge-base origin/main origin/preview` exits 1.

### Root cause

The 2026-04-20 Scenario K hard-reset (commit `dcf0ebf1c`) replaced preview with a fresh commit tree branched off `origin/development`. That new tree was bootstrapped from the 2026-04-20 state, not from any commit reachable from main. The new tree has no parent-chain that leads back to the original repo root (`39905dbe7`). Development was reset the same way.

**This is not a squash-merge ghost.** Prior sessions diagnosed this class of problem as "squash-merge ghost pattern" (6 occurrences noted in RUNS.md). This instance is different: it is a complete DAG split from the Scenario K reset. The squash-merge ghost pattern (development behind main by N cherry-pick commits) is a **different** failure mode.

### What the non-merge content commits on main actually are

```
1f5bf4807  fix(edge-functions): CORS suffix-match for tenant subdomains (#231)
58290dd84  release: migration hotfix + unblock 94 pending migrations (#227)
2fa890ef9  Preview (#226)
4300b9906  fix(migration): drop NOT NULL on legacy contract_template.template_type
183ac483f  fix(stage-engine): include utils + telemetry in Docker build chain
```

**All of these are already back-ported to development under different SHAs:**

| Main commit | Content | Status on development |
|-------------|---------|----------------------|
| `1f5bf4807` (#231) | CORS suffix-match fix | Back-ported `c16a9d6b6` on 2026-05-03 |
| `58290dd84` (#227) | Migration hotfix + billing engine | `engine_authority_config_updated_by_nullable` migration present on dev |
| `4300b9906` | contract_template NOT NULL drop | Same commit SHA on development (found via `git log`) |
| `183ac483f` | stage-engine Docker fix | Superseded by later stage-engine work on development |

**No content is exclusively on main and missing from development.** The divergence is ancestry-only, not content.

### Migration file counts

| Branch | Migrations (excl. rollback) |
|--------|----------------------------|
| `main` | 376 |
| `preview` / `development` | 492 |

Preview has 116 more migration files than main. All 116 exist on preview AND development. Zero migrations are exclusively on main.

### The conflict in PR #309

GitHub attempts a 3-way merge: finds no merge-base → treats both sides as unrelated histories → reports every differing file as a conflict. A `git merge-tree` simulation shows **713 source files with genuine content differences** (same path, different content), all of which prefer preview's version (newer, post-development work). With `-X theirs` / `-X ours` the merge resolves cleanly — zero irresolvable conflicts.

---

## Section 2 — Production DB State

### Latest applied migration on production

```
version: 20260515130400
name: helpdesk_rls_and_thread_enum
```

Verified via `supabase_migrations.schema_migrations` on project `yljaglomadbhyqpcigff` (MCP query 2026-05-04).

### Unapplied delta

| Stat | Count |
|------|-------|
| Migrations on preview newer than prod latest | **94** |
| Of those: have idempotency markers (IF NOT EXISTS / OR REPLACE / ON CONFLICT) | 78 |
| Of those: **missing idempotency markers** | **16** |

### First unapplied migration

`20260515130500_seed_session_authority.sql`

### Last migration in delta

`20260523000100_compute_period_aggregates_company_join.sql`

### 16 non-idempotent migrations in the unapplied delta

These have no `IF NOT EXISTS`, `IF EXISTS`, `OR REPLACE`, or `ON CONFLICT` guards. They will fail on re-run (no harm — Supabase skips already-applied versions by version number — but note for rollback planning):

```
20260515170000_billing_product_catalog.sql
20260515170200_contract_template_lineage_columns.sql
20260516000200_journey_version_status_0b_enum.sql
20260516000300_journey_version_status_0c_tighten.sql
20260516120000_deprecate_handoff_notes_column_phase1.sql
20260517000000_engine_event_realtime_publication.sql
20260518200000_create_employee_availability.sql
20260518200001_create_employee_availability_preference.sql
20260519000000_create_page_knowledge.sql
20260519100001_workspace_active_contract_id_fk.sql
20260519110000_deprecate_help_request_table.sql
20260520120100_engine_trigger_contract_events.sql
20260520170000_channel_access_rls_policies.sql
20260520170001_schedule_shift_dept_backfill.sql
20260521000200_billing_accountant_rls_policies.sql
20260522000000_billing_settlement_schema.sql
```

**Risk:** If the Supabase Cloud migration run fails mid-sequence (e.g. `billing_settlement_schema` has a dependency on the prior billing tables), the non-idempotent ones cannot be re-run without manual cleanup. Supabase will pause at the failed migration and queue subsequent ones. Review each before merge — especially the billing_settlement_schema (complex DDL, no guards).

### 22 main-only migrations NOT on production

The SQL check `WHERE version IN ('20260422120001', ...)` returned empty. These 22 migration files exist on preview but were applied to production through a prior squash-merge path that did not register them in `supabase_migrations.schema_migrations`. They are in the file tree on preview but **already applied** to the production DB (effects are present, version record is missing).

**Risk:** If Supabase auto-apply tries to run them again on HOP B merge, it depends on whether Supabase Cloud checks by filename or by SQL content. Supabase checks by version number — since no `schema_migrations` record exists for them, it WILL try to re-run them. With no idempotency guards, this will fail.

**Mitigation:** Before HOP B, manually insert these 22 version records into production:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES 
  ('20260422120001', 'guardian_log_pg_notify', ARRAY[]::text[]),
  ('20260422215500', 'system_actor_profile_seed', ARRAY[]::text[]),
  -- ... (full list below)
ON CONFLICT (version) DO NOTHING;
```

Full list of the 22 that need manual version-record insertion:
```
20260422120001  guardian_log_pg_notify
20260422215500  system_actor_profile_seed
20260428220000-20260428220007  tips_* (8 migrations)
20260429010000  approve_tip_pool_rpc
20260429092821  workspace_kpi_target_manual_value
20260429093537  workspace_kpi_manual_value
20260429174000  profile_welcome_wizard
20260430182443  employment_contract_activity_trail_trigger
20260503174428  migration_state_latest_rpc
20260515120100-20260515120600  agent_session_* + decrypt_envelope_rpc (6 migrations)
```

---

## Section 3 — Strategies

| # | Strategy | Risk | Reversible | Est. Time | DB push tonight | HOP A tonight |
|---|----------|------|-----------|-----------|-----------------|---------------|
| A | Defer HOP B entirely — HOP A only tonight | LOW | Yes | 15 min | No | Yes |
| B | Cherry-pick main hotfixes onto dev (not needed — all already back-ported) | N/A | — | — | — | — |
| C | Local `--allow-unrelated-histories` merge by Pontus | MEDIUM | Yes (via revert commit) | 30-60 min | Yes (on merge) | Yes |
| D | Reset preview+main history (nuclear) | HIGH | No | 2h+ | Risky | Yes |

**Strategy B is N/A.** All main hotfixes are already on development. The brief's Strategy B assumed they weren't — the investigation proved otherwise.

### Strategy C — Recommended for HOP B

Pontus runs locally from his workstation (not the agent):

```bash
# Step 1: Verify dev CI is green and preview is at dev HEAD after HOP A
git fetch origin
git log --oneline origin/preview | head -3  # must show dev HEAD SHA

# Step 2: Checkout main locally
git checkout main
git pull origin main

# Step 3: Merge preview into main with unrelated-histories
# -X theirs = on conflict, take preview's version (newer code wins)
git merge origin/preview --allow-unrelated-histories -X theirs \
  -m "release: merge preview → main — unrelated-histories graft (post-Scenario-K cutover)

Development and main have disjoint ancestry since 2026-04-20 Scenario K reset.
All main hotfixes (#227, #231, #231-backport) are already on preview/development.
This merge grafts the histories. Preview content wins on all conflicts (-X theirs).
94 migrations will auto-apply to production via Supabase on merge.

Co-Authored-By: deploy-conductor (Claude Sonnet 4.6) <noreply@anthropic.com>"

# Step 4: Push to main
git push origin main

# Step 5: Monitor Supabase migration apply in dashboard
# Dashboard: https://app.supabase.com/project/yljaglomadbhyqpcigff/database/migrations
```

**Before Step 4:** Insert the 22 missing version records into production `supabase_migrations.schema_migrations` (see Section 2 mitigation above). This prevents Supabase from re-running already-applied migrations.

**Strategy D** (hard-reset main to preview): Loses main's 2566-commit history. Not recommended — main history is non-critical but losing it is irreversible and creates audit gaps.

---

## Section 4 — Tonight's Safe Minimum (HOP A Only)

### Current dev HEAD

`0694ba54b` — `chore(release): trigger preview deploy [deploy]`

The `[deploy]` commit already exists. No new commit needed.

### Pre-flight checklist

1. Wait for CI green on `0694ba54b`:
   ```bash
   gh api repos/SXTNmedia21/smartout.ai/commits/0694ba54b0f2bdd729984f3c0df5eb943cf4a4bd/check-runs \
     --jq '.check_runs[] | "\(.conclusion // .status) \(.name)"'
   ```
   Required: all 14 checks = `success` or `skipped` (Migration State + Supabase Preview may be skipped — acceptable per ADR-0265).

2. Verify local dev is in sync:
   ```bash
   git fetch origin
   git status  # must be clean
   git log origin/development..HEAD  # must be empty (no unpushed commits)
   ```

3. Verify FF is possible:
   ```bash
   git merge-base --is-ancestor origin/preview origin/development && echo "FF possible" || echo "NOT FF-able"
   ```

### HOP A — exact operator commands

```bash
# Single command, all gates enforced by wrapper
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh
```

The wrapper runs:
- Gate 1: branch-sync (local dev = origin/development)
- Gate 2: CI green on dev HEAD
- Gate 3: Vercel READY for dev SHA (smartout-web + smartout-landing)
- Gate 4: FF-ancestry check (preview is ancestor of development)
- Gate 5: smoke-probe.sh preview
- Gate 6: tag `lkg-preview-<sha>` + push

### Post-HOP-A verification

```bash
# Confirm LKG tag was created
git tag -l "lkg-preview-*" | sort | tail -3

# Confirm preview is at dev HEAD
git fetch origin
git log --oneline origin/preview | head -3
# Must show: 0694ba54b chore(release): trigger preview deploy [deploy]

# Confirm Vercel preview is live
gh api repos/SXTNmedia21/smartout.ai/deployments \
  --jq '.[] | select(.environment=="Preview") | "\(.id) \(.created_at) \(.ref)"' | head -3
```

### After HOP A green

Tell the system: "HOP A complete. Preview at `0694ba54b`. LKG tag exists. Ready for HOP B planning next session."

**Do NOT attempt HOP B tonight.** The `--allow-unrelated-histories` merge is a one-shot operation that needs fresh eyes, the 22 version-record SQL prepared in advance, and Supabase migration monitoring.

---

## Section 5 — Tomorrow's Path (Strategy C — HOP B + DB Push)

### Preparation tasks (do before running merge)

1. **Prepare the 22 version-record SQL.** Generate the INSERT statement for all 22 missing migration records. Run it on production BEFORE triggering the merge-to-main. Use Supabase MCP or dashboard SQL editor.

2. **Run drift-check:**
   ```bash
   ./infra/scripts/drift-check.sh
   ```
   Confirm all 4 parity checks green.

3. **Verify last drift-check was < 24h old** (required pre-HOP-B per ADR-0265).

4. **Close PR #309** (it's CONFLICTING and will be superseded by the local merge push):
   ```bash
   gh pr close 309 --comment "Superseded by local --allow-unrelated-histories merge. Ancestry is disjoint since 2026-04-20 Scenario K reset."
   ```

### HOP B execution (Pontus, locally)

See Strategy C commands in Section 3. Key points:
- Run from Pontus's local workstation, not agent
- `-X theirs` ensures preview/dev content wins everywhere
- Expect the push to trigger Supabase auto-apply of 94 migrations
- Monitor Supabase dashboard immediately after push

### Post-merge monitoring

```bash
# Watch Supabase migration apply (poll until latest = 20260523000100)
op run --env-file=.env.template -- bash -c \
  'curl -sS -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/migration_state_latest" \
   -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
   -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq'

# Run production smoke probe
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production
```

### Rollback plan

If any migration fails mid-apply:
1. Supabase will pause at the failed migration. Note the version number from dashboard.
2. If the migration is non-idempotent, fix the SQL and re-apply manually via Supabase SQL editor.
3. If damage is structural (wrong schema), revert the merge on main and re-push:
   ```bash
   git revert -m 1 HEAD  # revert the merge commit
   git push origin main
   ```
   Then diagnose and fix the offending migration before re-attempting.

---

## Section 6 — Linear Ticket Queue

| Issue | Priority | Description |
|-------|----------|-------------|
| `deploy-drift` | P1 | PR #309 CONFLICTING — close it, document the --allow-unrelated-histories path |
| `deploy-drift` | P1 | 22 migration version-records missing from production `schema_migrations` — prepare INSERT SQL before HOP B |
| `deploy-drift` | P2 | 16 non-idempotent migrations in unapplied delta — review each before HOP B, especially `billing_settlement_schema` |
| `docs` | P3 | Update ADR-0265 with note: post-Scenario-K resets break PR ancestry; HOP B requires `--allow-unrelated-histories` local merge |
| `docs` | P3 | Document the disjoint-history variant of the divergence pattern in deploy-conductor KNOWLEDGE.md |
| `infra` | P3 | Add `apps/admin` to Vercel deploy config (it's on preview but may not have Vercel project configured) |

---

## Appendix — Key SHA Map

| Ref | SHA | Notes |
|-----|-----|-------|
| `origin/development` HEAD | `0694ba54b` | Has `[deploy]` commit |
| `origin/preview` HEAD | `dcf0ebf1c` | 8 commits behind development |
| `origin/main` HEAD | `1f5bf4807` | #231 CORS fix — last clean state |
| PR #146 last clean merge | 2026-04-07 | Last PR that ran cleanly through full pipeline |
| Production latest migration | `20260515130400` | `helpdesk_rls_and_thread_enum` |
| Preview latest migration | `20260523000100` | `compute_period_aggregates_company_join` |
| LKG tag (existing) | `lkg-preview-efd81700` | Pre-dates tonight's HOP A |
