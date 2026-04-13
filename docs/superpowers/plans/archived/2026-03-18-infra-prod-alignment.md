---
title: Infrastructure Production Alignment
status: in_progress
updated: 2026-04-08
progress: "8/35 tasks complete (23%) — stalled since 2026-03-26"
created: 2026-03-18
module: infra
tags: [infra, production, alignment]
---

# Infrastructure Production Alignment Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the DigitalOcean Droplet, Supabase Cloud secrets, and Vercel env vars so production works identically to development — fix scrapling 401s, stage-engine crash loop, hardcoded localhost URLs, and missing environment variables.

**Architecture:** Three environments must be consistent: (1) DO Droplet runs Docker services behind Caddy, (2) Supabase Cloud runs Edge Functions, (3) Vercel runs Next.js apps. Each needs correct env vars pointing at the others. The Droplet code is 20 commits behind and has uncommitted changes that must be preserved or discarded.

**Tech Stack:** Docker Compose, Caddy, Supabase Edge Functions (Deno), Next.js (Vercel), 1Password, SSH

---

## Context for the Worker

### Current State (audited 2026-03-18)

**Droplet** (`164.92.176.42`, repo at `/opt/smartout/`):

- Branch: `development` at commit `a917d6a` — **20 commits behind `origin/development`**
- `infra/docker-compose.override.yml` deleted (renamed `.bak`) — correct for prod
- `services/contract-service/src/lib/placeholders.ts` has uncommitted changes (new template keys) — NOT in development, must preserve
- `services/scrapling/main.py` + `infra/docker-compose.yml` have uncommitted changes that are ALREADY in latest `development` (safe to overwrite)
- Stage Engine is **crash-looping**: `ERR_MODULE_NOT_FOUND: /app/packages/ai/dist/types` (Dockerfile missing `COPY scripts/ ./scripts/`)
- **Critical bug**: `docker-compose.yml` line 52 hardcodes `SUPABASE_URL=http://host.docker.internal:54321` for stage-engine — this is a localhost address that doesn't exist on the Droplet. `docker-compose.prod.yml` does NOT override it. Must be fixed.
- Scrapling is **healthy** but returning 401 to callers that don't send auth token

**Supabase Cloud** (project `yljaglomadbhyqpcigff` = `smartout-live`):

- Edge Function secrets: `SCRAPLING_SERVICE_URL` and `SCRAPLING_AUTH_TOKEN` ARE set — but token may not match Droplet
- Missing secrets: `OPENROUTER_API_KEY`, `SENDGRID_API_KEY`, `ULTRAVOX_API_KEY`, `WATCHDOG_CRON_SECRET`, `GOOGLE_VISION_API_KEY`, `STAGE_ENGINE_URL`
- Second project `hcmhwsewrcjmldjezaqk` ("SmartOut Production") exists but should NOT be used — consider pausing

**Vercel**: Two projects (web + landing). Must be set for production. Authoritative reference for all needed vars: `.env.template` (root).

**Next.js API routes on current `development`**: All 4 scrapling callers (`company`, `raw`, `public`, `generate-content`) correctly send `Authorization: Bearer` when `SCRAPLING_AUTH_TOKEN` is set. Two platform-admin routes (`lookup`, `analyze-documents`) do NOT send auth — code fixes needed.

### Supabase Projects

| Project               | Ref                    | Use                                            |
| --------------------- | ---------------------- | ---------------------------------------------- |
| `smartout-live`       | `yljaglomadbhyqpcigff` | **Active** — all production traffic            |
| `SmartOut Production` | `hcmhwsewrcjmldjezaqk` | **Do NOT use** — consider pausing to save cost |

### Service URLs (production)

| Service          | URL                                        |
| ---------------- | ------------------------------------------ |
| Stage Engine     | `https://engine.smartout.ai`               |
| Shift MCP        | `https://schedule-mcp.smartout.ai`         |
| Contract Service | `https://contract.smartout.ai`             |
| Scrapling        | `https://scrape.smartout.ai` (via Caddy)   |
| n8n              | `https://n8n.smartout.ai` (via Caddy)      |
| Supabase         | `https://yljaglomadbhyqpcigff.supabase.co` |

