---
title: "Environment Variables Reference"
id: REF_ENV
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-03-11
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [env, secrets, configuration, 1password, validation, t3-env]
tables: []
changelog:
  - date: 2026-03-11
    change: "Note consolidated .env.example, add Edge Function + service vars, add TWILIO_FROM_NUMBER"
  - date: 2026-02-28
    change: "Initial version -- consolidated from CLAUDE.md + apps/web/src/env.ts + apps/landing/src/env.ts"
---

# Environment Variables Reference

All environment variables across both apps, their validation rules, and setup instructions. Verified against actual `env.ts` files.

---

## Validation Framework

Both `apps/web` and `apps/landing` use `@t3-oss/env-nextjs` with Zod schemas:

- **Web app:** `apps/web/src/env.ts`
- **Landing page:** `apps/landing/src/env.ts`
- Validation runs at build/start time
- `SKIP_ENV_VALIDATION=1` bypasses validation
- Empty strings treated as undefined (`emptyStringAsUndefined: true`)

---

## Web App Variables (apps/web/src/env.ts)

### Client Variables (`NEXT_PUBLIC_*`)

| Variable                        | Validation                      | Default                    | Required        | Notes                                                    |
| ------------------------------- | ------------------------------- | -------------------------- | --------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `z.string().optional()`         | --                         | Yes (practical) | Local: `http://127.0.0.1:54331`                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `z.string().optional()`         | --                         | Yes (practical) | From `npx supabase status`                               |
| `NEXT_PUBLIC_POSTHOG_KEY`       | `z.string().optional()`         | --                         | No              | PostHog project API key                                  |
| `NEXT_PUBLIC_POSTHOG_HOST`      | `z.string().url().default(...)` | `https://eu.i.posthog.com` | No              | PostHog EU proxy                                         |
| `NEXT_PUBLIC_SENTRY_DSN`        | `z.string().url().optional()`   | --                         | No              | Sentry client-side tracking                              |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | `z.string().default(...)`       | `localhost`                | No              | Set to `smartout.ai` in production for subdomain routing |

### Server Variables

| Variable                    | Validation                                   | Required | Notes                                        |
| --------------------------- | -------------------------------------------- | -------- | -------------------------------------------- |
| `DATABASE_URL`              | `z.string().optional()`                      | No       | Direct Postgres connection                   |
| `SUPABASE_SERVICE_ROLE_KEY` | `z.string().optional()`                      | No       | Admin operations only                        |
| `STRIPE_SECRET_KEY`         | `z.string().startsWith("sk_").optional()`    | No       | Must start with `sk_`                        |
| `STRIPE_WEBHOOK_SECRET`     | `z.string().startsWith("whsec_").optional()` | No       | Must start with `whsec_`                     |
| `SENDGRID_API_KEY`          | `z.string().startsWith("SG.").optional()`    | No       | Must start with `SG.`                        |
| `TWILIO_ACCOUNT_SID`        | `z.string().optional()`                      | No       | Twilio account SID                           |
| `TWILIO_AUTH_TOKEN`         | `z.string().optional()`                      | No       | Twilio auth token                            |
| `JWT_SECRET`                | `z.string().min(32).optional()`              | No       | Min 32 chars                                 |
| `SESSION_SECRET`            | `z.string().min(32).optional()`              | No       | Min 32 chars                                 |
| `OPENROUTER_API_KEY`        | `z.string().min(1).optional()`               | No       | For AI agents                                |
| `UPSTASH_REDIS_REST_URL`    | `z.string().url().optional()`                | No       | Rate limiting (production)                   |
| `UPSTASH_REDIS_REST_TOKEN`  | `z.string().optional()`                      | No       | Rate limiting (production)                   |
| `SENTRY_DSN`                | `z.string().url().optional()`                | No       | Error tracking                               |
| `DOCUSEAL_WEBHOOK_SECRET`   | `z.string().optional()`                      | No       | DocuSeal webhook signature                   |
| `ULTRAVOX_API_KEY`          | `z.string().optional()`                      | No       | Voice AI                                     |
| `CONTRACT_SERVICE_URL`      | `z.string().url().optional()`                | No       | Contract microservice URL                    |
| `CONTRACT_SERVICE_KEY`      | `z.string().min(16).optional()`              | No       | Contract microservice API key (min 16 chars) |
| `NODE_ENV`                  | `z.enum([...]).default("development")`       | No       | development, test, production                |

---

## Landing Page Variables (apps/landing/src/env.ts)

### Client Variables (`NEXT_PUBLIC_*`)

| Variable                        | Validation                      | Default                    | Required        | Notes                           |
| ------------------------------- | ------------------------------- | -------------------------- | --------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `z.string().optional()`         | --                         | Yes (practical) | Same as web                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `z.string().optional()`         | --                         | Yes (practical) | Same as web                     |
| `NEXT_PUBLIC_WEB_APP_URL`       | `z.string().url().optional()`   | --                         | No              | URL to web dashboard (for CTAs) |
| `NEXT_PUBLIC_POSTHOG_KEY`       | `z.string().optional()`         | --                         | No              | Same as web                     |
| `NEXT_PUBLIC_POSTHOG_HOST`      | `z.string().url().default(...)` | `https://eu.i.posthog.com` | No              | Same as web                     |

### Server Variables

