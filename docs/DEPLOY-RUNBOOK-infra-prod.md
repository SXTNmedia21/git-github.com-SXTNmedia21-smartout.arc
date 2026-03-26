---
title: Production Deployment Runbook — Infra Prod Alignment
status: in_progress
updated: 2026-03-26
created: 2026-03-26
module: infra
tags: [infra, production, deployment, runbook]
---

# Production Deployment Runbook — Infra Prod Alignment

> This runbook covers the manual steps required after code commits for the
> `feat/infra-prod-alignment` branch. Tasks 1 and 2 are done in code (merged
> to development). Tasks 3–6 require SSH to the DigitalOcean Droplet and/or
> Supabase/Vercel CLI access.
>
> **Droplet IP:** `164.92.176.42`
> **Supabase project:** `yljaglomadbhyqpcigff` (smartout-live)
> **Active Supabase project:** NOT `hcmhwsewrcjmldjezaqk` — do not use

---

## Prerequisites

Before running any task below, confirm:

```bash
# Local machine checks
op whoami                          # 1Password CLI authenticated
npx supabase --version             # Supabase CLI installed
vercel --version                   # Vercel CLI installed
ssh root@164.92.176.42 "echo OK"   # SSH key access to Droplet
```

---

## Task 3: Update Droplet — Pull Latest Code and Rebuild

The Droplet was 20 commits behind `development` (at commit `a917d6a`). The
`placeholders.ts` change in contract-service is NOT in development and must be
preserved during the pull.

### Step 3.1 — SSH into Droplet

```bash
ssh root@164.92.176.42
cd /opt/smartout
```

### Step 3.2 — Stash contract-service placeholder changes (NOT in development)

```bash
git stash push -m "contract-service placeholder keys" \
  -- services/contract-service/src/lib/placeholders.ts
```

Expected: `Saved working directory and index state WIP on development: a917d6a ...`

### Step 3.3 — Discard changes already merged into development

```bash
# These changes are already in development — safe to overwrite
git checkout -- infra/docker-compose.yml services/scrapling/main.py
```

### Step 3.4 — Pull latest development

```bash
git pull origin development
```

Expected: `Updating a917d6a..<latest>` — includes Task 1 (SUPABASE_URL fix) and
Task 2 (scrapling auth fix).

### Step 3.5 — Remove override.yml (git pull restores it, prod must not have it)

```bash
rm -f infra/docker-compose.override.yml
ls infra/docker-compose.override.yml 2>&1   # should say: No such file or directory
```

### Step 3.6 — Re-apply contract-service placeholder changes

```bash
git stash pop
```

If conflicts occur: the change adds new keys to `fieldMap` objects in
`resolveWorkspaceField` and `resolveCompanyField` in `placeholders.ts` —
resolve by accepting both incoming and stashed changes (both are additive).

### Step 3.7 — Add missing env vars to infra/.env

Check what's already there first:

```bash
grep -E "NODE_ENV|LOG_LEVEL|ENGINE_URL|SUPABASE_URL" /opt/smartout/infra/.env
```

Add any missing vars:

```bash
# Add if missing:
cat >> /opt/smartout/infra/.env << 'EOF'

# --- Added 2026-03-26 (prod alignment) ---
NODE_ENV=production
LOG_LEVEL=info
EOF
```

Verify ENGINE_URL is set (required by docker-compose.yml for stage-engine):

```bash
grep ENGINE_URL /opt/smartout/infra/.env
# Expected: ENGINE_URL=https://engine.smartout.ai
# If missing, add:
echo "ENGINE_URL=https://engine.smartout.ai" >> /opt/smartout/infra/.env
```

Verify SUPABASE_URL points to cloud (NOT localhost):

```bash
grep SUPABASE_URL /opt/smartout/infra/.env
# Expected: SUPABASE_URL=https://yljaglomadbhyqpcigff.supabase.co
```

### Step 3.8 — Rebuild all containers

```bash
cd /opt/smartout/infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Expected: All 6 containers rebuild and start. Stage Engine should no longer
crash-loop (the `ERR_MODULE_NOT_FOUND: /app/packages/ai/dist/types` crash was
caused by `SUPABASE_URL` pointing at localhost — now fixed).

### Step 3.9 — Verify all services are healthy

```bash
sleep 20
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

