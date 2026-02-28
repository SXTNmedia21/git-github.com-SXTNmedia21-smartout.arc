---
title: "API Inventory and Coverage"
id: REF_API_INVENTORY
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
  - inventory
  - coverage
  - gaps
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout API Inventory and Coverage

> Canonical inventory of current API endpoints and target API gaps.
> Last updated: 2026-02-28

---

## Status legend

- `implemented`: live and callable now
- `partial`: exists but missing controls/features/docs
- `planned`: in roadmap with defined target shape
- `not_started`: required but no implementation started
- `deprecated`: should no longer be used

Contract status:

- `documented`: endpoint has reference entry
- `draft`: endpoint noted but contract not finalized
- `undocumented`: no endpoint-level contract yet

Governance status:

- `policy_enforced`: explicit data-sharing and audit controls defined
- `partial`: auth/checks exist but no full governance mapping
- `missing`: no defined governance controls

---

## Current implemented APIs (have today)

### Next.js route handlers

| Surface        | Endpoint                                             | Methods                  | Purpose                                                | Status      | Contract   | Auth model                     | Governance |
| -------------- | ---------------------------------------------------- | ------------------------ | ------------------------------------------------------ | ----------- | ---------- | ------------------------------ | ---------- |
| `apps/web`     | `/api/wizard/start`                                  | `POST`                   | Start Ultravox mission call (`mission_id`, `metadata`) | implemented | documented | server env key                 | partial    |
| `apps/landing` | `/api/wizard/start`                                  | `POST`                   | Start landing demo voice mission                       | implemented | documented | server env key                 | partial    |
| `apps/web`     | `/api/webhooks/docuseal`                             | `POST`                   | DocuSeal contract status webhook intake                | implemented | documented | webhook signature              | partial    |
| `apps/web`     | `/api/platform-admin/content/configs`                | `GET`, `POST`            | List/create landing configs                            | implemented | documented | super-admin check              | partial    |
| `apps/web`     | `/api/platform-admin/content/configs/[slug]`         | `GET`, `PATCH`, `DELETE` | Read/update/archive config by slug                     | implemented | documented | super-admin check              | partial    |
| `apps/web`     | `/api/platform-admin/content/configs/[slug]/publish` | `POST`                   | Publish config snapshot with optimistic lock           | implemented | documented | super-admin check              | partial    |
| `apps/web`     | `/api/content/[slug]`                                | `GET`                    | Public fetch of published landing content              | implemented | documented | public read                    | missing    |
| `apps/web`     | `/api/telemetry`                                     | `POST`                   | Ingest telemetry beacon events                         | implemented | documented | authenticated Supabase session | partial    |
| `apps/web`     | `/api/health`                                        | `GET`                    | Health check (DB + memory checks)                      | implemented | documented | optional bearer secret         | partial    |
| `apps/landing` | `/api/health`                                        | `GET`                    | Landing health check                                   | implemented | documented | public                         | missing    |
| `apps/web`     | `/api/onboarding-agent`                              | `POST`                   | Chat + intelligence extraction for onboarding          | implemented | documented | authenticated session          | partial    |
| `apps/web`     | `/api/auth/callback`                                 | `GET`                    | Supabase auth callback and redirect                    | implemented | documented | auth code exchange             | partial    |
| `apps/landing` | `/api/auth/callback`                                 | `GET`                    | Supabase auth callback and redirect                    | implemented | documented | auth code exchange             | partial    |

### Supabase Edge Functions

| Function                        | Endpoint (`/functions/v1/*`)     | Methods      | Purpose                                   | Status      | Contract   | Auth model                | Governance |
| ------------------------------- | -------------------------------- | ------------ | ----------------------------------------- | ----------- | ---------- | ------------------------- | ---------- |
| `activate-workspace`            | `/activate-workspace`            | `POST`       | Activate workspace via RPC with payload   | implemented | documented | bearer token user         | partial    |
| `analyze-workspace`             | `/analyze-workspace`             | `POST`       | AI analysis and suggested entities        | implemented | documented | bearer token pass-through | partial    |
| `extract-workspace-data`        | `/extract-workspace-data`        | `POST`       | Scrape and create workspace in one flow   | implemented | documented | authenticated user        | partial    |
| `create-invitation`             | `/create-invitation`             | `POST`       | Create invitation records for workspace   | implemented | documented | authenticated admin/owner | partial    |
| `finalize-workspace`            | `/finalize-workspace`            | `POST`       | Final workspace transaction create        | implemented | documented | authenticated user        | partial    |
| `gather-workspace-intelligence` | `/gather-workspace-intelligence` | `POST`       | Gather scrape + Brreg + background tasks  | implemented | documented | optional anonymous/user   | partial    |
| `scrape-raw-data`               | `/scrape-raw-data`               | `POST`       | Return raw scrape results from scrapling  | implemented | documented | authenticated user        | partial    |
| `web-search-intelligence`       | `/web-search-intelligence`       | `POST`       | Background enrichment and trigger analyze | implemented | documented | bearer token pass-through | partial    |
| `health-check`                  | `/health-check`                  | `GET`/`POST` | DB/runtime service health status          | implemented | documented | optional cron secret      | partial    |
| `watchdog-integrity`            | `/watchdog-integrity`            | `GET`/`POST` | Data integrity watchdog checks            | implemented | documented | optional cron secret      | partial    |
| `watchdog-uptime`               | `/watchdog-uptime`               | `GET`/`POST` | External uptime checks for web/landing    | implemented | documented | optional cron secret      | partial    |