### Secrets Protocol

All secret values must come from 1Password via `op read 'op://smartout_ai/...'` at execution time. Never hardcode secret values in plan documents, worklogs, or code.

---

## Task 1: Fix Hardcoded Localhost SUPABASE_URL in Docker Compose

The base `docker-compose.yml` hardcodes `SUPABASE_URL=http://host.docker.internal:54321` for stage-engine (line 52). This is correct for local dev (where the override file also sets it), but in production the override is removed and `docker-compose.prod.yml` does NOT override this value. Stage Engine will try to connect to a non-existent local Supabase.

**Files:**

- Modify: `infra/docker-compose.yml:52`
- Modify: `infra/docker-compose.override.yml:17`

- [x] **Step 1: Change `docker-compose.yml` stage-engine SUPABASE_URL to use env var**

In `infra/docker-compose.yml`, line 52, change the hardcoded value to an env var substitution:

```yaml
# Before (line 52):
- SUPABASE_URL=http://host.docker.internal:54321
# After:
- SUPABASE_URL=${SUPABASE_URL:?SUPABASE_URL is required}
```

This makes it consistent with how `shift-mcp` and `contract-service` already handle it (lines 80 and 105).

- [x] **Step 2: Keep the dev override for local development**

Verify `infra/docker-compose.override.yml` still has the localhost value for dev:

```yaml
  stage-engine:
    ...
    environment:
      - SUPABASE_URL=http://host.docker.internal:54321
```

This file already has this on line 17. No change needed — just verify.

- [x] **Step 3: Verify typecheck / lint is not affected**

This is a YAML-only change. No code typecheck needed. Verify docker-compose config is valid:

```bash
cd infra && docker compose -f docker-compose.yml -f docker-compose.override.yml config --quiet && echo "OK"
```

Expected: `OK` (no errors)

- [x] **Step 4: Commit**

```bash
git add infra/docker-compose.yml
git commit -m "fix(infra): use env var for stage-engine SUPABASE_URL

The base docker-compose.yml hardcoded SUPABASE_URL to localhost for
stage-engine, causing it to connect to non-existent local Supabase
in production. Now uses env var substitution like shift-mcp and
contract-service already do. Dev override still sets localhost.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix Missing Auth in Platform-Admin API Routes

Two Next.js API routes call scrapling without sending the `Authorization` header. This causes 401s in production where `SCRAPLING_AUTH_TOKEN` is set.

**Important:** When adding auth headers to a `FormData` request, do NOT add a `Content-Type` header — `fetch` automatically sets `multipart/form-data` with the correct boundary when sending `FormData`. Adding it manually breaks the boundary.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts:105-121`
- Modify: `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts:68-76`

- [x] **Step 1: Fix `lookup/route.ts` — add auth header to scrapling call**

In `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts`, replace the `scrapeWebsite` function (lines 105-122):

```typescript
async function scrapeWebsite(url: string): Promise<{ email?: string; phone?: string } | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = process.env.SCRAPLING_AUTH_TOKEN;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${SCRAPLING_URL}/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url,
        config: { include_company_info: true },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { email: data?.email || undefined, phone: data?.phone || undefined };
  } catch {
    return null;
  }
}
```

- [x] **Step 2: Fix `analyze-documents/route.ts` — add auth header to scrapling call**

In `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts`, replace the fetch block around lines 68-76. Add auth headers but do NOT set Content-Type (FormData sets it automatically):

```typescript
const fetchHeaders: Record<string, string> = {};
const scraplingToken = process.env.SCRAPLING_AUTH_TOKEN;
if (scraplingToken) fetchHeaders["Authorization"] = `Bearer ${scraplingToken}`;

const res = await fetch(`${scraplingUrl}/extract/document`, {
  method: "POST",
  headers: fetchHeaders,
  body: formData,
});
```

