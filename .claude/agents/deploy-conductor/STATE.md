---
title: "deploy-conductor — Verified State"
status: live
updated: 2026-05-04
last-verified: 2026-05-04T06:30+0200
---

# Verified State

Snapshot of measurable deploy-surface state. Re-verify on session start. Counts drift; do not quote them without re-running the verification commands.

---

## Pipeline state (verified 2026-05-04 06:30 — POST-HOP-A complete)

| Metric | Value | Verified by | Last check |
|---|---|---|---|
| dev ahead of preview | **0 commits** (HOP A complete) | `git rev-list --count origin/preview..origin/development` | 2026-05-04 06:30 post-HOP-A |
| preview ahead of dev | **0 commits** (CONVERGED at f51b1f55f) | `git rev-list --count origin/development..origin/preview` | 2026-05-04 06:30 post-HOP-A |
| **Branch state** | **CONVERGED — preview = dev = `f51b1f55f`** | `git rev-parse origin/preview origin/development` | 2026-05-04 06:30 post-HOP-A |
| Pipeline gap preview→main | **761 commits preview-ahead** (disjoint histories — DAG-split, NOT squash-ghost) | `git rev-list --count origin/main..origin/preview` | 2026-05-04 06:30 |
| Latest LKG tag | **`lkg-preview-f51b1f55`** (post-HOP-A 2026-05-04 06:30) | `git tag -l 'lkg-preview-*' \| tail -1` | 2026-05-04 06:30 |
| Latest origin/development SHA | `f51b1f55f` (handoff doc commit, [deploy] in body) | `git rev-parse origin/development` | 2026-05-04 06:30 |
| Latest origin/preview SHA | `f51b1f55f` (HOP A FF complete) | `git rev-parse origin/preview` | 2026-05-04 06:30 |
| CI on dev/preview `f51b1f55f` | ✅ ALL GREEN — 15 success, 2 skipped (Migration State + Supabase Preview, not required), 0 failed | `gh api commits/f51b1f55f/check-runs` | 2026-05-04 06:25 |
| Vercel preview READY for `f51b1f55f` | ✅ web + landing READY | Vercel API `v6/deployments` | 2026-05-04 06:25 |
| Smoke preview post-HOP-A | ✅ GREEN 4/4 (web, landing, Supabase rrjfrisxvrrhyzzitlxd, Edge Functions all 401-alive) | `smoke-probe.sh preview` | 2026-05-04 06:30 |
| Vercel API token | OK | prior session | 2026-05-04 |
| L-0197 fix status | ✅ done | prior session | 2026-05-04 |
| Production smoke | green (last verified 2026-05-03; not re-run post-HOP-A since HOP B deferred) | prior session | 2026-05-03 |
| Production Supabase URL | `yljaglomadbhyqpcigff.supabase.co` | prior session | 2026-05-04 |
| **Production latest migration** | **`20260515130400` (helpdesk_rls_and_thread_enum)** | Supabase MCP `list_migrations` on `yljaglomadbhyqpcigff` | 2026-05-04 evening |
| **Migrations to apply on HOP B** | **94** (preview migrations newer than `20260515130400`) | `git ls-tree + date compare` | 2026-05-04 evening |
| **Non-idempotent in delta** | **16** (verification-agent confirmed: safe for first-time apply, NOT replay-safe) | grep scan + risk classification | 2026-05-04 evening |
| **Missing version-records in prod schema_migrations** | **22** (tips_*, guardian_log_pg_notify, agent_session_*, etc.) | SQL check on prod returned empty | 2026-05-04 evening |
| **PR #309 (preview→main)** | **CONFLICTING/DIRTY** — disjoint histories, zero shared commits | `gh pr view 309` | 2026-05-04 evening |
| **HOP B path** | **Local `--allow-unrelated-histories` merge by Pontus ONLY** — GitHub PR cannot merge disjoint histories | DAG analysis | 2026-05-04 evening |

✅ **HOP A COMPLETE.** Preview = dev = `f51b1f55f`. Smoke 4/4 green. lkg-preview-f51b1f55 tagged. Bug fix: `smoke-probe.sh:56` hardcoded fallback `cibmhhgsrdmpnmcikalu` (deleted Supabase project) updated to `rrjfrisxvrrhyzzitlxd` (current persistent preview branch).

⚠️ **HOP B + DB push DEFERRED to fresh session.** Main and preview/development share ZERO commits (DAG-split from 2026-04-20 Scenario K reset). `git merge-base origin/main origin/preview` exits 1. `gh pr view 309 = CONFLICTING`. Fix: Pontus runs `git merge origin/preview --allow-unrelated-histories -X theirs` locally and pushes to main. Pre-requisite: INSERT 22 missing version-records into prod `supabase_migrations.schema_migrations` first. Tomorrow-session HANDOFF written.

