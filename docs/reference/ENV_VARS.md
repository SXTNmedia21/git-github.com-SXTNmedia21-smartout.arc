---
title: "Environment Variables Reference"
id: REF_ENV
version: "2.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-04-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [env, secrets, configuration, 1password, validation, t3-env]
tables: []
changelog:
  - date: 2026-04-28
    change: "v2.0 audit — fix ports (web 3060, supabase 54321), add GITHUB_ERROR_*, NEXT_PUBLIC_STAGE_ENGINE_URL, LIVEKIT_*, REVALIDATION_SECRET, SCRAPLING_*, SHIFT_MCP_URL, STAGE_ENGINE_*. Replace .env.local instructions with op run flow."
  - date: 2026-04-10
    change: "Document NEXT_PUBLIC_POSTHOG_PROJECT_ID for web + landing"
  - date: 2026-03-11
    change: "Note consolidated .env.example, add Edge Function + service vars, add TWILIO_FROM_NUMBER"
  - date: 2026-02-28
    change: "Initial version — consolidated from CLAUDE.md + apps/web/src/env.ts + apps/landing/src/env.ts"
---

# Environment Variables Reference

Per-app environment variables, validation rules, and the 1Password flow. Verified against
`apps/web/src/env.ts`, `apps/landing/src/env.ts`, and `.env.template` on 2026-04-28.

> Protocol: `docs/protocols/ENV_PROTOCOL.md` | Verification: `docs/protocols/ENV_VERIFICATION.md`

---

## Validation Framework

Both `apps/web` and `apps/landing` use `@t3-oss/env-nextjs` with Zod schemas:

- **Web app:** `apps/web/src/env.ts`
- **Landing page:** `apps/landing/src/env.ts`
- Validation runs at build/start time
- `SKIP_ENV_VALIDATION=1` bypasses validation
- Empty strings treated as undefined (`emptyStringAsUndefined: true`)
- All server validators use `.optional()` so Vercel CI builds with partial values

---

## Web App Variables (`apps/web/src/env.ts`)

### Client Variables (`NEXT_PUBLIC_*`) — 11 total

| Variable                          | Validation                      | Default                    | Notes                                                |
| --------------------------------- | ------------------------------- | -------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | `z.string().optional()`         | —                          | Local: `http://127.0.0.1:54321`                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `z.string().optional()`         | —                          | From `npx supabase status`                           |
| `NEXT_PUBLIC_POSTHOG_KEY`         | `z.string().optional()`         | —                          | Project API key                                      |
| `NEXT_PUBLIC_POSTHOG_HOST`        | `z.string().url().default(...)` | `https://eu.i.posthog.com` | EU proxy                                             |
| `NEXT_PUBLIC_POSTHOG_PROJECT_ID`  | `z.string().optional()`         | —                          | Platform Admin bridge links                          |
| `NEXT_PUBLIC_SENTRY_DSN`          | `z.string().url().optional()`   | —                          | Client-side Sentry                                   |
| `NEXT_PUBLIC_ROOT_DOMAIN`         | `z.string().default("localhost")` | `localhost`              | `smartout.ai` in production for subdomain routing   |
| `NEXT_PUBLIC_LANDING_URL`         | `z.string().url().optional()`   | —                          | Marketing site URL (CTA targets)                     |
| `NEXT_PUBLIC_REVALIDATION_SECRET` | `z.string().optional()`         | —                          | ISR cache invalidation                               |
| `NEXT_PUBLIC_STAGE_ENGINE_URL`    | `z.string().url().optional()`   | —                          | Voice/agent engine endpoint                          |
| `NEXT_PUBLIC_LIVEKIT_URL`         | `z.string().url().optional()`   | —                          | LiveKit Cloud WebSocket URL                          |

### Server Variables — 28 total

