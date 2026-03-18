---
title: "Manual Test — Infrastructure Production Alignment"
status: in_progress
updated: 2026-03-18
created: 2026-03-18
module: infrastructure
tags: [testing, production, infrastructure, secrets]
---

# Manual Test — dev-prod-fix

> Tests that all services, secrets, and environment variables are correctly aligned across Development (local), Droplet (Docker), Supabase Cloud (Edge Functions), and Vercel (Next.js apps).

---

## Environment Legend

| Env | Description |
|-----|-------------|
| **LOCAL** | Your local dev machine (`pnpm dev:local` or `op run`) |
| **DROPLET** | DigitalOcean `164.92.176.42`, Docker services behind Caddy |
| **SUPABASE** | `yljaglomadbhyqpcigff.supabase.co` (Edge Functions) |
| **VERCEL** | `app.smartout.ai` (web) / `smartout.ai` (landing) |

---

## Journey 1: Onboarding Scrape Flow (Scrapling + Supabase + Vercel)

**What it tests:** Scrapling auth token, Caddy proxy, Edge Function secrets, Vercel → Droplet chain

**Precondition:** Logged in as admin with a workspace. Supabase Cloud running. Droplet containers healthy.

### Step 1: Admin opens onboarding wizard
1. Go to `https://app.smartout.ai/dashboard/onboarding` (or `/join` for new workspace)
2. **Expected:** Page loads without errors. No 500 in browser console.
3. **Tests:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel → Supabase auth)

### Step 2: Enter company org number in wizard
1. Enter a known Norwegian org number (e.g. `932 953 820`)
2. Wait for Brreg lookup + scrape enrichment
3. **Expected:** Company name, address, and contact info populate. No 401 errors in browser Network tab.
4. **Tests:** `api/platform-admin/workspaces/lookup` → Brreg API + `SCRAPLING_AUTH_TOKEN` → scrapling `/extract`

### Step 3: Verify enrichment data
1. Check that email/phone fields populated (if available on company website)
2. **Expected:** Data from Brreg + scraped website data combined
3. **Tests:** Scrapling auth works end-to-end (Vercel → Droplet via `SCRAPLING_SERVICE_URL`)

---

## Journey 2: Document Analysis (Scrapling + OpenRouter + Vercel)

**What it tests:** Scrapling document extraction, OpenRouter AI, auth headers on FormData

**Precondition:** Logged in as godmode admin. Have a PDF or DOCX document ready.

### Step 1: Open platform admin → workspace detail
1. Go to `https://app.smartout.ai/platform-admin`
2. Select any workspace
3. Navigate to document analysis section

### Step 2: Upload a document for analysis
1. Upload a Norwegian business document (PDF, DOCX)
2. Wait for processing
3. **Expected:** Document is processed → structured data returned (policies, employees, shift patterns, etc.)
4. **Tests:** `api/platform-admin/workspaces/analyze-documents` → `SCRAPLING_AUTH_TOKEN` (FormData, no Content-Type override) → `OPENROUTER_API_KEY`

### Step 3: Check for errors
1. Open browser DevTools → Network
2. Filter for `analyze-documents`
3. **Expected:** 200 response. No 401 from scrapling, no 502 from OpenRouter.

---

## Journey 3: Service Health Dashboard (All Droplet services)

**What it tests:** All 4 Droplet services reachable from Vercel, auth headers correct

**Precondition:** Logged in as godmode admin.

### Step 1: Open platform admin → services
1. Go to `https://app.smartout.ai/platform-admin/services`
2. **Expected:** Dashboard loads showing all service statuses

### Step 2: Verify all services show "healthy"
1. Check each service card:
   - **Stage Engine** → `https://engine.smartout.ai/health` → `status: ok`
   - **Shift MCP** → `https://schedule-mcp.smartout.ai/health` → should respond
   - **Contract Service** → `https://contract.smartout.ai/health` → should respond
   - **Scrapling** → `https://scrape.smartout.ai/health` → `status: healthy`
