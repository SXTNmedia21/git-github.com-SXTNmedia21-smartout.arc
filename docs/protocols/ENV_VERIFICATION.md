---
title: Environment Variable Consistency Verification
status: done
updated: 2026-03-23
created: 2026-03-23
module: infrastructure
tags: [environment, verification, deployment]
---

# Environment Variable Verification Report

**Date:** 2026-03-23
**Branch:** development
**Verified by:** env-checker agent

---

## Summary

✅ **Status: CONSISTENT** — No critical mismatches found.

- **op:// references in .env.template:** 67 (CONFIRMED — accurate)
- **Server vars validated in env.ts:** 23 unique
- **Docker services using vars:** 23 unique
- **Vercel CI compatibility:** ✅ All server secrets use `.optional()`
- **Critical issues:** None

---

## Detailed Findings

### 1. env.ts Server Validation (23 vars)

All server-side secrets use `.optional()` — **Vercel CI compatible** ✅

**Validated secrets:**

- DATABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SENDGRID_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- JWT_SECRET (min 32)
- SESSION_SECRET (min 32)
- OPENROUTER_API_KEY (min 1)
- UPSTASH_REDIS_REST_URL (url)
- UPSTASH_REDIS_REST_TOKEN
- SENTRY_DSN (url)
- DOCUSEAL_WEBHOOK_SECRET
- ULTRAVOX_API_KEY
- CONTRACT_SERVICE_URL (url)
- CONTRACT_SERVICE_KEY (min 16)
- SCRAPLING_SERVICE_URL (url)
- SCRAPLING_AUTH_TOKEN (min 1)
- SERPER_API_KEY (min 1)
- SHIFT_MCP_URL (url)
- STAGE_ENGINE_URL (url)
- STAGE_ENGINE_API_KEY (min 16)

✅ **All validators use `.optional()` — no Vercel CI breakage risk**

### 2. docker-compose.yml Env Vars (23 unique)

All vars used in services exist in .env.template.

**Service coverage:**

- `caddy` — (no env vars)
- `stage-engine` — ENGINE*URL, STAGE_ENGINE_API_KEY, ULTRAVOX_API_KEY, OPENROUTER_API_KEY, LOG_LEVEL, SESSION_EXPIRY_HOURS, CLEANUP_INTERVAL_MINUTES, SUPABASE*\*
- `shift-mcp` — SUPABASE\_\* (no new vars)
- `contract-service` — CONTRACT*SERVICE_KEY, SUPABASE*\_, DOCUSEAL\_\_, SMARTOUT\_\*, APP_URL
- `scrapling` — SCRAPLING_AUTH_TOKEN, OPENROUTER_API_KEY, SERPER_API_KEY
- `n8n` — N8N_HOST, N8N_BASIC_AUTH_USER, N8N_BASIC_AUTH_PASSWORD, N8N_ENCRYPTION_KEY, N8N_WEBHOOK_URL, GENERIC_TIMEZONE

✅ **All docker-compose vars exist in .env.template**

### 3. Cross-Reference Analysis

**Intentional separations:**

Vars in `.env.template` but NOT in `env.ts` server block:

- Client-side (NEXT*PUBLIC*_, EXPO*PUBLIC*_) — validated separately in env.ts
- Docker-only (N8N*\*, DOCUSEAL_API_URL, SMARTOUT*\*, GENERIC_TIMEZONE) — not needed by web app
- Database bootstrap (SUPABASE_URL, SUPABASE_ANON_KEY) — client-side equivalents exist

Vars in `env.ts` but NOT in `docker-compose.yml`:

- Edge Function URLs (CONTRACT_SERVICE_URL, SHIFT_MCP_URL) — web app only
- Email/SMS (SENDGRID\_\*) — Edge Functions only
- N8N configuration — docker service, not web app

✅ **This is expected — each layer has its own scope**

### 4. Recent Commits

No new env vars added in recent commits:

- `35e71f82` — relaxed env validation (added SKIP_ENV_VALIDATION)
- `1c6663b4` — no env var changes

✅ **No pending env var additions**

---

## Learnings

- **CONFIRMED** — 67 op:// references is accurate (current state matches deploy requirements)
- **NEW** — All validators use `.optional()` — system is Vercel CI compatible, no changes needed
- **CONFIRMED** — Contract and Shift MCP services use Edge Function URLs (deliberately not in docker)
- **CONFIRMED** — Env var separation is intentional: web app layer (env.ts) vs infrastructure layer (docker-compose)

---

## Actions Required

**None.** Environment variables are consistent across all three verification points.

### For Production Deployment to Vercel:

1. Ensure all 67 op:// secrets are configured in Vercel dashboard (project settings → Environment Variables)
2. Verify `SKIP_ENV_VALIDATION=false` in production (stricter validation than development)
3. Confirm `NODE_ENV=production`

### For Infrastructure Deployment:

1. All docker-compose service vars are sourced from .env.template via `op run`
2. Use `op run --env-file=.env.template -- docker compose up` to inject secrets
3. N8N service uses reasonable defaults (e.g., DOCUSEAL_API_URL defaults to https://api.docuseal.com)
