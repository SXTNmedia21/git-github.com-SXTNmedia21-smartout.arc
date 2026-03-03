---
title: "Edge Functions Reference"
status: canonical
updated: 2026-03-14
created: 2026-03-14
module: infrastructure
tags: [edge-functions, supabase, api, reference]
---

# Edge Functions Reference

> Complete inventory of all Supabase Edge Functions. 22 functions across 6 categories.
> For microservices, see `SERVICES_ARCHITECTURE.md`. For Next.js routes, see `API_ROUTES_REFERENCE.md`.

---

## Shared Utilities (`_shared/`)

| Utility                 | Purpose                                              | Key Exports                                                       |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **auth-middleware.ts**  | Dual-auth resolver (JWT + API key)                   | `resolveAuth()`, `AuthContext`, `AuthMethod`, `hasScope()`        |
| **api-key-auth.ts**     | API key validation, workspace context, usage logging | `validateApiKey()`, `executeWithWorkspaceContext()`, `logUsage()` |
| **scope-middleware.ts** | Scope validation + environment enforcement           | `requireScope()`, `getKeyEnvironment()`                           |
| **cors.ts**             | Standard CORS headers                                | `corsHeaders`                                                     |
| **rate-limit.ts**       | Upstash Redis sliding window (60s)                   | `checkRateLimit()`                                                |
| **twilio.ts**           | SMS delivery via Twilio REST API                     | `sendSms()`, `sendSmsBatch()`                                     |

---

## Category 1: API Gateway (`workspace-api`)

Single Edge Function with sub-routing. All endpoints require API key authentication. JWT gets `*` scope (RLS enforces). Config: `verify_jwt = false`.

| Route             | Method | Scope            | Description                                          |
| ----------------- | ------ | ---------------- | ---------------------------------------------------- |
| `/v1/profiles`    | GET    | `profiles:read`  | List workspace profiles (filters: status, is_active) |
| `/v1/departments` | GET    | `profiles:read`  | List departments                                     |
| `/v1/teams`       | GET    | `profiles:read`  | List teams                                           |
| `/v1/locations`   | GET    | `profiles:read`  | List locations                                       |
| `/v1/contracts`   | GET    | `contracts:read` | List employment contracts                            |
| `/v1/protocols`   | GET    | `training:read`  | List policies/protocols                              |
| `/v1/assignments` | GET    | `training:read`  | List protocol assignments                            |

**Handler files:** `supabase/functions/workspace-api/handlers/{profiles,organization,contracts,training}.ts`

**Request pattern:**

```
GET https://{projectRef}.supabase.co/functions/v1/workspace-api/v1/profiles
Authorization: Bearer smo_sk_live_...
```

**Response pattern:**

```json
{
  "data": [...],
  "count": 42,
  "workspace_id": "uuid"
}
```

---

## Category 2: Onboarding & Workspace Setup

### create-invitation

| Field   | Value                                                       |
| ------- | ----------------------------------------------------------- |
| Auth    | JWT required (`verify_jwt = true`)                          |
| Methods | POST, OPTIONS                                               |
| Purpose | Create and send workspace invitations (email, SMS, or link) |

**Request:**

```json
{
  "workspace_id": "uuid",
  "invitations": [
    {
      "email": "user@example.com",
      "name": "User Name",
      "role": "employee",
      "invite_type": "email|sms|link",
      "phone": "+4712345678",
      "departments": ["uuid"],
      "teams": ["uuid"]
    }
  ]
}
```

**Response:** `{ invitations: [{ id, token, invite_url, delivery_status }] }`

**Integrations:** SendGrid (email), Twilio (SMS via `_shared/twilio.ts`)

---

### accept-invitation

| Field   | Value                                               |
| ------- | --------------------------------------------------- |
| Auth    | None (`verify_jwt = false`)                         |
| Methods | POST, OPTIONS                                       |
| Purpose | Accept invitation by token — creates user + profile |

**Request:** `{ "token": "invite-token-string" }`

**Process:**

1. Validate token (not expired, not accepted)
2. Create auth user
3. Create `user_identity` record
4. Create `profile` with 6-char code
5. Assign departments + teams
6. Mark invitation as accepted

**Response:** `{ user_id, profile_id, workspace_id }`

---

### activate-workspace

| Field   | Value                                          |
| ------- | ---------------------------------------------- |
| Auth    | JWT required                                   |
| Methods | POST, OPTIONS                                  |
| Purpose | Atomically activate workspace after onboarding |

