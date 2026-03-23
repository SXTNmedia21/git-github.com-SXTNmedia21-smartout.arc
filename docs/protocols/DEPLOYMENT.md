---
title: "Deployment Protocol — Complete Checklist"
id: PROTO_DEPLOYMENT
status: canonical
layer: protocol
created: 2026-03-23
updated: 2026-03-23
depends_on:
  - PROTO_SECURITY
  - PROTO_ENV
  - SECRET_API_INFRA
module: infrastructure
tags: [deployment, checklist, vercel, supabase, docker, digitalocean, security, secrets]
---

# Deployment Protocol — Complete Checklist

> **Smartout.ai** — Mandatory protocol for every production deployment.
> **Status:** ACTIVE — Follow every gate in chronological order. No skipping.
> **Enforced by:** CI pipeline, PR bots, health checks, this document.
> **Parent protocols:** `SECURITY.md` (Three Laws), `ENV_PROTOCOL.md` (secrets management)

---

## Architecture Overview

Four deployment targets. Three platforms. One monorepo. Every push to `development` triggers Vercel + Supabase. Docker services deploy manually to DigitalOcean.

```
                          ┌─────────────────────────────────────────┐
                          │            MONOREPO (pnpm + Turbo)      │
                          │                                         │
                          │  apps/web ──────► Vercel (smartout-web) │
                          │  apps/landing ──► Vercel (smartout-landing)
                          │                                         │
                          │  supabase/ ─────► Supabase Cloud (PR branch)
                          │    migrations/     Edge Functions        │
                          │    functions/      config.toml           │
                          │                                         │
                          │  services/ ─────► DigitalOcean Droplet  │
                          │    stage-engine    (Docker Compose)      │
                          │    shift-mcp       Caddy reverse proxy   │
                          │    contract-svc                          │
                          │    scrapling                             │
                          │    n8n                                   │
                          └─────────────────────────────────────────┘
```

### Platform Map

| Target              | Platform       | Branch                     | Trigger                   | URL                                      |
| ------------------- | -------------- | -------------------------- | ------------------------- | ---------------------------------------- |
| `apps/web`          | Vercel         | `development` PR to `main` | `git push`                | `app.smartout.ai` / `{slug}.smartout.ai` |
| `apps/landing`      | Vercel         | `development` PR to `main` | `git push`                | `smartout.ai`                            |
| Supabase (DB + EFs) | Supabase Cloud | `development` PR branch    | `git push`                | `{project}.supabase.co`                  |
| Docker services (6) | DigitalOcean   | `development`              | `infra/scripts/deploy.sh` | `*.smartout.ai` (via Caddy)              |

### Service Topology

| Service          | Port   | Domain                     | Health          | Stack             |
| ---------------- | ------ | -------------------------- | --------------- | ----------------- |
| Caddy            | 80/443 | `*.smartout.ai`            | `:2019/config/` | caddy:2-alpine    |
| Stage Engine     | 5010   | `engine.smartout.ai`       | `/health`       | Hono + Node 22    |
| Shift MCP        | 5011   | `schedule-mcp.smartout.ai` | `/health`       | Hono + Node 22    |
| Contract Service | 5012   | `contract.smartout.ai`     | `/health`       | Fastify + Node 22 |
| Scrapling        | 8000   | `scrape.smartout.ai`       | `/health`       | Python 3.12       |
| n8n              | 5678   | `n8n.smartout.ai`          | `/healthz`      | n8nio/n8n:2.10.4  |

### Resource Limits (Production)

| Service          | Memory | CPU  |
| ---------------- | ------ | ---- |
| Stage Engine     | 512M   | 0.5  |
| Shift MCP        | 256M   | 0.25 |
| Contract Service | 256M   | 0.25 |
| Scrapling        | 512M   | 0.5  |
| n8n              | 1G     | 1.0  |

---

## Secrets Architecture

Three tiers. Two vaults. One protocol. Secrets never touch AI context.

### Key Storage Tiers