---

## Env-var landscape

| Channel | Count | Source of truth |
|---|---|---|
| `.env.template` op-refs | 83 | `grep -c '="op://' .env.template` |
| `.env.template` hardcoded | 12 | `grep -cE '^[A-Z_].*=[^"]' .env.template` |
| `apps/web/src/env.ts` validated keys | 52 | `grep -cE '^\s+[A-Z][A-Z0-9_]+:' apps/web/src/env.ts` |
| `apps/landing/src/env.ts` validated keys | 27 | `grep -cE '^\s+[A-Z][A-Z0-9_]+:' apps/landing/src/env.ts` |
| Vercel manifest entries | 64 (baseline) | `grep -cE '^smartout-(web\|landing)\|' infra/scripts/sync-env-to-vercel.sh` |
| Droplet manifest entries | 17 | `grep -cE '^\s*"[A-Z_]+\|' infra/scripts/sync-env-to-droplet.sh` |
| Edge Function `Deno.env.get()` keys | 37 unique | `grep -rohP "Deno\.env\.get\(['\"]\\K[A-Z_][A-Z0-9_]+" supabase/functions/ \| sort -u \| wc -l` |

### Drift-check baseline

`infra/scripts/drift-check.sh` baseline as of ADR-0265: 64 Vercel manifest entries.
If count drops below 64 → drift-check fails Check 1.

---

## Edge Function state

| Metric | Value | Source |
|---|---|---|
| Edge Functions deployed | 62 | `ls supabase/functions/ \| grep -v _shared` |
| Edge Functions in `config.toml` | 52 | `grep -cE '^\[functions\.' supabase/config.toml` |
| **GAP — EFs without config.toml entry** | 10 | needs investigation |
| Edge Function unit tests | 5 | `find supabase/functions -name '*test*.ts'` |
| Cron-fired EFs | ≥ 10 | `grep -lE 'cron\|schedule' supabase/functions/*/index.ts` |
| EFs with `verify_jwt = false` | ≥ 10 | `grep -B1 -A1 'verify_jwt = false' supabase/config.toml` |

⚠️ **10 EFs lack config.toml entry.** Default `verify_jwt = true` may not match what the function expects. ADR-0265 EF deploy CI job will surface this on next PR touching `supabase/functions/`.

---

## Migration state

| Metric | Value | Source |
|---|---|---|
| Total migrations (dev/preview) | 492 | `git ls-tree origin/development --name-only supabase/migrations/ \| grep .sql \| grep -v rollback \| wc -l` |
| Total migrations (main) | 376 | `git ls-tree origin/main --name-only supabase/migrations/ \| wc -l` |
| Latest migration (dev/preview) | `20260523000100_compute_period_aggregates_company_join.sql` | `git ls-tree + sort + tail -1` | 2026-05-04 evening |
| Latest migration applied to production | `20260515130400_helpdesk_rls_and_thread_enum` | Supabase MCP `list_migrations` | 2026-05-04 evening |
| Migrations to apply on HOP B | **94** | date-compare preview vs prod latest | 2026-05-04 evening |
| Non-idempotent in unapplied delta | **16** | grep scan | 2026-05-04 evening |
| Missing prod schema_migrations version-records | **22** (tips_*, guardian_log, agent_session_*) | SQL check on prod | 2026-05-04 evening |
| `database.types.ts` last modified | 2026-05-02 20:03 | `stat packages/supabase/src/database.types.ts` |

⚠️ **22 migration version-records missing from prod schema_migrations.** If HOP B triggers Supabase auto-apply without pre-inserting these, Supabase will attempt to re-run 22 already-applied migrations. Non-idempotent ones will fail. INSERT the 22 records BEFORE pushing to main.

---

## Test surface

| Metric | Value | Source |
|---|---|---|
| API routes | 165 | `find apps/web/src/app/api -name route.ts` |
| Server Actions (`"use server"`) | 97 | `grep -rl '"use server"' apps/web/src/` |
| E2E specs | 102 | `ls apps/e2e/tests/` |
| Vitest packages | 7 | year-wheel, journey-ir, schedule, data, billing, ai, ui |
| Vitest test files | 31 | `find packages -name '*.test.ts'` |
| pgTAP suites | 12 | `ls supabase/tests/{*.sql,pgtap/*.sql}` |
| **E2E in CI** | **NEVER** | grep `test:e2e` `.github/workflows/` returns nothing |

⚠️ **102 E2E specs orphaned from CI.** Playwright runs only against localhost in dev. Tier 1 task #3 wires them mot preview-URL post-promote.