- [x] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [x] **Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts
git commit -m "fix(scrape): add auth header to platform-admin scrapling calls

The lookup and analyze-documents routes called scrapling without
Authorization header, causing 401s in production where
SCRAPLING_AUTH_TOKEN is set.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Update Droplet — Pull Latest Code and Rebuild

The Droplet is 20 commits behind. The uncommitted `placeholders.ts` change is NOT in development and must be preserved. The other uncommitted changes (scrapling, docker-compose) are already in development.

**All steps run via SSH: `ssh root@164.92.176.42` — stay in the SSH session through Step 11.**

- [ ] **Step 1: Stash the contract-service changes**

```bash
cd /opt/smartout
git stash push -m "contract-service placeholder keys" -- services/contract-service/src/lib/placeholders.ts
```

Expected: `Saved working directory and index state...`

- [ ] **Step 2: Discard the other uncommitted changes (already in development)**

```bash
git checkout -- infra/docker-compose.yml services/scrapling/main.py
```

- [ ] **Step 3: Pull latest development (includes Task 1 + Task 2 commits)**

```bash
git pull origin development
```

Expected: `Updating a917d6a..<latest>` (20+ commits including the new fixes)

- [ ] **Step 4: Remove override.yml (prevents dev config from applying in prod)**

The file is tracked in git, so `git pull` restores it. Remove it immediately:

```bash
rm -f infra/docker-compose.override.yml
```

Verify: `ls infra/docker-compose.override.yml` should return "No such file or directory"

- [ ] **Step 5: Re-apply the contract-service placeholder changes**

```bash
git stash pop
```

Expected: `On branch development, Changes not staged for commit: services/contract-service/...`

If there are conflicts, resolve manually — the change adds new keys to `fieldMap` objects in `resolveWorkspaceField` and `resolveCompanyField`.

- [ ] **Step 6: Add missing env vars to `infra/.env`**

The Droplet `.env` is missing several vars that `docker-compose.yml` expects. The `SUPABASE_URL` is already set correctly. Add:

```bash
cat >> /opt/smartout/infra/.env << 'EOF'

# --- Added 2026-03-18 (prod alignment) ---
NODE_ENV=production
LOG_LEVEL=info
EOF
```

Verify `ENGINE_URL` is already set correctly:

```bash
grep ENGINE_URL /opt/smartout/infra/.env
```

Expected: `ENGINE_URL=https://engine.smartout.ai` — if missing, add it.

- [ ] **Step 7: Rebuild all containers**

```bash
cd /opt/smartout/infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Expected: All 6 containers rebuild and start. Stage Engine should no longer crash-loop.

- [ ] **Step 8: Wait and verify all services are healthy**

```bash
sleep 20
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Expected: All containers show `Up ... (healthy)` — especially `stage-engine` (should NOT show `Restarting`).

- [ ] **Step 9: Run health check script**

```bash
bash /opt/smartout/infra/scripts/health-check.sh
```

Expected: `All services healthy.`

- [ ] **Step 10: Verify Stage Engine connects to Supabase Cloud (not localhost)**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec stage-engine env | grep SUPABASE_URL
```

Expected: `SUPABASE_URL=https://yljaglomadbhyqpcigff.supabase.co` — NOT `http://host.docker.internal:54321`

- [ ] **Step 11: Clean up Docker disk (optional, reclaims ~30GB)**

```bash
docker system prune -f --volumes=false
docker builder prune -f
```

---

## Task 4: Align Supabase Edge Function Secrets

Edge Functions on `smartout-live` need correct secrets to reach the Droplet services. The `SCRAPLING_AUTH_TOKEN` may be stale. Several secrets are missing entirely.

**All steps run from local machine using Supabase CLI.**

- [ ] **Step 1: Re-set SCRAPLING_AUTH_TOKEN to match Droplet**

We can't read the current secret value (only its digest). Re-set it from 1Password to guarantee it matches:

