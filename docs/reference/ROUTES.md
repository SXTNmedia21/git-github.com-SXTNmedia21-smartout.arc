---
title: "Routes & Endpoints Reference"
id: REF_ROUTES
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-04-13
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [routes, api, pages, endpoints, middleware, signing]
tables: []
changelog:
  - date: 2026-02-28
    change: "Initial version -- consolidated from CLAUDE.md + actual app directory scan"
---

# Routes & Endpoints Reference

All routes for the web dashboard (`apps/web`), landing page (`apps/landing`), and API endpoints. Verified against actual file system directories.

---

## Web Dashboard Routes (apps/web, port 3050)

### Public Pages (no auth)

| Route                | Purpose                                         | Module     |
| -------------------- | ----------------------------------------------- | ---------- |
| `/login`             | Login page                                      | Auth       |
| `/signup`            | Signup page                                     | Auth       |
| `/reset-password`    | Password reset                                  | Auth       |
| `/api/auth/callback` | Auth callback handler (code exchange)           | Auth       |
| `/access-denied`     | Access denied (invalid workspace or no profile) | Auth       |
| `/invite/[token]`    | Invitation acceptance                           | Onboarding |

### Signing Pages (public, no auth)

| Route            | Purpose                        | Module    |
| ---------------- | ------------------------------ | --------- |
| `/sign/[token]`  | Embedded DocuSeal signing page | Contracts |
| `/sign/success`  | Post-signing success           | Contracts |
| `/sign/declined` | Post-decline page              | Contracts |

### Workspace Selection

| Route               | Purpose                                      | Module       |
| ------------------- | -------------------------------------------- | ------------ |
| `/select-workspace` | Workspace selector (portal: app.smartout.ai) | Multi-tenant |

### Onboarding & Tools

| Route         | Purpose                      | Module     |
| ------------- | ---------------------------- | ---------- |
| `/`           | Redirects to /dashboard      | --         |
| `/onboarding` | Onboarding flow (has layout) | Onboarding |
| `/scrape`     | Scraper UI (has layout)      | Tools      |

### Dashboard -- Admin/Manager Routes

| Route                             | Purpose                      | Module          |
| --------------------------------- | ---------------------------- | --------------- |
| `/dashboard`                      | Main dashboard               | Core            |
| `/dashboard/people`               | People management            | Org Structure   |
| `/dashboard/schedule`             | Shift scheduling             | Scheduling      |
| `/dashboard/operations`           | Live operations              | Operations      |
| `/dashboard/reports`              | Reports & KPIs               | Reports         |
| `/dashboard/governance`           | Policy & protocol management | Governance      |
| `/dashboard/season`               | Season management            | Season Planning |
| `/dashboard/organization`         | Organization settings        | Org Structure   |
| `/dashboard/chat`                 | Team chat                    | Communication   |
| `/dashboard/ai`                   | AI assistant (Mr. Botsson)   | AI              |
| `/dashboard/onboarding-assistant` | Onboarding copilot           | AI              |
| `/dashboard/settings`             | Settings                     | Settings        |
| `/dashboard/help`                 | Help center                  | Settings        |

### Dashboard -- Employee Routes

| Route                    | Purpose                                               | Module        |
| ------------------------ | ----------------------------------------------------- | ------------- |
| `/dashboard/my-schedule` | Employee: my shifts (MyWeekView)                      | Scheduling    |
| `/dashboard/my-training` | Employee: protocol progress, tests, signatures        | Training      |
| `/dashboard/handbook`    | Employee: read-only handbook chapters (ChapterReader) | Handbook      |
| `/dashboard/my-cv`       | Employee: profile & CV                                | Org Structure |
| `/dashboard/my-salary`   | Employee: salary info                                 | Payroll       |

### Platform Admin (super-admin only)