**Request:** `{ "workspace_id": "uuid", "company_data": {...}, "departments": [...], "locations": [...] }`

**Process:** Calls `activate_workspace_v3` RPC. Creates default agent profile (Mr. Botsson).

---

### finalize-workspace

| Field   | Value                                                          |
| ------- | -------------------------------------------------------------- |
| Auth    | JWT required                                                   |
| Methods | POST, OPTIONS                                                  |
| Purpose | Create workspace via RPC (deprecated — use activate-workspace) |

---

### extract-workspace-data

| Field   | Value                                  |
| ------- | -------------------------------------- |
| Auth    | JWT required                           |
| Methods | POST, OPTIONS                          |
| Purpose | Proxy to Scrapling `/extract` endpoint |

**Request:** `{ "url": "https://restaurant.no" }`
**Response:** Scrapling structured extraction result (see `SCRAPLING_API.md`)

---

### scrape-raw-data

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Auth    | JWT required                              |
| Methods | POST, OPTIONS                             |
| Purpose | Proxy to Scrapling `/scrape-raw` endpoint |

**Request:** `{ "url": "https://example.com" }`
**Response:** `{ title, description, text_content, images, files }`

---

### analyze-workspace

| Field   | Value                                            |
| ------- | ------------------------------------------------ |
| Auth    | JWT required                                     |
| Methods | POST, OPTIONS                                    |
| Purpose | AI analysis of workspace data (mock/placeholder) |

**Request:** `{ "workspace_data": {...} }`
**Response:** `{ departments: [...], teams: [...], zones: [...], branding: {...} }`

---

## Category 3: Intelligence Gathering

### gather-workspace-intelligence

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| Auth    | JWT required                                |
| Methods | POST, OPTIONS                               |
| Purpose | 6-step pipeline for onboarding intelligence |

**Request:**

```json
{
  "session_id": "uuid",
  "url": "https://restaurant.no",
  "org_number": "123456789"
}
```

**Pipeline:**

1. Scrape website (via Scrapling)
2. Brreg name lookup (Norwegian Company Registry)
3. Fetch Brreg details + roles (daglig leder)
4. Web search (via web-search-intelligence)
5. Build structured response
6. Store in `onboarding_session`

**Response:** `{ company: {...}, locations: [...], departments: [...], insights: {...} }`

**Modes:** URL-based (scrape + search) or org-number-based (Brreg direct lookup)

---

### web-search-intelligence

| Field   | Value                                              |
| ------- | -------------------------------------------------- |
| Auth    | JWT required                                       |
| Methods | POST, OPTIONS                                      |
| Purpose | Web search via Serper API for company intelligence |

**Request:** `{ "query": "restaurant name oslo", "company_name": "..." }`

**Extracts:** Ratings, news articles, seasonal patterns, job listings.

**Fallback:** Returns empty results if Serper API not configured.

---

## Category 4: API Key Management

### validate-api-key

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Auth    | Dual-auth (`verify_jwt = false`)          |
| Methods | GET, OPTIONS                              |
| Purpose | Validate API key — used by other services |

**Request:** `Authorization: Bearer smo_sk_live_...`

**Response:**

```json
{
  "valid": true,
  "method": "api_key",
  "key_id": "uuid",
  "workspace_id": "uuid",
  "scopes": ["profiles:read", "schedules:read"]
}
```

Includes rate limit check via Upstash Redis.

---

### cleanup-api-keys

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Auth    | Cron bearer token (`WATCHDOG_CRON_SECRET`) |
| Methods | Cron only (no HTTP)                        |
| Purpose | Revoke expired/expired-grace API keys      |

Calls `cleanup_expired_api_keys` RPC.

---

## Category 5: Communications & Webhooks

### sendgrid-webhook

| Field   | Value                                   |
| ------- | --------------------------------------- |
| Auth    | Webhook signature (ECDSA P-256 SHA-256) |
| Methods | POST                                    |
| Config  | `verify_jwt = false`                    |
| Purpose | Process SendGrid delivery events        |

**Events handled:** open, click, bounce, delivered, unsubscribe, spamreport

**Updates:**

- `platform_communication_recipient` — delivery status
- `platform_email_suppression` — bounce/unsubscribe tracking
- `platform_webhook_event` — raw event log

---

## Category 6: Financial & Reconciliation

### process-settlement-image

| Field   | Value                                             |
| ------- | ------------------------------------------------- |
| Auth    | Service role only                                 |
| Methods | POST, OPTIONS                                     |
| Config  | `verify_jwt = false`                              |
| Purpose | OCR processing for POS/terminal settlement images |