```bash
npx supabase secrets set SCRAPLING_AUTH_TOKEN="$(op read 'op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN')" --project-ref yljaglomadbhyqpcigff
```

- [ ] **Step 2: Set SCRAPLING_SERVICE_URL to Caddy-fronted URL**

Edge Functions call from Supabase Cloud over the internet:

```bash
npx supabase secrets set SCRAPLING_SERVICE_URL=https://scrape.smartout.ai --project-ref yljaglomadbhyqpcigff
```

- [ ] **Step 3: Set missing secrets**

These are needed by various Edge Functions. All values from 1Password:

```bash
# OpenRouter (used by analyze-setup-documents, web-search-intelligence)
npx supabase secrets set OPENROUTER_API_KEY="$(op read 'op://smartout_ai/OpenRouter/api_key')" --project-ref yljaglomadbhyqpcigff

# Stage Engine URL (used by functions that call the engine)
npx supabase secrets set STAGE_ENGINE_URL=https://engine.smartout.ai --project-ref yljaglomadbhyqpcigff

# Ultravox (voice functions)
npx supabase secrets set ULTRAVOX_API_KEY="$(op read 'op://smartout_ai/Ultravox/api_key')" --project-ref yljaglomadbhyqpcigff

# SendGrid (notification functions)
npx supabase secrets set SENDGRID_API_KEY="$(op read 'op://smartout_ai/SendGrid/api_key')" --project-ref yljaglomadbhyqpcigff

# Watchdog cron secret
npx supabase secrets set WATCHDOG_CRON_SECRET="$(op read 'op://smartout_ai/SmartOut/watchdog_cron_secret')" --project-ref yljaglomadbhyqpcigff

# Google Vision (settlement image processing)
# NOTE: Verify the correct 1Password path — GOOGLE_VISION_API_KEY may differ from GOOGLE_API_KEY
npx supabase secrets set GOOGLE_VISION_API_KEY="$(op read 'op://smartout_ai/Google/api_key')" --project-ref yljaglomadbhyqpcigff
```

- [ ] **Step 4: Verify all secrets are set**

```bash
npx supabase secrets list --project-ref yljaglomadbhyqpcigff
```

Expected names in the list:

- `SCRAPLING_AUTH_TOKEN`, `SCRAPLING_SERVICE_URL`
- `OPENROUTER_API_KEY`, `STAGE_ENGINE_URL`, `ULTRAVOX_API_KEY`
- `SENDGRID_API_KEY`, `WATCHDOG_CRON_SECRET`, `GOOGLE_VISION_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (already set)
- `SERPER_API_KEY`, `GOOGLE_API_KEY`, `CONTRACT_SERVICE_KEY` (already set)

---

## Task 5: Set Vercel Environment Variables

Both Vercel projects need env vars pointing at Supabase Cloud (`smartout-live`) and the Droplet services.

**Authoritative reference:** `.env.template` (root) contains every variable. Cross-check against `apps/web/src/env.ts` and `apps/landing/src/env.ts` for what each app actually uses.

**Prerequisite:** Log in to Vercel CLI: `vercel login`

### 5A: Smartout Web (`apps/web`)

- [ ] **Step 1: Set client-side (public) vars for Production**

```bash
# Supabase Cloud (smartout-live)
echo "https://yljaglomadbhyqpcigff.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
op read 'op://smartout_ai/Supabase/anon_key' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# Domain config
echo "smartout.ai" | vercel env add NEXT_PUBLIC_ROOT_DOMAIN production
echo "https://smartout.ai" | vercel env add NEXT_PUBLIC_LANDING_URL production
echo "https://engine.smartout.ai" | vercel env add NEXT_PUBLIC_STAGE_ENGINE_URL production