| Tier | What                                                  | Storage                               | Key Prefix                      | Rotation          |
| ---- | ----------------------------------------------------- | ------------------------------------- | ------------------------------- | ----------------- |
| 1    | Workspace API keys                                    | SHA-256 hash in `platform_api_key`    | `smo_sk_live_` / `smo_sk_test_` | Customer's choice |
| 2    | External secrets (Stripe, Twilio, SendGrid, DocuSeal) | Supabase Vault (pgsodium AES-256-GCM) | Provider-specific               | 90 days           |
| 3    | Service-to-service keys                               | SHA-256 hash in `platform_api_key`    | `smo_svc_live_`                 | 180 days          |

### 1Password Vault Architecture

| Vault               | Purpose             | Contains                                      |
| ------------------- | ------------------- | --------------------------------------------- |
| `smartout_ai` (dev) | Development secrets | Localhost URLs, test API keys, sandbox tokens |
| `smartout_ai_prod`  | Production secrets  | Real URLs, live API keys, production tokens   |

### Where Keys Live

| Secret                    | Dev Location                                 | Prod Location                                     | Managed By        |
| ------------------------- | -------------------------------------------- | ------------------------------------------------- | ----------------- |
| Supabase URL              | `op://smartout_ai/Supabase/url`              | `op://smartout_ai_prod/Supabase/url`              | 1Password         |
| Supabase Anon Key         | `op://smartout_ai/Supabase/anon_key`         | `op://smartout_ai_prod/Supabase/anon_key`         | 1Password         |
| Supabase Service Role     | `op://smartout_ai/Supabase/service_role_key` | `op://smartout_ai_prod/Supabase/service_role_key` | 1Password         |
| Stripe Secret Key         | `sk_test_*` in vault                         | `sk_live_*` in vault + Supabase Vault             | 1Password + Vault |
| Stripe Webhook Secret     | `whsec_*` in vault                           | `whsec_*` in vault                                | 1Password         |
| SendGrid API Key          | `SG.*` in vault                              | `SG.*` in vault + Supabase Vault                  | 1Password + Vault |
| SendGrid Webhook Key      | ECDSA P-256 public key                       | Same                                              | 1Password         |
| Twilio SID + Token        | Test credentials                             | Live credentials in vault                         | 1Password + Vault |
| DocuSeal API Key          | Test key                                     | Live key in Supabase Vault                        | 1Password + Vault |
| DocuSeal Webhook Secret   | Local secret                                 | Production secret                                 | 1Password         |
| OpenRouter API Key        | In vault                                     | In vault                                          | 1Password         |
| Ultravox API Key          | In vault                                     | In vault                                          | 1Password         |
| Upstash Redis URL + Token | Dev instance                                 | Prod instance                                     | 1Password         |
| Sentry DSN                | Dev DSN                                      | Prod DSN                                          | 1Password         |
| PostHog Key               | Dev project                                  | Prod project                                      | 1Password         |
| Contract Service Key      | `smo_svc_*`                                  | `smo_svc_*` in `platform_api_key`                 | 1Password         |
| Stage Engine API Key      | Dev key                                      | Live key                                          | 1Password         |
| Scrapling Auth Token      | Local token                                  | Production token                                  | 1Password         |
| Watchdog Cron Secret      | Local secret                                 | Production secret                                 | 1Password         |
| JWT Secret                | Local 32+ char                               | Production 32+ char                               | 1Password         |
| Session Secret            | Local 32+ char                               | Production 32+ char                               | 1Password         |
| Google OAuth Client ID    | Dev OAuth app                                | Prod OAuth app                                    | 1Password         |
| Google OAuth Secret       | Dev secret                                   | Prod secret                                       | 1Password         |

### Three Environments, Three Injection Methods

| Environment  | Method                                        | Source              |
| ------------ | --------------------------------------------- | ------------------- |
| Local dev    | `op run --env-file=.env.template -- pnpm dev` | 1Password CLI       |
| Vercel       | Environment Variables in dashboard            | Manual in Vercel UI |
| DigitalOcean | `infra/.env` file on droplet                  | Manually populated  |

---

## Edge Function Auth Patterns

Every Edge Function falls into one of three patterns. No exceptions.

