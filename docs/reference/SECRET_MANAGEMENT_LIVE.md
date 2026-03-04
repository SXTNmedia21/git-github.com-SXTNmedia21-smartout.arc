---
title: "Secret Management — Live Environment"
status: canonical
updated: 2026-03-04
created: 2026-03-04
module: security
tags: [secrets, vault, production, 1password, vercel, supabase]
---

# Secret Management — Live Environment

> Operational reference for how secrets flow from creation to runtime in production.
> For protocol rules and checklists, see `docs/protocols/SECURITY.md`.
> For database-level architecture, see `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        1Password (Master Record)                    │
│  Every secret originates here. Updated first, always.               │
└────────────┬──────────────────────────┬─────────────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌──────────────────────────────────────┐
│   Vercel Dashboard     │   │   Supabase Vault (pgsodium)          │
│   (build-time vars)    │   │   (runtime secrets)                  │
│                        │   │                                      │
│ SUPABASE_URL           │   │ AES-256-GCM encrypted                │
│ SUPABASE_ANON_KEY      │   │ Accessed via get_secret() RPC        │
│ SUPABASE_SERVICE_ROLE  │   │ service_role only                    │
│ STRIPE_WEBHOOK_SECRET  │   │                                      │
│ SENTRY_DSN             │   │ Stored secrets:                      │
│ POSTHOG_KEY            │   │  stripe, sendgrid, twilio,           │
│ UPSTASH_REDIS_*        │   │  docuseal, docuseal_webhook_secret,  │
│ NODE_ENV=production    │   │  ultravox, openrouter                │
└────────────┬───────────┘   └──────────┬───────────────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────────┐   ┌──────────────────────────────────────┐
│ Next.js Apps (Vercel)  │   │ Edge Functions / Microservices       │
│                        │   │                                      │
│ apps/web               │   │ supabase/functions/*                 │
│ apps/landing           │   │ services/stage-engine                │
│                        │   │ services/contract-service            │
│ Zod validation at      │   │ services/shift-mcp                  │
│ build via @t3-oss/env  │   │                                      │
│                        │   │ Call: supabase.rpc('get_secret',     │
│ Server vars never      │   │   { secret_name: 'stripe' })        │
│ reach client bundle    │   │                                      │
└────────────────────────┘   └──────────────────────────────────────┘
```

---

## Three Secret Tiers

| Tier  | What                                       | Storage                            | How accessed                          | Example                      |
| ----- | ------------------------------------------ | ---------------------------------- | ------------------------------------- | ---------------------------- |
| **1** | Workspace API keys (`smo_sk_live_*`)       | SHA-256 hash in `platform_api_key` | Hash incoming key, compare to DB      | Customer POS → Edge Function |
| **2** | External provider secrets                  | Supabase Vault (AES-256-GCM)       | `get_secret()` RPC, service_role only | Stripe, SendGrid, Ultravox   |
| **3** | Service-to-service keys (`smo_svc_live_*`) | SHA-256 hash in `platform_api_key` | Same as Tier 1                        | n8n → Edge Functions         |

### Why SHA-256 for Tier 1/3 (not bcrypt)?

Keys are generated with `randomBytes(32)` — 256 bits of entropy. Brute-forcing SHA-256 at that entropy is computationally impossible. bcrypt's deliberate ~100ms delay protects low-entropy passwords; applying it to every API request creates a bottleneck with zero security benefit.

---

## Where Each Secret Lives

### Vercel Environment Variables (build-time)

Set in the Vercel dashboard per-project. Injected at build and available server-side.

| Variable                        | Validated              | Notes                                       |
| ------------------------------- | ---------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Zod                    | Supabase Cloud URL                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Zod                    | Publishable, safe for client                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Zod                    | **Server-side only** — never in client code |
| `STRIPE_WEBHOOK_SECRET`         | `startsWith("whsec_")` | Webhook signature verification              |
| `DOCUSEAL_WEBHOOK_SECRET`       | Zod                    | DocuSeal webhook signature                  |
| `UPSTASH_REDIS_REST_URL`        | `url()`                | Rate limiting                               |
| `UPSTASH_REDIS_REST_TOKEN`      | Zod                    | Rate limiting                               |
| `SENTRY_DSN`                    | `url()`                | Error tracking                              |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Zod                    | Analytics (client-safe)                     |
| `NEXT_PUBLIC_ROOT_DOMAIN`       | default `localhost`    | `smartout.ai` in production                 |