2. **Expected:** All green/operational
3. **Tests:** `STAGE_ENGINE_URL`, `SHIFT_MCP_URL`, `CONTRACT_SERVICE_URL`, `SCRAPLING_SERVICE_URL`

### Step 3: Test scrapling from service tester
1. In the service tester, select "scrapling"
2. POST to `/extract` with body `{"url": "smartout.ai"}`
3. **Expected:** 200 with company data (NOT 401)
4. **Tests:** `SCRAPLING_AUTH_TOKEN` in `api/platform-admin/services/test` route

---

## Journey 4: Stage Engine Chat (Stage Engine + Supabase + Vercel)

**What it tests:** Stage Engine no longer crash-looping, connects to Supabase Cloud, API key auth

**Precondition:** Logged in as employee or admin. Stage Engine containers healthy on Droplet.

### Step 1: Open an AI chat session
1. Go to `https://app.smartout.ai/dashboard` (or any page with AI chat)
2. Click the AI assistant / chat widget
3. **Expected:** Chat loads, connection established (no timeouts)
4. **Tests:** `NEXT_PUBLIC_STAGE_ENGINE_URL` (client-side WebSocket/HTTP), `STAGE_ENGINE_API_KEY`

### Step 2: Send a message
1. Type "Hei, hva kan du hjelpe meg med?"
2. Wait for response
3. **Expected:** AI responds. No connection errors. No "service unavailable".
4. **Tests:** Stage Engine → `SUPABASE_URL` (reads workspace/profile data), `OPENROUTER_API_KEY` (AI completion)

### Step 3: Verify no crash-loop (Droplet)
1. SSH: `ssh root@164.92.176.42`
2. Run: `cd /opt/smartout/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml ps | grep stage-engine`
3. **Expected:** `Up X minutes (healthy)` — NOT `Restarting`
4. Run: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 stage-engine | grep -i error`
5. **Expected:** No `ERR_MODULE_NOT_FOUND` errors

---

## Journey 5: Landing Page → App Flow (Vercel Landing + Vercel Web + Supabase)

**What it tests:** Landing env vars, cross-app URLs, Supabase auth from both apps

**Precondition:** Use incognito browser.

### Step 1: Visit landing page
1. Go to `https://smartout.ai`
2. **Expected:** Page loads, no errors. PostHog tracking fires (check Network for `eu.i.posthog.com`).
3. **Tests:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_LANDING_VARIANT`

### Step 2: Click "Kom i gang" / registration CTA
1. Click the main CTA button
2. **Expected:** Redirects to `https://app.smartout.ai/login` or `/join`
3. **Tests:** `NEXT_PUBLIC_WEB_APP_URL` on landing → correct cross-app URL

### Step 3: Log in / register
1. Use Google OAuth or email/password
2. **Expected:** Auth works, redirects to dashboard
3. **Tests:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both apps)

---

## Journey 6: Stripe Billing (Vercel + Stripe)

**What it tests:** Stripe live keys on Vercel production

**Precondition:** Admin with active workspace. Stripe customer exists.

### Step 1: Open billing page
1. Go to `https://app.smartout.ai/dashboard/settings/billing`
2. **Expected:** Current plan and billing info loads
3. **Tests:** `STRIPE_SECRET_KEY` (server-side Stripe API call)

### Step 2: Manage subscription
1. Click "Administrer abonnement" or similar
2. **Expected:** Redirects to Stripe Customer Portal (not error page)
3. **Tests:** `STRIPE_SECRET_KEY` creates portal session

---

## Journey 7: Contract Generation (Contract Service + DocuSeal)

**What it tests:** Contract service on Droplet, DocuSeal integration, Vercel → Droplet chain

**Precondition:** Admin with workspace. Contract template exists.

### Step 1: Create a contract
1. Go to contract management in dashboard
2. Start a new contract for an employee
3. **Expected:** Template loads with placeholder fields populated
4. **Tests:** `CONTRACT_SERVICE_URL`, `CONTRACT_SERVICE_KEY`