| Variable                    | Validation                                | Notes                                              |
| --------------------------- | ----------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`              | `z.string().optional()`                   | Direct Postgres connection                         |
| `SUPABASE_SERVICE_ROLE_KEY` | `z.string().optional()`                   | Admin operations / Vault                           |
| `STRIPE_SECRET_KEY`         | `z.string().optional()`                   | (Web does not enforce `sk_` prefix; landing does)  |
| `STRIPE_WEBHOOK_SECRET`     | `z.string().optional()`                   | Webhook signature verification                     |
| `SENDGRID_API_KEY`          | `z.string().optional()`                   | Email dispatch                                     |
| `TWILIO_ACCOUNT_SID`        | `z.string().optional()`                   | SMS                                                |
| `TWILIO_AUTH_TOKEN`         | `z.string().optional()`                   | SMS                                                |
| `JWT_SECRET`                | `z.string().min(32).optional()`           | Min 32 chars                                       |
| `SESSION_SECRET`            | `z.string().min(32).optional()`           | Min 32 chars                                       |
| `OPENROUTER_API_KEY`        | `z.string().min(1).optional()`            | LLM routing                                        |
| `UPSTASH_REDIS_REST_URL`    | `z.string().url().optional()`             | Rate limiting                                      |
| `UPSTASH_REDIS_REST_TOKEN`  | `z.string().optional()`                   | Rate limiting                                      |
| `SENTRY_DSN`                | `z.string().url().optional()`             | Server-side Sentry                                 |
| `GITHUB_ERROR_TOKEN`        | `z.string().optional()`                   | Error reporter → GitHub Issues                     |
| `GITHUB_ERROR_REPO`         | `z.string().optional()`                   | Repo target (`SXTNmedia21/smartout.ai`)            |
| `DOCUSEAL_WEBHOOK_SECRET`   | `z.string().optional()`                   | DocuSeal webhook signature                         |
| `ULTRAVOX_API_KEY`          | `z.string().optional()`                   | Voice AI                                           |
| `CONTRACT_SERVICE_URL`      | `z.string().url().optional()`             | Contract microservice URL                          |
| `CONTRACT_SERVICE_KEY`      | `z.string().min(16).optional()`           | Contract microservice API key                      |
| `SCRAPLING_SERVICE_URL`     | `z.string().url().optional()`             | Scrapling microservice URL                         |
| `SCRAPLING_AUTH_TOKEN`      | `z.string().min(1).optional()`            | Scrapling auth                                     |
| `SERPER_API_KEY`            | `z.string().min(1).optional()`            | Web search                                         |
| `SHIFT_MCP_URL`             | `z.string().url().optional()`             | Shift-MCP microservice                             |
| `STAGE_ENGINE_URL`          | `z.string().url().optional()`             | Stage Engine HTTP base                             |
| `STAGE_ENGINE_API_KEY`      | `z.string().min(16).optional()`           | Stage Engine API key (min 16)                      |
| `LIVEKIT_API_KEY`           | `z.string().min(1).optional()`            | LiveKit token minting                              |
| `LIVEKIT_API_SECRET`        | `z.string().min(1).optional()`            | LiveKit token minting                              |
| `LIVEKIT_WEBHOOK_SECRET`    | `z.string().min(1).optional()`            | LiveKit webhook HMAC                               |
| `NODE_ENV`                  | `z.enum([...]).default("development")`    | development / test / production                    |

---

## Landing Page Variables (`apps/landing/src/env.ts`)

### Client Variables (`NEXT_PUBLIC_*`) — 6 total

| Variable                         | Validation                                          | Default                    | Notes                                |
| -------------------------------- | --------------------------------------------------- | -------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`       | `z.string().optional()`                             | —                          | Same as web                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | `z.string().optional()`                             | —                          | Same as web                          |
| `NEXT_PUBLIC_WEB_APP_URL`        | `z.string().url().optional()`                       | —                          | URL to web dashboard for CTAs        |
| `NEXT_PUBLIC_POSTHOG_KEY`        | `z.string().optional()`                             | —                          | Analytics                            |
| `NEXT_PUBLIC_POSTHOG_HOST`       | `z.string().url().default("https://eu.i.posthog.com")` | EU URL                  | EU proxy                             |
| `NEXT_PUBLIC_LANDING_VARIANT`    | `z.enum(["B","E","T","K","A","F","S"]).default("B")` | `B`                       | Hero/copy variant flag (template hardcodes `T`) |