All containers must show `Up ... (healthy)`. Stage Engine must NOT show
`Restarting`.

```bash
bash /opt/smartout/infra/scripts/health-check.sh
# Expected: All services healthy.
```

### Step 3.10 — Verify stage-engine uses Supabase Cloud

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec stage-engine env | grep SUPABASE_URL
# Expected: SUPABASE_URL=https://yljaglomadbhyqpcigff.supabase.co
# NOT: http://host.docker.internal:54321
```

### Step 3.11 — Optional: Clean Docker disk (~30GB)

```bash
docker system prune -f --volumes=false
docker builder prune -f
```

---

## Task 4: Align Supabase Edge Function Secrets

Run from **local machine** (not SSH). Requires Supabase CLI and 1Password CLI.

### Step 4.1 — Re-set SCRAPLING_AUTH_TOKEN

Re-set from 1Password to guarantee it matches the Droplet's `.env`:

```bash
npx supabase secrets set \
  SCRAPLING_AUTH_TOKEN="$(op read 'op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN')" \
  --project-ref yljaglomadbhyqpcigff
```

### Step 4.2 — Set SCRAPLING_SERVICE_URL

```bash
npx supabase secrets set \
  SCRAPLING_SERVICE_URL=https://scrape.smartout.ai \
  --project-ref yljaglomadbhyqpcigff
```

### Step 4.3 — Set missing secrets

```bash
# OpenRouter (analyze-setup-documents, web-search-intelligence)
npx supabase secrets set \
  OPENROUTER_API_KEY="$(op read 'op://smartout_ai/OpenRouter/api_key')" \
  --project-ref yljaglomadbhyqpcigff

# Stage Engine URL
npx supabase secrets set \
  STAGE_ENGINE_URL=https://engine.smartout.ai \
  --project-ref yljaglomadbhyqpcigff

# Ultravox (voice functions)
npx supabase secrets set \
  ULTRAVOX_API_KEY="$(op read 'op://smartout_ai/Ultravox/api_key')" \
  --project-ref yljaglomadbhyqpcigff

# SendGrid (notification functions)
npx supabase secrets set \
  SENDGRID_API_KEY="$(op read 'op://smartout_ai/SendGrid/api_key')" \
  --project-ref yljaglomadbhyqpcigff

# Watchdog cron secret
npx supabase secrets set \
  WATCHDOG_CRON_SECRET="$(op read 'op://smartout_ai/SmartOut/watchdog_cron_secret')" \
  --project-ref yljaglomadbhyqpcigff

# Google Vision (settlement image processing)
# NOTE: Verify correct 1Password path — may be 'Google Vision' not 'Google'
npx supabase secrets set \
  GOOGLE_VISION_API_KEY="$(op read 'op://smartout_ai/Google/api_key')" \
  --project-ref yljaglomadbhyqpcigff
