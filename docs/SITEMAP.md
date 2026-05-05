---
title: "Smartout Sitemap — All Paths"
status: canonical
generated_from: filesystem walk
updated: 2026-05-02
created: 2026-05-02
module: ops
tags: [sitemap, routes, audit]
---

# Smartout Sitemap

Auto-generated from filesystem walk of `apps/web/src/app`, `apps/landing/src/app`, `supabase/functions`, `services/`. Run `bash scripts/regen-sitemap.sh` to refresh (TBD — currently manual via `find` commands at bottom).

## Counts

| Surface | Count |
|---|---|
| Web pages (`apps/web`) | **128** |
| Web API routes (`apps/web/api`) | **165** |
| Landing pages (`apps/landing`) | **34** |
| Landing API routes | **8** |
| Edge Functions (`supabase/functions`) | **60** |
| Services (`services/`) | **11** |
| **Total entry points** | **406** |

---

## 1. Web Pages — `apps/web/src/app`

Port 3060. Subdomain routing: `{slug}.smartout.ai` → middleware sets `x-workspace-slug`.

### 1.1 Public + Auth

| Path | Auth |
|---|---|
| `/` | redirect → `/dashboard` |
| `/login` | none |
| `/signup` | none |
| `/reset-password` | none |
| `/access-denied` | none |
| `/invite/[token]` | invitation token |
| `/sign/[token]` | DocuSeal capability URL |
| `/sign/success` | none |
| `/sign/declined` | none |
| `/select-workspace` | session |
| `/onboarding` | session |
| `/join` | session |
| `/flow` + `/flow/alkohol` | session |
| `/scrape` | session |
| `/Botsson` | session |

### 1.2 Dashboard — admin / manager / employee

128 pages total. Structured by domain:

#### Core
- `/dashboard`
- `/dashboard/people` + `/[id]` + `/[id]/complete-data` + `/invitations`
- `/dashboard/organization` + `/departments/[id]` + `/locations/[id]` + `/teams/[id]`
- `/dashboard/notifications`
- `/dashboard/settings` + `/operations/tips`
- `/dashboard/setup`
- `/dashboard/help`

#### Cascade execution (D1-D6, C1-C4)
- `/dashboard/schedule`
- `/dashboard/year-wheel`
- `/dashboard/season/[seasonId]`
- `/dashboard/operations`
- `/dashboard/reconciliation`
- `/dashboard/close`
- `/dashboard/calendar`
- `/dashboard/shift-clock`

#### Governance + HMS
- `/dashboard/governance`
- `/dashboard/hms` + `/deviations` + `/documents` + `/drift` + `/governance` + `/training` + `/procedure/[id]`
- `/dashboard/handbook`

#### Contracts (employment-cycle)
- `/dashboard/contracts` + `/[id]` + `/[id]/revise` + `/new`

#### Communication
- `/dashboard/komm` + `/chat` + `/nyheter` + `/oversikt` + `/thread/[channelId]`

#### Money
- `/dashboard/billing` + `/[invoice_id]` + `/settings`
- `/dashboard/cost`
- `/dashboard/reports`

#### Employee-self
- `/dashboard/my-schedule`
- `/dashboard/my-contract`
- `/dashboard/my-cv`
- `/dashboard/my-profile/complete`
- `/dashboard/my-salary`
- `/dashboard/my-training`

#### AI + Botsson
- `/dashboard/ai` + `/config`
- `/dashboard/onboarding-assistant`

#### Workspace website
- `/dashboard/website` + `/pages/[pageId]` + `/setup`

### 1.3 Platform Admin (godmode)

68 platform-admin pages. Major clusters:

- `/platform-admin/dashboard`
- `/platform-admin/users`
- `/platform-admin/workspaces`
- `/platform-admin/audit`
- `/platform-admin/health`
- `/platform-admin/dev-outbox`
- `/platform-admin/keys`
- `/platform-admin/services`
- `/platform-admin/landing` (CMS for landing-pages)
- `/platform-admin/content` (content management)
- `/platform-admin/contracts` + `/[id]` + `/new` + `/templates` + `/templates/[id]/edit`
- `/platform-admin/billing` + `/drift` + `/dunning` + `/ehf-export` + `/export` + `/integrations` + `/invoices` + `/[id]` + `/payments` + `/settings/dispatch`
- `/platform-admin/communications` + `/compose` + `/scheduled` + `/suppressions` + `/templates` + `/[id]/edit`
- `/platform-admin/journeys` + `/[id]` + `/versions` + `/[journeyVersionId]`
- `/platform-admin/guardian`
- `/platform-admin/helpdesk-preview`