> `NEXT_PUBLIC_POSTHOG_PROJECT_ID` is read at runtime by the Platform Admin bridge but
> is **not** declared in `apps/landing/src/env.ts` — accessed via raw `process.env` if set.

### Server Variables — 14 total

| Variable                      | Validation                                   | Notes                         |
| ----------------------------- | -------------------------------------------- | ----------------------------- |
| `DATABASE_URL`                | `z.string().optional()`                      | Direct Postgres connection    |
| `SUPABASE_SERVICE_ROLE_KEY`   | `z.string().optional()`                      | Admin operations              |
| `STRIPE_SECRET_KEY`           | `z.string().startsWith("sk_").optional()`    | Pricing page                  |
| `STRIPE_WEBHOOK_SECRET`       | `z.string().startsWith("whsec_").optional()` | Stripe webhooks               |
| `SENDGRID_API_KEY`            | `z.string().startsWith("SG.").optional()`    | Waitlist emails               |
| `TWILIO_ACCOUNT_SID`          | `z.string().optional()`                      | SMS                           |
| `TWILIO_AUTH_TOKEN`           | `z.string().optional()`                      | SMS                           |
| `JWT_SECRET`                  | `z.string().min(32).optional()`              | Min 32 chars                  |
| `SESSION_SECRET`              | `z.string().min(32).optional()`              | Min 32 chars                  |
| `ULTRAVOX_API_KEY`            | `z.string().optional()`                      | Voice demo                    |
| `STAGE_ENGINE_URL`            | `z.string().url().optional()`                | Stage Engine HTTP base        |
| `STAGE_ENGINE_API_KEY`        | `z.string().optional()`                      | Stage Engine key (no min)     |
| `INTERVJU_MCP_WEBHOOK_SECRET` | `z.string().optional()`                      | Interview MCP webhook         |
| `REVALIDATION_SECRET`         | `z.string().min(16).optional()`              | ISR cache invalidation        |
| `NODE_ENV`                    | `z.enum([...]).default("development")`       | development / test / production |

---

## Variables Unique to Each App

### Web only (not in landing)

`OPENROUTER_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`,
`GITHUB_ERROR_TOKEN`, `GITHUB_ERROR_REPO`, `DOCUSEAL_WEBHOOK_SECRET`, `CONTRACT_SERVICE_URL`,
`CONTRACT_SERVICE_KEY`, `SCRAPLING_SERVICE_URL`, `SCRAPLING_AUTH_TOKEN`, `SERPER_API_KEY`,
`SHIFT_MCP_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WEBHOOK_SECRET`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ROOT_DOMAIN`, `NEXT_PUBLIC_LANDING_URL`,
`NEXT_PUBLIC_REVALIDATION_SECRET`, `NEXT_PUBLIC_STAGE_ENGINE_URL`, `NEXT_PUBLIC_LIVEKIT_URL`.

### Landing only (not in web)

`NEXT_PUBLIC_WEB_APP_URL`, `NEXT_PUBLIC_LANDING_VARIANT`, `INTERVJU_MCP_WEBHOOK_SECRET`,
`REVALIDATION_SECRET` (server, not the `NEXT_PUBLIC_` flavor).

---

## 1Password Integration

The canonical local-dev flow is `op run --env-file=.env.template`. See
`docs/protocols/ENV_PROTOCOL.md` for the full protocol.

```bash
# .env.sh auto-loads OP_SERVICE_ACCOUNT_TOKEN on cd into the repo.
# No interactive signin, no master password, no biometric prompt.
op whoami    # USER_TYPE: SERVICE_ACCOUNT