| Route                                           | Purpose                                     | Module         |
| ----------------------------------------------- | ------------------------------------------- | -------------- |
| `/platform-admin`                               | Redirects to dashboard                      | Platform Admin |
| `/platform-admin/dashboard`                     | Dashboard KPIs + metrics                    | Platform Admin |
| `/platform-admin/workspaces`                    | Workspace list + management                 | Platform Admin |
| `/platform-admin/workspaces/[id]`               | Workspace detail + actions                  | Platform Admin |
| `/platform-admin/users`                         | User administration                         | Platform Admin |
| `/platform-admin/billing`                       | Billing overview + Stripe sync              | Platform Admin |
| `/platform-admin/content`                       | Landing page content CMS                    | Platform Admin |
| `/platform-admin/contracts`                     | Contract list + management (TanStack Table) | Platform Admin |
| `/platform-admin/contracts/new`                 | Contract creation form                      | Platform Admin |
| `/platform-admin/contracts/[id]`                | Contract detail + actions                   | Platform Admin |
| `/platform-admin/contracts/templates`           | Template list                               | Platform Admin |
| `/platform-admin/contracts/templates/[id]/edit` | Tiptap template editor + AI                 | Platform Admin |
| `/platform-admin/communications`                | Broadcast/notification management           | Platform Admin |
| `/platform-admin/audit`                         | Platform audit log viewer                   | Platform Admin |
| `/platform-admin/health`                        | System health + edge function status        | Platform Admin |

---

## API Routes (apps/web)

### Public API

| Route                    | Method | Purpose                               |
| ------------------------ | ------ | ------------------------------------- |
| `/api/health`            | GET    | Service health check                  |
| `/api/telemetry`         | POST   | Telemetry beacon                      |
| `/api/engine-dispatch`   | POST   | Client relay for engine events (→ EF) |
| `/api/auth/callback`     | GET    | Auth callback                         |
| `/api/webhooks/docuseal` | POST   | DocuSeal contract webhook             |

### AI Agents

| Route                   | Method | Purpose               |
| ----------------------- | ------ | --------------------- |
| `/api/onboarding-agent` | POST   | Onboarding AI agent   |
| `/api/contract-agent`   | POST   | AI contract assistant |

### Context & Search

| Route                    | Method | Purpose                                                       |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `/api/context/bootstrap` | GET    | Deterministic bootstrap context (role, perms)                 |
| `/api/search`            | GET    | Orchestrated multi-mode search (instance+semantic+dependency) |

### Wizard

| Route               | Method | Purpose                |
| ------------------- | ------ | ---------------------- |
| `/api/wizard/start` | POST   | Workspace setup wizard |

### Content

| Route                 | Method | Purpose         |
| --------------------- | ------ | --------------- |
| `/api/content/[slug]` | GET    | Content by slug |

### Platform Admin API (service role, super-admin)

| Route                                                | Method   | Purpose                        |
| ---------------------------------------------------- | -------- | ------------------------------ |
| `/api/platform-admin/users`                          | GET      | List users                     |
| `/api/platform-admin/users/toggle-super-admin`       | POST     | Toggle super-admin flag        |
| `/api/platform-admin/audit-log`                      | GET      | Audit log entries              |
| `/api/platform-admin/content`                        | GET      | Content list                   |
| `/api/platform-admin/content/configs`                | GET/POST | Landing configs CRUD           |
| `/api/platform-admin/content/configs/[slug]`         | GET/PUT  | Config by slug                 |
| `/api/platform-admin/content/configs/[slug]/publish` | POST     | Publish config version         |
| `/api/platform-admin/contracts`                      | GET/POST | Contract proxy to microservice |
| `/api/platform-admin/contracts/[id]`                 | GET      | Contract detail                |
| `/api/platform-admin/contracts/[id]/send`            | POST     | Send contract for signing      |
| `/api/platform-admin/contracts/[id]/cancel`          | POST     | Cancel contract                |
| `/api/platform-admin/contracts/[id]/remind`          | POST     | Send reminder                  |
| `/api/platform-admin/communications`                 | GET      | Communication list             |
| `/api/platform-admin/communications/send`            | POST     | Send broadcast                 |
| `/api/platform-admin/communications/dry-run`         | POST     | Preview broadcast              |
| `/api/platform-admin/communications/history`         | GET      | Communication history          |
| `/api/platform-admin/communications/[jobId]`         | GET      | Job status                     |
| `/api/platform-admin/communications/[jobId]/cancel`  | POST     | Cancel job                     |

---

## Landing Page Routes (apps/landing, port 3055)

### Main Pages