| Pattern   | `verify_jwt`     | Auth Method                                          | When                                    |
| --------- | ---------------- | ---------------------------------------------------- | --------------------------------------- |
| JWT-only  | `true` (default) | `supabase.auth.getUser()`                            | User-facing (onboarding, workspace ops) |
| Dual-auth | `false`          | `resolveAuth(req)` from `_shared/auth-middleware.ts` | Public API, data endpoints              |
| Cron-only | `false`          | `WATCHDOG_CRON_SECRET` bearer token                  | Scheduled tasks                         |

### Functions with verify_jwt=false (must be in config.toml)

```
accept-invitation        validate-api-key         cleanup-api-keys
workspace-api            sendgrid-webhook         process-settlement-image
validate-settlement      engine-dispatch          leader-pulse
guardian-sweep           guardian-notify           gather-workspace-intelligence
google-places-intelligence  web-search-intelligence  finalize-workspace
activate-workspace       fire-delayed-triggers    emma-task-trigger
analyze-setup-documents  push-dispatch
```

---

## CI Pipeline (GitHub Actions)

Triggered on every push to `main` or `development`, and on PRs targeting those branches.

```
┌──────────────────────────────────────────────────────────┐
│                    PARALLEL (~1 min each)                 │
│                                                          │
│  ┌─────────┐  ┌───────────┐  ┌────────────┐            │
│  │  Lint   │  │ Typecheck │  │  Format    │            │
│  └─────────┘  └───────────┘  └────────────┘            │
│                                                          │
│  ┌──────────────┐  ┌──────────────────────┐             │
│  │ Build Health │  │ API Docs Go-Live     │             │
│  └──────────────┘  └──────────────────────┘             │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │ Docker Build (4 services, matrix)        │           │
│  │  stage-engine | shift-mcp | contract | scrapling    │
│  └──────────────────────────────────────────┘           │
│                                                          │
│  ┌──────────────────────┐                               │
│  │ Build (web + landing)│ ─── uploads .next artifacts   │
│  └──────────────────────┘                               │
│            │                                             │
│            ▼                                             │
│  ┌──────────────────────────────┐                       │
│  │ Post-Build Verification     │                        │
│  │ (types, supabase, ui, telem)│                        │
│  └──────────────────────────────┘                       │
└──────────────────────────────────────────────────────────┘

PLUS: Vercel Bot (preview deploy) + Supabase Bot (branch deploy)
```

All CI jobs use `SKIP_ENV_VALIDATION=true` to bypass env.ts validation at build time.

---

## The Chronological Checklist

Everything below must be completed in order. Each gate has a CLI command to verify. A single failure blocks deployment.

---

### Phase 1: Pre-Flight (Local Machine)

Run these before any `git push`. Every command must pass.

#### Gate 1.1 — Working Directory Clean

```bash
git status --short
# Expected: empty output (no uncommitted changes)

git branch --show-current
# Expected: development (or your feature branch)
```

**If dirty:** Commit or stash. Never push with uncommitted changes.

#### Gate 1.2 — No Secrets in Code

```bash
# Search for leaked key patterns
grep -rn 'smo_sk_\|smo_svc_\|sk_live_\|sk_test_\|whsec_\|SG\.\|eyJhbG' \
  --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.json" \
  apps/ packages/ services/ supabase/migrations/ supabase/functions/ \
  | grep -v node_modules | grep -v '.env.template' | grep -v '.env.example'
# Expected: empty output

# Verify .gitignore covers sensitive files
git ls-files --cached | grep -E '\.env\.local|\.env$' | head -5
# Expected: empty output
```

**If matches found:** Remove secrets immediately. Use `op://` references.

#### Gate 1.3 — Environment Variables Consistent

```bash
# Find vars used in code but missing from .env.template
grep -rhoP 'process\.env\.\K[A-Z_]+' apps/ packages/ services/ \
  --include="*.ts" --include="*.tsx" | sort -u > /tmp/used.txt
grep -oP '^[A-Z_]+' .env.template | sort -u > /tmp/declared.txt
comm -23 /tmp/used.txt /tmp/declared.txt
# Expected: empty output (all vars declared)
```

**If new vars found:** Add to `.env.template` with `op://` reference (secrets) or plain value (config). Then add to Vercel dashboard and `infra/.env` as needed. See Phase 5.

#### Gate 1.4 — TypeScript Passes

```bash
pnpm turbo typecheck
# Expected: 0 errors
```