### 1.4 Full enumeration (auto-generated)

<details>
<summary>Click to expand all 128 web pages</summary>

```
- `/`
- `/Botsson`
- `/access-denied`
- `/dashboard`
- `/dashboard/ai`
- `/dashboard/ai/config`
- `/dashboard/billing`
- `/dashboard/billing/[invoice_id]`
- `/dashboard/billing/settings`
- `/dashboard/calendar`
- `/dashboard/close`
- `/dashboard/contracts`
- `/dashboard/contracts/[id]`
- `/dashboard/contracts/[id]/revise`
- `/dashboard/contracts/new`
- `/dashboard/cost`
- `/dashboard/governance`
- `/dashboard/handbook`
- `/dashboard/help`
- `/dashboard/hms`
- `/dashboard/hms/deviations`
- `/dashboard/hms/documents`
- `/dashboard/hms/drift`
- `/dashboard/hms/governance`
- `/dashboard/hms/procedure/[id]`
- `/dashboard/hms/training`
- `/dashboard/komm`
- `/dashboard/komm/chat`
- `/dashboard/komm/nyheter`
- `/dashboard/komm/oversikt`
- `/dashboard/komm/thread/[channelId]`
- `/dashboard/my-contract`
- `/dashboard/my-cv`
- `/dashboard/my-profile/complete`
- `/dashboard/my-salary`
- `/dashboard/my-schedule`
- `/dashboard/my-training`
- `/dashboard/notifications`
- `/dashboard/onboarding-assistant`
- `/dashboard/operations`
- `/dashboard/organization`
- `/dashboard/organization/departments/[id]`
- `/dashboard/organization/locations/[id]`
- `/dashboard/organization/teams/[id]`
- `/dashboard/people`
- `/dashboard/people/[id]`
- `/dashboard/people/[id]/complete-data`
- `/dashboard/people/invitations`
- `/dashboard/reconciliation`
- `/dashboard/reports`
- `/dashboard/schedule`
- `/dashboard/season/[seasonId]`
- `/dashboard/settings`
- `/dashboard/settings/operations/tips`
- `/dashboard/setup`
- `/dashboard/shift-clock`
- `/dashboard/website`
- `/dashboard/website/pages/[pageId]`
- `/dashboard/website/setup`
- `/dashboard/year-wheel`
- `/design/shift-timeline`
- `/flow`
- `/flow/alkohol`
- `/invite/[token]`
- `/join`
- `/login`
- `/onboarding`
- `/platform-admin/audit`
- `/platform-admin/billing`
- `/platform-admin/billing/drift`
- `/platform-admin/billing/dunning`
- `/platform-admin/billing/ehf-export`
- `/platform-admin/billing/export`
- `/platform-admin/billing/integrations`
- `/platform-admin/billing/invoices`
- `/platform-admin/billing/invoices/[id]`
- `/platform-admin/billing/payments`
- `/platform-admin/billing/settings/dispatch`
- `/platform-admin/communications`
- `/platform-admin/communications/compose`
- `/platform-admin/communications/scheduled`
- `/platform-admin/communications/suppressions`
- `/platform-admin/communications/templates`
- `/platform-admin/communications/templates/[id]/edit`
- `/platform-admin/content`
- `/platform-admin/contracts`
- `/platform-admin/contracts/[id]`
- `/platform-admin/contracts/new`
- `/platform-admin/contracts/templates`
- `/platform-admin/contracts/templates/[id]/edit`
- `/platform-admin/dashboard`
- `/platform-admin/dev-outbox`
- `/platform-admin/guardian`
- `/platform-admin/health`
- `/platform-admin/helpdesk-preview`
- `/platform-admin/journeys`
- `/platform-admin/journeys/[id]`
- `/platform-admin/journeys/versions`
- `/platform-admin/journeys/versions/[journeyVersionId]`
- `/platform-admin/journeys/versions/[journeyVersionId]/run`
- `/platform-admin/journeys/versions/new`
- `/platform-admin/journeys/wizard`
- `/platform-admin/journeys/wizard/[sessionId]`
- `/platform-admin/keys`
- `/platform-admin/landing`
- `/platform-admin/landing/variants`
- `/platform-admin/landing/variants/[variantId]`
- `/platform-admin/landing/variants/[variantId]/preview`
- `/platform-admin/services`
- `/platform-admin/services/[key]`
- `/platform-admin/users`
- `/platform-admin/workspaces`
- `/platform-admin/workspaces/[id]`
- `/platform-admin/workspaces/new`
- `/public-site/[host]`
- `/public-site/[host]/[...path]`
- `/reset-password`
- `/scrape`
- `/select-plan`
- `/select-workspace`
- `/sign/[token]`
- `/sign/declined`
- `/sign/success`
- `/signup`
- `/update-password`
- `/walt`
- `/walt/sign-dev/[contract_id]`
- `/welcome`
```