# Analytics / Monitoring
op read 'op://smartout_ai/PostHog/api_key' | vercel env add NEXT_PUBLIC_POSTHOG_KEY production
echo "https://eu.i.posthog.com" | vercel env add NEXT_PUBLIC_POSTHOG_HOST production
op read 'op://smartout_ai/Sentry/dsn' | vercel env add NEXT_PUBLIC_SENTRY_DSN production
```

- [ ] **Step 2: Set server-side vars for Production**

```bash
# Supabase
op read 'op://smartout_ai/Supabase/service_role_key' | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Scrapling (Droplet via Caddy)
echo "https://scrape.smartout.ai" | vercel env add SCRAPLING_SERVICE_URL production
op read 'op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN' | vercel env add SCRAPLING_AUTH_TOKEN production

# Stage Engine
echo "https://engine.smartout.ai" | vercel env add STAGE_ENGINE_URL production
op read 'op://smartout_ai/Stage-Engine/api_key' | vercel env add STAGE_ENGINE_API_KEY production

# Contract Service
echo "https://contract.smartout.ai" | vercel env add CONTRACT_SERVICE_URL production
op read 'op://smartout_ai/Contract-Service/api_key' | vercel env add CONTRACT_SERVICE_KEY production

# Shift MCP
echo "https://schedule-mcp.smartout.ai" | vercel env add SHIFT_MCP_URL production

# Stripe (LIVE keys for production)
op read 'op://smartout_ai/Stripe/secret_key' | vercel env add STRIPE_SECRET_KEY production
op read 'op://smartout_ai/Stripe/webhook_secret' | vercel env add STRIPE_WEBHOOK_SECRET production

# AI / Email / SMS
op read 'op://smartout_ai/OpenRouter/api_key' | vercel env add OPENROUTER_API_KEY production
op read 'op://smartout_ai/SendGrid/api_key' | vercel env add SENDGRID_API_KEY production
op read 'op://smartout_ai/Twilio/account_sid' | vercel env add TWILIO_ACCOUNT_SID production
op read 'op://smartout_ai/Twilio/auth_token' | vercel env add TWILIO_AUTH_TOKEN production

# Cache
op read 'op://smartout_ai/Upstash/rest_url' | vercel env add UPSTASH_REDIS_REST_URL production
op read 'op://smartout_ai/Upstash/rest_token' | vercel env add UPSTASH_REDIS_REST_TOKEN production

# Sentry (server-side)
op read 'op://smartout_ai/Sentry/auth_token' | vercel env add SENTRY_AUTH_TOKEN production
op read 'op://smartout_ai/Sentry/dsn' | vercel env add SENTRY_DSN production

# ISR Revalidation
op read 'op://smartout_ai/SmartOut/revalidation_secret' | vercel env add NEXT_PUBLIC_REVALIDATION_SECRET production

# DocuSeal webhooks (hit Next.js, not contract-service)
op read 'op://smartout_ai/DocuSeal/webhook_secret' | vercel env add DOCUSEAL_WEBHOOK_SECRET production
```

- [ ] **Step 3: Set Preview environment vars**

Same as production except Stripe uses test keys and NODE_ENV can stay default:

```bash
# Copy all the same vars for preview scope, but override Stripe:
op read 'op://smartout_ai/Stripe/test_secret_key' | vercel env add STRIPE_SECRET_KEY preview
```

For all other vars, use Vercel dashboard to scope them to `production,preview` or repeat the commands with `preview`.

### 5B: Smartout Landing (`apps/landing`)

- [ ] **Step 4: Set landing vars for Production**

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

- [ ] **Step 5: Verify Vercel env vars are complete**

```bash
vercel env ls --environment production
```

Cross-check both projects against `.env.template` and the respective `env.ts` files.

---

## Task 6: End-to-End Verification

After Tasks 1-5 are complete, verify the full chain works.

- [ ] **Step 1: Test scrapling directly on Droplet**

```bash
ssh root@164.92.176.42 "curl -s -X POST http://localhost:8000/extract \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer \$(grep SCRAPLING_AUTH_TOKEN /opt/smartout/infra/.env | cut -d= -f2)' \
  -d '{\"url\": \"smartout.ai\"}' | python3 -m json.tool | head -5"