Validated at build by `@t3-oss/env-nextjs` + Zod in:

- `apps/web/src/env.ts`
- `apps/landing/src/env.ts`

### Supabase Vault (runtime)

Encrypted with pgsodium (AES-256-GCM). Accessed only via SECURITY DEFINER functions.

| Secret name               | Used by                              | Service              |
| ------------------------- | ------------------------------------ | -------------------- |
| `stripe`                  | Edge Functions, Next.js API routes   | Stripe billing       |
| `sendgrid`                | `@smartout/notifications` package    | Email delivery       |
| `twilio`                  | Edge Functions                       | SMS                  |
| `docuseal`                | `services/contract-service`          | Contract signing     |
| `docuseal_webhook_secret` | `services/contract-service`          | Webhook verification |
| `ultravox`                | `services/stage-engine`              | Voice AI             |
| `openrouter`              | `services/stage-engine`, Next.js API | LLM routing          |

---

## Runtime Access Patterns

### Pattern 1: Shared package (`packages/supabase/src/vault.ts`)

Used by Next.js API routes and the notifications package.

```typescript
import { getServiceKey } from "@smartout/supabase/vault";

const apiKey = await getServiceKey(adminClient, "sendgrid");
```

- Requires a service-role Supabase client
- Results cached in-memory (process lifetime)
- `clearServiceKeyCache()` available for post-rotation refresh

### Pattern 2: Service startup (`services/*/src/secrets.ts`)

Used by microservices (stage-engine, contract-service).

```typescript
// At server startup, before accepting requests:
await loadSecrets();

// In request handlers:
const { ultravoxApiKey } = getSecrets();
```

- Loads all secrets in parallel via `Promise.all()`
- Throws if `loadSecrets()` not called (fail-fast)
- stage-engine has env var fallback for local dev; contract-service does not

### Pattern 3: Edge Functions (direct RPC)

```typescript
const { data: apiKey } = await supabase.rpc("get_secret", {
  secret_name: "stripe",
});
```

---

## Vault Database Functions

All three are `SECURITY DEFINER` with `REVOKE EXECUTE FROM public, anon, authenticated`.

| Function                            | Purpose                  | Access            |
| ----------------------------------- | ------------------------ | ----------------- |
| `get_secret(name)`                  | Read decrypted secret    | service_role only |
| `upsert_secret(name, secret, desc)` | Store or update a secret | service_role only |
| `delete_secret(name)`               | Remove a secret          | service_role only |

---

## Key Lifecycle

### Workspace API Keys (Tier 1)

```
Create:
  randomBytes(32) → base64url → prefix "smo_sk_live_" + random
  SHA-256 hash → stored in platform_api_key
  Raw key shown ONCE to user → never stored

Validate:
  x-api-key header → SHA-256(key) → lookup in platform_api_key
  → set_config('app.workspace_id', ..., true) → SET LOCAL ROLE authenticated
  → RLS takes over

Rotate:
  New "current" key created → old key demoted to "previous" (48h grace)
  → pg_cron revokes expired "previous" keys hourly

Revoke:
  status → "revoked", immediately rejected on next request
```

### External Secrets (Tier 2)

```
Store:
  Admin pastes new key in dashboard → POST /api/platform-admin/secrets
  → supabase.rpc('upsert_secret', { secret_name, secret, description })
  → Encrypted by pgsodium, stored in vault.secrets

Retrieve:
  Service needs key → supabase.rpc('get_secret', { secret_name })
  → pgsodium decrypts → returned to caller → cached in-memory

Rotate:
  1. Admin rotates in provider dashboard (Stripe, SendGrid, etc.)
  2. Admin pastes new key in Smartout Keys & Secrets UI
  3. upsert_secret() overwrites the old value
  4. Services pick up new key on next process restart (or cache clear)
```

---

## Local Development vs Production