| Route       | Purpose                                       |
| ----------- | --------------------------------------------- |
| `/`         | Homepage (workspace analyzer, features, CTAs) |
| `/pricing`  | Pricing page                                  |
| `/om-oss`   | About us                                      |
| `/blog`     | Blog                                          |
| `/login`    | Login redirect                                |
| `/signup`   | Signup redirect                               |
| `/waitlist` | Waitlist signup                               |

### Legal Pages

| Route         | Purpose               |
| ------------- | --------------------- |
| `/personvern` | Privacy policy (GDPR) |
| `/vilkar`     | Terms of service      |

### Feature Pages

| Route                               | Purpose                           |
| ----------------------------------- | --------------------------------- |
| `/features/shiftplanner`            | Shift planning showcase           |
| `/features/punchclock-timetracking` | Time tracking + shift detail view |
| `/features/staff-training`          | Staff training showcase           |
| `/features/task-rutines`            | Tasks & routines showcase         |
| `/features/haccp-complience`        | HACCP compliance showcase         |
| `/features/communications`          | Communication tools showcase      |

### Concept Pages

| Route                     | Purpose                      |
| ------------------------- | ---------------------------- |
| `/concepts/seasons`       | Season management concept    |
| `/concepts/lokations`     | Location management concept  |
| `/concepts/procedures`    | Procedure management concept |
| `/concepts/daily-session` | Daily session concept        |

### Documentation Pages

| Route                    | Purpose                  |
| ------------------------ | ------------------------ |
| `/docs`                  | Docs index with sidebar  |
| `/docs/kom-i-gang`       | Getting started          |
| `/docs/onboarding`       | Onboarding docs          |
| `/docs/ansatte`          | Employee management docs |
| `/docs/vaktplan`         | Shift planning docs      |
| `/docs/oppgaver-rutiner` | Tasks & routines docs    |
| `/docs/haccp`            | HACCP docs               |
| `/docs/kommunikasjon`    | Communication docs       |
| `/docs/rapporter`        | Reports docs             |
| `/docs/ai-assistent`     | AI assistant docs        |
| `/docs/innstillinger`    | Settings docs            |
| `/docs/api`              | API docs                 |
| `/docs/[slug]`           | Dynamic doc page         |

### Landing API Routes

| Route                | Method | Purpose                |
| -------------------- | ------ | ---------------------- |
| `/api/auth/callback` | GET    | Auth callback          |
| `/api/docs-agent`    | POST   | Documentation AI agent |
| `/api/health`        | GET    | Health check           |
| `/api/wizard/start`  | POST   | Wizard start           |

---

## Supabase Edge Functions (16)

| Function                        | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `accept-invitation`             | Process invitation acceptance, create profile     |
| `activate-workspace`            | Workspace activation flow                         |
| `analyze-workspace`             | Workspace analysis                                |
| `contract-lifecycle`            | Contract state machine                            |
| `create-invitation`             | Create workspace invitations                      |
| `engine-dispatch`               | Event Engine: match triggers, execute steps       |
| `extract-workspace-data`        | Extract workspace data                            |
| `finalize-workspace`            | Finalize workspace setup                          |
| `fire-delayed-triggers`         | Cron: poll engine_delayed_trigger, fire due items |
| `gather-workspace-intelligence` | Workspace intelligence gathering                  |
| `health-check`                  | Edge function health check                        |
| `scrape-raw-data`               | Web scraping                                      |
| `validate-api-key`              | API key validation for workspace-api gateway      |
| `watchdog-integrity`            | Data integrity monitoring                         |
| `watchdog-uptime`               | Uptime monitoring                                 |
| `web-search-intelligence`       | Web search for intelligence gathering             |

---

## Routing Architecture

### Subdomain Routing (ADR-0021)

- Production: `{slug}.smartout.ai` -- middleware sets `x-workspace-slug` header
- Portal: `app.smartout.ai` -- workspace selector at `/select-workspace`
- Dev fallback: `localhost:3050` works without subdomains (uses first profile's workspace)

### Dashboard Layout

- `apps/web/src/app/dashboard/layout.tsx` -- Server Component, reads `x-workspace-slug` header
- `apps/web/src/components/dashboard/DashboardShell.tsx` -- Client Component, sidebar/nav/context bar
- `WorkspaceProvider` + `useWorkspace()` for workspace context