</details>

---

## 2. Web API Routes — `apps/web/src/app/api`

165 Next.js route handlers. BFF for browser + mobile (per ADR-0029 + ADR-0132).

### 2.1 By domain

#### Auth
- `/api/auth/callback`
- `/api/admin/invite`

#### Botsson + Emma (AI)
- `/api/botsson/chat`
- `/api/botsson/voice/token` + `/session-context`
- `/api/botsson/recorder/*` (8 routes — flag, force-stop, whisper, sessions, break-glass, metrics)
- `/api/emma/chat` + `/history` + `/memory` + `/notes` + `/tasks` + `/tasks/dismiss` + `/voice/transcript`

#### Contracts
- `/api/contracts` + `/[id]` + `/[id]/cancel` + `/[id]/send` + `/[id]/sign-dev`
- `/api/contracts/[id]/amend` + `/[amendmentId]/accept` + `/decline` + `/classify`
- `/api/contract-templates/*`, `/api/contract-template-bindings/*`
- `/api/employment-contracts/*` (8 routes)

#### Channels (Komm)
- `/api/channels/[id]/call/start` + `/respond` + `/status` + `/token` + `/history`

#### Workspace + Org
- `/api/workspace/*` (multiple)
- `/api/workspaces/[id]/*`
- `/api/profile-update`
- `/api/profile-deactivate`

#### Contract / Onboarding agent
- `/api/contract-agent`
- `/api/onboarding-agent`
- `/api/onboarding/clauses` + `/send-contract`

#### Schedule + Availability
- `/api/availability/me` + `/clear` + `/query` + `/set`

#### Engine + Telemetry
- `/api/engine-dispatch`
- `/api/internal/emit`
- `/api/heartbeat/sixten`
- `/api/journey/guided/start` + `/[runId]/status`

#### Platform Admin (~60 routes)
- `/api/platform-admin/audit-log`
- `/api/platform-admin/billing/*` (~20)
- `/api/platform-admin/communications/*` (~17)
- `/api/platform-admin/content/configs/*`
- `/api/platform-admin/contracts/*`
- `/api/platform-admin/journeys/*`
- `/api/platform-admin/users/*`
- `/api/platform-admin/workspaces/*`

### 2.2 Full enumeration

<details>
<summary>Click to expand all 165 API routes</summary>