**If errors:** Fix all type errors. No exceptions.

#### Gate 1.5 — Lint Passes

```bash
pnpm lint
# Expected: 0 errors (warnings OK)
```

**If errors:** Fix lint errors. Warnings are acceptable but should be reviewed.

#### Gate 1.6 — Build Succeeds

```bash
pnpm turbo run build
# Expected: all apps build successfully
# NOTE: Use `turbo run build` directly, not `pnpm build` (which wraps op run)
```

**If failures:** Check build logs. Common issues:

- Missing env vars → set `SKIP_ENV_VALIDATION=1` temporarily to isolate
- Import errors → check package exports
- Type errors that typecheck missed → fix them

#### Gate 1.7 — Format Clean

```bash
pnpm format:check
# Expected: no unformatted files

# Auto-fix if needed:
pnpm format
git add -A && git commit -m "style: format code"
```

#### Gate 1.8 — Build Health

```bash
pnpm build:health
# Expected: report generated at artifacts/quality/build-health-report.json
cat artifacts/quality/build-health-report.json | head -20
```

#### Gate 1.9 — API Docs Go-Live Guard

```bash
pnpm api:docs:verify-go-live
# Expected: passes (no uncommitted changes to go-live API spec)
```

---

### Phase 2: Database (Supabase)

Run if ANY migrations or Edge Functions changed.

#### Gate 2.1 — Check for New Migrations

```bash
git diff origin/development..HEAD --name-only -- supabase/migrations/
# If output: new migrations exist — continue this phase
# If empty: skip to Gate 2.5
```

#### Gate 2.2 — Test Migrations Locally

```bash
# Ensure local Supabase is running
npx supabase status
# If not running:
npx supabase start

# Apply each new migration against local DB
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres \
  < supabase/migrations/<new_migration_file>.sql
# Expected: no errors

# Or reset everything (destructive — reapplies all migrations + seed):
npx supabase db reset
```

**If migration fails locally:** Fix the SQL before pushing. Never push a migration that fails locally.

#### Gate 2.3 — Regenerate Types

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
# Verify the types changed as expected:
git diff packages/supabase/src/database.types.ts | head -50
# Commit if changed:
git add packages/supabase/src/database.types.ts
git commit -m "chore(supabase): regenerate database types"
```

**Mandatory after every migration.** Never push a migration without regenerating types.

#### Gate 2.4 — Verify RLS on New Tables

```bash
# List tables without RLS (should be empty for workspace-scoped tables)
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname IN ('public', 'payroll', 'websites', 'timesheet')
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE c.relrowsecurity = true
  )
  ORDER BY schemaname, tablename;
"
# Review: any workspace-scoped table here is a security violation
```

#### Gate 2.5 — Check config.toml for New Edge Functions

```bash
git diff origin/development..HEAD --name-only -- supabase/functions/
# If new function directories appear:

# Verify verify_jwt=false functions are in config.toml
grep -E '^\[functions\.' supabase/config.toml | sed 's/\[functions\.\(.*\)\]/\1/' | sort
# Cross-reference with function dirs:
ls -d supabase/functions/*/  | xargs -I{} basename {} | sort
# Any verify_jwt=false function MUST have a [functions.<name>] entry
```

#### Gate 2.6 — Check config.toml Cloud Traps

```bash
# SMS test OTP: phone numbers must NOT have + prefix for Cloud
grep -A1 'test_otp' supabase/config.toml
# Expected: "4700000000" = "123456" (no + prefix)

# Auth redirect URLs include production domains
grep 'additional_redirect_urls' supabase/config.toml
# Expected: includes https://smartout.ai, https://*.smartout.ai
```

| Trap                        | Local works         | Cloud fails            | Fix                            |
| --------------------------- | ------------------- | ---------------------- | ------------------------------ |
| `sms_test_otp` phone format | `"+47..."` OK       | Requires no `+` prefix | Use `"47..."`                  |
| `verify_jwt = false`        | Always works        | Must be in config.toml | Add `[functions.<name>]` entry |
| Auth redirect URLs          | `localhost:3060`    | Needs prod URL         | Add both in `[auth]` section   |
| New migration syntax        | Local PG permissive | Cloud PG strict        | Test with psql locally first   |

---

### Phase 3: Docker Services (DigitalOcean)

Run if ANY services or packages they depend on changed.

#### Gate 3.1 — Check for Service Changes

```bash
git diff origin/development..HEAD --name-only -- services/ infra/ packages/
# If output: Docker containers may need rebuild
# If empty: skip to Phase 4
```

#### Gate 3.2 — Build Docker Images Locally

```bash
# Build each changed service to verify Dockerfile compiles
docker build -f services/stage-engine/Dockerfile -t smartout/stage-engine:test .
docker build -f services/shift-mcp/Dockerfile -t smartout/shift-mcp:test .
docker build -f services/contract-service/Dockerfile -t smartout/contract-service:test .
docker build -f services/scrapling/Dockerfile -t smartout/scrapling:test services/scrapling/
# Expected: all images build without errors
```

#### Gate 3.3 — Verify infra/.env on Droplet

Before deploying, ensure the DigitalOcean droplet has all required env vars.

```bash
# SSH to droplet and check
ssh smartout-droplet "cat /root/smartout.ai/infra/.env | grep -c '='"
# Compare with .env.template var count:
grep -c '^[A-Z]' .env.template
# Counts should be comparable (infra/.env may have fewer — Docker services only)
```

Required Docker env vars per service:

| Service              | Required Variables                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Stage Engine**     | `NODE_ENV`, `ENGINE_URL`, `STAGE_ENGINE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ULTRAVOX_API_KEY`, `OPENROUTER_API_KEY` |
| **Shift MCP**        | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                                                                             |
| **Contract Service** | `CONTRACT_SERVICE_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL`, `DOCUSEAL_WEBHOOK_SECRET`, `APP_URL`            |
| **Scrapling**        | `SCRAPLING_AUTH_TOKEN`, `OPENROUTER_API_KEY`, `SERPER_API_KEY`                                                                                               |
| **n8n**              | `N8N_HOST`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `N8N_ENCRYPTION_KEY`                                                                           |

#### Gate 3.4 — Deploy to DigitalOcean

```bash
# On the DigitalOcean droplet:
cd /root/smartout.ai
./infra/scripts/deploy.sh
# This runs: git pull → docker compose up -d --build → health checks

# Or manually:
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
sleep 5
./scripts/health-check.sh
```

**Expected health check output:**

```
Checking services...
  OK    Caddy
  OK    Stage Engine
  OK    Shift MCP
  OK    Contract Service
  OK    Scrapling
  OK    n8n

All services healthy.
```

**If any fail:** Check logs:

```bash
docker compose logs stage-engine --tail 50
docker compose logs shift-mcp --tail 50
docker compose logs contract-service --tail 50
docker compose logs scrapling --tail 50
docker compose logs n8n --tail 50
docker compose logs caddy --tail 50
```

#### Gate 3.5 — Verify Caddy TLS

```bash
# From outside the droplet, check HTTPS works
curl -sI https://engine.smartout.ai/health | head -5
# Expected: HTTP/2 200

curl -sI https://schedule-mcp.smartout.ai/health | head -5
curl -sI https://contract.smartout.ai/health | head -5
curl -sI https://scrape.smartout.ai/health | head -5
```

#### Gate 3.6 — Backup Before Major Changes

```bash
# On the droplet, before destructive changes:
./infra/scripts/backup.sh
# Saves: n8n data + Caddy certificates to ~/backups/smartout/YYYY-MM-DD_HHMM/
```

---

### Phase 4: Push & Monitor CI

#### Gate 4.1 — Push to Development

```bash
git push origin development
# Or if on a feature branch:
git push origin feat/your-feature
# Then create PR to development
```

#### Gate 4.2 — Monitor GitHub Actions CI

```bash
# Get PR number
gh pr list --head development --json number --jq '.[0].number'

# Watch CI status
gh pr checks <PR_NUMBER> --watch
# Expected: all checks pass

# Or check specific job status
gh run list --branch development --limit 5
gh run view <RUN_ID>
```

**CI Jobs that must pass:**

| Job                       | Command                        | Blocks Deploy |
| ------------------------- | ------------------------------ | ------------- |
| Lint                      | `pnpm lint`                    | Yes           |
| Type Check                | `pnpm typecheck`               | Yes           |
| Format Check              | `pnpm format:check`            | Yes           |
| Build Health              | `pnpm build:health`            | Yes           |
| API Docs Go-Live Guard    | `pnpm api:docs:verify-go-live` | Yes           |
| Docker Build (4 services) | `docker build ...`             | Yes           |
| Build (web + landing)     | `pnpm turbo run build`         | Yes           |
| Post-Build Verification   | Package exports check          | Yes           |

#### Gate 4.3 — Monitor Vercel Bot

```bash
# Check Vercel preview deploy status
gh api /repos/SXTNmedia21/smartout.ai/issues/<PR_NUMBER>/comments \
  --jq '[.[] | select(.user.login=="vercel[bot]")] | last | .body' \
  | head -30
# Look for: deployment URLs (success) or "Error" (failed)
```

**Common Vercel failures:**

| Error                           | Cause                    | Fix                                               |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| "Invalid environment variables" | env.ts validation failed | Add var to Vercel dashboard or make `.optional()` |
| Build timeout                   | Heavy dependencies       | Add `NODE_OPTIONS: --max-old-space-size=4096`     |
| Import error                    | Package export mismatch  | Check `packages/*/package.json` exports field     |

#### Gate 4.4 — Monitor Supabase Bot

```bash
gh api /repos/SXTNmedia21/smartout.ai/issues/<PR_NUMBER>/comments \
  --jq '[.[] | select(.user.login=="supabase[bot]")] | last | .body' \
  | head -30
