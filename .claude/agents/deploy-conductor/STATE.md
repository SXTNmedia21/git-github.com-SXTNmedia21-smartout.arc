---
title: "deploy-conductor — Verified State"
status: live
updated: 2026-05-04
last-verified: 2026-05-04T<post-K>+0200
---

# Verified State

Snapshot of measurable deploy-surface state. Re-verify on session start. Counts drift; do not quote them without re-running the verification commands.

---

## Pipeline state (verified 2026-05-04 — post Scenario K)

| Metric | Value | Verified by | Last check |
|---|---|---|---|
| dev ahead of preview | **0 commits** | `git rev-list --count origin/preview..origin/development` | 2026-05-04 post-K |
| preview ahead of dev | **0 commits** | `git rev-list --count origin/development..origin/preview` | 2026-05-04 post-K |
| **Branch state** | **CONVERGED — preview = dev HEAD `dcf0ebf1c`** | `git merge-base --is-ancestor origin/preview origin/development` exits 0 | 2026-05-04 post-K |
| Pipeline gap preview→main | (not re-verified post-K) | `git rev-list --count origin/main..origin/preview` | 2026-05-03 |
| Latest LKG tag | none yet | `git tag -l 'lkg-preview-*' \| tail -1` | 2026-05-04 |
| Latest origin/development SHA | `dcf0ebf1c` | `git rev-parse origin/development` | 2026-05-04 |
| Latest origin/preview SHA | `dcf0ebf1c` (= dev after K) | `git rev-parse origin/preview` | 2026-05-04 post-K |
| Vercel API token | OK (`op run` 1Password version, 60-char) | `op run -- curl Vercel API` | 2026-05-04 |
| CI on dev `dcf0ebf1c` | 12/14 required green; pgTAP Suites + Enforce branch flow PR-only triggers (don't fire on direct push) | `gh api commits/<sha>/check-runs` | 2026-05-04 |
| Production smoke | green (web, landing, Supabase, EFs) | `smoke-probe.sh production --skip-droplet` | 2026-05-03 |
| Preview Supabase URL | `rrjfrisxvrrhyzzitlxd.supabase.co` (NEW persistent branch, 2026-05-04) | Vercel env `NEXT_PUBLIC_SUPABASE_URL` preview | 2026-05-04 |
| Production Supabase URL | `yljaglomadbhyqpcigff.supabase.co` | Vercel env `NEXT_PUBLIC_SUPABASE_URL` production | 2026-05-04 |
| Vercel env-var sync | 62/64 keys live, 2026-05-04 timestamps. 2 fails: `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` (Sentry/dsn item missing in `smartout_ai_prod` vault) | direct API query | 2026-05-04 |

✅ **HOP A unblocked.** Preview = dev HEAD, ruleset re-active, env-vars fresh. Next promote can succeed if [deploy] tag present in commit triggering Vercel build. NB: latest commit `dcf0ebf1c` lacks [deploy] tag — Vercel preview build will skip until tag-bearing commit lands.

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
| Total migrations | 481 | `ls supabase/migrations/*.sql \| wc -l` |
| Migrations w/o idempotency markers (`IF NOT EXISTS`/`IF EXISTS`/`OR REPLACE`) | 154 | `grep -L '...' supabase/migrations/*.sql \| wc -l` |
| Latest migration | `20260520170002_schedule_shift_dept_trigger.sql` | `ls supabase/migrations/*.sql \| sort \| tail -1` |
| `database.types.ts` last modified | 2026-05-02 20:03 | `stat packages/supabase/src/database.types.ts` |
| Production migration state RPC | not yet deployed | from ADR-0265 sortie unmerged |

⚠️ **154/481 (32%) migrations lack idempotency markers.** Branch DB replay can fail mid-flight on any of them. Tier 1 task #1 wraps these.

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
| **Enforce branch flow** | pipeline-enforcement.yml | ✅ required (F2 ✅ done 2026-05-03) |
| **pgTAP Suites** | pgtap.yml | ✅ required (F2 ✅ done 2026-05-03) |
| **authority-seed-parity** | authority-seed-parity.yml | ✅ required (F2 ✅ done 2026-05-03) |

Total: 14 contexts on main (14797822) + preview (15290760) — F2 complete.

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
| Scenario K — preview hard-reset | PENDING (operator-led, blocks HOP A) |
| Vercel env-var sync | Pontus running 2026-05-04 (parallel stream) |
| PREVIEW_E2E_KEY provisioning | PENDING (plan v2 Phase 4 prereq) |
| DEPLOY_TAP_WEBHOOK_URL n8n setup | PENDING (ADR-0271 §2 prereq) |

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
