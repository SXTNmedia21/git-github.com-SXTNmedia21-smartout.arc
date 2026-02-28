---
title: "API Endpoint Reference"
id: REF_API_ENDPOINTS
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on:
  - REF_API_OVERVIEW
tags:
  - api
  - endpoints
  - rest
  - documentation
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout API Endpoint Reference

> Classical endpoint documentation for currently implemented APIs plus target control endpoints.
> Last updated: 2026-02-28

---

## Document conventions

For each endpoint:

- **Auth** describes required caller identity/credential.
- **Request attributes** list accepted input fields and meaning.
- **Response attributes** list primary output fields.
- **Errors** list expected status classes and known causes.

Visibility controls:

- **Visibility:** `internal`, `partner`, or `public`.
- Use `docs/reference/api-visibility.profiles.json` to control what is shown in release docs.

---

## Next.js route handlers

### `POST /api/wizard/start` (web)

- **Location:** `apps/web/src/app/api/wizard/start/route.ts`
- **Auth:** Server-side `ULTRAVOX_API_KEY` env; no end-user auth check in handler.
- **Purpose:** Start Ultravox mission call from dashboard context.

Request attributes:

- `mission_id` (string, optional): mission identifier; default `mr-botsson`.
- `metadata` (object, optional): additional mission metadata.

Response attributes:

- `joinUrl` (string): URL for joining voice session.
- `callId` (string): provider call identifier.
- `mission` (string): mission name.

Errors:

- `503` when `ULTRAVOX_API_KEY` not configured.
- `502` when mission call start fails.

---

### `POST /api/wizard/start` (landing)

- **Location:** `apps/landing/src/app/api/wizard/start/route.ts`
- **Auth:** Server-side `ULTRAVOX_API_KEY` env.
- **Purpose:** Start landing demo voice mission.

Request attributes:

- `mission_id` (string, optional): default `landing-demo`.
- `metadata` (object, optional).

Response attributes:

- `joinUrl`, `callId`, `mission`.

Errors:

- `503` missing voice config.
- `502` upstream voice start failure.

---

### `POST /api/docs-agent` (landing)

- **Location:** `apps/landing/src/app/api/docs-agent/route.ts`
- **Visibility:** `internal`
- **Auth:** no explicit user auth in handler.
- **Purpose:** answer user-manual questions with docs-focused AI agent.

Request attributes:

- `message` (string, required, 1..4000)
- `history[]` (optional):
  - `role` (`user` | `assistant`)
  - `content` (string)

Response attributes:

- `answer` (string)
- `sources[]`:
  - `title` (string)
  - `href` (string)

Errors:

- `400` invalid body
- `500` docs-agent processing failure

---

### `POST /api/webhooks/docuseal`

- **Location:** `apps/web/src/app/api/webhooks/docuseal/route.ts`
- **Auth:** Optional static signature via `DOCUSEAL_WEBHOOK_SECRET` and `x-docuseal-signature`.
- **Purpose:** Ingest DocuSeal events and update contract state.

Request attributes:

- `event_type` (string): webhook event name.
- `timestamp` (string datetime): event timestamp.
- `data.id` (number): event entity id.
- `data.submission_id` (number): DocuSeal submission id.
- `data.status` (string): upstream status.
- `data.documents[]` (optional): document descriptors.
- `data.submitters[]` (optional): submitter completion data.

Response attributes:

- `received` (boolean): intake acknowledgement.
- `status` (string, optional): mapped contract status.
- `skipped` (string, optional): reason if ignored.

Errors:

- `401` invalid signature.
- `400` invalid payload schema.
- `404` contract mapping not found.
- `500` contract update write error.

---

### `GET /api/platform-admin/content/configs`

- **Location:** `apps/web/src/app/api/platform-admin/content/configs/route.ts`
- **Auth:** Super-admin identity via `getSuperAdminId()`.
- **Purpose:** List landing content config records.

Response attributes:

- `data[]`: config summaries:
  - `config_id`, `slug`, `name`, `locale`, `status`, `version`, `published_at`, `updated_at`.

