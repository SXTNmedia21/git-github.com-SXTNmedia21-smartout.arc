---
title: "deploy-conductor — Playbook"
status: canonical
updated: 2026-05-03
---

# Playbook

Concrete scripts for the most common deploy-conductor scenarios. Each scenario maps a signal (operator intent or system alert) to (a) verification steps, (b) action proposal, (c) escalation rule.

---

## Scenario A — Operator wants to promote dev → preview

**Signal:** "deploy", "promote", "ship", "push til preview", "promote-preview", any explicit HOP A intent.

### Pre-checks (read-only)

```bash
cd /home/sxtnl/dev/smartout.ai
git rev-parse --abbrev-ref HEAD                              # confirm on development
git status --short                                            # must be clean
git rev-list --count origin/preview..origin/development      # report gap
./infra/scripts/drift-check.sh --skip-droplet                 # must be green
```

If gap > 200 → load `git-cleanup` skill, run landscape audit, surface to operator.
If drift-check red → diagnose first FAIL via Scenario E. Don't proceed.

### Action proposal

```
Pipeline state:
- dev SHA: <short>
- gap: <N> commits
- drift-check: green
- last LKG: <tag or 'none'>
- last promote: <date from activity-log or 'never'>

Proceeding with `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` will:
1. FF preview to dev SHA <short>
2. Run smoke probe across 5 surfaces
3. Tag lkg-preview-<short> if smoke green

Skal jeg kjøre wrapper'en, eller vil du først <X>?
```

### Execution (only after explicit "yes")

```bash
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh
```

### Post-promote

- If all 6 gates green → report LKG tag. Tell operator: "klar for HOP B".
- If smoke red → Scenario D.
- If any earlier gate red → report exact gate + reason. No retry on own — wait for operator.

### Escalation

- Vercel state CANCELED for SHA → operator must re-deploy via Vercel dashboard or push a no-op commit
- CI not green → `gh pr checks` reports which workflow → Scenario F
- Husky pre-push blocks → read message, propose fix path, never `--no-verify`

---

## Scenario B — Operator wants to release preview → main

**Signal:** "ship to main", "release", "open release PR", "preview til main".

### Pre-checks

```bash
# HOP A done?
git tag -l 'lkg-preview-*' | tail -1     # must exist for current preview SHA
PREVIEW_SHA=$(git rev-parse origin/preview)
git tag -l "lkg-preview-${PREVIEW_SHA:0:8}"   # exact match required

# 14 checks green?
gh run list --branch preview --commit "$PREVIEW_SHA" --limit 20 \
  --json status,conclusion,name --jq '.[] | "\(.conclusion) \(.name)"'

# Drift recent?
./infra/scripts/drift-check.sh --skip-droplet

# Migration state OK?
# (After Phase 1 lands, query prod RPC. Until then, defer to operator.)
```

### Action proposal

```
HOP B readiness:
- HOP A done: <yes/no>
- LKG tag: <lkg-preview-XXXXXXXX>
- 14 checks: <green/missing>
- Drift: <green/Nfail>
- Migration state: <unknown until Phase 1>

Skal jeg åpne PR med `gh pr create --base main --head preview --template preview-to-main.md`,
eller vil du først validere preview manuelt?
```

### Execution

```bash
gh pr create --base main --head preview --template preview-to-main.md \
  --title "release: preview → main (<short SHA>)"
```

Then DO NOT merge. Wait for:
- Operator fills checklist boxes
- 14 required checks all green
- Operator clicks merge in GH UI

### Post-merge

Run Scenario G (post-main verification).

### Escalation

- LKG tag missing → HOP A wasn't completed via wrapper. Refuse PR. Tell operator to run HOP A.
- 14 checks not green → Scenario F.
- Pipeline-enforcement.yml red → check head/base combination is preview→main only.

---

## Scenario C — Drift-check alert from heartbeat

**Signal:** Telegram message "drift-check: N drift(s) — first: <name>" OR activity-log entry.

### Diagnose

```bash
cd /home/sxtnl/dev/smartout.ai
./infra/scripts/drift-check.sh                # full output, no skip
```

Map first FAIL to fix path:

| Failed check | Likely cause | Fix |
|---|---|---|
| `vercel-manifest-baseline` | Manifest entry deleted | Restore deleted entries; re-sync |
| `env-ts-vs-known-keys` | env.ts adds key not in manifest/template | Add to manifest OR add as hardcoded in template |
| `edge-fn-secrets` | EF added `Deno.env.get('NEW_KEY')` without `supabase secrets set` | `supabase secrets set NEW_KEY=... --project-ref <ref>` |
| `droplet-env-vs-manifest` | Manifest adds key not on droplet | `./infra/scripts/sync-env-to-droplet.sh --remote` |

### Action proposal

```
Drift detected: <check name>
Detail: <first failed key>
Likely cause: <from table>
Proposed fix: <concrete command>

Skal jeg kjøre fixen, eller vil du verifisere først?
```

### Escalation

- Drift persists after fix → check sync-script for syntax error
- Operator ignores alert > 7 days → auto-create Linear ticket tagged `deploy-drift` (per ADR-0262)