```

Expected: 200 with `companyName` in response.

- [ ] **Step 2: Test scrapling through Caddy (HTTPS)**

```bash
curl -s -X POST https://scrape.smartout.ai/health
```

Expected: 200 with `{"status": "healthy", ...}`

- [ ] **Step 3: Test Stage Engine health**

```bash
curl -s https://engine.smartout.ai/health
```

Expected: `{"status": "healthy", ...}` (proves stage-engine no longer crash-loops)

- [ ] **Step 4: Verify Stage Engine uses Supabase Cloud**

```bash
ssh root@164.92.176.42 "cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec stage-engine env | grep SUPABASE_URL"
```

Expected: `SUPABASE_URL=https://yljaglomadbhyqpcigff.supabase.co`

- [ ] **Step 5: Test Edge Function → Scrapling chain**

```bash
curl -s -X POST https://yljaglomadbhyqpcigff.supabase.co/functions/v1/scrape-website \
  -H "Authorization: Bearer $(op read 'op://smartout_ai/Supabase/anon_key')" \
  -H 'Content-Type: application/json' \
  -d '{"url": "smartout.ai"}' | head -10
```

Expected: 200 with scraped data (proves EF → Caddy → Scrapling chain with auth).

- [ ] **Step 6: Check Droplet logs for 401s**

```bash
ssh root@164.92.176.42 "cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 scrapling 2>&1 | grep -v health"
```

Expected: No new 401 Unauthorized entries after the fixes.

- [ ] **Step 7: Verify the unused Supabase project**

Confirm `hcmhwsewrcjmldjezaqk` (SmartOut Production) is not referenced anywhere in production code:

```bash
grep -r "hcmhwsewrcjmldjezaqk" apps/ packages/ services/ supabase/ infra/ --include="*.ts" --include="*.tsx" --include="*.env*" --include="*.yml"
```

Expected: No matches. If confirmed unused, pause it in Supabase dashboard to save cost.

---

## Reference: Complete Environment Variable Map

### Development (local)

| Variable                   | Source                 | Value                             |
| -------------------------- | ---------------------- | --------------------------------- |
| `SUPABASE_URL`             | `npx supabase status`  | `http://127.0.0.1:54321`          |
| `NEXT_PUBLIC_SUPABASE_URL` | Same                   | `http://127.0.0.1:54321`          |
| All secrets                | 1Password              | `op run --env-file=.env.template` |
| `SCRAPLING_SERVICE_URL`    | Local Docker or direct | `http://localhost:8000`           |
| `STAGE_ENGINE_URL`         | Local Docker           | `http://localhost:5010`           |
| All service URLs           | Local ports            | `localhost:XXXX`                  |

### Production