# Run the full dev environment
pnpm dev               # = op run --env-file=.env.template -- turbo run dev

# Single app
pnpm --filter web dev      # port 3060
pnpm --filter landing dev  # port 3055

# Without 1Password (uses .env.local fallback — must be created manually)
pnpm dev:local
```

⛔ **Do not commit `.env`, `.env.local`, or `.env.*.local`** — gitignored. The
canonical workflow is `op run`, not local files.

⛔ **The dev service-account token only reads `smartout_ai`.** Production
secrets (`smartout_ai_prod`) are scoped to a separate token used by the env-sync
scripts on Vercel and the droplet — never load it locally.

---

## Local Development Setup

### Step 1: Verify 1Password service-account token is loaded

```bash
# .env.sh auto-runs on cd into the project root. If not, source it:
source .env.sh
op whoami    # USER_TYPE: SERVICE_ACCOUNT
```

If `OP_SERVICE_ACCOUNT_TOKEN` is empty, verify `.claude/op-auth.json` exists and
is chmod 600. Re-source `.env.sh`.

### Step 2: Start Supabase Local

```bash
npx supabase start
npx supabase status   # Read URL, anon, service_role
```

These local-Supabase values must be present in the `smartout_ai` 1Password vault under
`Supabase` (`url`, `anon_key`, `service_role_key`). On a fresh machine, run
`./scripts/setup-vault.sh` to bootstrap the vault structure.

### Step 3: Start dev servers

```bash
# Full stack (recommended)
./scripts/dev-startup.sh

# Or just web + landing
pnpm dev    # all apps via turbo
```

---

## Production vs Local

| Variable                        | Local                       | Production                |
| ------------------------------- | --------------------------- | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `http://127.0.0.1:54321`    | Supabase Cloud URL        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From `supabase status`      | Supabase Cloud key        |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | `localhost`                 | `smartout.ai`             |
| `NEXT_PUBLIC_WEB_APP_URL`       | `http://localhost:3060`     | `https://app.smartout.ai` |
| `NEXT_PUBLIC_LANDING_URL`       | `http://localhost:3055`     | `https://smartout.ai`     |
| `SENTRY_DSN`                    | unset                       | Production DSN            |
| `UPSTASH_REDIS_*`               | unset (rate limit fail-closed) | Upstash credentials    |

Vault mapping per environment is defined in `infra/scripts/sync-env-to-vercel.sh`. Local
dev reads `smartout_ai`; Vercel production reads `smartout_ai_prod`.

---

## Edge Function Variables (Deno.env)

Set via `npx supabase secrets set` from the CLI or Supabase Dashboard. Auto-injected vars
are populated by the Supabase runtime — do not set them manually.

| Variable                       | Required | Notes                                                         |
| ------------------------------ | -------- | ------------------------------------------------------------- |
| `SUPABASE_URL`                 | Auto     | Injected by Supabase runtime                                  |
| `SUPABASE_ANON_KEY`            | Auto     | Injected by Supabase runtime                                  |
| `SUPABASE_SERVICE_ROLE_KEY`    | Auto     | Injected by Supabase runtime                                  |
| `SENDGRID_API_KEY`             | No       | Email dispatch (invitations)                                  |
| `TWILIO_ACCOUNT_SID`           | No       | SMS dispatch                                                  |
| `TWILIO_AUTH_TOKEN`            | No       | SMS dispatch                                                  |
| `TWILIO_FROM_NUMBER`           | No       | SMS sender number                                             |
| `SERPER_API_KEY`               | No       | Web search in intelligence                                    |
| `SITE_URL`                     | No       | Invite link base URL                                          |
| `LIVEKIT_API_KEY`              | No       | LiveKit token minting                                         |
| `LIVEKIT_API_SECRET`           | No       | LiveKit token minting                                         |
| `LIVEKIT_WEBHOOK_SECRET`       | No       | LiveKit webhook HMAC                                          |
| `NEXT_PUBLIC_LIVEKIT_URL`      | No       | LiveKit Cloud WebSocket URL                                   |
| `WATCHDOG_CRON_SECRET`         | No       | Cron-only Edge Function auth                                  |
| `PROCESS_NOTIFICATIONS_SECRET` | No       | Bearer token for `process-notifications` (cron + EF)          |
| `MORNING_DIGEST_SECRET`        | No       | Bearer token for `send-morning-digest` (cron + EF)            |
| `PUSH_DISPATCH_SECRET`         | No       | Bearer token for `push-dispatch`                              |
| `HEALTH_CHECK_SECRET`          | No       | Bearer token for the `health-check` endpoint                  |