### Step 2: Send contract for signing
1. Fill in required fields and send
2. **Expected:** DocuSeal signing link generated
3. **Tests:** Contract service → DocuSeal API (keys on Droplet .env)

---

## Journey 8: Comprehensive Health Check (ALL External Services)

**What it tests:** Stripe, SendGrid, Twilio, DocuSeal, PostHog, Sentry, Upstash Redis, OpenRouter — ALL in one call

**Precondition:** Logged in as godmode admin.

### Step 1: Call the comprehensive health endpoint
1. Go to `https://app.smartout.ai/platform-admin` → health/status section
2. Or via curl:
   ```bash
   curl -s https://app.smartout.ai/api/platform-admin/health/status \
     -H "Cookie: <your-session-cookie>" | jq .
   ```
3. **Expected:** JSON with status for every external service
4. **Tests:** `STRIPE_SECRET_KEY`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OPENROUTER_API_KEY`, `SENTRY_DSN`, all Droplet service URLs

### Step 2: Verify each service section
1. Check each service shows `operational` or `ok`
2. Any `down` or `degraded` → indicates a missing/wrong env var
3. **This single endpoint validates ~15 environment variables at once**

---

## Journey 9: Landing Voice Wizard (Landing → Stage Engine)

**What it tests:** Landing app → Stage Engine → Ultravox voice chain

**Precondition:** Landing page deployed. Stage Engine healthy.

### Step 1: Open landing page wizard
1. Go to `https://smartout.ai`
2. Start the interactive voice demo/wizard
3. **Expected:** Voice session initiates
4. **Tests:** Landing `STAGE_ENGINE_URL` + `STAGE_ENGINE_API_KEY` → `/adapters/ultravox/create-call`

---

## Smoke Tests (Quick CLI Verification)

Run these from your local terminal to quickly verify infrastructure without UI:

```bash
# 1. Scrapling health (Caddy → Scrapling)
curl -s https://scrape.smartout.ai/health | jq .status
# Expected: "healthy"

# 2. Stage Engine health (Caddy → Stage Engine)
curl -s https://engine.smartout.ai/health | jq .status
# Expected: "ok"

# 3. Contract Service health
curl -s https://contract.smartout.ai/health | jq .status
# Expected: "ok" or similar

# 4. Shift MCP health
curl -s https://schedule-mcp.smartout.ai/health | jq .status
# Expected: "ok" or similar

# 5. Supabase Cloud reachable
curl -s https://yljaglomadbhyqpcigff.supabase.co/rest/v1/ \
  -H "apikey: $(op read 'op://smartout_ai/Supabase/anon_key')" | head -5
# Expected: JSON response (not error)

# 6. Vercel Web responds
curl -sI https://app.smartout.ai | head -3
# Expected: HTTP/2 200

# 7. Vercel Landing responds
curl -sI https://smartout.ai | head -3
# Expected: HTTP/2 200

# 8. Scrapling with auth (Caddy → Scrapling, proves auth token works)
curl -s -X POST https://scrape.smartout.ai/extract \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $(op read 'op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN')" \
  -d '{"url": "vg.no"}' | jq .companyName
# Expected: company name string (not 401)
```

---

## Test Execution Log

| # | Journey | Env | Date | Result | Notes |
|---|---------|-----|------|--------|-------|
| 1 | Onboarding Scrape | VERCEL+DROPLET | | | |
| 2 | Document Analysis | VERCEL+DROPLET | | | |
| 3 | Service Health | VERCEL+DROPLET | | | |
| 4 | Stage Engine Chat | VERCEL+DROPLET+SUPABASE | | | |
| 5 | Landing → App | VERCEL (both) | | | |
| 6 | Stripe Billing | VERCEL+STRIPE | | | |
| 7 | Contract Generation | VERCEL+DROPLET+DOCUSEAL | | | |
| 8 | Comprehensive Health | VERCEL → ALL SERVICES | | | |
| 9 | Landing Voice Wizard | VERCEL LANDING → DROPLET | | | |
| S | Smoke Tests (CLI) | ALL | | | |