# Look for: migration status, config errors, "Branch Error"
```

**Common Supabase failures:**

| Error                    | Cause                    | Fix                                                  |
| ------------------------ | ------------------------ | ---------------------------------------------------- |
| "Configurations: Failed" | config.toml format error | Check `sms_test_otp` format, verify_jwt entries      |
| "Migrations: Failed"     | SQL syntax error         | Test locally: `docker exec ... psql < migration.sql` |
| "Branch Error"           | Schema conflict          | Reset branch or fix migration                        |

---

### Phase 5: Vercel Environment Variables

Run when ANY new env var was added.

#### Gate 5.1 — Identify New Variables

```bash
git diff origin/development..HEAD -- .env.template apps/web/src/env.ts apps/landing/src/env.ts
# Lists all env var changes
```

#### Gate 5.2 — Update Vercel Dashboard

For each new variable:

```bash
# Vercel CLI method (if installed):
vercel env add <VAR_NAME> production
vercel env add <VAR_NAME> preview
vercel env add <VAR_NAME> development

# Or use the Vercel dashboard:
# https://vercel.com/sxtnmedia21/smartout-web/settings/environment-variables
# https://vercel.com/sxtnmedia21/smartout-landing/settings/environment-variables
```

**Variable routing:**

| Variable Pattern                                 | Add to `smartout-web` | Add to `smartout-landing` |
| ------------------------------------------------ | --------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_*`                         | Yes                   | Yes                       |
| `NEXT_PUBLIC_POSTHOG_*`                          | Yes                   | Yes                       |
| `NEXT_PUBLIC_SENTRY_*`                           | Yes                   | Yes                       |
| `NEXT_PUBLIC_ROOT_DOMAIN`                        | Yes                   | Yes                       |
| `NEXT_PUBLIC_LANDING_URL`                        | Yes                   | No                        |
| `NEXT_PUBLIC_WEB_APP_URL`                        | No                    | Yes                       |
| `NEXT_PUBLIC_STAGE_ENGINE_URL`                   | Yes                   | No                        |
| All server vars (`STRIPE_*`, `SENDGRID_*`, etc.) | Yes                   | Only if landing uses them |
| `SKIP_ENV_VALIDATION`                            | Yes (set to `1`)      | Yes (set to `1`)          |

#### Gate 5.3 — Verify env.ts CI Compatibility

```bash
# Check that server vars are .optional() (required for Vercel build)
grep -n '\.optional()' apps/web/src/env.ts | wc -l
# Should match number of server vars

# Check for CI-breaking validators (startsWith, includes on secrets)
grep -n 'startsWith\|\.includes(' apps/web/src/env.ts
# If found on secret vars: replace with .min(1).optional() or remove
```