```
- `/api/admin/change-proposals/[id]/apply`
- `/api/admin/invite`
- `/api/admin/session-events`
- `/api/admin/tag-visitor`
- `/api/admin/visitor-sessions`
- `/api/agent/memory`
- `/api/auth/callback`
- `/api/availability/clear`
- `/api/availability/me`
- `/api/availability/query`
- `/api/availability/set`
- `/api/botsson/chat`
- `/api/botsson/recorder/break-glass/[envelope_id]`
- `/api/botsson/recorder/flag`
- `/api/botsson/recorder/flag-log-entry`
- `/api/botsson/recorder/flag-session`
- `/api/botsson/recorder/force-stop`
- `/api/botsson/recorder/metrics`
- `/api/botsson/recorder/sessions/[id]`
- `/api/botsson/recorder/whisper`
- `/api/botsson/voice/session-context`
- `/api/botsson/voice/token`
- `/api/channels/[id]/call/history`
- `/api/channels/[id]/call/respond`
- `/api/channels/[id]/call/start`
- `/api/channels/[id]/call/status`
- `/api/channels/[id]/call/token`
- `/api/content/[slug]`
- `/api/context/bootstrap`
- `/api/contract-agent`
- `/api/contract-template-bindings`
- `/api/contract-template-bindings/[id]`
- `/api/contract-templates/[id]/publish`
- `/api/contract-templates/[id]/rename`
- `/api/contract-templates/blank`
- `/api/contract-templates/copy`
- `/api/contracts`
- `/api/contracts/[id]`
- `/api/contracts/[id]/amend`
- `/api/contracts/[id]/amend/[amendmentId]/accept`
- `/api/contracts/[id]/amend/[amendmentId]/decline`
- `/api/contracts/[id]/amend/classify`
- `/api/contracts/[id]/cancel`
- `/api/contracts/[id]/send`
- `/api/contracts/[id]/sign-dev`
- `/api/contracts/employment/upsert`
- `/api/contracts/resolve-placeholders`
- `/api/contracts/send`
- `/api/contracts/templates`
- `/api/contracts/templates/[id]`
- `/api/emma/chat`
- `/api/emma/history`
- `/api/emma/memory`
- `/api/emma/notes`
- `/api/emma/tasks`
- `/api/emma/tasks/dismiss`
- `/api/emma/voice/transcript`
- `/api/employment-contracts`
- `/api/employment-contracts/[id]`
- `/api/employment-contracts/[id]/regenerate`
- `/api/employment-contracts/[id]/revise`
- `/api/employment-contracts/[id]/send`
- `/api/employment-contracts/bulk`
- `/api/employment-contracts/list`
- `/api/engine-dispatch`
- `/api/error-report`
- `/api/health`
- `/api/heartbeat/sixten`
- `/api/internal/emit`
- `/api/journey/guided/[runId]/status`
- `/api/journey/guided/start`
- `/api/notifications/outbox`
- `/api/observer-requests`
- `/api/observer-requests/[id]`
- `/api/onboarding-agent`
- `/api/onboarding/clauses`
- `/api/onboarding/send-contract`
- `/api/platform-admin/audit-log`
- `/api/platform-admin/communications/[jobId]`
- `/api/platform-admin/communications/[jobId]/cancel`
- `/api/platform-admin/communications/[jobId]/recipients`
- `/api/platform-admin/communications/ai-correct`
- `/api/platform-admin/communications/channels`
- `/api/platform-admin/communications/channels/[id]/post`
- `/api/platform-admin/communications/departments`
- `/api/platform-admin/communications/dry-run`
- `/api/platform-admin/communications/history`
- `/api/platform-admin/communications/in-app/broadcast`
- `/api/platform-admin/communications/push/send`
- `/api/platform-admin/communications/scheduled`
- `/api/platform-admin/communications/send`
- `/api/platform-admin/communications/suppressions`
- `/api/platform-admin/communications/templates`
- `/api/platform-admin/communications/translate`
- `/api/platform-admin/communications/users`
- `/api/platform-admin/communications/workspaces`
- `/api/platform-admin/content/configs`
- `/api/platform-admin/content/configs/[slug]`
- `/api/platform-admin/content/configs/[slug]/publish`
- `/api/platform-admin/contracts`
- `/api/platform-admin/contracts/[id]/attachments`
- `/api/platform-admin/contracts/[id]/attachments/[attachmentId]`
- `/api/platform-admin/contracts/[id]/cancel`
- `/api/platform-admin/contracts/[id]/fetch-documents`
- `/api/platform-admin/contracts/[id]/remind`
- `/api/platform-admin/contracts/[id]/send`
- `/api/platform-admin/contracts/[id]/update`
- `/api/platform-admin/e2e/run`
- `/api/platform-admin/e2e/stream/[runId]`
- `/api/platform-admin/health/status`
- `/api/platform-admin/health/system-speed-test`
- `/api/platform-admin/journey-ops-agent`
- `/api/platform-admin/journeys/[id]`
- `/api/platform-admin/journeys/[id]/derive-engine-binding`
- `/api/platform-admin/journeys/[id]/generate`
- `/api/platform-admin/journeys/[id]/run-test`
- `/api/platform-admin/journeys/[id]/steps`
- `/api/platform-admin/journeys/[id]/test-runs`
- `/api/platform-admin/journeys/[id]/transition`
- `/api/platform-admin/journeys/wizard`
- `/api/platform-admin/journeys/wizard/[sessionId]`
- `/api/platform-admin/journeys/wizard/[sessionId]/complete`
- `/api/platform-admin/keys`
- `/api/platform-admin/keys/[id]`
- `/api/platform-admin/keys/[id]/revoke`
- `/api/platform-admin/keys/[id]/rotate`
- `/api/platform-admin/keys/[id]/usage`
- `/api/platform-admin/perf`
- `/api/platform-admin/pricing-terms`
- `/api/platform-admin/secrets`
- `/api/platform-admin/secrets/bulk`
- `/api/platform-admin/services/config`
- `/api/platform-admin/services/config/[slug]`
- `/api/platform-admin/services/config/[slug]/restart`
- `/api/platform-admin/services/config/[slug]/sync-env`
- `/api/platform-admin/services/health`
- `/api/platform-admin/services/test`
- `/api/platform-admin/users/toggle-super-admin`
- `/api/platform-admin/workspace-notes`
- `/api/platform-admin/workspaces`
- `/api/platform-admin/workspaces/analyze-documents`
- `/api/platform-admin/workspaces/lookup`
- `/api/platform-admin/workspaces/update`
- `/api/reconciliation/settlement-image/process`
- `/api/reconciliation/validate`
- `/api/reconciliation/wizard-override`
- `/api/reports-agent`
- `/api/schedule/send-message`
- `/api/scrape/brreg`
- `/api/scrape/company`
- `/api/scrape/public`
- `/api/scrape/raw`
- `/api/search`
- `/api/shift-clock/compliance`
- `/api/shift-swap/cancel`
- `/api/shift-swap/initiate`
- `/api/shift-swap/respond`
- `/api/smoke`
- `/api/telemetry`
- `/api/tips/adjust-share`
- `/api/tips/approve-distribution`
- `/api/tips/set-pot`
- `/api/webhooks/docuseal`
- `/api/wizard/start`
- `/api/workspace-intelligence`
```

