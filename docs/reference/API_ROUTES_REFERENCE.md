---
title: "Next.js API Routes Reference"
status: canonical
updated: 2026-03-14
created: 2026-03-14
module: infrastructure
tags: [api, routes, next.js, reference]
---

# Next.js API Routes Reference

> Complete inventory of all Next.js API routes across web and landing apps.
> For microservices, see `SERVICES_ARCHITECTURE.md`. For Edge Functions, see `EDGE_FUNCTIONS_REFERENCE.md`.

---

## Overview

| App              | Routes | Base URL                                                            |
| ---------------- | ------ | ------------------------------------------------------------------- |
| **apps/web**     | 47     | `https://app.smartout.ai/api/` or `https://{slug}.smartout.ai/api/` |
| **apps/landing** | 7      | `https://smartout.ai/api/`                                          |
| **Total**        | **54** |                                                                     |

### Auth Methods Used

| Method      | Description                                                      |
| ----------- | ---------------------------------------------------------------- |
| **Session** | Supabase cookie-based auth via `supabase.auth.getUser()`         |
| **Godmode** | `getSuperAdminId()` — requires `user_identity.is_godmode = true` |
| **Bearer**  | Secret token in `Authorization` header                           |
| **Webhook** | Provider-specific signature verification                         |
| **None**    | Public endpoint                                                  |

---

## Apps/Web — Core Routes

### GET /api/health

| Field   | Value                                   |
| ------- | --------------------------------------- |
| Auth    | Bearer (HEALTH_CHECK_SECRET) — optional |
| Purpose | Deployment health + uptime monitoring   |

**Response:**

```json
{
  "status": "healthy|unhealthy",
  "timestamp": "ISO8601",
  "version": "1.0.0",
  "checks": {
    "database": "ok|error",
    "memory": "ok|warning"
  }
}
```

Returns 200 (healthy) or 503 (unhealthy).

---

### GET /api/auth/callback

| Field   | Value                                                           |
| ------- | --------------------------------------------------------------- |
| Auth    | None (OAuth callback)                                           |
| Query   | `code` (auth code), `next` (redirect path, default: /dashboard) |
| Purpose | Exchange OAuth code for session cookie                          |

Redirects 302 to `next` on success, or `/login?error=Invalid_link` on failure.

---

### POST /api/telemetry

| Field      | Value                        |
| ---------- | ---------------------------- |
| Auth       | Session (401 if missing)     |
| Rate Limit | Upstash Redis (429 on limit) |
| Purpose    | Client-side event telemetry  |

**Request:**

```json
{
  "event": "string",
  "workspace_id": "uuid",
  "actor_id": "uuid",
  "properties": {},
  "timestamp": "ISO8601"
}
```

Validates `actor_id` matches authenticated user. Returns 202 `{ ok: true }`.

---

### GET /api/content/[slug]

| Field   | Value                                        |
| ------- | -------------------------------------------- |
| Auth    | None (public)                                |
| Purpose | Fetch published landing page content configs |

**Response:** `{ slug, name, locale, content, version, published_at }` or 404.

---

### POST /api/wizard/start

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| Auth    | None (requires ULTRAVOX_API_KEY configured) |
| Purpose | Start voice session for onboarding wizard   |

**Request:** `{ "mission_id": "string", "selected_tools": [...] }`

**Response:**

```json
{
  "joinUrl": "wss://...",
  "callId": "uuid",
  "mission": "onboarding-interview",
  "voiceFallbackUsed": false
}
```

Returns 503 if voice not configured, 502 if call fails.

---

### POST /api/scrape/raw

| Field   | Value                                               |
| ------- | --------------------------------------------------- |
| Auth    | None (public proxy)                                 |
| Purpose | Forward scraping requests to Scrapling microservice |

Proxies request body to `SCRAPLING_SERVICE_URL/scrape-raw`. Returns 503 if not configured.

---

## Apps/Web — AI Agent Routes

### POST /api/onboarding-agent

| Field   | Value                                    |
| ------- | ---------------------------------------- |
| Auth    | Session (401 if missing)                 |
| Purpose | AI-guided onboarding wizard conversation |

**Request:**

```json
{
  "sessionId": "uuid",
  "userMessage": "string (1-5000 chars)",
  "conversationHistory": [...],
  "extractIntelligence": false
}
```