**Rules for env.ts:**

- All server vars: `.optional()` (Vercel may not have all)
- No `.startsWith()` or `.includes()` on secrets (placeholder values break Vercel)
- `emptyStringAsUndefined: true` handles empty strings
- `SKIP_ENV_VALIDATION=1` is the emergency escape hatch

#### Gate 5.4 — Update 1Password (Both Vaults)

```bash
# Verify both vaults are in sync
op item list --vault smartout_ai --format json | jq '.[].title' | sort > /tmp/dev_items.txt
op item list --vault smartout_ai_prod --format json | jq '.[].title' | sort > /tmp/prod_items.txt
diff /tmp/dev_items.txt /tmp/prod_items.txt
# Expected: identical structure (different values)

# Add new secret to dev vault
op item edit "<ItemName>" --vault smartout_ai <field>=<dev_value>

# Add new secret to prod vault
op item edit "<ItemName>" --vault smartout_ai_prod <field>=<prod_value>

# Verify locally
op run --env-file=.env.template -- env | grep <NEW_VAR>
```

---

### Phase 6: Post-Deploy Verification

#### Gate 6.1 — Verify Vercel Deployments

```bash
# Check web app
curl -sI https://app.smartout.ai | head -5
# Expected: HTTP/2 200

# Check landing page
curl -sI https://smartout.ai | head -5
# Expected: HTTP/2 200

# Check subdomain routing
curl -sI https://demo.smartout.ai | head -5
# Expected: HTTP/2 200 (redirects to login if not authenticated)
```

#### Gate 6.2 — Verify Supabase Cloud

```bash
# Check Edge Functions are deployed (via Supabase CLI)
npx supabase functions list --project-ref <PROJECT_REF>
# Expected: all 35 functions listed

# Test a public function
curl -s https://<PROJECT_REF>.supabase.co/functions/v1/workspace-api/v1/health
# Expected: 200 OK
```

#### Gate 6.3 — Verify Docker Services

```bash
# From local machine (or use the droplet)
curl -s https://engine.smartout.ai/health
curl -s https://schedule-mcp.smartout.ai/health
curl -s https://contract.smartout.ai/health
curl -s https://scrape.smartout.ai/health
# Expected: all return 200 with health status
```

#### Gate 6.4 — Verify Webhook Endpoints

```bash
# SendGrid webhook (should accept POST, reject GET)
curl -sI -X POST https://<PROJECT_REF>.supabase.co/functions/v1/sendgrid-webhook
# Expected: 401 or 400 (not 404 — function exists but auth fails)

# DocuSeal webhook (Next.js API route)
curl -sI -X POST https://app.smartout.ai/api/webhooks/docuseal
# Expected: 401 or 400
```

#### Gate 6.5 — Verify Monitoring

```bash
# Check Sentry is receiving events (production only)
# Visit: https://sentry.io/organizations/smartout/issues/
# Expected: Sentry dashboard loads, recent events visible

# Check PostHog is receiving events
# Visit: https://eu.posthog.com/project/<ID>/activity
# Expected: recent events from production users
```

#### Gate 6.6 — Platform Health Dashboard

```bash
# Hit the internal health endpoint (requires auth)
# Visit: https://app.smartout.ai/dashboard/health (platform admin only)
# Checks: Supabase DB, Contract Service, Scrapling, Stage Engine, Shift MCP, Telemetry
# Plus external status: Stripe, SendGrid, Twilio, Sentry, PostHog, Upstash, OpenRouter
```

---

### Phase 7: Rollback Plan

If anything goes wrong after deployment.

#### Vercel Rollback

```bash
# List recent deployments
vercel ls smartout-web --limit 5

# Promote previous deployment
vercel rollback <DEPLOYMENT_URL>
# Or use Vercel dashboard: Deployments → three dots → Promote to Production
```

#### Supabase Rollback

```bash
# Migrations cannot be auto-rolled back
# Write a reverse migration:
# supabase/migrations/YYYYMMDDHHMMSS_rollback_description.sql

# Test locally first:
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres \
  < supabase/migrations/<rollback_file>.sql
```

#### Docker Rollback