</details>

---

## 3. Landing Pages — `apps/landing/src/app`

Port 3055. Public marketing site.

### 3.1 By domain

#### Marketing
- `/` + `/free-forever` + `/pricing` + `/compare`
- `/features/communications` + `/haccp-complience` + `/punchclock-timetracking` + `/shiftplanner` + `/staff-training` + `/task-rutines`
- `/om-oss` (`/en/om-oss`)
- `/personvern` + `/vilkar`

#### Concepts (educational)
- `/concepts/daily-session`
- `/concepts/lokations`
- `/concepts/procedures`
- `/concepts/seasons`

#### Demo / Onboarding
- `/demo` + `/[journey]`
- `/v` (variant testing)
- `/waitlist`
- `/signup` + `/login`

#### Content
- `/blog` + `/[slug]`
- `/docs` + `/[slug]` + `/api`
- `/en` + `/en/docs` + `/en/docs/[slug]` + `/en/pricing`
- `/design`

### 3.2 Landing API

- `/api/auth/callback`
- `/api/health`
- `/api/track`
- `/api/waitlist`
- `/api/revalidate`
- `/api/docs-agent`
- `/api/wizard/start` + `/engine-start`

---

## 4. Edge Functions — `supabase/functions`

60 functions. Three classes per ADR-0029:

### 4.1 External API gateway
- `workspace-api` (NOT in raw list — verify exists)

### 4.2 Webhooks (`verify_jwt=false`)
- `stripe-webhook`
- `sendgrid-webhook`
- `livekit-webhook`

### 4.3 Pre-workspace flows
- `accept-invitation`
- `activate-workspace`
- `bootstrap-cascade`
- `extract-workspace-data`
- `finalize-workspace`
- `gather-workspace-intelligence`
- `identify-company`
- `analyze-setup-documents`
- `analyze-workspace`
- `search-brreg`
- `send-login-code`

### 4.4 Cron / scheduled
- `daily-session-replenish`
- `fire-delayed-triggers`
- `generate-monthly-invoices`
- `obligation-due-soon-cron`
- `obligation-overdue-cron`
- `process-notifications`
- `process-settlement-image`
- `push-dispatch`
- `send-morning-digest`
- `session-watchdog-demoter`
- `shift-clock-compliance`
- `shift-lateness-check`
- `tariff-amendment-sweep`
- `journey-stuck-detector`
- `heartbeat-dispatcher`
- `cleanup-api-keys`
- `cleanup-sandbox-workspaces`