---

## Service Variables (Docker)

### Stage Engine (`services/stage-engine`, port 5010)

| Variable                | Required | Notes                          |
| ----------------------- | -------- | ------------------------------ |
| `STAGE_ENGINE_API_KEY`  | Yes      | Service auth key (min 16 chars)|
| `DEV_API_KEY`           | Local    | Alternate key (development)    |
| `ENGINE_URL`            | No       | Self-reference URL             |
| `ENVIRONMENT`           | No       | development / production       |
| `LOG_LEVEL`             | No       | debug / info / warn            |
| `SESSION_EXPIRY_HOURS`  | No       | Default 24                     |
| `CLEANUP_INTERVAL_MINUTES` | No    | Default 5                      |
| `ULTRAVOX_API_KEY`      | No       | Voice synthesis                |
| `OPENROUTER_API_KEY`    | No       | LLM routing                    |

### Contract Service (`services/contract-service`, port 5012)

| Variable                | Required | Notes                          |
| ----------------------- | -------- | ------------------------------ |
| `CONTRACT_SERVICE_KEY`  | Yes      | Service auth key (min 16 chars)|
| `PORT`                  | No       | Default 5012                   |
| `DOCUSEAL_API_KEY`      | Yes      | DocuSeal integration           |
| `DOCUSEAL_API_URL`      | No       | Default `https://api.docuseal.com` |
| `DOCUSEAL_WEBHOOK_SECRET` | Yes    | Webhook verification           |
| `SMARTOUT_COMPANY_NAME` | No       | Default `Smartout AS`          |

### Shift MCP (`services/shift-mcp`, port 5011)

Reads `SUPABASE_*` only.

### Scrapling (`services/scrapling`, port 8000)

| Variable                | Required | Notes                          |
| ----------------------- | -------- | ------------------------------ |
| `SCRAPLING_AUTH_TOKEN`  | Yes      | Bearer auth                    |
| `OPENROUTER_API_KEY`    | No       | LLM-assisted parsing           |
| `SERPER_API_KEY`        | No       | Search enrichment              |

### N8N (`services/n8n` on droplet)

| Variable                  | Required | Notes                        |
| ------------------------- | -------- | ---------------------------- |
| `N8N_HOST`                | Yes      | `n8n.smartout.ai`            |
| `N8N_BASIC_AUTH_USER`     | Yes      | Auth                         |
| `N8N_BASIC_AUTH_PASSWORD` | Yes      | Auth                         |
| `N8N_ENCRYPTION_KEY`      | Yes      | Workflow encryption          |
| `N8N_WEBHOOK_URL`         | Yes      | Public webhook base          |
| `GENERIC_TIMEZONE`        | No       | `Europe/Oslo`                |

---

## Secrets Protocol Summary

- Never expose raw values in prompts, code, or logs
- Never commit `.env*.local` files
- Always use `op://` references for 1Password
- Two vaults: `smartout_ai` (dev + preview Branch DB) and `smartout_ai_prod` (production)
- Rotation: 30 days (runtime keys), 90 days (build keys)
- All secrets must be classified: env / type / scope

> Full protocol: `docs/protocols/ENV_PROTOCOL.md` and `docs/protocols/SECURITY.md`.
> Runtime architecture: `docs/reference/SECRET_MANAGEMENT_LIVE.md`.