```bash
# On the DigitalOcean droplet:
cd /root/smartout.ai
git log --oneline -5  # Find last good commit
git checkout <GOOD_COMMIT>
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
./scripts/health-check.sh
```

#### Emergency: Secret Compromise

```bash
# 1. Identify key type
# smo_sk_* → Workspace API key → Revoke via admin dashboard
# smo_svc_* → Service key → Revoke via super-admin
# sk_live_* → Stripe → Roll in Stripe dashboard → update Vault
# Other → Identify provider → roll key → update Vault

# 2. Check usage logs
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT endpoint, request_count, error_count, hour_bucket
  FROM platform_api_key_usage
  WHERE key_id = '<compromised_key_id>'
  ORDER BY hour_bucket DESC
  LIMIT 20;
"

# 3. Revoke and rotate
op item edit "<ItemName>" --vault smartout_ai_prod <field>=<new_value>
# Redeploy affected service
```

---

## Quick Reference: What Change Affects What

| Change Type             | Vercel              | Supabase Cloud  | Docker/DO           | Must Check                             |
| ----------------------- | ------------------- | --------------- | ------------------- | -------------------------------------- |
| New env var             | Add to dashboard    | —               | Add to `infra/.env` | `.env.template`, `env.ts`, Vercel UI   |
| New migration           | —                   | Auto via PR bot | —                   | Test locally, regen types, check bot   |
| New Edge Function       | —                   | Auto via PR bot | —                   | `config.toml` if `verify_jwt=false`    |
| New/changed service     | —                   | —               | Rebuild containers  | Dockerfile, health check               |
| Package dep change      | Auto (Vercel build) | —               | Rebuild containers  | Docker images use built `node_modules` |
| config.toml change      | —                   | Auto via PR bot | —                   | Format differences from local          |
| env.ts validator change | Verify build passes | —               | —                   | Keep validators CI-friendly            |
| Caddyfile change        | —                   | —               | Restart Caddy       | TLS, routing, security headers         |

---

## Automation: Full Deploy Command Sequence

Copy-paste this for a standard deployment from `development`:

```bash
# ── Phase 1: Pre-flight ──
git status --short                              # Must be clean
pnpm turbo typecheck                            # 0 errors
pnpm lint                                       # 0 errors
pnpm turbo run build                            # Builds succeed
pnpm format:check                               # Formatted
pnpm build:health                               # Report generated
pnpm api:docs:verify-go-live                    # API docs committed

# ── Phase 2: Database (if migrations changed) ──
npx supabase status                             # Local running
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
git add -A && git commit -m "chore(supabase): regenerate types"

# ── Phase 3: Push & Monitor ──
git push origin development
gh pr checks $(gh pr list --head development --json number --jq '.[0].number') --watch

# ── Phase 4: Docker (if services changed) ──
ssh smartout-droplet "cd /root/smartout.ai && ./infra/scripts/deploy.sh"

# ── Phase 5: Verify ──
curl -sI https://app.smartout.ai | head -1      # HTTP/2 200
curl -sI https://smartout.ai | head -1           # HTTP/2 200
curl -s https://engine.smartout.ai/health        # Healthy
curl -s https://schedule-mcp.smartout.ai/health  # Healthy
curl -s https://contract.smartout.ai/health      # Healthy
curl -s https://scrape.smartout.ai/health        # Healthy
```

---

## Document Relationships

```
CLAUDE.md
  └── References → docs/protocols/DEPLOYMENT.md (this doc)
                      ├── Depends on → docs/protocols/SECURITY.md (Three Laws, key tiers)
                      ├── Depends on → docs/protocols/ENV_PROTOCOL.md (env var management)
                      ├── References → docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md
                      ├── References → .github/workflows/ci.yml (CI pipeline)
                      ├── References → infra/docker-compose.yml (service definitions)
                      ├── References → infra/docker-compose.prod.yml (prod overlay)
                      ├── References → infra/Caddyfile (reverse proxy)
                      ├── References → infra/scripts/deploy.sh (deploy script)
                      ├── References → infra/scripts/health-check.sh (health checks)
                      ├── References → supabase/config.toml (Edge Function config)
                      └── References → apps/web/src/env.ts (env validation)
```

---

_If you cannot explain which phase your deployment is in, you should not be deploying._
