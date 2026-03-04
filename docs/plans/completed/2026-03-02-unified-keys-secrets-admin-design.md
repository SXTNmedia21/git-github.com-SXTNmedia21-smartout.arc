---
title: "Design — Unified Keys & Secrets Admin"
status: done
updated: 2026-03-03
created: 2026-03-02
module: platform-admin
tags: [keys, secrets, vault, security, admin]
---

# Unified Keys & Secrets Admin

## Problem

All API keys and secrets are managed via `.env.local` files. No central UI to configure, rotate, or monitor keys. New developers need manual setup. No visibility into which keys are active, expired, or missing.

## Decision

Move ALL keys into Supabase Vault, managed via `/platform-admin/keys`. Only 2 env vars remain as bootstrap:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Everything else is stored encrypted in Vault and fetched at runtime.

## UI Structure

Single page `/platform-admin/keys` with 4 tabs:

### Tab 1: Platform Keys

Predefined services grouped by category. Admin fills in the key, system stores in Vault.

| Group               | Services                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| AI & Voice          | OpenRouter (API key), Ultravox (API key)                                  |
| Billing & Contracts | Stripe (secret key + webhook secret), DocuSeal (API key + webhook secret) |
| Notifications       | SendGrid (API key), Twilio (account SID + auth token)                     |
| Monitoring          | Sentry (DSN), PostHog (project key + host)                                |
| Infrastructure      | Upstash Redis (REST URL + REST token), JWT Secret, Session Secret         |

Each service shows: status (active/not configured/error), masked key prefix, last rotated date, [Setup/Edit] button opening a drawer.

### Tab 2: Workspace Keys

Create/manage `smo_sk_*` keys per workspace:

- Scopes (profiles:read, schedules:write, etc.)
- Rate limits (requests/minute)
- Environment (live/test)
- Rotation with 48-hour grace period
- Usage stats (hourly buckets)

### Tab 3: Webhooks

**Inbound:** Stripe, DocuSeal — show URL, verification secret, last event, status
**Outbound:** Custom webhook endpoints that Smartout sends events to — URL, secret, event types, retry config

### Tab 4: Service Keys

`smo_svc_*` for service-to-service auth:

- Stage Engine
- Contract Service
- Shift MCP
- Scrapling

## Data Architecture

### Storage

```
Admin UI → API route → service_role client → vault.secrets (encrypted)
                                            → platform_external_secret (metadata)
```

### Runtime Access

New helper replaces all `process.env.*` lookups:

```typescript
// packages/supabase/src/vault.ts
export async function getServiceKey(provider: string): Promise<string | null>;
```

1. Check in-memory cache (5-min TTL per key)
2. Cache miss → `rpc('get_secret', { secret_name: provider })` via service role
3. Return decrypted key

### Migration Path

1. Build the UI and Vault storage
2. Create `getServiceKey()` helper with env var fallback
3. Replace `process.env.X` references one by one
4. Remove env vars from `.env.template` as each moves to Vault

## Service Registry

Predefined list of all services with metadata:

```typescript
const PLATFORM_SERVICES = [
  {
    provider: "openrouter",
    category: "ai",
    label: "OpenRouter",
    fields: [{ key: "api_key", label: "API Key", prefix: "sk-or-" }],
    required: true,
    docsUrl: "https://openrouter.ai/keys",
  },
  // ... all services
] as const;
```

## Security

- All secrets encrypted at rest (pgsodium AES-256 in Vault)
- Plaintext only shown once at input, then masked
- RLS: only `is_godmode` users can access platform_external_secret
- Audit log: every create/update/delete logged with user + timestamp
- Vault access: only via SECURITY DEFINER functions with service_role