| Variable                      | Validation                                   | Required | Notes                         |
| ----------------------------- | -------------------------------------------- | -------- | ----------------------------- |
| `DATABASE_URL`                | `z.string().optional()`                      | No       | Direct Postgres connection    |
| `SUPABASE_SERVICE_ROLE_KEY`   | `z.string().optional()`                      | No       | Admin operations              |
| `STRIPE_SECRET_KEY`           | `z.string().startsWith("sk_").optional()`    | No       | Pricing page                  |
| `STRIPE_WEBHOOK_SECRET`       | `z.string().startsWith("whsec_").optional()` | No       | Stripe webhooks               |
| `SENDGRID_API_KEY`            | `z.string().startsWith("SG.").optional()`    | No       | Waitlist emails               |
| `TWILIO_ACCOUNT_SID`          | `z.string().optional()`                      | No       | SMS                           |
| `TWILIO_AUTH_TOKEN`           | `z.string().optional()`                      | No       | SMS                           |
| `JWT_SECRET`                  | `z.string().min(32).optional()`              | No       | Min 32 chars                  |
| `SESSION_SECRET`              | `z.string().min(32).optional()`              | No       | Min 32 chars                  |
| `ULTRAVOX_API_KEY`            | `z.string().optional()`                      | No       | Voice demo                    |
| `INTERVJU_MCP_WEBHOOK_SECRET` | `z.string().optional()`                      | No       | Interview MCP webhook         |
| `NODE_ENV`                    | `z.enum([...]).default("development")`       | No       | development, test, production |

---

## Variables Unique to Each App

### Web only (not in landing)

- `OPENROUTER_API_KEY` -- AI agents
- `UPSTASH_REDIS_REST_URL` -- Rate limiting
- `UPSTASH_REDIS_REST_TOKEN` -- Rate limiting
- `SENTRY_DSN` -- Error tracking
- `DOCUSEAL_WEBHOOK_SECRET` -- Contract signing
- `CONTRACT_SERVICE_URL` -- Contract microservice
- `CONTRACT_SERVICE_KEY` -- Contract microservice
- `NEXT_PUBLIC_SENTRY_DSN` -- Client Sentry
- `NEXT_PUBLIC_ROOT_DOMAIN` -- Subdomain routing

### Landing only (not in web)

- `NEXT_PUBLIC_WEB_APP_URL` -- Dashboard URL for CTAs
- `INTERVJU_MCP_WEBHOOK_SECRET` -- Interview webhook

---

## 1Password Integration

Root scripts use `op run --env-file=.env.template` to inject secrets at runtime.

```bash
# Run with 1Password secret injection
pnpm dev          # Uses op run

# Run without 1Password
pnpm dev:local    # No op run, requires .env.local files
```

Never commit `.env.local` -- it is gitignored.

---

## Local Development Setup

### Step 1: Start Supabase

```bash
npx supabase start
npx supabase status   # Copy URL and keys
```

### Step 2: Create .env.local

Create in **both** `apps/web/` and `apps/landing/`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<secret key from supabase status>
```

### Step 3: Start dev servers

```bash
pnpm --filter web dev       # port 3050
pnpm --filter landing dev   # port 3055
```

---

## Production vs Local

| Variable                        | Local                    | Production                |
| ------------------------------- | ------------------------ | ------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `http://127.0.0.1:54331` | Supabase Cloud URL        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From `supabase status`   | Supabase Cloud key        |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | `localhost` (default)    | `smartout.ai`             |
| `NEXT_PUBLIC_WEB_APP_URL`       | `http://localhost:3050`  | `https://app.smartout.ai` |
| `SENTRY_DSN`                    | Not set                  | Production DSN            |
| `UPSTASH_REDIS_*`               | Not set                  | Upstash credentials       |

---

## Consolidated .env.example

A single `.env.example` at the repo root lists ALL environment variables across all apps, services, and Edge Functions. Service-specific `.env.example` files were removed in March 2026.

```bash
# Copy and fill in:
cp .env.example .env.local
```

---

## Edge Function Variables (Deno.env)

These are set via `supabase/functions/.env` or Supabase Dashboard secrets.

| Variable                    | Required | Notes                        |
| --------------------------- | -------- | ---------------------------- |
| `SUPABASE_URL`              | Auto     | Injected by Supabase runtime |
| `SUPABASE_ANON_KEY`         | Auto     | Injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto     | Injected by Supabase runtime |
| `SENDGRID_API_KEY`          | No       | Email dispatch (invitations) |
| `TWILIO_ACCOUNT_SID`        | No       | SMS dispatch (invitations)   |
| `TWILIO_AUTH_TOKEN`         | No       | SMS dispatch (invitations)   |
| `TWILIO_FROM_NUMBER`        | No       | SMS sender number            |
| `SERPER_API_KEY`            | No       | Web search in intelligence   |
| `SITE_URL`                  | No       | Invite link base URL         |
| `WATCHDOG_CRON_SECRET`      | No       | Cron-only Edge Function auth |

---

## Service Variables

### Stage Engine (services/stage-engine)

| Variable               | Required | Notes                    |
| ---------------------- | -------- | ------------------------ |
| `STAGE_ENGINE_API_KEY` | Yes      | Service auth key         |
| `ENGINE_URL`           | No       | Self-reference URL       |
| `ENVIRONMENT`          | No       | development / production |
| `LOG_LEVEL`            | No       | debug / info / warn      |

### Contract Service (services/contract-service)

| Variable               | Required | Notes            |
| ---------------------- | -------- | ---------------- |
| `CONTRACT_SERVICE_KEY` | Yes      | Service auth key |
| `PORT`                 | No       | Default: 3100    |

---

## Secrets Protocol

- Never expose raw values in prompts, code, or logs
- Never commit `.env.local` files
- Use `op://` references for 1Password
- Rotation: 30 days (runtime), 90 days (build)
- All secrets must be classified: env / type / scope
