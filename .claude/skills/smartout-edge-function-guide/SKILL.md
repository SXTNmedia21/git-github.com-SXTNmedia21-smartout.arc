---
name: smartout-edge-function-guide
description: |
  AUTHORITATIVE guide for Supabase Edge Functions — auth patterns, dual-auth (JWT + API key), scope guards, the workspace-api gateway, and config.toml. MUST be loaded before creating, editing, or deploying any Edge Function or when designing a new API endpoint.

  Triggers (English): Edge Function, edge-function, supabase/functions, workspace-api, scope guard, scope_guard, ensureScope, requireScope, dual-auth, dual auth, verify_jwt, JWT verify, anon key, service role, config.toml, Deno, Deno.serve, Hono router, CORS, API gateway, public API, internal API, webhook endpoint, signature verification.

  Triggers (Norwegian): edge-funksjon, API-endepunkt, portvokter.

  Triggers (files/paths): supabase/functions/**, supabase/functions/_shared/**, supabase/functions/workspace-api/**, supabase/config.toml, apps/web/src/lib/api-client.ts, any `supabase.functions.invoke` call site.

  Triggers (specific functions to watch): workspace-api, engine-dispatch, contract-*, docuseal-*, stripe-webhook, sendgrid-webhook, twilio-webhook, any `*-webhook` endpoint.

  Triggers (patterns): `scope_guard`, `ensureScope`, `requireScope`, `supabase.functions.invoke`, `new Hono()`, `Deno.serve`, `verify_jwt = false`, `createClient` inside an Edge Function.

  Traps to remember: workspace-scoped data endpoints route through the workspace-api gateway, not standalone functions (ADR-0039). Dual-auth is required when the endpoint is called from BOTH browser (JWT) and external integrations (API key). Public/webhook endpoints MUST set `verify_jwt=false` AND validate request signatures. Never skip Zod validation on request bodies. User ops use anon key; admin/service ops use service role.

  ALWAYS load when creating a new function, editing supabase/config.toml, adding a scope guard, or designing any `/api/*` route that fronts an Edge Function.
tools: Read, Grep, Glob, Bash
---

# Last synced: 2026-04-06

# Smartout Edge Function Guide

This skill is the AUTHORITATIVE source for Edge Function patterns. CLAUDE.md points here.

## Auth Pattern Decision Tree

| Pattern   | When                                    | `verify_jwt`     | Auth                                                 |
| --------- | --------------------------------------- | ---------------- | ---------------------------------------------------- |
| JWT-only  | User-facing (onboarding, workspace ops) | `true` (default) | `supabase.auth.getUser()`                            |
| Dual-auth | Public API, data endpoints              | `false`          | `resolveAuth(req)` from `_shared/auth-middleware.ts` |
| Cron-only | Scheduled tasks (cleanup, watchdog)     | `false`          | `WATCHDOG_CRON_SECRET` bearer token                  |

**NEVER roll your own auth.** Use `_shared/auth-middleware.ts` for dual-auth.

## config.toml Rules

Every `verify_jwt = false` function MUST be listed in `supabase/functions/config.toml`.

```toml
[functions.your-function-name]
verify_jwt = false
```

## Scope Guard Checklist

Every data endpoint MUST call `requireScope()` before querying.

### Canonical Scope List

| Scope               | Tables                                                                       | Status  |
| ------------------- | ---------------------------------------------------------------------------- | ------- |
| `profiles:read`     | profile, department, location, team, position                                | Active  |
| `organization:read` | workspace, department, location, team                                        | Active  |
| `schedules:read`    | schedule_shift, schedule_absence                                             | Active  |
| `schedules:write`   | schedule_shift                                                               | Active  |
| `operations:read`   | department_session, deviation                                                | Active  |
| `operations:write`  | department_session (future)                                                  | Planned |
| `reports:read`      | daily_reconciliation, shift_approval, workspace_kpi_target, workspace_budget | Active  |
| `guardian:read`     | guardian_signal, guardian_log                                                | Active  |
| `events:read`       | engine_event                                                                 | Active  |
| `suppliers:read`    | supplier, supplier_order                                                     | Active  |
| `waste:read`        | waste_log                                                                    | Active  |
| `equipment:read`    | asset, asset_maintenance, asset_downtime                                     | Active  |
| `training:read`     | protocol, protocol_assignment                                                | Active  |
| `contracts:read`    | employment_contract                                                          | Active  |
| `haccp:read`        | haccp_log (future)                                                           | Planned |
| `haccp:write`       | haccp_log (future)                                                           | Planned |

## Gateway Pattern

External consumers get one API key → validated by Edge Functions → services behind the gate.

**The web app/Edge Function IS the gateway.** Services don't hold consumer keys.

## New Endpoint Checklist

1. Create handler in `workspace-api/handlers/`
2. Register route in `workspace-api/index.ts`
3. Add to API registry
4. Add scope to canonical list above
5. Update preset bundles

## Pre-workspace check (ADR-0123)

When creating a new Edge Function, ask: does the caller have an active workspace at call time?

- **Yes** → must route through `workspace-api` gateway per ADR-0029.
- **No (pre-workspace flow — invite tokens, signup, identity-link callbacks)** → MAY stay standalone per ADR-0123.

If the answer is "no", count the current set of pre-workspace endpoints before proceeding:

```bash
# Current pre-workspace exceptions (as of 2026-04-17): accept-invitation, create-invitation
ls supabase/functions/ | grep -E 'invitation'
```

If this would be the **3rd** pre-workspace endpoint, **stop** and open an `identity-api` gateway ADR before implementation. Two endpoints is an exception; three is a pattern that deserves its own gateway tier.

Document the new endpoint's pre-workspace status in its `config.toml` entry with a comment:

```toml
[functions.<name>]
verify_jwt = false  # Pre-workspace — auth via token per ADR-0123.
```

## New Table Checklist (workspace-scoped)

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. JWT policy: `USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))`
3. API key policy: `USING (workspace_id = get_api_workspace_id())`
4. Write policy if needed: `api_key_write_{table}`
5. Handler + route + registry if publicly exposed

## Service Authentication

ALL microservices (contract-service, scrapling, etc.):

- MUST use managed service keys (`smo_svc_live_*`) in `platform_api_key`
- MUST validate via `validate-api-key` Edge Function
- MUST NOT use hardcoded env var keys

## API Key Tiers

| Tier   | What               | Storage                            | Key prefix                      |
| ------ | ------------------ | ---------------------------------- | ------------------------------- |
| Tier 1 | Workspace API keys | SHA-256 hash in `platform_api_key` | `smo_sk_live_` / `smo_sk_test_` |
| Tier 2 | External secrets   | Supabase Vault (pgsodium)          | Provider-specific               |
| Tier 3 | Service-to-service | SHA-256 hash in `platform_api_key` | `smo_svc_live_`                 |

## Reference Files

- Edge Functions: `supabase/functions/`
- Config: `supabase/functions/config.toml`
- Auth middleware: `supabase/functions/_shared/auth-middleware.ts`
- Vault wrappers: `get_secret()`, `upsert_secret()`, `delete_vault_secret()`