Verifies session ownership (403 if not user's session). If `extractIntelligence: true`, runs intelligence extraction instead of conversation.

**Response:** `{ text, toolCalls, toolResults }`

---

### POST /api/contract-agent

| Field   | Value                               |
| ------- | ----------------------------------- |
| Auth    | Godmode (403 if not platform-admin) |
| Purpose | AI-guided contract template editor  |

**Request:** `{ "templateId": "uuid", "userMessage": "string", "conversationHistory": [...], "editorState": {...} }`

**Response:** `{ text, actions, toolCalls }`

---

### POST /api/journey-agent

| Field   | Value                            |
| ------- | -------------------------------- |
| Auth    | Godmode                          |
| Purpose | AI wizard for journey definition |

**Request:** `{ "sessionId": "uuid", "userMessage": "string" }`

Loads wizard_session, appends conversation, calls `runJourneyAgent()`.

**Response:** `{ text, phase, draftJourney }`

---

### POST /api/reports-agent

| Field   | Value             |
| ------- | ----------------- |
| Auth    | Session           |
| Purpose | AI report builder |

**Request:** `{ "workspaceId": "uuid", "userMessage": "string", "conversationHistory": [...] }`

Verifies workspace membership (403 if not member).

**Response:** `{ text, reportData, savedReport }`

---

### POST & GET /api/agent/memory

| Field   | Value                     |
| ------- | ------------------------- |
| Auth    | Session                   |
| Purpose | Persistent agent memories |

**POST (save):** `{ "content": "string", "memoryType": "string", "expiresAt": "ISO8601" }`
**GET (load):** Returns 50 most recent non-expired memories for user's profile.

---

## Apps/Web — Webhook Routes

### POST /api/webhooks/docuseal

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| Auth    | Webhook signature (DOCUSEAL_WEBHOOK_SECRET) |
| Purpose | DocuSeal e-signature status updates         |

**Events:** form.viewed, form.started, form.completed, form.declined, submission.completed, submission.expired

**Process:**

1. Validate webhook signature
2. Find contract by `docuseal_submission_id`
3. Map event to status (with weight-based regression prevention)
4. Update contract, insert event + audit log
5. Cancel reminders if declined/signed
6. Update workspace `contract_status` if signed

Always returns 200 `{ received: true }`.

---

## Apps/Web — Admin Routes (Landing Analytics)

### POST /api/admin/tag-visitor

| Field   | Value                             |
| ------- | --------------------------------- |
| Auth    | Godmode                           |
| Purpose | Tag landing visitor for CRM/sales |

**Request:** `{ "visitor_id": "uuid", "label": "string", "notes": "string" }`

---

### GET /api/admin/session-events

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Auth    | Godmode                                   |
| Query   | `session_id` (required)                   |
| Purpose | Event timeline for landing session detail |

Returns up to 500 `landing_event` rows ordered by `created_at`.

---

### GET /api/admin/visitor-sessions

| Field   | Value                               |
| ------- | ----------------------------------- |
| Auth    | Godmode                             |
| Query   | `visitor_id` (required)             |
| Purpose | Session history for landing visitor |

Returns up to 100 `landing_session` rows ordered by `started_at DESC`.

---

## Apps/Web — Platform-Admin Routes

All routes require `getSuperAdminId()` check (403 if not godmode).

### Health & Monitoring

#### GET /api/platform-admin/health/status

Comprehensive system health. Checks (parallel): Supabase DB, Contract Service, Scrapling, Shift MCP, Edge Functions.

**Query:** `include=integrity` — also runs watchdog-integrity checks.

**External service configuration checks:** Stripe, SendGrid, Twilio, DocuSeal, PostHog, Sentry, Upstash Redis, OpenRouter.

**Response:** `{ overall, timestamp, services: [...], external: [...], integrity: {...}, metrics: {...} }`

---

#### POST /api/platform-admin/audit-log

Log platform admin actions. **Request:** `{ "action": "string", "entityType": "string", "entityId": "uuid", "details": {} }`

---

#### GET /api/platform-admin/services/health

Microservice health check. Pings stage-engine, shift-mcp, contract-service `/health` endpoints (5s timeout).

**Response:** `{ services: [{ name, url, status, responseTime, version, error }] }`

---

### User Management

#### POST /api/platform-admin/users/toggle-super-admin

| Field   | Value                                        |
| ------- | -------------------------------------------- |
| Request | `{ "userId": "uuid", "isGodmode": boolean }` |
| Guard   | Cannot revoke own godmode                    |

Updates `user_identity.is_godmode`. Logs audit event.

---

### Workspace Management

#### GET /api/platform-admin/workspaces

**Query:** `type` = `companies` | `templates` | `workspaces`

Returns dropdown data for workspace creation form.

---

#### POST /api/platform-admin/workspaces

Create workspace + company.

**Request:**

```json
{
  "company_name": "string",
  "org_number": "string",
  "is_new_company": true,
  "company_id": "uuid (if existing)",
  "workspace_name": "string",
  "slug": "string (auto-generated if empty)",
  "industry": "string",
  "template_id": "uuid (optional)",
  "price_per_employee": 299,
  "billing_interval": "monthly",
  "trial_days": 14,
  "discount_percent": 0
}
```

**Response:** `{ data: { workspace_id, company_id, slug, contract_id } }` (201)

409 on duplicate slug.

---

### API Key Management

#### GET /api/platform-admin/keys

List keys. Filters: `type`, `env`, `status`. Joins workspace names.

#### POST /api/platform-admin/keys

Create key. Generates `smo_sk_[env]_[random]` or `smo_svc_[env]_[random]`. SHA-256 stored, plaintext shown once.

**Request:**

```json
{
  "name": "string",
  "key_type": "workspace|service",
  "workspace_id": "uuid (workspace keys only)",
  "environment": "live|test",
  "rate_limit": 60,
  "scopes": ["profiles:read", "schedules:read"],
  "expires_at": "ISO8601"
}
```

**Response:** `{ data: { ...key, plaintext_key }, warning }` (201)

#### GET /api/platform-admin/keys/[id]

Key detail + rotation history + usage summary.

#### GET /api/platform-admin/keys/[id]/usage

Hourly usage buckets. Query: `limit` (default 168, max 1000).

#### POST /api/platform-admin/keys/[id]/rotate

**Request:** `{ "grace_period": "48 hours" }`

Calls `rotate_api_key` RPC. Returns new plaintext key.

#### POST /api/platform-admin/keys/[id]/revoke

Revokes key + all versions in rotation group.

---

### Secrets Management

#### GET /api/platform-admin/secrets

List secret metadata (no values returned). Joins workspace names.

#### POST /api/platform-admin/secrets

Create or rotate secret.

**Request:**

```json
{
  "provider": "string",
  "vault_secret_name": "string",
  "secret_value": "string",
  "workspace_id": "uuid (optional)",
  "environment": "string",
  "rotation_reminder_days": 90
}
```

Stores in Supabase Vault via `upsert_secret()` RPC.

#### DELETE /api/platform-admin/secrets

**Request:** `{ "id": "uuid" }`

Removes from Vault + deletes metadata row.

#### POST /api/platform-admin/secrets/bulk

Bulk import or delete. Discriminated union: `{ action: "import", secrets: [...] }` or `{ action: "delete", keys: [...] }`.

---

### Contract Management

#### GET /api/platform-admin/contracts

Dropdown data. Query: `type` = `templates` | `companies` | `workspaces`.

#### POST /api/platform-admin/contracts

Create and optionally send contract.

**Request:**

```json
{
  "template_id": "uuid",
  "company_id": "uuid",
  "workspace_id": "uuid (optional)",
  "recipient_name": "string",
  "recipient_email": "string",
  "title": "string",
  "notes": "string"
}
```

Creates draft, attempts send via contract microservice. Returns `{ data: { contract_id, status } }` (201).

#### POST /api/platform-admin/contracts/[id]/send

Send contract for signing via contract microservice.

#### POST /api/platform-admin/contracts/[id]/remind

Send signing reminder.

#### POST /api/platform-admin/contracts/[id]/cancel

Cancel pending contract.

---

### Content Management

#### GET /api/platform-admin/content/configs

List landing page configs. Returns: `config_id, slug, name, locale, status, version, published_at`.

#### POST /api/platform-admin/content/configs

Create config. **Request:** `{ "slug": "string", "name": "string", "locale": "string", "config_json": {} }`

Slug validation: `/^[a-z0-9-]+$/`.

#### PATCH /api/platform-admin/content/configs/[slug]

Update config content/metadata.

#### DELETE /api/platform-admin/content/configs/[slug]

Delete config.

---

### Communications (Email Campaigns)

#### POST /api/platform-admin/communications/send

Full email send pipeline.

**Request:**

```json
{
  "audience": {
    "type": "all_users|super_admins|workspace|role|status|user_ids",
    "workspace_id": "uuid (if type=workspace)",
    "role": "string (if type=role)",
    "status": "string (if type=status)",
    "user_ids": ["uuid"]
  },
  "template": "announcement|transactional|marketing",
  "subject": "string",
  "message": "string",
  "confirmed": false,
  "idempotencyKey": "string"
}
```

**Pipeline:**

1. Check outbound email enabled (kill switch)
2. Rate limit by classification
3. Idempotency check (409 if duplicate)
4. Resolve audience → recipients
5. Check hard cap / soft cap
6. Filter suppressed emails
7. Create `platform_communication_log` + `platform_communication_recipient` rows
8. Call `createEmailJob()` from `@smartout/notifications`
9. Update delivery statuses

**Response:** `{ jobId, status, recipientCount, sentCount, failedCount }`

#### GET /api/platform-admin/communications/history

Communication job history.

#### GET /api/platform-admin/communications/[jobId]

Job detail with recipient status breakdown.

#### POST /api/platform-admin/communications/[jobId]/cancel

Cancel pending job, mark pending recipients as cancelled.

#### GET /api/platform-admin/communications/[jobId]/recipients

Paginated recipient list with delivery status.

#### POST /api/platform-admin/communications/translate

Translation utility for email templates.

#### POST /api/platform-admin/communications/dry-run

Preview email without sending.

#### POST /api/platform-admin/communications/ai-correct

AI-assisted copy correction.

---

### Journey Wizard (AI-Guided)

#### GET /api/platform-admin/journeys/wizard

List recent wizard sessions. Limit: 50, ordered by `created_at DESC`.

#### POST /api/platform-admin/journeys/wizard

Create session. **Request:** `{ "workspaceId": "uuid" }`

#### GET /api/platform-admin/journeys/wizard/[sessionId]

Load session state for continuation.

#### POST /api/platform-admin/journeys/wizard/[sessionId]/complete

Mark session complete, finalize journey from draft.

---

### Journey CRUD

#### GET /api/platform-admin/journeys/[id]

Journey + steps + recent events (parallel queries).

#### PATCH /api/platform-admin/journeys/[id]

Update metadata (title, module, actor, platform, priority, tags, trigger_description, etc.).

#### DELETE /api/platform-admin/journeys/[id]

Hard delete (cascade: steps, events, test_runs).

#### POST /api/platform-admin/journeys/[id]/generate

Generate outputs. **Request:** `{ "type": "e2e|doc|linear|botsson" }`

Returns generated content (Playwright test, docs page, Linear issue, or Botsson knowledge).

---

## Apps/Landing Routes

### GET /api/health

Simple health check. **Response:** `{ status: "healthy", timestamp, version }`

---

### GET /api/auth/callback

OAuth callback (same as web version).

---

### POST /api/track

| Field   | Value                                     |
| ------- | ----------------------------------------- |
| Auth    | None (public, write-only)                 |
| Purpose | Landing page analytics (no PII beyond IP) |

**Request:**

```json
{
  "event_type": "page_view|voice_session_started|cta_click|click|scroll_depth|session_heartbeat|session_end",
  "variant": "string",
  "session_id": "uuid",
  "visitor_id": "uuid",
  "referrer": "string",
  "details": {}
}
```

**Process:** Best-effort visitor upsert → insert `landing_event` (critical) → best-effort session upsert.

---

### POST /api/docs-agent

| Field   | Value                                        |
| ------- | -------------------------------------------- |
| Auth    | None (public)                                |
| Purpose | AI documentation search for landing visitors |

**Request:** `{ "message": "string", "history": [...] }`
**Response:** `{ answer: "string", sources: [{ title, href }] }`

---

### POST /api/wizard/start

Start Ultravox voice session for landing demo. Same as web version but includes variant context logging.

---

### POST /api/wizard/engine-start

| Field   | Value                                                         |
| ------- | ------------------------------------------------------------- |
| Auth    | None (public)                                                 |
| Purpose | Start voice via Stage Engine (alternative to direct Ultravox) |

**Request:** `{ "mission_id": "string" }`

Calls Stage Engine `/adapters/ultravox/create-call`.

**Response:** `{ joinUrl, callId, sessionId, mission, engine: true }`

---

### POST /api/revalidate

| Field   | Value                                      |
| ------- | ------------------------------------------ |
| Auth    | REVALIDATION_SECRET in body                |
| Purpose | On-demand cache bust after variant publish |

**Request:** `{ "secret": "string" }`

Calls `revalidateTag("landing")`. Returns `{ revalidated: true }`.

---

## Route Summary by Auth Level

| Auth Level                   | Count  | Examples                                                             |
| ---------------------------- | ------ | -------------------------------------------------------------------- |
| **None (public)**            | 10     | health, auth callback, content/[slug], track, docs-agent, wizard     |
| **Session (user)**           | 7      | telemetry, onboarding-agent, reports-agent, agent/memory, scrape/raw |
| **Godmode (platform-admin)** | 34     | All /platform-admin/_ routes, contract-agent, journey-agent, admin/_ |
| **Bearer token**             | 1      | health (optional)                                                    |
| **Webhook signature**        | 1      | webhooks/docuseal                                                    |
| **Secret in body**           | 1      | revalidate                                                           |
| **Total**                    | **54** |                                                                      |
