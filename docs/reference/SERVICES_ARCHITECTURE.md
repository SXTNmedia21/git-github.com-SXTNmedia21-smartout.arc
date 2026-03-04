---
title: "Services Architecture & Infrastructure"
status: canonical
updated: 2026-03-29
created: 2026-03-14
module: infrastructure
tags: [services, docker, caddy, infra, architecture, api]
---

# Services Architecture & Infrastructure

> Definitive reference for all Smartout microservices, infrastructure, and network topology.
> For Edge Functions, see `EDGE_FUNCTIONS_REFERENCE.md`. For Next.js routes, see `API_ROUTES_REFERENCE.md`.

---

## Overview

Smartout runs **5 microservices** on a single DigitalOcean Droplet, orchestrated via Docker Compose with Caddy as reverse proxy. All services communicate over an internal Docker bridge network (`smartout-internal`). External HTTPS is terminated by Caddy with automatic Let's Encrypt certificates.

| Service              | Framework          | Language    | Port | Subdomain                | Auth                        | Status       |
| -------------------- | ------------------ | ----------- | ---- | ------------------------ | --------------------------- | ------------ |
| **Stage Engine**     | Hono 4.7           | TypeScript  | 5010 | engine.smartout.ai       | Dual-auth (JWT + API key)   | Active       |
| **Shift MCP**        | Hono 4.7 + MCP SDK | TypeScript  | 5011 | schedule-mcp.smartout.ai | Dual-auth (JWT + API key)   | Active       |
| **Contract Service** | Fastify 5.2        | TypeScript  | 5012 | contract.smartout.ai     | Service key (X-Service-Key) | Active       |
| **Scrapling**        | FastAPI            | Python 3.12 | 8000 | _(internal only)_        | None                        | Active       |
| **n8n**              | n8n                | Node.js     | 5678 | n8n.smartout.ai          | Basic auth                  | Not deployed |

Additional API surfaces:

- **22 Supabase Edge Functions** — see `EDGE_FUNCTIONS_REFERENCE.md`
- **47 Next.js web routes** (`apps/web/src/app/api/`) — see `API_ROUTES_REFERENCE.md`
- **7 Next.js landing routes** (`apps/landing/src/app/api/`) — see `API_ROUTES_REFERENCE.md`

---

## Network Topology

```
┌─ External (HTTPS) ─────────────────────────────────────────────────┐
│  engine.smartout.ai    schedule-mcp.smartout.ai    contract.smartout.ai  │
└────────────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────▼────────────┐
                  │   Caddy (80/443)       │
                  │   Auto TLS (Let's Encrypt) │
                  └───────────┬────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
     smartout-internal (Docker bridge network)    │
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐
│ Stage Engine     │ │ Shift MCP      │ │ Contract Service │
│ :5010 (Hono)     │ │ :5011 (MCP)    │ │ :5012 (Fastify)  │
└────────┬─────────┘ └───────┬────────┘ └────────┬─────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │ Supabase Cloud  │
                    │ (PostgreSQL,    │
                    │  Auth, Storage) │
                    └─────────────────┘

┌──────────────────────────────────────────────────┐
│ Scrapling :8000 (Python, internal only — no      │
│ external Caddy route, accessed by Edge Functions) │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ n8n :5678 (not deployed — planned automation)    │
└──────────────────────────────────────────────────┘
```

**External dependencies:** Supabase Cloud, Ultravox API, OpenRouter API, DocuSeal API, SendGrid, Twilio, Serper, Google Vision API, Brreg (Norwegian Company Registry).

---

## Infrastructure (`infra/`)

### Docker Compose Files

| File                          | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `docker-compose.yml`          | Base service definitions, networks, volumes    |
| `docker-compose.override.yml` | Dev overrides (debug logging, localhost ports) |
| `docker-compose.prod.yml`     | Production (resource limits, restart: always)  |

### Caddy Configuration

| File            | Purpose                                       |
| --------------- | --------------------------------------------- |
| `Caddyfile`     | Production — domain-based routing, auto HTTPS |
| `Caddyfile.dev` | Development — port-based routing on localhost |

