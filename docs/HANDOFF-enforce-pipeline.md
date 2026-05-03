---
title: "HANDOFF — Enforced Deployment Pipeline"
status: review
created: 2026-05-03
updated: 2026-05-03
module: cross-cutting
tags: [handoff, deployment, enforcement, drift]
---

# HANDOFF: Enforced Deployment Pipeline (sortie wt-4)

## Summary

Branch: `feat/enforce-pipeline`
ADR: `0262-enforced-deployment-pipeline.md`
Journey: `JOURNEY-enforce-pipeline.md`

Closes the gaps the `deploying` skill itself names: Edge Functions orphan
tier, migration-state blindness, no post-promote smoke, no rollback target,
no continuous drift detection. Single sortie, 7 file changes, no new
services, no new database tables (one stable RPC migration).

## Architecture (one sentence)

The 3-branch pipeline (`development → preview → main`) gains a single
repo-canonical wrapper that enforces 6 sequential gates, two new CI jobs
(Edge Functions deploy, Migration State drift), one PR template that turns
review into a checklist, and a heartbeat-triggered drift-check that runs
nightly across all four env-var channels.

## Decisions made (registered in 0000-decision-log.md)

- **ADR-0262** — Enforced Deployment Pipeline. Required checks expanded
  from 11 → 14. Repo wrapper at `infra/scripts/promote-preview.sh` is the
  only sanctioned entry point. Drift-check runs nightly via heartbeat.

## What was built

### Code
| File | Type | Purpose |
|---|---|---|
| `infra/scripts/promote-preview.sh` | new (executable) | 3-stage wrapper around global script: 4 foundational gates → smoke probe → lkg tag |
| `infra/scripts/smoke-probe.sh` | new (executable) | Health probe across web/landing/Supabase/EF/droplet, env-aware (preview vs production) |
| `infra/scripts/drift-check.sh` | new (executable) | 4-channel drift detector: Vercel manifest baseline, env.ts ↔ known keys, EF secrets, droplet env |
| `supabase/migrations/20260503174428_migration_state_latest_rpc.sql` | new migration | `public.migration_state_latest()` RPC, service_role only, used by CI Migration State gate |
| `.github/workflows/ci.yml` | modified | +2 jobs: `Edge Functions` (PR dry-run + main real), `Migration State` (main push only) |
| `.github/PULL_REQUEST_TEMPLATE/preview-to-main.md` | new | 6-item operator checklist for preview→main PRs |

### Docs
| File | Type | Purpose |
|---|---|---|
| `docs/decisions/0262-enforced-deployment-pipeline.md` | new ADR | accepted |
| `docs/decisions/0000-decision-log.md` | modified | register ADR-0262 |
| `docs/journeys/JOURNEY-enforce-pipeline.md` | new | 3 journeys (HOP A, HOP B, drift response) |
| `docs/protocols/DEPLOYMENT.md` | modified | +5 hard rules per ADR-0262 |
| `.claude/commands/promote-preview.md` | modified | point at repo wrapper, document Stage 2/3 |
| `~/dev/second-brain-v2/HEARTBEAT.md` | modified | +1 job: `drift-check` cooldown 24h |

## Operator actions required (NOT in this sortie — Pontus must do)

These three are out of scope for code changes but are required for the
pipeline to actually be enforced. Document order matters.

### 1. Vercel API token (unblocks promote Stage 1 Gate 3)

```bash
# Create real API token at https://vercel.com/account/tokens (full account scope, 1y)
read -rs TOKEN  # paste, hit enter
op item edit Vercel --vault smartout_ai credential="$TOKEN"
op item create --category=APICredential --title=Vercel \
  --vault=smartout_ai_prod credential="$TOKEN"
unset TOKEN
```

Two-vault parity per `secrets-protocol`.

### 2. Add 3 workflows to required-checks ruleset

Adds `Enforce branch flow`, `pgTAP Suites`, `authority-seed-parity` to the
14 required contexts on `main` (ruleset 14797822) and `preview`
(ruleset 15290760).

