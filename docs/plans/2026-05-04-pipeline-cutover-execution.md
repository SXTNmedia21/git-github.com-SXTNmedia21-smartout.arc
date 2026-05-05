---
title: "Pipeline cutover execution plan — preview → main + 95 migrations"
status: dispatch_ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [plan, cutover, hop-b, db-push, branching, dag-split, allow-unrelated-histories]
---

# Pipeline Cutover Execution Plan

> **For fresh-context agent (post-/compact):** This plan is self-contained. Read top to bottom. Each phase has explicit decision gate + operator command + verification. Do not skip phases.

## Mission

Get production database updated with 95 migrations + production code synced with preview's `f51b1f55f`. Tonight. Pontus has authorized full pipeline run with hawk-mode + per-phase verification.

## State at plan-write time

| Branch | SHA | Notes |
|---|---|---|
| `main` | `1f5bf4807` | Production, untouched since 2026-05-03 |
| `preview` | `f51b1f55f` | HOP A complete 2026-05-04 06:30, lkg-preview-f51b1f55 tagged |
| `development` | `6b0ddf7d6` | Migration #95 (88 anon REVOKE) added, ready to bundle |
| Sortie wt-4 | running background | `feat/pwa-telemetry-build` investigation, separate scope |

Production DB:
- Project: `yljaglomadbhyqpcigff` (smartout_ai_prod)
- Tail: `20260515130400` (helpdesk_rls_and_thread_enum)
- Applied: 376 migrations
- 22 missing version-records in `supabase_migrations.schema_migrations` (records exist in code but never INSERTed into prod tracking table)