| Concern                      | Local                                             | Production                    |
| ---------------------------- | ------------------------------------------------- | ----------------------------- |
| Supabase                     | `npx supabase start` (local containers)           | Supabase Cloud                |
| Secrets injection            | `.env.local` or `op run --env-file=.env.template` | Vercel dashboard + Vault      |
| Vault available              | Yes (local Supabase has Vault)                    | Yes                           |
| Service role key             | From `npx supabase status`                        | From Supabase Cloud dashboard |
| API key env (`smo_sk_test_`) | Allowed                                           | Blocked — only `smo_sk_live_` |
| 1Password                    | `pnpm dev` uses `op run`                          | Not used at runtime           |

### Local-only fallback (stage-engine)

```typescript
// Vault first, then env var fallback
const ultravoxApiKey = vaultUltravox ?? process.env.ULTRAVOX_API_KEY ?? null;
```

This fallback exists only for local dev where Vault may be empty. In production, secrets must be in Vault.

---

## Admin UI

**Path:** `/dashboard/settings` → Keys & Secrets (platform-admin)

| Tab      | What                                                     |
| -------- | -------------------------------------------------------- |
| API Keys | Create/rotate/revoke workspace keys                      |
| Secrets  | View/update external provider secrets grouped by service |
| Usage    | Hourly request buckets per key                           |
| Config   | Environment enforcement, scope presets                   |

**API routes:**

- `GET/POST /api/platform-admin/secrets` — CRUD for Vault secrets
- `POST /api/platform-admin/secrets/bulk` — Batch upsert
- `DELETE /api/platform-admin/secrets` — Remove from Vault

---

## Rotation Schedule

| Secret type                        | Max age                  | Reminder          | Enforced by       |
| ---------------------------------- | ------------------------ | ----------------- | ----------------- |
| Workspace API keys                 | No hard limit            | Customer's choice | —                 |
| Stripe, SendGrid, Twilio, DocuSeal | 90 days                  | 45 days remaining | Dashboard alert   |
| Service-to-service keys            | 180 days                 | 30 days remaining | Super-admin alert |
| Supabase service role              | Never (Supabase-managed) | —                 | —                 |

---

## Encryption Summary

| Layer           | Method                                   |
| --------------- | ---------------------------------------- |
| At rest (DB)    | Supabase AES-256                         |
| In transit      | TLS 1.2+ everywhere                      |
| Passwords       | bcrypt via Supabase Auth                 |
| Vault secrets   | pgsodium AES-256-GCM                     |
| Issued API keys | SHA-256 hash only, no reversible storage |

---

## Incident Response: Leaked Key

```
IMMEDIATE (15 min):
  1. Identify by prefix:
     smo_sk_*  → Workspace key  → Revoke in admin dashboard
     smo_svc_* → Service key    → Revoke in super-admin dashboard
     sk_live_  → Stripe         → Roll in Stripe → update Vault
     SG.*      → SendGrid       → Roll in SendGrid → update Vault
     Other     → Identify provider → roll → update Vault

  2. Check platform_api_key_usage for compromised key activity

  3. Notify workspace owner (workspace key) or team (service key)

WITHIN 1 HOUR:
  4. Audit leak vector (logs, Git history, client code)
  5. Fix the leak
  6. Document in incident log

WITHIN 24 HOURS:
  7. Review all keys of same type for similar exposure
  8. Update protocols if leak vector was not covered
  9. Write a Learning record
```

---

## Related Documents

| Document                  | Path                                                      | Relationship                          |
| ------------------------- | --------------------------------------------------------- | ------------------------------------- |
| Security Protocol         | `docs/protocols/SECURITY.md`                              | Rules and checklists (the law)        |
| Secret API Infrastructure | `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` | DB schema, key generation, validation |
| Admin Key Management      | `docs/architecture/SMARTOUT_ADMIN_KEY_MANAGEMENT.md`      | Dashboard UI flows                    |
| Environment Variables     | `docs/reference/ENV_VARS.md`                              | Full variable list with validation    |
| Vault helper              | `packages/supabase/src/vault.ts`                          | Shared `getServiceKey()`              |
| Stage-engine secrets      | `services/stage-engine/src/secrets.ts`                    | Startup loader with env fallback      |
| Contract-service secrets  | `services/contract-service/src/secrets.ts`                | Startup loader (Vault only)           |