---

## CI state (required checks)

| Required (today) | Source workflow | Required (after F2) |
|---|---|---|
| Format Check | ci.yml | YES |
| Lint | ci.yml | YES |
| Type Check | ci.yml | YES |
| Vitest (packages) | ci.yml | YES |
| Build Health | ci.yml | YES |
| Build | ci.yml | YES |
| API Docs Go-Live Guard | ci.yml | YES |
| Docker Build (4 services) | ci.yml | YES (×4) |
| **Enforce branch flow** | pipeline-enforcement.yml | ❌ removed 2026-05-04 (L-0197 fix Path A1) — PR-only trigger, incoherent on direct push |
| **pgTAP Suites** | pgtap.yml | ❌ removed 2026-05-04 (L-0197 fix Path A1) — PR-only trigger, never fires on FF-push to preview |
| **authority-seed-parity** | authority-seed-parity.yml | ✅ required (F2 ✅ done 2026-05-03) |

Total: 14 contexts on main (14797822); **12 contexts on preview (15290760)** — F2 done 2026-05-03, L-0197 Path A1 cleanup done 2026-05-04.

| Not-required (path-scoped or main-only) | Source |
|---|---|
| AI Eval (golden-transcripts) | ai-eval.yml |
| Edge Functions (NEW, ADR-0265) | ci.yml (unmerged in dev) |
| Migration State (NEW, ADR-0265, main-push only) | ci.yml (unmerged in dev) |

---

## Heartbeat jobs (continuous review)

| Job | Cooldown | Purpose | Status |
|---|---|---|---|
| raw-inbox | 30m | Vault inbox | active |
| stale-check | 24h | Wiki page age | active |
| lint | 7d | Weekly lint reports | active |
| migration | 24h | Migration progress | active |
| worktree-audit | 24h | Worktree drift | active |
| **drift-check** | 24h | 4-channel env-var parity | NEW (ADR-0265) |

---

## Sortie state (in-flight work for deploy-conductor)

| Branch | Worktree | Status | Notes |
|---|---|---|---|
| `feat/enforce-pipeline` | `~/dev/smartout.ai-wt-4` | MERGED (2026-05-03) | ADR-0265 sortie. 13 files, 1137 insertions. Merged to development. |

| Operator follow-up (from HANDOFF) | Status |
|---|---|
| F1 — Vercel API token in both vaults | ✅ Done 2026-05-03 |
| F2 — 3 workflows to required-checks | ✅ Done 2026-05-03 (rulesets 14797822 + 15290760, 14/14 contexts each) |
| F3 — CI secrets for new jobs | ✅ Done 2026-05-03 (4 secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_PROD_REF, SUPABASE_PROD_URL, SUPABASE_PROD_SERVICE_ROLE_KEY) |
| Scenario K — preview hard-reset | ✅ Done 2026-05-04 (dcf0ebf1c; dev now 9 ahead from Phase A + handoffs) |
| Vercel env-var sync | ✅ Done 2026-05-04 (62/64 keys, 2 Sentry DSN fails) |
| **L-0197 fix — ruleset-required-checks-cleanup** | **✅ Done 2026-05-04** (Path A1: PUT ruleset 15290760 → 12 contexts) |
| PREVIEW_E2E_KEY provisioning | PENDING (plan v2 Phase 4 prereq) |
| DEPLOY_TAP_WEBHOOK_URL n8n setup | PENDING (ADR-0271 §2 prereq) |
| **PR #309 — close + local HOP B prep** | **PENDING** — must INSERT 22 migration version-records + run local --allow-unrelated-histories merge. See `docs/handoffs/HANDOFF-2026-05-04-pipeline-cutover-divergence.md` |

---

## Last verified — commands to re-run on session start

```bash
# Pipeline gap
git rev-list --count origin/preview..origin/development
git rev-list --count origin/main..origin/preview

# Latest dev SHA + Vercel state
git rev-parse origin/development
op run --env-file=.env.template -- bash -c 'curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v6/deployments?teamId=team_bbtw5JnNxRkKlecAKQB7qqzG&projectId=prj_CG6Gi7QE5jpz5fghbDUco16wG2ds&limit=5" | jq -r ".deployments[0:3] | .[] | \"\(.state) \(.meta.githubCommitSha[0:8]) \(.url)\""'

# Drift state
./infra/scripts/drift-check.sh --skip-droplet

# Smoke production (read-only, no deploy)
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production --skip-droplet

# Latest LKG tag
git tag -l 'lkg-preview-*' | tail -1

# DASHBOARD freshness
head -10 docs/DASHBOARD.md
```

If any of these surface a failure, update STATE.md before proceeding with operator request.