### 4.5 Call orchestration (ADR-0054)
- `livekit-token`
- `livekit-webhook`
- `call-command`

### 4.6 Engine + Agent
- `engine-dispatch`
- `apply-change-proposal`
- `contract-lifecycle`
- `emma-task-trigger`
- `guardian-actions`
- `guardian-notify`
- `guardian-sweep`
- `leader-pulse`
- `session-hook-executor`
- `session-lifecycle`

### 4.7 Workspace intelligence
- `ingest-workspace-knowledge`
- `google-places-intelligence`
- `scrape-website`
- `scrape-raw-data`

### 4.8 Operations intelligence
- `ops-day-brief`
- `ops-learn`
- `ops-monitor`
- `ops-predict`
- `ops-triage`

### 4.9 Util
- `health-check`
- `delete-account`
- `validate-api-key`

### 4.10 Full enumeration

<details>
<summary>Click to expand all 60 Edge Functions</summary>

```
- `accept-invitation`
- `activate-workspace`
- `analyze-setup-documents`
- `analyze-workspace`
- `apply-change-proposal`
- `bootstrap-cascade`
- `call-command`
- `cleanup-api-keys`
- `cleanup-sandbox-workspaces`
- `contract-lifecycle`
- `daily-session-replenish`
- `delete-account`
- `emma-task-trigger`
- `engine-dispatch`
- `extract-workspace-data`
- `finalize-workspace`
- `fire-delayed-triggers`
- `gather-workspace-intelligence`
- `generate-monthly-invoices`
- `google-places-intelligence`
- `guardian-actions`
- `guardian-notify`
- `guardian-sweep`
- `health-check`
- `heartbeat-dispatcher`
- `identify-company`
- `ingest-workspace-knowledge`
- `journey-stuck-detector`
- `leader-pulse`
- `livekit-token`
- `livekit-webhook`
- `obligation-due-soon-cron`
- `obligation-overdue-cron`
- `ops-day-brief`
- `ops-learn`
- `ops-monitor`
- `ops-predict`
- `ops-triage`
- `process-notifications`
- `process-settlement-image`
- `push-dispatch`
- `scrape-raw-data`
- `scrape-website`
- `search-brreg`
- `send-login-code`
- `send-morning-digest`
- `sendgrid-webhook`
- `session-hook-executor`
- `session-lifecycle`
- `session-watchdog-demoter`
- `shift-clock-compliance`
- `shift-lateness-check`
- `stripe-webhook`
- `tariff-amendment-sweep`
- `validate-api-key`
- `validate-settlement`
- `watchdog-integrity`
- `watchdog-uptime`
- `web-search-intelligence`
- `workspace-api`
```

</details>

---

## 5. Services — `services/`

11 long-lived processes (Hono / Node / Python). Per ADR-0040 + ADR-0208:

| Service | Port | Type | In compose? | Purpose |
|---|---|---|---|---|
| `stage-engine` | 5010 | Hono / Node | ✓ | AI agent orchestration, capabilities, agent-router, WS, pg_notify |
| `shift-mcp` | 5011 | Hono / Node | ✓ | Schedule MCP tools |
| `contract-service` | 5012 | Fastify / Node | ✓ | DocuSeal e-sign management |
| `scrapling` | 8000 | Python | ✓ | Web scraping |
| `voice-agent` | (no HTTP) | Node / @livekit/agents | ✓ | LiveKit Agents worker, GPT Realtime, autodispatch |
| `interview-mcp` | (?) | Node | 🔴 | Anchor interview |
| `lovsen-arbeidstilsynet-mcp` | stdio | Python | 🔴 | Arbeidstilsynet rules MCP |
| `lovsen-lovdata-mcp` | stdio | Python | 🔴 | Lovdata rules MCP |
| `lovsen-mattilsynet-mcp` | stdio | Python | 🔴 | Mattilsynet rules MCP |
| `lovsen-nho-reiseliv-mcp` | stdio | Python | 🔴 | Riksavtalen MCP |
| `strike-mcp` | (?) | Node | 🔴 | Strike-related MCP |

> 🔴 = exists in `services/` but not in `infra/docker-compose*.yml`. Either by design (stdio MCPs are spawned per-LLM-call) or drift to investigate.

---

## 6. MCP Tools (Botsson capabilities)

Capabilities live in `packages/ai/src/capabilities/`. 26 directories.