```

### Step 4.4 — Verify all secrets

```bash
npx supabase secrets list --project-ref yljaglomadbhyqpcigff
```

Expected names in the list:

| Secret | Status |
|--------|--------|
| `SCRAPLING_AUTH_TOKEN` | Must exist |
| `SCRAPLING_SERVICE_URL` | Must exist |
| `OPENROUTER_API_KEY` | Must exist |
| `STAGE_ENGINE_URL` | Must exist |
| `ULTRAVOX_API_KEY` | Must exist |
| `SENDGRID_API_KEY` | Must exist |
| `WATCHDOG_CRON_SECRET` | Must exist |
| `GOOGLE_VISION_API_KEY` | Must exist |
| `SUPABASE_URL` | Already set |
| `SUPABASE_ANON_KEY` | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set |
| `SUPABASE_DB_URL` | Already set |
| `SERPER_API_KEY` | Already set |
| `GOOGLE_API_KEY` | Already set |
| `CONTRACT_SERVICE_KEY` | Already set |

---

## Task 5: Set Vercel Environment Variables

Run from **local machine**. Requires Vercel CLI and 1Password CLI.

```bash
vercel login   # if not already logged in
```

### 5A — Smartout Web (`apps/web`)

Navigate to the web project in Vercel CLI before running these commands, or
add `--scope` flags matching your Vercel team.

**Client-side (public) vars:**

```bash
echo "https://yljaglomadbhyqpcigff.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
op read 'op://smartout_ai/Supabase/anon_key' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "smartout.ai" | vercel env add NEXT_PUBLIC_ROOT_DOMAIN production
echo "https://smartout.ai" | vercel env add NEXT_PUBLIC_LANDING_URL production
echo "https://engine.smartout.ai" | vercel env add NEXT_PUBLIC_STAGE_ENGINE_URL production
op read 'op://smartout_ai/PostHog/api_key' | vercel env add NEXT_PUBLIC_POSTHOG_KEY production
echo "https://eu.i.posthog.com" | vercel env add NEXT_PUBLIC_POSTHOG_HOST production
op read 'op://smartout_ai/Sentry/dsn' | vercel env add NEXT_PUBLIC_SENTRY_DSN production
op read 'op://smartout_ai/SmartOut/revalidation_secret' | vercel env add NEXT_PUBLIC_REVALIDATION_SECRET production
```

**Server-side vars:**

```bash
op read 'op://smartout_ai/Supabase/service_role_key' | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo "https://scrape.smartout.ai" | vercel env add SCRAPLING_SERVICE_URL production
op read 'op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN' | vercel env add SCRAPLING_AUTH_TOKEN production
echo "https://engine.smartout.ai" | vercel env add STAGE_ENGINE_URL production
op read 'op://smartout_ai/Stage-Engine/api_key' | vercel env add STAGE_ENGINE_API_KEY production
echo "https://contract.smartout.ai" | vercel env add CONTRACT_SERVICE_URL production
op read 'op://smartout_ai/Contract-Service/api_key' | vercel env add CONTRACT_SERVICE_KEY production
echo "https://schedule-mcp.smartout.ai" | vercel env add SHIFT_MCP_URL production
op read 'op://smartout_ai/Stripe/secret_key' | vercel env add STRIPE_SECRET_KEY production
op read 'op://smartout_ai/Stripe/webhook_secret' | vercel env add STRIPE_WEBHOOK_SECRET production
op read 'op://smartout_ai/OpenRouter/api_key' | vercel env add OPENROUTER_API_KEY production
op read 'op://smartout_ai/SendGrid/api_key' | vercel env add SENDGRID_API_KEY production
op read 'op://smartout_ai/Twilio/account_sid' | vercel env add TWILIO_ACCOUNT_SID production
op read 'op://smartout_ai/Twilio/auth_token' | vercel env add TWILIO_AUTH_TOKEN production
op read 'op://smartout_ai/Upstash/rest_url' | vercel env add UPSTASH_REDIS_REST_URL production
op read 'op://smartout_ai/Upstash/rest_token' | vercel env add UPSTASH_REDIS_REST_TOKEN production
op read 'op://smartout_ai/Sentry/auth_token' | vercel env add SENTRY_AUTH_TOKEN production
op read 'op://smartout_ai/Sentry/dsn' | vercel env add SENTRY_DSN production
op read 'op://smartout_ai/DocuSeal/webhook_secret' | vercel env add DOCUSEAL_WEBHOOK_SECRET production
```

**Preview env override (Stripe test keys only):**

```bash
op read 'op://smartout_ai/Stripe/test_secret_key' | vercel env add STRIPE_SECRET_KEY preview
```

All other vars: scope to `production,preview` in the Vercel dashboard, or repeat
with `preview` in the commands above.

### 5B — Smartout Landing (`apps/landing`)

Switch to landing project in Vercel CLI, then:

```bash
echo "https://yljaglomadbhyqpcigff.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
op read 'op://smartout_ai/Supabase/anon_key' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "https://app.smartout.ai" | vercel env add NEXT_PUBLIC_WEB_APP_URL production
op read 'op://smartout_ai/PostHog/api_key' | vercel env add NEXT_PUBLIC_POSTHOG_KEY production
echo "T" | vercel env add NEXT_PUBLIC_LANDING_VARIANT production
echo "https://engine.smartout.ai" | vercel env add STAGE_ENGINE_URL production
op read 'op://smartout_ai/Stage-Engine/api_key' | vercel env add STAGE_ENGINE_API_KEY production
op read 'op://smartout_ai/SmartOut/revalidation_secret' | vercel env add REVALIDATION_SECRET production
```

### Step 5.3 — Verify Vercel vars are complete

```bash
vercel env ls --environment production
```

Cross-check both projects against:
- `.env.template` (root) — authoritative list of all variables
- `apps/web/src/env.ts` — what web actually reads
- `apps/landing/src/env.ts` — what landing actually reads

---

## Task 6: End-to-End Verification

Run after Tasks 3, 4, and 5 are complete.

### Step 6.1 — Test scrapling directly on Droplet (via SSH)

```bash
ssh root@164.92.176.42 "
  TOKEN=\$(grep SCRAPLING_AUTH_TOKEN /opt/smartout/infra/.env | cut -d= -f2)
  curl -s -X POST http://localhost:8000/extract \
    -H 'Content-Type: application/json' \
    -H \"Authorization: Bearer \$TOKEN\" \
    -d '{\"url\": \"smartout.ai\"}' | python3 -m json.tool | head -5
