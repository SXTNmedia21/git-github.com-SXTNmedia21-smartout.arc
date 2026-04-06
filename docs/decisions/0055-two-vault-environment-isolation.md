---
title: "ADR-0055: Two-Vault Environment Isolation"
status: superseded
superseded_by: "Deployment Pipeline Spec (2026-04-06) — vault naming decision"
created: 2026-03-19
updated: 2026-04-06
module: infrastructure
tags: [security, 1password, environments, secrets]
---

# ADR-0055: Two-Vault Environment Isolation

## Decision

Separate all secrets into two 1Password vaults:

- `smartout_dev` — local development and staging
- `smartout_prod` — production only

The `.env.template` stays as the single source of truth for which variables exist. The vault prefix (`op://smartout_dev/...` vs `op://smartout_prod/...`) determines which environment's secrets are used.

## Context

Currently all secrets live in one vault (`smartout_ai`). This means:

- Development uses the same API keys as production
- No isolation between environments
- Risk of accidentally hitting production services from local dev
- No way to rotate production keys without affecting development

## What Changes

Every external service gets separate keys per environment:

| Service       | Dev Vault                | Prod Vault               | Why Separate                    |
| ------------- | ------------------------ | ------------------------ | ------------------------------- |
| Supabase      | Local Docker (localhost) | Supabase Cloud           | Different databases entirely    |
| Stripe        | `sk_test_*` keys         | `sk_live_*` keys         | Test vs real payments           |
| OpenRouter    | Dev key (lower limits)   | Prod key (higher limits) | Cost tracking, rate limits      |
| Serper        | Dev key                  | Prod key                 | Usage quotas                    |
| SendGrid      | Dev key (sandbox)        | Prod key                 | Don't send real emails from dev |
| Twilio        | Dev key (test numbers)   | Prod key                 | Don't send real SMS from dev    |
| Sentry        | Dev DSN                  | Prod DSN                 | Separate error tracking         |
| PostHog       | Dev key                  | Prod key                 | Don't pollute analytics         |
| Upstash Redis | Dev instance             | Prod instance            | Separate cache/state            |

Internal service URLs also differ:

| Service      | Dev URL                                    | Prod URL                                  |
| ------------ | ------------------------------------------ | ----------------------------------------- |
| Scrapling    | `https://scrape.smartout.ai` (local Caddy) | `https://scrape.smartout.ai` (prod Caddy) |
| Stage Engine | `https://engine.smartout.ai` (local)       | `https://engine.smartout.ai` (prod)       |
| Supabase     | `http://127.0.0.1:54321`                   | `https://{project}.supabase.co`           |

## Implementation (future task)

1. Create `smartout_dev` vault in 1Password
2. Create `smartout_prod` vault in 1Password
3. Generate separate API keys for each service per environment
4. Update `.env.template` — use `op://smartout_dev/` as default
5. Create `.env.template.prod` — uses `op://smartout_prod/`
6. Or: use a single `.env.template` with a `SMARTOUT_ENV` variable that selects the vault prefix
7. Document in `SERVICE_ROUTING.md`

## Consequences

- Full environment isolation — no shared secrets
- Can rotate production keys without breaking dev
- Cost tracking per environment (OpenRouter, Serper, etc.)
- Slightly more setup when onboarding new services (create key in both vaults)

## Status

Accepted as architecture decision. Implementation deferred — not blocking current work.