### Internal service APIs

| Service              | Endpoint      | Methods | Purpose                                                        | Status      | Contract   | Auth model     | Governance |
| -------------------- | ------------- | ------- | -------------------------------------------------------------- | ----------- | ---------- | -------------- | ---------- |
| `services/scrapling` | `/extract`    | `POST`  | Structured extraction (company, departments, locations, links) | implemented | documented | none currently | missing    |
| `services/scrapling` | `/scrape-raw` | `POST`  | Raw content/image/file extraction                              | implemented | documented | none currently | missing    |
| `services/scrapling` | `/health`     | `GET`   | Service health                                                 | implemented | documented | none currently | missing    |

---

## Planned and missing APIs (don’t have yet)

### Public API (`/v1`) target domains

| Domain                    | Example target endpoint group                          | Status      | Priority |
| ------------------------- | ------------------------------------------------------ | ----------- | -------- |
| Identity and access       | `/v1/companies`, `/v1/workspaces`, `/v1/profiles`      | not_started | P0       |
| Readiness and governance  | `/v1/readiness/*`, `/v1/policies/*`, `/v1/protocols/*` | not_started | P0       |
| Scheduling and operations | `/v1/shifts/*`, `/v1/sessions/*`, `/v1/tasks/*`        | not_started | P1       |
| Training and completion   | `/v1/training/*`, `/v1/tests/*`, `/v1/confirmations/*` | not_started | P1       |
| Reporting/data products   | `/v1/reports/*`, `/v1/metrics/*`                       | not_started | P1       |

### Governance and client-control APIs

| Capability            | Endpoint group (target)          | Status      | Priority |
| --------------------- | -------------------------------- | ----------- | -------- |
| API clients (tenant)  | `/v1/integrations/clients/*`     | not_started | P0       |
| API key lifecycle     | `/v1/integrations/keys/*`        | not_started | P0       |
| OAuth app management  | `/v1/integrations/oauth/*`       | not_started | P1       |
| Data sharing policies | `/v1/governance/data-policies/*` | planned     | P0       |
| Approval workflows    | `/v1/governance/approvals/*`     | planned     | P0       |
| Audit export          | `/v1/governance/audit-events/*`  | planned     | P0       |

### Event and webhook APIs

| Capability                       | Endpoint group (target)                  | Status      | Priority |
| -------------------------------- | ---------------------------------------- | ----------- | -------- |
| Webhook subscriptions            | `/v1/events/subscriptions/*`             | not_started | P1       |
| Webhook secret rotation          | `/v1/events/subscriptions/{id}/secret/*` | not_started | P1       |
| Delivery attempts/logs           | `/v1/events/deliveries/*`                | not_started | P1       |
| Event replay/idempotency support | `/v1/events/replay/*`                    | not_started | P2       |

---

## Coverage scorecard (snapshot)

| Area                                                   | Coverage                         |
| ------------------------------------------------------ | -------------------------------- |
| Implemented internal APIs inventoried                  | 100% (snapshot date)             |
| Implemented endpoints with reference docs              | 100% (in this documentation set) |
| Implemented endpoints with explicit governance mapping | ~30%                             |
| Tenant-controlled API key/governance endpoints         | 0%                               |
| Public `/v1` external API                              | 0%                               |
| Webhook subscription management API                    | 0%                               |

---

## Immediate next actions

1. Establish `/v1` namespace and auth/scope model.
2. Ship tenant API client + key lifecycle APIs first (P0).
3. Add governance policy endpoints before any external data export expansion.
4. Introduce webhook subscription and delivery logs for partner integrations.
5. Keep this inventory updated in every API PR.