**Production routes:**

```
engine.smartout.ai       → stage-engine:5010
schedule-mcp.smartout.ai → shift-mcp:5011
contract.smartout.ai     → contract-service:5012
n8n.smartout.ai          → n8n:5678
```

**Development ports:**

```
:3070 → stage-engine:5010
:3071 → shift-mcp:5011
:3072 → contract-service:5012
:3073 → scrapling:8000
:3074 → n8n:5678
```

### Deployment Scripts (`infra/scripts/`)

| Script            | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `setup.sh`        | First-time setup: verify Docker, create `.env` from `.env.example` |
| `deploy.sh`       | Pull + build + run (prod overlays) + health check                  |
| `health-check.sh` | Ping all service `/health` endpoints                               |
| `backup.sh`       | Backup n8n data + Caddy certs to `~/backups/`                      |

### Production Resource Limits

| Service          | Memory | CPU  |
| ---------------- | ------ | ---- |
| Stage Engine     | 512M   | 0.5  |
| Shift MCP        | 256M   | 0.25 |
| Contract Service | 256M   | 0.25 |
| Scrapling        | 512M   | 0.5  |
| n8n              | 1G     | 1.0  |

### Volumes

| Volume         | Purpose                                   | Service |
| -------------- | ----------------------------------------- | ------- |
| `caddy_data`   | HTTPS certificates (Let's Encrypt)        | Caddy   |
| `caddy_config` | Caddy state                               | Caddy   |
| `n8n_data`     | Workflows, credentials, execution history | n8n     |

### Commands

```bash
# Development
cd infra && docker compose up --build

# Production deploy
./infra/scripts/deploy.sh

# Health check
./infra/scripts/health-check.sh

# Backup
./infra/scripts/backup.sh
```

---

## Service 1: Stage Engine

> AI agent orchestration engine. Manages mission-based conversations with structured stages, context storage, and Ultravox voice adapter.

**Source:** `services/stage-engine/`
**Framework:** Hono 4.7.0
**Port:** 5010
**Subdomain:** engine.smartout.ai

### Authentication

Dual-auth middleware (`src/middleware/auth.ts`):

- JWT token in `Authorization: Bearer <token>` header
- API key in `X-API-Key` header
- Sets `auth: AuthContext` with `workspace_id`, `user_id`, `api_key_type`
- Skip auth for: `/health`

### Endpoints

| Method | Path                             | Auth | Description                               |
| ------ | -------------------------------- | ---- | ----------------------------------------- |
| GET    | `/health`                        | None | `{ status, service, version, timestamp }` |
| POST   | `/sessions`                      | JWT  | Create mission session                    |
| GET    | `/sessions/:id`                  | JWT  | Get session status + progress             |
| POST   | `/sessions/:id/abandon`          | JWT  | Abandon active session                    |
| POST   | `/sessions/:id/fetch`            | JWT  | Fetch context/inbox/stage/history         |
| POST   | `/sessions/:id/store`            | JWT  | Store entity data to inbox                |
| POST   | `/sessions/:id/advance`          | JWT  | Advance to next stage                     |
| POST   | `/agent/chat`                    | JWT  | Free-form agent conversation              |
| POST   | `/adapters/ultravox/create-call` | JWT  | Start Ultravox voice call                 |
| POST   | `/adapters/ultravox/store`       | JWT  | Store (Ultravox tool format)              |
| POST   | `/adapters/ultravox/fetch`       | JWT  | Fetch (Ultravox tool format)              |
| POST   | `/adapters/ultravox/advance`     | JWT  | Advance (Ultravox tool format)            |

### Key Request/Response Formats

**POST /sessions** (create):

```json
// Request
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "profile_id": "uuid",
  "channel": "voice|sms|chat|email|autonomous",
  "callback_url": "https://...",
  "context": { "key": "value" }
}

// Response
{
  "session_id": "uuid",
  "status": "active",
  "current_stage": { "stage_id": "...", "goal": "..." },
  "progress": "1/5",
  "system_prompt": "...",
  "expires_at": "ISO8601"
}
```

**POST /sessions/:id/store**:

```json
{
  "entity_type": "profile|department|location|team|policy|...",
  "data": { "field": "value" },
  "stage_id": "uuid"
}
```

**POST /sessions/:id/fetch**:

```json
{
  "query_type": "context|inbox|stage|history",
  "filters": { "entity_type": "string", "stage_id": "string" }
}
```

**POST /sessions/:id/advance**:

```json
{
  "result": { "collected": "data" },
  "next_stage_id": "uuid",
  "force": false
}
```

**POST /adapters/ultravox/create-call**:

```json
// Request
{
  "mission_id": "onboarding-interview",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "voice": "mark",
  "language": "no"
}

// Response
{ "joinUrl": "wss://...", "callId": "uuid", "sessionId": "uuid" }
```

### Background Jobs

| Job            | Interval | Purpose                                 |
| -------------- | -------- | --------------------------------------- |
| Session Expiry | 5 min    | Mark sessions older than 24h as expired |
| Memory Cleanup | 5 min    | Delete `engine_memory` records past TTL |

### Database Tables

`engine_sessions`, `engine_missions`, `engine_stages`, `engine_inbox`, `engine_memory`, `engine_authority_config`, `workspace`, `profile`

### Environment Variables

```
PORT=5010
ENGINE_URL=https://engine.smartout.ai
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
ULTRAVOX_API_KEY
OPENROUTER_API_KEY
LOG_LEVEL=info
SESSION_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=5
```

---

## Service 2: Shift MCP

> MCP (Model Context Protocol) server providing 5 shift management tools for AI agents. All operations workspace-scoped via `schedule_shift` table.

**Source:** `services/shift-mcp/`
**Framework:** Hono 4.7.0 + MCP SDK 1.27.1
**Port:** 5011
**Subdomain:** schedule-mcp.smartout.ai

### Authentication

Dual-auth middleware (same pattern as Stage Engine). Workspace scope enforced at tool handler level — tools reject mismatched `workspace_id`.

### Endpoints

| Method | Path      | Auth      | Description                                          |
| ------ | --------- | --------- | ---------------------------------------------------- |
| GET    | `/health` | None      | `{ status, service, version, timestamp }`            |
| POST   | `/mcp`    | Dual-auth | MCP protocol handler (StreamableHTTPServerTransport) |

### MCP Tools

#### 1. `create_shift`

Creates a new shift in `schedule_shift`.

| Field        | Type                       | Required | Default |
| ------------ | -------------------------- | -------- | ------- |
| workspace_id | UUID                       | yes      | —       |
| shift_date   | YYYY-MM-DD                 | yes      | —       |
| role         | string                     | yes      | —       |
| start_time   | HH:MM                      | yes      | —       |
| end_time     | HH:MM                      | yes      | —       |
| day_category | enum                       | yes      | —       |
| employee_id  | UUID                       | no       | null    |
| position_id  | UUID                       | no       | null    |
| team_id      | UUID                       | no       | null    |
| breaks       | integer (min)              | no       | 0       |
| zone         | string                     | no       | null    |
| indicator    | blue/emerald/purple/orange | no       | blue    |
| notes        | string                     | no       | null    |
| status       | shift_status enum          | no       | created |
| is_published | boolean                    | no       | false   |

`day_category` enum: `morning`, `midday`, `afternoon`, `evening`, `night`, `weekend`
`status` enum: `created`, `assigned`, `published`, `active`, `completed`, `unpublished`

Returns: Inserted shift with auto-computed `work_hours`.

#### 2. `update_shift`

Updates an existing shift. Accepts `shift_id` (required) + any field from `create_shift`. Recalculates `work_hours` if time fields change.

#### 3. `list_shifts`

| Field        | Type         | Required |
| ------------ | ------------ | -------- |
| workspace_id | UUID         | yes      |
| date_from    | YYYY-MM-DD   | yes      |
| date_to      | YYYY-MM-DD   | yes      |
| employee_id  | UUID         | no       |
| status       | shift_status | no       |
| team_id      | UUID         | no       |

Returns: `{ shifts: Shift[], count: number }`

#### 4. `get_shift`

Input: `{ shift_id: UUID }`. Returns single shift with workspace scope validation.

#### 5. `delete_shift`

Input: `{ shift_id: UUID }`. Only deletes shifts with status `created` or `unpublished`. Returns success message or error.

### Work Hours Calculation

Formula: `(end_time - start_time) - (breaks / 60)` in hours.
Example: 09:00–17:30 with 30 min break = 8.0 hours.

### MCP Protocol Details

- **Transport:** Stateless HTTP streaming via `StreamableHTTPServerTransport`
- **Session:** Stateless (no session ID)
- **Tool Result Format:** `{ content: [{ type: "text", text: JSON }], isError?: boolean }`

### Environment Variables

```
PORT=5011
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
LOG_LEVEL=info
```

---

## Service 3: Contract Service

> Employment contract management via DocuSeal e-signatures. Templates, contract creation, signing workflows, webhook-driven status tracking.

**Source:** `services/contract-service/`
**Framework:** Fastify 5.2.1
**Port:** 5012
**Subdomain:** contract.smartout.ai

### Authentication

Service key in `X-Service-Key` header. Validated against:

1. `validate-api-key` Edge Function (primary)
2. `SERVICE_KEY` env var (fallback — legacy, being migrated)

Skip auth for: `/health`, `/webhooks/*`

### Endpoints

#### Templates

| Method | Path                     | Description                                                                           |
| ------ | ------------------------ | ------------------------------------------------------------------------------------- |
| GET    | `/templates`             | List templates (filters: workspace_id, contract_type, language, is_system, is_active) |
| GET    | `/templates/:id`         | Get single template                                                                   |
| POST   | `/templates`             | Create template                                                                       |
| PUT    | `/templates/:id`         | Update template                                                                       |
| DELETE | `/templates/:id`         | Archive template                                                                      |
| POST   | `/templates/:id/sync`    | Sync to DocuSeal                                                                      |
| POST   | `/templates/:id/preview` | Preview as HTML (body: placeholder overrides)                                         |

#### Contracts

| Method | Path                    | Description                                                                    |
| ------ | ----------------------- | ------------------------------------------------------------------------------ |
| GET    | `/contracts`            | List contracts (filters: workspace_id, status, contract_type, recipient_email) |
| GET    | `/contracts/:id`        | Get contract + events                                                          |
| POST   | `/contracts`            | Create from template                                                           |
| POST   | `/contracts/:id/send`   | Send for signing                                                               |
| POST   | `/contracts/:id/cancel` | Cancel contract                                                                |
| GET    | `/contracts/:id/events` | Audit trail                                                                    |

#### Webhooks

| Method | Path                 | Auth            | Description                                        |
| ------ | -------------------- | --------------- | -------------------------------------------------- |
| POST   | `/webhooks/docuseal` | DocuSeal secret | Status updates (viewed, signed, declined, expired) |

### Webhook Event Mapping

| DocuSeal Event       | Contract Status | Weight |
| -------------------- | --------------- | ------ |
| form.viewed          | viewed          | 1      |
| form.started         | viewed          | 1      |
| form.completed       | signed          | 3      |
| form.declined        | declined        | 4      |
| submission.completed | signed          | 3      |
| submission.expired   | expired         | 2      |

Status regression prevented via weight comparison (Learning L-0004).

### Database Tables

`contract`, `contract_template`, `contract_event`, `contract_reminder`, `workspace`

### Environment Variables

```
PORT=5012
SERVICE_KEY=<smo_svc_* key>
NODE_ENV=production
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
DOCUSEAL_API_KEY, DOCUSEAL_API_URL, DOCUSEAL_WEBHOOK_SECRET
SMARTOUT_COMPANY_NAME, SMARTOUT_ORG_NUMBER, SMARTOUT_CONTACT_EMAIL
APP_URL=https://app.smartout.ai
```

---

## Service 4: Scrapling

> Web scraping microservice for extracting structured company data from URLs. Used in onboarding wizard for auto-populating workspace info.

**Source:** `services/scrapling/`
**Framework:** FastAPI + Uvicorn
**Language:** Python 3.12
**Port:** 8000
**Subdomain:** None (internal Docker network only)

### Authentication

None — internal-only service, no external Caddy route.

### Endpoints

| Method | Path          | Description                                 |
| ------ | ------------- | ------------------------------------------- |
| GET    | `/health`     | `{ status: "healthy", timestamp, service }` |
| POST   | `/extract`    | Extract structured workspace data           |
| POST   | `/scrape-raw` | Raw HTML/text extraction                    |

### POST /extract

```json
// Request
{
  "url": "https://restaurant.no",
  "config": {
    "include_company_info": true,
    "include_locations": true,
    "include_departments": true,
    "include_dictionary": false
  }
}

// Response
{
  "companyName": "Restaurant Name",
  "locations": [{ "id": "1", "name": "Bar", "type": "Indoor", "function": "", "isComplete": false }],
  "departments": [{ "id": "1", "name": "Kjøkken", "roles": ["Head Chef", "Line Cook"], "description": "", "isComplete": false }],
  "email": "contact@restaurant.no",
  "phone": "+47 XX XX XX XX",
  "summary": "First 300 chars...",
  "pageDictionary": { "link text": "url" },
  "images": [{ "src": "https://...", "alt": "..." }],
  "menus": [{ "href": "https://...", "text": "Meny" }],
  "socialLinks": { "facebook": "https://...", "instagram": "https://..." },
  "reservationUrl": "https://..."
}
```

### POST /scrape-raw

```json
// Request
{ "url": "https://example.com" }

// Response
{
  "title": "Page Title",
  "description": "Meta description",
  "text_content": "All extracted text",
  "images": [{ "src": "...", "alt": "..." }],
  "files": [{ "href": ".../doc.pdf", "text": "Document" }]
}
```

### Extraction Logic

- **Deep scraping:** Follows "om oss" / "about" links for additional context
- **Location detection:** Keywords → Bar, Outdoor, Main Dining
- **Department detection:** Keywords → Kjøkken, Service/Floor, General Staff
- **Contact extraction:** Regex for email + Norwegian phone (+47)
- **Menu/Link classification:** Keywords for menus, booking domains, social media

### Dependencies

Scrapling library, Playwright (headless browser), curl_cffi, lxml. No database — stateless.

### Full API spec: `docs/reference/SCRAPLING_API.md`

---

## Service 5: Interview MCP (External)

> Voice call coordination service. Hosted externally (separate repo).

**URL:** `https://intervju-mcp.vercel.app`
**Status:** External anchor — not part of this monorepo's Docker Compose

### Integration Points

1. Mission registry: `packages/ai/src/missions/registry.ts` — 5 missions
2. `startMissionCall()` in `@smartout/ai/missions` — calls Ultravox API
3. Used by `/api/wizard/start` in both web and landing apps

### Missions Defined

| Mission ID           | Purpose                           |
| -------------------- | --------------------------------- |
| onboarding-interview | Guided onboarding data collection |
| landing-demo         | Landing page voice demo           |
| mr-botsson           | General AI assistant              |
| haccp-inspector      | Food safety inspection            |
| shift-assistant      | Shift management help             |

---

## n8n (Planned)

> Workflow automation platform. Configured in Docker Compose but not yet deployed.

**Port:** 5678
**Subdomain:** n8n.smartout.ai (planned)
**Auth:** Basic auth (N8N_BASIC_AUTH_USER/PASSWORD)
**Volume:** `n8n_data:/home/node/.n8n`

---

## Authentication Patterns Summary

| Pattern            | Used By                                               | How It Works                                                            |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| **Dual-auth**      | Stage Engine, Shift MCP, workspace-api Edge Functions | JWT OR API key — middleware resolves to AuthContext                     |
| **Service key**    | Contract Service                                      | `X-Service-Key` header → validated against `platform_api_key` (SHA-256) |
| **JWT-only**       | Most Edge Functions, Next.js dashboard routes         | Supabase `verify_jwt = true` or `supabase.auth.getUser()`               |
| **Cron token**     | Watchdog, cleanup Edge Functions                      | `WATCHDOG_CRON_SECRET` bearer token                                     |
| **Webhook secret** | DocuSeal webhook, SendGrid webhook                    | Provider-specific signature validation                                  |
| **None**           | Scrapling, health endpoints, public landing routes    | Internal network or intentionally public                                |

---

## Service-to-Service Communication

```
Next.js App ──────→ Stage Engine (voice sessions, agent chat)
Next.js App ──────→ Contract Service (via proxy routes)
Next.js App ──────→ Scrapling (via Edge Functions: extract-workspace-data, scrape-raw-data)

Stage Engine ─────→ Ultravox API (voice calls)
Stage Engine ─────→ OpenRouter API (LLM inference)
Stage Engine ─────→ Supabase (sessions, missions, inbox, memory)

Shift MCP ────────→ Supabase (schedule_shift CRUD)

Contract Service ─→ DocuSeal API (e-signatures)
Contract Service ─→ Supabase (contracts, templates, events)
Contract Service ─→ validate-api-key Edge Function

Scrapling ────────→ Target URLs (scraping)

Edge Functions ───→ Scrapling (extract, scrape-raw)
Edge Functions ───→ Brreg API (company registry)
Edge Functions ───→ Serper API (web search)
Edge Functions ───→ Google Vision API (OCR)
Edge Functions ───→ SendGrid API (email)
Edge Functions ───→ Twilio API (SMS)
```

---

## Adding a New Service

Checklist (per ADR-0039/0040):

1. Create `services/<name>/Dockerfile`
2. Add service block to `infra/docker-compose.yml`
3. Add dev overrides to `infra/docker-compose.override.yml`
4. Add prod overrides to `infra/docker-compose.prod.yml`
5. Add Caddy route to `infra/Caddyfile` (if external-facing)
6. Add Caddy dev route to `infra/Caddyfile.dev`
7. Add env vars to `infra/.env.example`
8. Add health check to `infra/scripts/health-check.sh`
9. Create DNS A record for subdomain (GoDaddy)
10. Add to service health dashboard (`/platform-admin/services`)
11. Document in this file

---

## Key Files

| File                                      | Purpose                     |
| ----------------------------------------- | --------------------------- |
| `infra/docker-compose.yml`                | Base service orchestration  |
| `infra/docker-compose.override.yml`       | Development overrides       |
| `infra/docker-compose.prod.yml`           | Production resource limits  |
| `infra/Caddyfile`                         | Production reverse proxy    |
| `infra/Caddyfile.dev`                     | Development reverse proxy   |
| `infra/scripts/deploy.sh`                 | Production deployment       |
| `infra/scripts/health-check.sh`           | Service health verification |
| `infra/scripts/backup.sh`                 | Volume backup               |
| `services/stage-engine/src/index.ts`      | Stage Engine entry          |
| `services/shift-mcp/src/index.ts`         | Shift MCP entry             |
| `services/shift-mcp/src/server.ts`        | MCP tool registrations      |
| `services/contract-service/src/server.ts` | Contract Service entry      |
| `services/scrapling/main.py`              | Scrapling entry             |
| `packages/ai/src/missions/registry.ts`    | Voice mission definitions   |

---

## Related Documentation

- `EDGE_FUNCTIONS_REFERENCE.md` — All 22 Supabase Edge Functions
- `API_ROUTES_REFERENCE.md` — All 54 Next.js API routes
- `SCRAPLING_API.md` — Detailed Scrapling API spec
- `API_REFERENCE_OVERVIEW.md` — API organization and auth models
- `docs/decisions/0039-infra-consolidation.md` — Infrastructure ADR
- `docs/decisions/0040-infrastructure-in-monorepo.md` — Monorepo decision
- `docs/decisions/0036-shift-mcp-server.md` — Shift MCP ADR
- `docs/decisions/0028-api-key-management-system.md` — API key system ADR
- `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md` — Secret management