---

## Scenario D — Smoke red after promote

**Signal:** smoke-probe.sh exits 1, or wrapper reports "smoke RED".

### Diagnose

Read smoke output. Identify which surface(s):

| Failed surface | Check |
|---|---|
| Vercel web | open preview URL in browser; check Sentry; check Vercel build logs |
| Vercel landing | same |
| Supabase REST | check Branch DB status; query `pg_stat_activity` |
| Edge Functions | `supabase functions logs <name>` for the gateway function |
| Droplet | `ssh` + `docker compose ps` + `infra/scripts/health-check.sh` |

### Action proposal — rollback per surface

| Surface | Rollback command |
|---|---|
| Vercel (web/landing) | `vercel rollback <previous-deploy-url> --token "$VERCEL_TOKEN"` |
| Supabase migration | Manual via dashboard or `smartout-database-guide` skill |
| Edge Functions | `git checkout <LKG SHA> && supabase functions deploy <name> --project-ref <ref>` |
| Droplet | `ssh root@164.92.176.42 "cd /root/dev/smartout.ai && git checkout <LKG SHA> && ./infra/scripts/deploy.sh"` |

```
Smoke red: <surface(s)>
Likely cause: <hypothesis from logs>
Last green LKG tag: <lkg-preview-XXXXXXXX>

Forslag rollback:
<concrete command for failed surface>

Skal jeg kjøre rollback, eller diagnose videre først?
```

### Escalation

- Multiple surfaces red simultaneously → infra-level issue (Cloudflare, Supabase region, etc.). Operator escalates.
- Rollback also fails → operator-led recovery via vendor support.

---

## Scenario E — Drift-check red but no heartbeat alert

**Signal:** Operator runs drift-check ad-hoc and it returns red.

Same as Scenario C. Just diagnose + propose fix path. Don't escalate to Linear unless drift was already alerted ≥ 7 days ago.

---

## Scenario F — CI red on PR

**Signal:** "CI rødt" / "PR check failing" / `gh pr checks` shows red.

### Diagnose

```bash
PR_NUM=$1
gh pr checks "$PR_NUM"
gh run list --branch "$(gh pr view $PR_NUM --json headRefName --jq .headRefName)" --limit 5
```

Map failed check name to source workflow + file:

| Check | Workflow | Common fixes |
|---|---|---|
| Format Check | ci.yml | `pnpm format` then commit |
| Lint | ci.yml | `pnpm lint:fix` then commit |
| Type Check | ci.yml | `pnpm turbo typecheck` locally; fix errors |
| Vitest | ci.yml | `pnpm turbo test` locally; investigate broken test |
| Build | ci.yml | `pnpm turbo build` locally with same env vars; check Sentry warnings, Next.js logs |
| Build Health | ci.yml | `pnpm build:health` locally; check artefacts/quality/build-health-report.json |
| API Docs Go-Live Guard | ci.yml | `pnpm api:docs:go-live` then commit regenerated OpenAPI |
| Docker Build (X) | ci.yml | local `docker build -f services/X/Dockerfile .`; debug step that fails |
| Harness Invariants | ci.yml | `pnpm --filter @smartout/ai run invariants:*`; fix coverage |
| Enforce branch flow | pipeline-enforcement.yml | Check head/base PR combination is allowed |
| pgTAP Suites | pgtap.yml | Run `npx supabase test db <suite>` locally; debug SQL |
| authority-seed-parity | authority-seed-parity.yml | Run `pnpm authority-seed-parity` locally; add seed for missing capability |
| AI Eval | ai-eval.yml | Check golden transcripts; run with `RUN_EVALS=1` locally |
| Edge Functions | ci.yml (after merge) | Check `supabase functions deploy --dry-run` locally |
| Migration State | ci.yml main-push (after merge) | Migration drift on prod — Scenario H |

### Action proposal

```
CI red on <check name>:
Source: .github/workflows/<file>
Likely fix: <from table>

Skal jeg <kjøre kommandoen lokalt / hjelpe operator debugge / lese workflow-loggen>?
```

---

## Scenario G — Post-main-merge verification

**Signal:** PR preview→main merged. Operator says "merged" or post-merge hook fires.

### Verify

```bash
# Vercel deploy state for new main SHA
MAIN_SHA=$(git rev-parse origin/main)
op run --env-file=.env.template -- bash -c 'curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?teamId=team_bbtw5JnNxRkKlecAKQB7qqzG&projectId=prj_CG6Gi7QE5jpz5fghbDUco16wG2ds&limit=5" | \
  jq -r --arg sha "'$MAIN_SHA'" ".deployments[] | select(.meta.githubCommitSha == \$sha) | \"\(.state) \(.url)\""'

# Wait for READY then smoke
op run --env-file=.env.template -- ./infra/scripts/smoke-probe.sh production --skip-droplet

# Migration State CI gate (if F3 done)
gh run list --branch main --commit "$MAIN_SHA" --workflow "CI" --limit 1
```

### Tell operator