Errors:

- `403` forbidden.
- `500` database query error.

---

### `POST /api/platform-admin/content/configs`

- **Location:** same as above.
- **Auth:** Super-admin.
- **Purpose:** Create new landing config draft.

Request attributes:

- `slug` (string): lowercase kebab-case identifier.
- `name` (string): display name.
- `locale` (string, optional): locale code, default `no`.
- `config_json` (object): config payload.

Response attributes:

- `data`: inserted config record.

Errors:

- `403` forbidden.
- `400` schema validation error.
- `500` insert error.

---

### `GET /api/platform-admin/content/configs/[slug]`

- **Location:** `apps/web/src/app/api/platform-admin/content/configs/[slug]/route.ts`
- **Auth:** Super-admin.
- **Purpose:** Fetch full config by slug.

Path attributes:

- `slug` (string): config slug.

Response attributes:

- `data`: full `landing_config` record.

Errors:

- `403` forbidden.
- `404` not found.

---

### `PATCH /api/platform-admin/content/configs/[slug]`

- **Location:** same file.
- **Auth:** Super-admin.
- **Purpose:** Update config fields.

Path attributes:

- `slug` (string).

Request attributes:

- `name` (string, optional).
- `config_json` (object, optional).
- `locale` (string, optional).

Response attributes:

- `data`: updated record.

Errors:

- `403` forbidden.
- `400` validation failure.
- `404` not found.

---

### `DELETE /api/platform-admin/content/configs/[slug]`

- **Location:** same file.
- **Auth:** Super-admin.
- **Purpose:** Archive config (soft delete).

Path attributes:

- `slug` (string).

Response attributes:

- `success` (boolean).

Errors:

- `403` forbidden.
- `404` not found.

---

### `POST /api/platform-admin/content/configs/[slug]/publish`

- **Location:** `apps/web/src/app/api/platform-admin/content/configs/[slug]/publish/route.ts`
- **Auth:** Super-admin.
- **Purpose:** Publish a config with optimistic locking and version snapshot.

Path attributes:

- `slug` (string).

Response attributes:

- `success` (boolean).
- `version` (number): new published version.

Errors:

- `403` forbidden.
- `404` config not found.
- `409` optimistic-lock conflict.
- `500` snapshot insert error.

---

### `GET /api/content/[slug]`

- **Location:** `apps/web/src/app/api/content/[slug]/route.ts`
- **Auth:** public.
- **Purpose:** Read published content config for frontend consumption.

Path attributes:

- `slug` (string).

Response attributes:

- `slug`, `name`, `locale`.
- `content` (object): published JSON payload.
- `version` (number).
- `published_at` (string datetime).

Errors:

- `404` published content not found.

---

### `POST /api/telemetry`

- **Location:** `apps/web/src/app/api/telemetry/route.ts`
- **Auth:** authenticated Supabase session user.
- **Purpose:** Accept and forward telemetry beacon events.

Request attributes:

- `event` (string): event name.
- `workspace_id` (uuid string).
- `actor_id` (uuid string): must match authenticated user id.
- `properties` (object, optional).
- `timestamp` (datetime string, optional).

Response attributes:

- `ok` (boolean) with `202` on accepted event.

Errors:

- `429` rate limit exceeded.
- `401` unauthenticated.
- `403` actor_id mismatch.
- `400` invalid payload.

---

### `GET /api/health` (web)

- **Location:** `apps/web/src/app/api/health/route.ts`
- **Auth:** optional `Authorization: Bearer <HEALTH_CHECK_SECRET>` if configured.
- **Purpose:** service health with DB and memory checks.

Response attributes:

- `status` (`healthy` | `degraded` | `unhealthy`).
- `timestamp`, `version`.
- `checks.database` and `checks.memory`.

Errors:

- `401` when secret configured and missing/invalid.
- `503` when unhealthy.

---

### `GET /api/health` (landing)

- **Location:** `apps/landing/src/app/api/health/route.ts`
- **Auth:** public.
- **Purpose:** simple landing health status.

Response attributes:

- `status`, `timestamp`, `version`.

---

### `POST /api/onboarding-agent`

- **Location:** `apps/web/src/app/api/onboarding-agent/route.ts`
- **Auth:** authenticated Supabase session, session ownership enforced.
- **Purpose:** run onboarding conversation agent or extract intelligence.

Request attributes:

- `sessionId` (uuid string).
- `userMessage` (string, 1..5000 chars).
- `conversationHistory[]`:
  - `role` (`user` | `assistant`)
  - `content` (string)
- `extractIntelligence` (boolean, optional; default `false`).

Response attributes:

- if `extractIntelligence=true`:
  - `intelligence` (object).
- else:
  - `text` (string),
  - `toolCalls` (array),
  - `toolResults` (array).

Errors:

- `401` unauthenticated.
- `400` invalid request.
- `404` onboarding session not found.
- `403` session ownership mismatch.
- `500` agent execution error.

---

### `GET /api/auth/callback` (web + landing)

- **Locations:**
  - `apps/web/src/app/api/auth/callback/route.ts`
  - `apps/landing/src/app/api/auth/callback/route.ts`
- **Auth:** auth-code callback exchange.
- **Purpose:** exchange Supabase auth code and redirect.

Query attributes:

- `code` (string): Supabase auth code.
- `next` (string, optional): redirect target; default `/dashboard`.

Response behavior:

- redirect to `origin + next` on success.
- redirect to `/login?error=Invalid_link` on failure.

---

## Supabase Edge Functions

Note: functions accept CORS preflight (`OPTIONS`) and mostly use JSON request/response bodies.

### `POST /functions/v1/activate-workspace`

- **Location:** `supabase/functions/activate-workspace/index.ts`
- **Auth:** bearer token user required.
- **Request attributes:**
  - `workspaceData` (object): payload passed to `activate_workspace_v3` RPC.
- **Response attributes:**
  - `success` (boolean), `workspaceId`.
- **Errors:** `400` bad payload or RPC error.

### `POST /functions/v1/analyze-workspace`

- **Location:** `supabase/functions/analyze-workspace/index.ts`
- **Auth:** bearer token header forwarded to Supabase client.
- **Request attributes:**
  - `sessionId` (string, required),
  - `companyName` (string, optional),
  - `scrapedData` (object, optional),
  - `webSearchData` (object, optional).
- **Response attributes:**
  - `success` (boolean),
  - `ai_analysis` (object).
- **Errors:** `400` invalid payload or processing failure.

### `POST /functions/v1/extract-workspace-data`

- **Location:** `supabase/functions/extract-workspace-data/index.ts`
- **Auth:** authenticated user required.
- **Request attributes:**
  - `url` (string, required),
  - `config` (object, optional) forwarded to scrapling.
- **Response attributes:**
  - `success` (boolean),
  - `workspaceId`,
  - `data` (extraction payload).
- **Errors:** `401` unauthorized, `400` invalid input/downstream failure.

### `POST /functions/v1/create-invitation`

- **Location:** `supabase/functions/create-invitation/index.ts`
- **Auth:** authenticated user + workspace role check (`admin`/`owner`).
- **Request attributes:**
  - `workspace_id` (uuid),
  - `company_id` (uuid),
  - `invites[]`: each invite contains
    - `email`,
    - `first_name`,
    - `last_name`,
    - `role` (optional),
    - `department_ids` (optional array),
    - `team_ids` (optional array).
- **Response attributes:**
  - `success`, `count`, `invitations[]`.
- **Errors:** `400` invalid payload/permission failure.

### `POST /functions/v1/finalize-workspace`

- **Location:** `supabase/functions/finalize-workspace/index.ts`
- **Auth:** authenticated user.
- **Request attributes:**
  - `companyName` (string, required),
  - `locations` (array, optional),
  - `departments` (array, optional),
  - `policies` (array, optional).
- **Response attributes:**
  - `success`,
  - `workspace_id`.
- **Errors:** `401` unauthorized, `400` invalid input or transaction error.

### `POST /functions/v1/gather-workspace-intelligence`