| Capability | Path | ADR |
|---|---|---|
| availability | `capabilities/availability/` | ADR-0200 |
| billing-query | `capabilities/billing-query/` | ADR-0118 |
| communication | `capabilities/communication/` | (frozen-4) |
| contract | `capabilities/contract/` | ADR-0173 frozen-4 |
| contract-intake | `capabilities/contract-intake/` | (PII flow) |
| governance | `capabilities/governance/` | |
| guardian | `capabilities/guardian/` | ADR-0186 |
| helpdesk_query | `capabilities/helpdesk_query/` | ADR-0160 |
| journey | `capabilities/journey/` | ADR-0173 |
| journey-authoring | `capabilities/journey-authoring/` | ADR-0239 |
| kb_query | `capabilities/kb_query/` | ADR-0221 (amended) |
| legal | `capabilities/legal/` | ADR-0242 (Lovsen) |
| memory | `capabilities/memory/` | Phase A3 |
| mission | `capabilities/mission/` | |
| operations | `capabilities/operations/` | |
| operations-intelligence | `capabilities/operations-intelligence/` | ADR-0088 |
| payroll | `capabilities/payroll/` | ADR-0242 (split) |
| personal | `capabilities/personal/` | |
| profile | `capabilities/profile/` | |
| schedule | `capabilities/schedule/` | ADR-0173 frozen-4 |
| season | `capabilities/season/` | ADR-0201 |
| shift-lifecycle | `capabilities/shift-lifecycle/` | |
| shift-swap | `capabilities/shift-swap/` | |
| tips | `capabilities/tips/` | ADR-0261 |
| training | `capabilities/training/` | |
| ui | `capabilities/ui/` | (Orb tools) |

---

## 7. Mobile (Expo) — `apps/mobile`

Thin client per ADR-0133. Surface allowed: D6 production + C4 acceptance.

Allowed:
- View shifts, swap requests, time-stamping
- View own contract, signature flow
- View own training progress
- Channel chat + voice (LiveKit per ADR-0135)
- Botsson voice (LiveKit, NOT Ultravox)
- Push notifications

Forbidden:
- Schedule editor
- Contract authoring
- Year-wheel
- Governance authoring
- Organization settings
- Cost / billing

---

## 8. Subdomains (production)

| Subdomain | Backend | Caddy route |
|---|---|---|
| `smartout.ai` | landing app | direct (Vercel) |
| `app.smartout.ai` | web app, workspace selector | direct (Vercel) |
| `{slug}.smartout.ai` | web app, scoped to workspace `slug` | direct (Vercel) |
| `engine.smartout.ai` | stage-engine | Caddyfile |
| `schedule-mcp.smartout.ai` | shift-mcp | Caddyfile |
| `contract.smartout.ai` | contract-service | Caddyfile |
| `scrape.smartout.ai` | scrapling | Caddyfile |
| `n8n.smartout.ai` | n8n | Caddyfile |

---

## 9. Regen

Refresh this file:

```bash
(
  echo "=== WEB PAGES ==="
  find apps/web/src/app -name "page.tsx" -not -path "*/node_modules/*" 2>/dev/null | sed 's|apps/web/src/app||;s|/page.tsx||;s|^$|/|' | sort
  echo ""
  echo "=== WEB API ROUTES ==="
  find apps/web/src/app/api -name "route.ts" -not -path "*/node_modules/*" 2>/dev/null | sed 's|apps/web/src/app||;s|/route.ts||' | sort
  echo ""
  echo "=== LANDING PAGES ==="
  find apps/landing/src/app -name "page.tsx" -not -path "*/node_modules/*" 2>/dev/null | sed 's|apps/landing/src/app||;s|/page.tsx||;s|^$|/|' | sort
  echo ""
  echo "=== LANDING API ==="
  find apps/landing/src/app/api -name "route.ts" -not -path "*/node_modules/*" 2>/dev/null | sed 's|apps/landing/src/app||;s|/route.ts||' | sort
  echo ""
  echo "=== EDGE FUNCTIONS ==="
  find supabase/functions -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sed 's|supabase/functions/||' | grep -v "^_" | sort
  echo ""
  echo "=== SERVICES ==="
  find services -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sed 's|services/||' | sort
) > /tmp/sitemap-raw.txt
```

> Last regenerated: 2026-05-02. Diff against this file flags unrecorded routes.
