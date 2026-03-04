---
title: "Port Standardization & Vault Secrets Strategy"
status: accepted
updated: 2026-03-29
created: 2026-03-29
module: infra
tags: [ports, docker, vault, secrets, infrastructure]
---

# ADR-0050: Port Standardization & Vault Secrets Strategy

## Context

Stage Engine had 6 different port numbers across the codebase (3000, 3060, 3070, 5022, 5030, 8500). No two configuration files agreed. Healthchecks pinged wrong ports, causing false negatives on the Droplet. Similar inconsistencies existed for Shift MCP and Contract Service.

Additionally, secrets were scattered across env vars, 1Password references, and Supabase Vault — with no clear single source of truth for production rotation.

## Decision

### Port Standard (5000-series)

All custom services use the 5000-series to avoid conflicts with common development tools:

| Service          | Port | Rationale                        |
| ---------------- | ---- | -------------------------------- |
| Stage Engine     | 5010 | Primary service, first in series |
| Shift MCP        | 5011 | Secondary service                |
| Contract Service | 5012 | Third service                    |
| Scrapling        | 8000 | Python convention, unchanged     |
| n8n              | 5678 | n8n default, unchanged           |

The port is the same everywhere: config.ts default, Dockerfile EXPOSE, docker-compose.yml PORT env var, docker-compose.override.yml mapping, Caddyfile upstream, and healthcheck URL. One number per service, no translation.

### Secrets Strategy: Vault as Single Source of Truth

```
Development:  1Password → op run → env vars → services
Production:   Supabase Vault → get_secret() → runtime load

Bootstrap only (env vars in prod):
  - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  - NEXT_PUBLIC_* (build-time, unavoidable)

Everything else in prod:
  - Supabase Vault via get_secret() / upsert_secret()
  - Stage Engine already does this (src/secrets.ts)
  - Contract Service and Edge Functions to follow same pattern
```

Rotation becomes a single SQL query:

```sql
SELECT upsert_secret('stripe_secret_key', 'new_key_here');
-- Done. No restarts, no deploys.
```

## Consequences

- All port references consolidated — grep for old ports should return only docs/plans/completed/ (historical)
- .env.example and .env.template are 1:1 matched
- infra/.env.example created for Docker Compose subset
- Future: services that read env vars should fall through to Vault for production secrets
- Vault migration is manual (Pontus) — secrets never pass through AI context