```bash
gh api repos/SXTNmedia21/smartout.ai/rulesets/14797822 > /tmp/main-ruleset.json
# Edit /tmp/main-ruleset.json — add three contexts to required_status_checks.checks
gh api -X PUT repos/SXTNmedia21/smartout.ai/rulesets/14797822 \
  --input /tmp/main-ruleset.json
# Repeat for ruleset 15290760 (preview)
```

Or via GitHub UI: Settings → Rulesets → main → Edit → Required status
checks → Add: `Enforce branch flow`, `pgTAP Suites`, `authority-seed-parity`.

### 3. Add CI secrets for new jobs

Settings → Secrets and variables → Actions → New repository secret:

- `SUPABASE_ACCESS_TOKEN` — supabase CLI token (smartout_ai_prod vault, item `Supabase`, field `access_token` if exists, else create)
- `SUPABASE_PROD_REF` — `yljaglomadbhyqpcigff`
- `SUPABASE_PROD_URL` — `https://yljaglomadbhyqpcigff.supabase.co`
- `SUPABASE_PROD_SERVICE_ROLE_KEY` — already in 1Password prod vault

Without these, `Edge Functions` and `Migration State` jobs skip with
warnings. Pipeline still functions; enforcement is partial until set.

## Learnings

- **`Vercel CLI auth.json token (vca_*) ≠ Vercel API token.**** The CLI
  session token cannot authenticate the public REST API. Promote Gate 3
  dies with HTTP 403 + invalidToken:true. Real API token from
  vercel.com/account/tokens is a separate format. Both vaults must hold it.
- **Python heredoc-as-arg with f-string escapes is fragile.** The
  promote-preview.sh Python block embedded in a single-quoted shell string
  fails on `f"{r.get(\"key\")}"` patterns. Fix: pass JSON via env var
  (`RUNS_JSON_ENV`) and use `os.environ` inside the block.
- **Drift-check needs a system-key allowlist.** `NODE_ENV`, `VERCEL_*`,
  `NEXT_RUNTIME` are platform-injected and never in the manifest by
  design. Without an allowlist the check produces false positives.
- **Edge Function deploy `--dry-run` is mandatory in CI** — if you only
  validate types you miss runtime errors that surface during `supabase
  functions deploy`. Dry-run on PR catches them before merge.
- **Migration State RPC must be `SECURITY DEFINER` + `service_role` only.**
  Anonymous query of `supabase_migrations.schema_migrations` is blocked by
  default; the RPC wraps it cleanly without exposing the schema migration
  table to RLS policies.

## Known issues / debt

- **Smoke probe assumes static preview URLs.** `VERCEL_PREVIEW_WEB_URL`
  and `VERCEL_PREVIEW_LANDING_URL` are env vars the wrapper reads with
  fallback defaults. If Vercel changes the URL pattern, fallbacks break.
  Future: read URL from Vercel API per SHA, like Gate 3 already does.
- **No rollback script yet.** `vercel rollback` and droplet image-tag
  rollback are documented in the PR template but not scripted. Future
  sortie: `infra/scripts/rollback-vercel.sh` + `rollback-droplet.sh`.
- **Drift-check edge-fn check needs SUPABASE_PROJECT_REF + auth.** Runs in
  heartbeat (Pontus's machine), skips in CI without setup. Future: CI
  drift-check job that runs the EF check with the new
  `SUPABASE_ACCESS_TOKEN` secret.
- **No monitoring of LKG tag age.** If `lkg-preview-*` tags pile up
  un-pruned, repo gets noisy. Future: weekly cron prune of LKG tags > 30d
  via heartbeat.

## Next steps

1. **Pontus does the 3 operator actions above** (token, ruleset, CI secrets)
2. Run `./infra/scripts/drift-check.sh --skip-droplet` to verify green
3. Run `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh`
   on a real promote — this is the end-to-end test
4. After first successful enforced promote, mark ADR-0262 status from
   `accepted` to `implemented` (optional convention).
5. Future sortie `feat/deploy-rollback-scripts` for the two rollback
   scripts (Tier 2 from prior verdict).