"
```

Expected: 200 response with `companyName` in output.

### Step 6.2 — Test scrapling through Caddy (HTTPS)

```bash
curl -s -X POST https://scrape.smartout.ai/health
```

Expected: `{"status": "healthy", ...}`

### Step 6.3 — Test Stage Engine health

```bash
curl -s https://engine.smartout.ai/health
```

Expected: `{"status": "healthy", ...}` — confirms stage-engine no longer crash-loops.

### Step 6.4 — Verify Stage Engine uses Supabase Cloud (not localhost)

```bash
ssh root@164.92.176.42 "
  cd /opt/smartout/infra
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    exec stage-engine env | grep SUPABASE_URL
"
```

Expected: `SUPABASE_URL=https://yljaglomadbhyqpcigff.supabase.co`

### Step 6.5 — Test Edge Function → Scrapling chain

```bash
curl -s -X POST \
  https://yljaglomadbhyqpcigff.supabase.co/functions/v1/scrape-website \
  -H "Authorization: Bearer $(op read 'op://smartout_ai/Supabase/anon_key')" \
  -H 'Content-Type: application/json' \
  -d '{"url": "smartout.ai"}' | head -10
```

Expected: 200 with scraped data (proves EF → Caddy → Scrapling with auth works).

### Step 6.6 — Check Droplet logs for 401s

```bash
ssh root@164.92.176.42 "
  cd /opt/smartout/infra
  docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    logs --tail=20 scrapling 2>&1 | grep -v health
"
```

Expected: No `401 Unauthorized` entries after the fixes.

### Step 6.7 — Verify unused Supabase project is not referenced

```bash
grep -r "hcmhwsewrcjmldjezaqk" \
  apps/ packages/ services/ supabase/ infra/ \
  --include="*.ts" --include="*.tsx" --include="*.env*" --include="*.yml"
```

Expected: No matches. If confirmed unused, pause `SmartOut Production`
(`hcmhwsewrcjmldjezaqk`) in Supabase dashboard to save cost.

---

## Rollback Plan

If stage-engine fails to start after pulling latest code:

```bash
ssh root@164.92.176.42
cd /opt/smartout

# Roll back to previous known commit
git log --oneline -5        # find the commit before the pull
git reset --hard a917d6a    # or whichever commit was stable

# Rebuild
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

If scrapling returns 401 after env sync:

1. Check `SCRAPLING_AUTH_TOKEN` in Droplet `.env` matches Supabase secret and Vercel var
2. All three must be identical — re-read from 1Password and re-set all three

---

## What Was Done in Code (Tasks 1-2, no manual steps needed)

| Task | Fix | File |
|------|-----|------|
| Task 1 | `SUPABASE_URL` for stage-engine uses `${SUPABASE_URL}` env var instead of hardcoded localhost | `infra/docker-compose.yml:50` |
| Task 2a | Auth header added to scrapling call in platform-admin lookup route | `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts` |
| Task 2b | Auth header added to scrapling call in analyze-documents route | `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts` |