- **Location:** `supabase/functions/gather-workspace-intelligence/index.ts`
- **Auth:** optional user (`user_id` may be null), uses bearer if present.
- **Request attributes:**
  - `url` (string, required),
  - `orgNumber` (string, optional).
- **Response attributes:**
  - `success`,
  - `sessionId`,
  - `scrapedData`,
  - `brregData`.
- **Errors:** `400` invalid input or integration failure.

### `POST /functions/v1/scrape-raw-data`

- **Location:** `supabase/functions/scrape-raw-data/index.ts`
- **Auth:** authenticated user.
- **Request attributes:**
  - `url` (string, required).
- **Response attributes:**
  - `success`,
  - `data` (raw scrape payload).
- **Errors:** `401` unauthorized, `400` invalid/downstream error.

### `POST /functions/v1/web-search-intelligence`

- **Location:** `supabase/functions/web-search-intelligence/index.ts`
- **Auth:** bearer token pass-through.
- **Request attributes:**
  - `sessionId` (string, required),
  - `companyName` (string, required),
  - `city` (string, optional),
  - `scrapedData` (object, optional).
- **Response attributes:**
  - `success` (boolean).
- **Errors:** `400` missing required input or processing error.

### `GET|POST /functions/v1/health-check`

- **Location:** `supabase/functions/health-check/index.ts`
- **Auth:** optional `WATCHDOG_CRON_SECRET` bearer.
- **Purpose:** DB + runtime health report.
- **Response attributes:**
  - `status`, `timestamp`, `checks`.
- **Errors:** `401` unauthorized.

### `GET|POST /functions/v1/watchdog-integrity`

- **Location:** `supabase/functions/watchdog-integrity/index.ts`
- **Auth:** optional `WATCHDOG_CRON_SECRET`.
- **Purpose:** integrity checks over workspace/session/invitation data.
- **Response attributes:**
  - `status`, `timestamp`, `checks[]`.
- **Errors:** `401` unauthorized.

### `GET|POST /functions/v1/watchdog-uptime`

- **Location:** `supabase/functions/watchdog-uptime/index.ts`
- **Auth:** optional `WATCHDOG_CRON_SECRET`.
- **Purpose:** uptime checks against web/landing `/api/health`.
- **Response attributes:**
  - `status`, `timestamp`, `checks[]`.
- **Errors:** `401` unauthorized.

---

## Internal service endpoint reference

### `POST /extract`

- **Location:** `services/scrapling/main.py`
- **Auth:** none currently (internal-network expectation).
- **Request attributes:**
  - `url` (string, required),
  - `config` (object, optional):
    - `include_company_info` (bool),
    - `include_locations` (bool),
    - `include_departments` (bool),
    - `include_dictionary` (bool).
- **Response attributes:**
  - `companyName`, `locations[]`, `departments[]`,
  - `email`, `phone`, `summary`,
  - `pageDictionary`, `images[]`, `menus[]`,
  - `socialLinks`, `reservationUrl`.
- **Errors:** `400` missing url, `500` extraction failure.

### `POST /scrape-raw`

- **Location:** `services/scrapling/main.py`
- **Auth:** none currently.
- **Request attributes:**
  - `url` (string, required).
- **Response attributes:**
  - `title`, `description`, `text_content`,
  - `images[]`, `files[]`.
- **Errors:** `400` missing url, `500` extraction failure.

### `GET /health`

- **Location:** `services/scrapling/main.py`
- **Auth:** none currently.
- **Response attributes:**
  - `status`, `timestamp`, `service`.

---

## Target endpoint groups (planned)

The following endpoint groups are planned and should be created as Smartout evolves:

- `/v1/integrations/clients/*`
- `/v1/integrations/keys/*`
- `/v1/governance/data-policies/*`
- `/v1/governance/approvals/*`
- `/v1/governance/audit-events/*`
- `/v1/events/subscriptions/*`
- `/v1/events/deliveries/*`
- `/v1/readiness/*`
- `/v1/operations/*`
- `/v1/reports/*`