```
Post-merge state for main@<short>:
- Vercel web: <state>
- Vercel landing: <state>
- Smoke: <green/red per surface>
- Migration State CI: <green/red/pending>
- Droplet: ⚠️ NOT YET DEPLOYED — operator must SSH

Neste steg:
- Hvis alt grønt + droplet ikke trenger update → ferdig.
- Hvis droplet trenger update (services/, infra/, packages/ services consumed) →
  ssh root@164.92.176.42 "cd /root/dev/smartout.ai && ./infra/scripts/deploy.sh"
- Hvis smoke rødt → Scenario D.

Skal jeg kjøre droplet-deploy, eller vil du først?
```

### Escalation

- If smoke red → Scenario D
- If Migration State red → Scenario H

---

## Scenario H — MIGRATIONS_FAILED on production

**Signal:** Migration State CI gate red on main push, OR Supabase MCP query shows `MIGRATIONS_FAILED` status.

### Diagnose (load `smartout-database-guide` skill first)

```bash
# Latest local
LATEST_LOCAL=$(ls supabase/migrations/*.sql | xargs -n1 basename | grep -E '^[0-9]{14}_' | sort | tail -1 | cut -d_ -f1)

# Latest applied on prod (via Supabase MCP)
# Use mcp__claude_ai_Supabase__list_migrations against project yljaglomadbhyqpcigff
```

Identify the migration that failed. Read its SQL. Check for:
- NOT NULL constraint with no default + system-seeded rows (memory: ADR-0262 traps section)
- `CREATE TABLE` without `IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION` changing return type (SQLSTATE 42P13)
- Trigger referencing wrong column name

### Action proposal

```
MIGRATIONS_FAILED on prod.
Local tail: <local timestamp>
Prod last applied: <prod timestamp>
Failed migration: <filename>
Likely cause: <from check list>

Recovery options:
1. Operator runs reverse-SQL on prod via Supabase dashboard, then redeploys correct version
2. Apply hotfix migration that resolves the failure (most common)
3. If migration is destructive — operator-led restore from backup

Anbefaler: <option N> fordi <reason>.

Skal jeg drafte hotfix-migrasjonen, eller vil du gjøre dashboard-reverse først?
```

### Escalation

- MIGRATIONS_FAILED ≥ 24h → block all further main-push merges
- > 1 migration failed → indicates merge from a parallel branch with un-rebased migrations; load `git-cleanup`

---

## Scenario I — Edge Function CI dry-run fails

**Signal:** New `Edge Functions` CI job (post-ADR-0262) reports failure on PR.

### Diagnose (load `smartout-edge-function-guide` skill)

Read CI log for which function. Test locally:

```bash
op run --env-file=.env.template -- supabase functions deploy <name> --dry-run --linked
```

### Common failures

| Symptom | Fix |
|---|---|
| `verify_jwt = false` not in config.toml | Add `[functions.<name>]` entry to `supabase/config.toml` |
| Missing import (Deno) | Add to function's `import_map.json` or fix path |
| Invalid `Deno.env.get()` key | Add to manifest + `supabase secrets set` (after Phase 2) |
| Hono router config error | Read function source, debug locally |

### Action proposal

```
EF dry-run failed: <function-name>
Error: <first error line from CI log>
Likely fix: <from table>

Skal jeg drafte fixen, eller vil du debugge lokalt først?
```

---

## Scenario J — Operator wants to know "where are we"

**Signal:** "what's the state", "status", "hvor er vi", "is preview safe to promote".

### Output template

```bash
# Read this in order, output as a single status block:
git status --short
git rev-list --count origin/preview..origin/development
git rev-list --count origin/main..origin/preview
git tag -l 'lkg-preview-*' | tail -1
./infra/scripts/drift-check.sh --skip-droplet
gh run list --branch development --limit 3 --json status,conclusion,name --jq '.[] | "\(.conclusion) \(.name)"'
```

```
Status — <date> <time>:

Pipeline:
- dev SHA: <short>
- gap dev→preview: <N>
- gap preview→main: <N>
- last LKG tag: <tag or 'none'>

Drift: <green/N fails>
CI on dev: <last 3 runs status>

Sortie state:
- <branch> @ <wt-N> — <last commit short> (<dirty/clean>)

Operator follow-up pending: <F2/F3 status>

Anbefaler: <next single concrete action> fordi <one-line reason>.
```

---

## Common operator phrases — quick map

| Operator says | Scenario |
|---|---|
| "deploy", "push", "ship", "promote" | A |
| "release", "ship to main", "open release PR" | B |
| "drift sa noe", "drift alert" | C, E |
| "smoke red", "deploy is broken" | D |
| "rollback", "revert deploy" | D |
| "CI rødt", "PR red" | F |
| "merged", "post-merge" | G |
| "MIGRATIONS_FAILED", "migrasjon feila" | H |
| "EF deploy failed", "function broken" | I |
| "what's the state", "status" | J |
| "is preview safe?" | J then maybe B |
| "drift-check", "kjør drift-check" | C (manual run) |
| "smoke production", "smoke prod" | G (read-only) |
