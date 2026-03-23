---
title: "Handoff — Infrastructure Production Alignment"
status: in_progress
updated: 2026-03-18
created: 2026-03-18
module: infrastructure
tags: [handoff, deployment, testing]
---

# Handoff — dev-prod-fix

> Continue from here after deploying to production.

---

## What was done (2026-03-18)

### Code changes (on `development`)

1. **Auth headers added** to 3 platform-admin routes that call scrapling:
   - `apps/web/src/app/api/platform-admin/workspaces/lookup/route.ts`
   - `apps/web/src/app/api/platform-admin/workspaces/analyze-documents/route.ts`
   - `apps/web/src/app/api/platform-admin/services/test/route.ts`
2. Commits: `fc1e1f6f` + `7a798ea7` (merged to development)

### Droplet (LIVE)

- Pulled latest `development` (20+ commits)
- Rebuilt all 6 containers — all healthy
- Stage Engine no longer crash-looping (was `ERR_MODULE_NOT_FOUND`)
- Stage Engine now connects to Supabase Cloud (was hardcoded localhost)
- Added `NODE_ENV=production` and `LOG_LEVEL=info` to `.env`
- Contract-service stash dropped (superseded by development)
- Docker cleanup reclaimed 19.14GB

### Supabase Cloud secrets (LIVE)

Set on `yljaglomadbhyqpcigff`:

- `SCRAPLING_AUTH_TOKEN` (re-synced from 1Password)
- `SCRAPLING_SERVICE_URL` = `https://scrape.smartout.ai`
- `OPENROUTER_API_KEY`
- `STAGE_ENGINE_URL` = `https://engine.smartout.ai`
- `ULTRAVOX_API_KEY`
- `SENDGRID_API_KEY`
- `WATCHDOG_CRON_SECRET`
- `GOOGLE_VISION_API_KEY`

### Vercel env vars (SET, need deploy to activate)

**smartout-web** — 12 vars added for production:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `DOCUSEAL_WEBHOOK_SECRET`
- `SHIFT_MCP_URL`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_STAGE_ENGINE_URL`
- `NEXT_PUBLIC_REVALIDATION_SECRET`

**smartout-landing** — 2 vars added:

- `NEXT_PUBLIC_WEB_APP_URL` = `https://app.smartout.ai`
- `NEXT_PUBLIC_LANDING_VARIANT` = `T`

---

## What's NOT done yet

### Deploy to production

The code changes (auth headers) are on `development` only. To get them live on Vercel:

1. Merge `development` → `main`
2. Vercel auto-deploys from `main`
3. New env vars activate on the new deployment

⚠️ **Only Pontus merges to main.** This is a hard rule.

### Manual testing (after deploy)

Run the test journeys in `docs/journeys/MANUAL-TEST-dev-prod-fix.md`:

**Priority order:**

1. **Journey 8** — Comprehensive health check (`/platform-admin` → health/status). Tests ~15 env vars in one call.
2. **Journey 3** — Service health dashboard. Visual check all Droplet services are reachable.
3. **Journey 1** — Onboarding scrape flow. Tests the original 401 bug (scrapling auth).
4. **Journey 5** — Landing → App flow. Tests cross-app URLs.
5. **Journey 2** — Document analysis (scrapling + OpenRouter).
6. **Journey 4** — Stage Engine chat (AI agent, no crash-loop).
7. **Journey 6** — Stripe billing.
8. **Journey 7** — Contract generation.
9. **Journey 9** — Landing voice wizard.

### Remaining items

- [ ] Pause unused Supabase project `hcmhwsewrcjmldjezaqk` (dashboard, saves cost)
- [ ] Set Stripe test key for Vercel preview (1Password field `test_secret_key` doesn't exist — check actual field name)
- [ ] Deploy `scrape-website` Edge Function (only `scrape-raw-data` is deployed)
- [ ] Fix 1Password field: `op://smartout_ai/Supabase/anon_key` returns `sb_publishable_` key, not the `eyJ...` JWT anon key

---

## Smoke test results (2026-03-18, pre-deploy)

All 8 passed:

- Scrapling health ✅
- Stage Engine health ✅ (no more crash-loop!)
- Contract Service health ✅
- Shift MCP health ✅
- Supabase Cloud ✅ (with correct anon key)
- Vercel Web ✅ (307 → login)
- Vercel Landing ✅ (200)
- Scrapling auth ✅ (returned VG company data)

---

## Key files

- Test plan: `docs/journeys/MANUAL-TEST-dev-prod-fix.md`
- Worklog: `docs/worklogs/WORKLOG-dev-prod-fix.md`
- Original plan: Located in main repo `docs/superpowers/plans/2026-03-18-infra-prod-alignment.md`
- Branch: `feat/dev-prod-fix` (merged to `development`)