| Variable                        | Droplet `.env`                             | Supabase Secrets             | Vercel Web                                 | Vercel Landing                             |
| ------------------------------- | ------------------------------------------ | ---------------------------- | ------------------------------------------ | ------------------------------------------ |
| `SUPABASE_URL`                  | `https://yljaglomadbhyqpcigff.supabase.co` | Auto-set                     | —                                          | —                                          |
| `NEXT_PUBLIC_SUPABASE_URL`      | —                                          | —                            | `https://yljaglomadbhyqpcigff.supabase.co` | `https://yljaglomadbhyqpcigff.supabase.co` |
| `SUPABASE_ANON_KEY`             | Set (from 1Password)                       | Auto-set                     | —                                          | —                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | —                                          | —                            | Set (from 1Password)                       | Set (from 1Password)                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Set (from 1Password)                       | Auto-set                     | Set (from 1Password)                       | —                                          |
| `SCRAPLING_SERVICE_URL`         | —                                          | `https://scrape.smartout.ai` | `https://scrape.smartout.ai`               | —                                          |
| `SCRAPLING_AUTH_TOKEN`          | Set (from 1Password)                       | Must match Droplet           | Must match Droplet                         | —                                          |
| `STAGE_ENGINE_URL`              | `https://engine.smartout.ai`               | `https://engine.smartout.ai` | `https://engine.smartout.ai`               | `https://engine.smartout.ai`               |
| `ENGINE_URL`                    | `https://engine.smartout.ai`               | —                            | —                                          | —                                          |
| `OPENROUTER_API_KEY`            | Set (from 1Password)                       | Must be set                  | Set (from 1Password)                       | —                                          |
| `NODE_ENV`                      | `production`                               | —                            | Auto (`production`)                        | Auto (`production`)                        |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | —                                          | —                            | `smartout.ai`                              | —                                          |
| `NEXT_PUBLIC_WEB_APP_URL`       | —                                          | —                            | —                                          | `https://app.smartout.ai`                  |
| `APP_URL`                       | `https://app.smartout.ai`                  | —                            | —                                          | —                                          |
| `STRIPE_SECRET_KEY`             | —                                          | —                            | `sk_live_...` (from 1Password)             | —                                          |
| `SENDGRID_API_KEY`              | —                                          | Must be set                  | Set (from 1Password)                       | —                                          |
| `SENTRY_DSN`                    | —                                          | —                            | Set (from 1Password)                       | —                                          |
| `UPSTASH_REDIS_REST_URL`        | —                                          | —                            | Set (from 1Password)                       | —                                          |

---

## Council Review (2026-03-26)

**Verdict:** APPROVED_WITH_CONDITIONS
**Reviewer:** Plan Audit Council

**Issues found:**

- **Missing YAML frontmatter** — All docs in `docs/` MUST have frontmatter (`title`, `status`, `updated`, `created`, `module`, `tags`). This plan has none. Violates CLAUDE.md mandatory requirement.
- **Task 1 already done** — `infra/docker-compose.yml` line 50 already uses `SUPABASE_URL=${SUPABASE_URL}` (env var substitution). The hardcoded `http://host.docker.internal:54321` the plan describes does NOT exist in the current codebase. This fix was already merged to `development`.
- **Task 2 already done** — Both `lookup/route.ts` (lines 107-109) and `analyze-documents/route.ts` (lines 73-75) already have the conditional `Authorization: Bearer` header using `process.env.SCRAPLING_AUTH_TOKEN`. These fixes are already in `development`.
- **Task 5 Step 3 (Preview scope) is incomplete** — The plan says "repeat the commands with `preview`" for non-Stripe vars but gives no concrete commands. An executor could skip this entirely.
- **`docker-compose.override.yml` survives `git pull`** — Task 3 Step 4 correctly addresses this (rm -f after pull), but the plan should note that `docker-compose.override.yml` is tracked in git and will return on every pull. Production deployment must always include this rm step in the runbook.

**Recommendations:**

- Add YAML frontmatter before implementation begins (status: `in_progress`, module: `infra`)
- Skip Tasks 1 and 2 code changes entirely — they are already in `development`. Task 3 Step 3 (`git pull`) will pull them to the Droplet automatically.
- For Task 5 Step 3, explicitly list all vars that need `preview` scope or link to the Vercel dashboard URL for bulk scoping.
- Consider adding a permanent note to the production deployment runbook: always `rm -f infra/docker-compose.override.yml` after any `git pull` on the Droplet.
- The two Supabase project situation (`hcmhwsewrcjmldjezaqk`) should be addressed promptly — Task 6 Step 7 covers verification, but pausing the unused project should be an explicit action item with a deadline.

**Security check:** PASSED — all secrets use `op read 'op://...'` references, no hardcoded values, no secrets in plan body. 1Password paths look correct. Supabase project ref `yljaglomadbhyqpcigff` is a non-secret identifier (safe to document).

**Scope check:** PASSED — realistic scope, well-bounded, clear done criteria for each step.

**Overall:** The plan is structurally sound and safe to execute. Tasks 3–6 are the remaining work. The executor should begin at Task 3 (Droplet update) and can skip the code changes in Tasks 1 and 2 since they are already merged.