**Process:**

1. Fetch image from `settlements` storage bucket
2. Call Google Vision API for text detection
3. Parse Norwegian POS/terminal patterns
4. Calculate confidence score
5. Store `ocr_raw_text`, `ocr_parsed`, `ocr_confidence`

---

### validate-settlement

| Field   | Value                                             |
| ------- | ------------------------------------------------- |
| Auth    | Service role only                                 |
| Methods | POST, OPTIONS                                     |
| Config  | `verify_jwt = false`                              |
| Purpose | Cross-validate POS vs terminal settlement amounts |

**Process:**

1. Fetch POS + terminal images with OCR data
2. Extract totals from parsed OCR
3. Calculate difference %
4. Check threshold (1% or 50 NOK)
5. Create `settlement_validation` record
6. If mismatch > threshold: create deviation
7. If mismatch > 5%: blocks day approval
8. Update `daily_reconciliation` with revenue data

---

## Category 7: Process Engine

### engine-dispatch

| Field   | Value                                           |
| ------- | ----------------------------------------------- |
| Auth    | Service role only                               |
| Methods | POST, OPTIONS                                   |
| Config  | `verify_jwt = false`                            |
| Purpose | Event dispatcher for workflow automation engine |

**Request:** `{ "event_type": "string", "entity_type": "string", "entity_id": "uuid", "data": {...} }`

**Process:**

1. Record event (idempotency check)
2. Match active triggers (condition evaluation)
3. Create `engine_state` + execute first step, or schedule delayed trigger
4. Resume waiting states on matching event

**Action types:** `wait_for_event`, `assign_task`, `send_notification`, `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control`, `start_process`

**Condition evaluator:** `match`, `step_status`, `all`/`any` combinators.

---

## Category 8: Monitoring & Watchdog

### health-check

| Field   | Value                                         |
| ------- | --------------------------------------------- |
| Auth    | Cron bearer token                             |
| Methods | GET                                           |
| Purpose | Basic system health (DB query + Deno version) |

**Response:** `{ status: "healthy|degraded", timestamp, checks: {...} }`

---

### watchdog-integrity

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Auth    | Cron bearer token                         |
| Methods | GET                                       |
| Purpose | Data integrity checks (4 parallel checks) |

**Checks:**

1. Dangling `company_member` records
2. Stale active sessions (>24h)
3. Empty workspaces (no profiles)
4. Expired pending invitations

**Response:** `{ status: "healthy|degraded|unhealthy", checks: [{name, status, count, details}] }`

---

### watchdog-uptime

| Field   | Value                     |
| ------- | ------------------------- |
| Auth    | Cron bearer token         |
| Methods | GET                       |
| Purpose | Service uptime monitoring |

**Checks (parallel):** Web app (port 3050), Landing page (port 3055) via `/api/health`

**Response:** `{ status: "operational|degraded|outage", services: [{name, url, status, latency_ms}] }`

---

### contract-lifecycle

| Field   | Value                                 |
| ------- | ------------------------------------- |
| Auth    | Cron bearer token                     |
| Methods | Cron only                             |
| Purpose | Automated contract status transitions |

**Actions:**

1. Trial expirations → workspace suspended
2. Grace period expirations → workspace deactivated
3. Signing deadline expirations → contract expired (cancel reminders)

---

## Summary

| Category                    | Count            | Auth Pattern        |
| --------------------------- | ---------------- | ------------------- |
| API Gateway (workspace-api) | 7 routes         | API key (dual-auth) |
| Onboarding & Setup          | 7                | JWT                 |
| Intelligence Gathering      | 2                | JWT                 |
| API Key Management          | 2                | Dual-auth / Cron    |
| Communications              | 1                | Webhook signature   |
| Financial & Reconciliation  | 2                | Service role        |
| Process Engine              | 1                | Service role        |
| Monitoring & Watchdog       | 4                | Cron token          |
| **Total**                   | **22 functions** |                     |
| Shared utilities            | 6                | —                   |

### config.toml `verify_jwt = false` Functions

These functions handle auth internally (not via Supabase JWT verification):

- workspace-api
- accept-invitation
- validate-api-key
- cleanup-api-keys
- sendgrid-webhook
- process-settlement-image
- validate-settlement
- engine-dispatch
- health-check
- watchdog-integrity
- watchdog-uptime
- contract-lifecycle

All other functions use default `verify_jwt = true`.