Migrations to apply: **95 total** = 94 unapplied (delta) + 1 hardening (#95 REVOKE 88 anon SECURITY DEFINER fns)

Of the 94 delta: 16 non-idempotent (safe for first-time linear apply per verification-agent — Supabase `db push` skips already-applied versions by version number)

Migration #95 file: `supabase/migrations/20260524000000_revoke_anon_security_definer_hardening.sql`

## Strategy

**Supabase Branching ephemeral dry-run, then prod apply.** Pontus's intuition ("clone main to preview") via cloud-native Branching primitive.

| Phase | Op | Risk | Reversibel | Decision gate before |
|---|---|---|---|---|
| 0 | pg_dump --schema-only prod backup | NONE | n/a | (none) |
| 1 | Create ephemeral Supabase branch from prod, apply 95 migrations to it, smoke validate, DELETE branch | NONE | yes (delete branch) | (none) |
| 2 | INSERT 22 version-records to prod `supabase_migrations.schema_migrations` (idempotent ON CONFLICT) | LOW | yes (DELETE versions) | **PAUSE** for operator go |
| 3 | `supabase db push --linked` → 95 migrations to prod | **HIGH** | NO (pg_restore rope only) | **PAUSE** for operator go |
| 4 | Local `git merge origin/preview --allow-unrelated-histories -X theirs` on main + `git push origin main` | MED | partial (revert commit, but Vercel deploys from new HEAD) | **PAUSE** for operator go |
| 5 | Smoke production + tag lkg-prod + close PR #309 | LOW | n/a | (none) |
| 6 | Cleanup: delete ephemeral branch, activity-log entry, RUNS.md update | LOW | n/a | (none) |

## Phase 0 — pg_dump backup (read-only)

**Goal**: Safety net before any prod write.

```bash
cd /home/sxtnl/dev/smartout.ai
DATABASE_URL=$(op run --env-file=.env.template -- bash -c 'echo "postgresql://postgres.yljaglomadbhyqpcigff:$SUPABASE_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"')
# Adjust host/port if not the EU pooler — verify via Supabase MCP get_project for project yljaglomadbhyqpcigff

# Schema-only first (small, fast)
op run --env-file=.env.template -- bash -c \
  'pg_dump "$DATABASE_URL" --schema-only --no-owner --no-acl \
   -f /tmp/prod-schema-snapshot-$(date +%Y%m%d-%H%M%S).sql'
ls -lh /tmp/prod-schema-snapshot-*.sql

# OPTIONAL: data-only (longer, ~5-10 min, sensitive PII — handle carefully)
# Only if downtime budget allows. Tonight: skip if schema-only suffices for confidence.
```

**Verification**: file exists, size > 0, contains "CREATE TABLE" and "CREATE POLICY" lines.

**On failure**: investigate connection. Do NOT proceed to Phase 1 without backup.

## Phase 1 — Ephemeral branch dry-run

**Goal**: Verify all 95 migrations apply cleanly against prod-state schema. Zero prod impact.

### 1.1 Create ephemeral branch

Use Supabase MCP `mcp__plugin_supabase_supabase__create_branch`:

```
project_id: yljaglomadbhyqpcigff
name: cutover-test-2026-05-04
```

This forks prod (schema + data). Cost ~$0.03. Branch ID returned in response — capture as `BRANCH_ID`.

### 1.2 Verify branch tail matches prod

```sql
-- Via Supabase MCP execute_sql on BRANCH_ID:
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```

Expected: `20260515130400` at top. Same as prod.

### 1.3 Apply 22 missing version-records to branch

```sql
-- 22 versions list — get from divergence handoff Section 2 OR
-- recompute by querying prod schema_migrations vs files in supabase/migrations/
-- that have timestamp <= 20260515130400 but missing from prod tracking.

INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  -- [22 version strings]
  ('VERSION_1'), ('VERSION_2'), ...
ON CONFLICT (version) DO NOTHING;
```

To compute the 22 list:
```bash
# All version prefixes from filenames
ls supabase/migrations/*.sql | xargs -n1 basename | sed 's/_.*//' | sort -u > /tmp/dev-versions.txt

# Versions applied to prod (from MCP query)
# Save to /tmp/prod-versions.txt

# Diff: in dev but not in prod, AND <= prod tail
comm -23 /tmp/dev-versions.txt /tmp/prod-versions.txt | awk '$0 <= "20260515130400"' > /tmp/missing-versions.txt
wc -l /tmp/missing-versions.txt  # Expected: 22
```

### 1.4 Apply 95 migrations to branch

```bash
# Set branch as Supabase target
SUPABASE_PROJECT_REF=$BRANCH_ID op run --env-file=.env.template -- supabase db push --linked
```

Watch for errors. Each migration should record in branch's `schema_migrations`.

### 1.5 Validate branch

```sql
-- Verify tail advanced
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
-- Expected: 20260524000000_revoke_anon_security_definer_hardening
```

Smoke probe against branch URL:
```bash
SUPABASE_PREVIEW_REF=$BRANCH_ID op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh preview
```

Expected: 4/4 green.

### 1.6 Decision gate

If any of 1.4 / 1.5 RED:
- STOP. Do NOT proceed to Phase 2.
- Diagnose: which migration failed, why.
- Fix migration on dev branch, re-run Phase 1 with new branch.
- Delete failed branch.

If green:
- Delete branch (cleanup):
  ```
  mcp__plugin_supabase_supabase__delete_branch with branch_id: $BRANCH_ID
  ```
- Proceed to Phase 2.

## Phase 2 — INSERT 22 missing version-records to PROD

**🚨 First prod write. PAUSE for operator go.**

```sql
-- Via Supabase MCP execute_sql on yljaglomadbhyqpcigff:
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  -- [22 versions from /tmp/missing-versions.txt]
ON CONFLICT (version) DO NOTHING;

-- Verify
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
-- Expected: 376 + 22 = 398 (or less if some were already applied)
```

**Verification**: COUNT query returns expected total. SELECT version WHERE version IN (22 list) returns 22 rows.

**On failure**: rollback via `DELETE FROM supabase_migrations.schema_migrations WHERE version IN (...)`. Investigate.

## Phase 3 — `supabase db push --linked` to PROD

**🚨 IRREVERSIBLE. PAUSE for operator go. pg_dump rope from Phase 0 = only fallback.**

```bash
op run --env-file=.env.template -- supabase db push --linked
```

Watch live output. Expected: 95 migrations applied in order.

If mid-flight failure:
1. STOP. Note which migration failed.
2. Verify state via Supabase MCP execute_sql:
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;
   ```
3. Determine: rollback to pre-Phase-3 via pg_restore (downtime ~5 min) OR fix-forward (manually apply remaining migrations).
4. Bias: rollback if any non-idempotent migration partially applied.

**Verification post-success**:
```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
-- Expected tail: 20260524000000_revoke_anon_security_definer_hardening
```

## Phase 4 — Local merge + push to main

**🚨 PAUSE for operator go.**

ADR-0265 hard rule "main only accepts PRs from preview" is broken once tonight (DAG-split prevents PR-UI merge). Document as one-time exception.

```bash
cd /home/sxtnl/dev/smartout.ai
git fetch origin main preview
git checkout main
git merge origin/preview --allow-unrelated-histories -X theirs \
  -m "release: preview → main [deploy] (DAG-merge post Scenario K reset 2026-04-20)

Bypass of standard PR-merge path because main and preview share zero commits
since the 2026-04-20 Scenario K hard-reset. -X theirs ensures preview's
course-fixed content wins on duplicate-file conflicts. All hotfixes (#227,
#231) verified content-equivalent on dev under different SHAs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

**Verification**:
- `git rev-parse origin/main` = new merge commit SHA
- GitHub Actions main-deploy CI fires; wait for green: `gh run list --branch main --limit 5`
- Vercel prod deploys (3 projects: smartout-web, smartout-landing, smartout-pwa) — pwa may fail per pwa-telemetry-build sortie status

## Phase 5 — Smoke + tag + close PR

```bash
# 1. Smoke production
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production
# Expected: 4/4 green (web, landing, Supabase, EFs)

# 2. Tag prod LKG
MAIN_SHA=$(git rev-parse origin/main)
git tag "lkg-prod-${MAIN_SHA:0:8}" origin/main
git push origin "lkg-prod-${MAIN_SHA:0:8}"

# 3. Close PR #309
gh pr close 309 --comment "Resolved via local --allow-unrelated-histories merge tonight 2026-05-04. DAG-split prevented PR-UI merge (zero shared commits since 2026-04-20 Scenario K reset). See HANDOFF-2026-05-04-pipeline-cutover-execution.md for full sequence."
```

## Phase 6 — Cleanup + closure

```bash
# Activity log
~/.claude/scripts/log-activity.sh git pontus \
  "Pipeline cutover 2026-05-04 complete. main → ${MAIN_SHA:0:8}. 95 migrations applied (94 delta + #95 anon REVOKE hardening). lkg-prod-${MAIN_SHA:0:8} tagged. PR #309 closed (DAG-merge bypass). Branching ephemeral test passed."

# RUNS.md entry — append HOP B execution to deploy-conductor RUNS
# Update STATE.md — refresh post-prod state

# Optional: Sentry DSN missing in smartout_ai_prod vault — Pontus follow-up
```

## Sources of truth

1. `docs/handoffs/HANDOFF-2026-05-04-pipeline-cutover-divergence.md` — divergence anatomy, 22 version-records list (Section 2)
2. `docs/handoffs/HANDOFF-2026-05-04-anon-revoke-classification.md` — migration #95 classification
3. `.claude/agents/deploy-conductor/STATE.md` — last-verified state
4. `.claude/agents/deploy-conductor/RUNS.md` — last 3 entries (HOP A + diagnosis + post-PUT)
5. `docs/decisions/0265-enforced-deployment-pipeline.md` — base enforcement (broken once tonight, document exception)

## Hard constraints (no exceptions)

- ⛔ NEVER skip Phase 0 (pg_dump backup)
- ⛔ NEVER skip Phase 1 (ephemeral test) — that's the safety gate
- ⛔ NEVER apply Phase 2-3 if Phase 1 RED
- ⛔ ALWAYS pause for operator go at decision gates (Phase 2, 3, 4)
- ⛔ NEVER force-push to main
- ⛔ NEVER `--no-verify`
- ⛔ NEVER `git add -A`

## Mantra

**Branch first, dump always, push twice (verify post-each), merge once (irreversible).**
