---
title: "Smartout — Project Roadmap"
id: PROJECT_ROADMAP
version: "1.0"
status: canonical
layer: plan
created: 2026-02-28
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - roadmap
  - modules
  - phases
  - planning
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Project Roadmap

> The big picture. Module order, scope, and where to find everything.
> Last updated: 2026-02-28

---

## Vision

Smartout is an Employee Readiness System for shift-based hospitality businesses in Norway.
We are rebuilding a live Bubble.io product on a modern stack (Next.js, Supabase, TypeScript).
The goal: every employee is **ready** — trained, compliant, equipped, and informed — before their first shift.

---

## Architecture Layers

The platform is built in four conceptual layers. Each module sits on one or more layers:

| Layer                    | Purpose                     | Modules                                     |
| ------------------------ | --------------------------- | ------------------------------------------- |
| **Identity & Structure** | Who, where, what            | Org Structure, Settings, Multi-tenant       |
| **Governance**           | Rules, training, compliance | Training, HACCP, Onboarding                 |
| **Operations**           | Daily execution             | Scheduling, Operations, Absence, Production |
| **Intelligence**         | Data, insights, AI          | Reports, AI, Season Planning, Payroll       |

---

## Module Build Sequence

Modules are ordered by **dependency**, not by their documentation number.
Each module builds on what came before it.

### Wave 0 — Foundation [COMPLETED]

> Monorepo, database schema, auth, shared packages, dashboard shell.

| What                                      | Status | Key References                                                                                                                                                                         |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo scaffold                         | Done   | [ADR-0001](../decisions/0001-use-turborepo-pnpm.md)                                                                                                                                    |
| Database: 15 migrations, 11 core tables   | Done   | [Data Model](../architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md)                                                                                                                        |
| Auth flows (login, signup, reset, invite) | Done   | [Security](../cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md)                                                                                                                       |
| Shared packages (11 packages)             | Done   | [Packages](../architecture/SMARTOUT_PACKAGES_ARCHITECTURE.md)                                                                                                                          |
| Dashboard layout + 34 route shells        | Done   | [ADR-0007](../decisions/0007-dashboard-architecture.md), [ADR-0008](../decisions/0008-dashboard-scroll-behavior.md)                                                                    |
| Tailwind v4 + shadcn/ui setup             | Done   | [ADR-0009](../decisions/0009-tailwind-v4-css-config.md), [ADR-0003](../decisions/0003-shadcn-integration.md)                                                                           |
| PostHog telemetry                         | Done   | [ADR-0004](../decisions/0004-unified-telemetry-engine.md), [ADR-0014](../decisions/0014-posthog-eu-proxy.md)                                                                           |
| AI SDK + OpenRouter                       | Done   | [ADR-0010](../decisions/0010-ai-sdk-openrouter.md)                                                                                                                                     |
| Performance and Build Governance          | Done   | [ADR-0019](../decisions/0019-performance-build-governance.md), [Architecture](../architecture/PERFORMANCE_BUILD_GOVERNANCE.md), [Checklist](../cross-cutting/performance-checklist.md) |

### Wave 0.5 — Platform Admin (Module 17) [COMPLETED]

> Internal backoffice for managing companies, workspaces, billing, contracts, and audit.

| What                                                 | Status | Key References                                                                                                                 |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 8 admin sub-pages                                    | Done   | [Module 17 Spec](../modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md)                                                              |
| Data tables (TanStack Table)                         | Done   | [ADR-0018](../decisions/0018-tanstack-table-recharts-platform-admin.md)                                                        |
| Enterprise infrastructure (health checks, watchdogs) | Done   | [ADR-0017](../decisions/0017-enterprise-infrastructure.md), [Plan](../plans/completed/2026-02-27-enterprise-infrastructure.md) |

---

### Wave 1 — Structural Core

> Build the management layer. Without this, nothing else can function.

#### Module 2: Org Structure

The skeleton of every workspace. Departments, locations, teams, positions — the entities that scheduling, operations, and governance all hang on.

| Scope                                                                    | References                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| CRUD for departments, locations, zones, assets, teams, positions         | [Module 2 Spec](../modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md)   |
| Workspace structure visualization                                        | [Org Roadmap](../architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md) |
| DB tables: `department`, `location`, `zone`, `asset`, `team`, `position` | [Data Model](../architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md)  |
| Route: `/dashboard/organization`                                         | Dashboard shell exists                                           |

#### Module 11: Settings

Workspace configuration — the knobs that control how every other module behaves.

| Scope                                                       | References                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Workspace settings (timezone, currency, language, industry) | [Module 11 Spec](../modules/SMARTOUT_MODULE_11_SETTINGS.md) |
| Notification preferences                                    | [Module 11 Spec](../modules/SMARTOUT_MODULE_11_SETTINGS.md) |
| Route: `/dashboard/settings`                                | Dashboard shell exists                                      |

#### Module 1: Onboarding (Completion)

The entry point. AI-driven workspace setup is working, but invitation management and trainee mode need finishing.

| Scope                                                | References                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Invitation management UI (resend, status, dashboard) | [Module 1 Spec](../modules/SMARTOUT_MODULE_1_ONBOARDING.md)                              |
| Accept-invite flow linking users to profiles         | [Onboarding Architecture](../architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md) |
| Trainee sandbox mode                                 | [Module 1 Spec](../modules/SMARTOUT_MODULE_1_ONBOARDING.md)                              |
| Role progression (trainee → active)                  | [Core Architecture](../architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md)                    |
| Agent rewrite plan                                   | [Plan](../plans/completed/2026-02-27-onboarding-agent-rewrite.md)                        |

---

### Wave 2 — Operational Core

> The daily heartbeat of the platform. Scheduling drives operations.

#### Module 3: Scheduling

Shift planning — the most-used feature for managers. Depends on departments, locations, and positions from Wave 1.

| Scope                                         | References                                                  |
| --------------------------------------------- | ----------------------------------------------------------- |
| Shift creation, templates, drag-and-drop      | [Module 3 Spec](../modules/SMARTOUT_MODULE_3_SCHEDULING.md) |
| Schedule views (week, day, list, "Vaktliste") | [Module 3 Spec](../modules/SMARTOUT_MODULE_3_SCHEDULING.md) |
| Open shifts, swap mechanics                   | [Module 3 Spec](../modules/SMARTOUT_MODULE_3_SCHEDULING.md) |
| Employee view: `/dashboard/my-schedule`       | Dashboard shell exists                                      |
| Routes: `/dashboard/schedule`                 | Partially built                                             |

#### Module 9: Communication

Team messaging and notifications. Partially independent — can start early.

| Scope                                          | References                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Workspace chat, team channels                  | [Module 9 Spec](../modules/SMARTOUT_MODULE_9_COMMUNICATION.md)                  |
| Notification system (in-app, push, email, SMS) | [Module 9 Spec](../modules/SMARTOUT_MODULE_9_COMMUNICATION.md)                  |
| SendGrid + Twilio integration                  | [Cross-cutting: Security](../cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md) |
| Route: `/dashboard/chat`                       | Dashboard shell exists                                                          |

#### Module 18: WebRTC Voice & Video (extends Module 9)

Real-time voice/video calling inside chat channels. Depends on Module 9 communication primitives.

| Scope                                                       | References                                                |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| 1:1 voice calls + channel group calls                       | [Module 18 Spec](../modules/SMARTOUT_MODULE_18_WEBRTC.md) |
| Push-to-talk channels (walkie-talkie mode)                  | [Module 18 Spec](../modules/SMARTOUT_MODULE_18_WEBRTC.md) |
| Call state, missed calls, history                           | [Module 18 Spec](../modules/SMARTOUT_MODULE_18_WEBRTC.md) |
| Route surface: `/dashboard/chat` (call controls in chat UI) | Extends Module 9 route                                    |

---

### Wave 3 — Live Operations

> From planned shifts to executed work. The real-time layer.

#### Module 4: Operations

Department Sessions — the daily container. Auto-generated from the schedule, filled with tasks, tracked in real-time.

| Scope                                                       | References                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| Department sessions (lifecycle, hooks, tasks)               | [Module 4 Spec](../modules/SMARTOUT_MODULE_4_OPERATIONS.md) |
| Session hooks (pre_open, open, scheduled, pre_close, close) | [Module 4 Spec](../modules/SMARTOUT_MODULE_4_OPERATIONS.md) |
| Task execution + compliance verification                    | [Module 4 Spec](../modules/SMARTOUT_MODULE_4_OPERATIONS.md) |
| Real-time capacity tracking                                 | [Module 18 Spec](../modules/SMARTOUT_MODULE_18_WEBRTC.md)   |
| Route: `/dashboard/operations`                              | Dashboard shell exists                                      |

#### Module 5: HACCP

Food safety compliance as an extension of Operations. Hooks into department sessions.

| Scope                                        | References                                             |
| -------------------------------------------- | ------------------------------------------------------ |
| Temperature logging, critical control points | [Module 5 Spec](../modules/SMARTOUT_MODULE_5_HACCP.md) |
| HACCP checklists as session hooks            | [Module 5 Spec](../modules/SMARTOUT_MODULE_5_HACCP.md) |
| Deviation handling + corrective actions      | [Module 5 Spec](../modules/SMARTOUT_MODULE_5_HACCP.md) |

---

### Wave 4 — Governance & Training

> Rules, training, and compliance enforcement.

#### Module 6: Training

The "Academy" — policies become lessons, protocols become tests. Proves employee readiness.

| Scope                                       | References                                                |
| ------------------------------------------- | --------------------------------------------------------- |
| Policy → Procedure → KnowledgeTest pipeline | [Module 6 Spec](../modules/SMARTOUT_MODULE_6_TRAINING.md) |
| Training assignments + progress tracking    | [Module 6 Spec](../modules/SMARTOUT_MODULE_6_TRAINING.md) |
| Readiness score calculation                 | [Module 6 Spec](../modules/SMARTOUT_MODULE_6_TRAINING.md) |
| Employee view: `/dashboard/my-training`     | Dashboard shell exists                                    |
| Route: `/dashboard/governance`              | Dashboard shell exists                                    |

---

### Wave 5 — Time & Money

> Absence, payroll, and financial tracking. Depends on Scheduling + Operations.

#### Module 7: Absence

Leave management, sick days, vacation tracking.

| Scope                                        | References                                               |
| -------------------------------------------- | -------------------------------------------------------- |
| Absence requests + approval workflow         | [Module 7 Spec](../modules/SMARTOUT_MODULE_7_ABSENCE.md) |
| Schedule impact (auto-flag uncovered shifts) | [Module 7 Spec](../modules/SMARTOUT_MODULE_7_ABSENCE.md) |

#### Module 8: Payroll

Time-to-money. Salary calculations, export to payroll systems.

| Scope                                 | References                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Time tracking aggregation             | [Module 8 Spec](../modules/SMARTOUT_MODULE_8_PAYROLL.md)                       |
| Payroll export (CSV/integration)      | [Module 8 Spec](../modules/SMARTOUT_MODULE_8_PAYROLL.md)                       |
| Billing integration                   | [Cross-cutting: Billing](../cross-cutting/SMARTOUT_CROSSCUT_BILLING_STRIPE.md) |
| Employee view: `/dashboard/my-salary` | Dashboard shell exists                                                         |

---

### Wave 6 — Intelligence & Advanced

> Reporting, AI, production management, and season planning.

#### Module 10: Reports

Aggregated KPIs across all modules. The insight layer.

| Scope                              | References                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Dashboard KPI cards + trend charts | [Module 10 Spec](../modules/SMARTOUT_MODULE_10_REPORTS.md)                   |
| Reconciliation system              | [PRD-03: Avstemming](../architecture/PRD-03_Avstemmingssystem.md)            |
| Telemetry extraction pipeline      | [Telemetry Architecture](../architecture/SMARTOUT_TELEMETRY_ARCHITECTURE.md) |
| Route: `/dashboard/reports`        | Dashboard shell exists                                                       |

#### Module 14: Production

Menu management, recipe costing, inventory — for restaurants and kitchens.

| Scope                             | References                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Menu builder, recipe management   | [Module 14 Spec](../modules/SMARTOUT_MODULE_14_PRODUCTION.md)                  |
| Cost calculation + waste tracking | [Production Architecture](../architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md) |

#### Module 15: Season Planning

Strategic planning across time periods. Gamification, budgets, team configurations.

| Scope                                        | References                                                         |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Season lifecycle (draft → active → archived) | [Module 15 Spec](../modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md) |
| Budget engine + point systems                | [Module 15 Spec](../modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md) |
| Route: `/dashboard/season`                   | Dashboard shell exists                                             |

#### Module 12: AI

Cross-cutting intelligence. Enhanced progressively as modules are built.

| Scope                                | References                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Mr. Botsson (workspace AI assistant) | [Module 12 Spec](../modules/SMARTOUT_MODULE_12_AI.md)                                                      |
| AI tools per module                  | [AI Package](../../packages/ai/), [ADR-0010](../decisions/0010-ai-sdk-openrouter.md)                       |
| Voice assistant (Ultravox/LiveKit)   | [LiveKit Research](../research/LiveKit%20as%20Smartout's%20real-time.md), [AI Package](../../packages/ai/) |
| Route: `/dashboard/ai`               | Dashboard shell exists                                                                                     |

---

### Cross-Cutting Concerns (All Waves)

These are woven into every module, not built as standalone features:

| Concern                    | References                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Multi-tenancy (Module 13)  | [Module 13 Spec](../modules/SMARTOUT_MODULE_13_MULTITENANT.md)                             |
| Billing & Stripe           | [Cross-cutting: Billing](../cross-cutting/SMARTOUT_CROSSCUT_BILLING_STRIPE.md)             |
| i18n (Norwegian primary)   | [Cross-cutting: i18n](../cross-cutting/SMARTOUT_CROSSCUT_I18N.md)                          |
| GDPR & Legal compliance    | [Cross-cutting: GDPR](../cross-cutting/SMARTOUT_CROSSCUT_LEGAL_GDPR_COMPLIANCE.md)         |
| Security & Infrastructure  | [Cross-cutting: Security](../cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md)            |
| Contracts & Certifications | [Cross-cutting: Contracts](../cross-cutting/SMARTOUT_CROSSCUT_CONTRACTS_CERTIFICATIONS.md) |

---

## Documentation Index

| Category                   | Location                                   | Contents                                                           |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Ground truth               | [`CLAUDE.md`](../../CLAUDE.md)             | Verified codebase facts, conventions, data model                   |
| Module specs (18)          | [`docs/modules/`](../modules/)             | Detailed feature specifications per module                         |
| Architecture docs (19)     | [`docs/architecture/`](../architecture/)   | System design, data model, package architecture                    |
| Decision records (19 ADRs) | [`docs/decisions/`](../decisions/)         | Architectural decisions with rationale                             |
| Cross-cutting specs (7)    | [`docs/cross-cutting/`](../cross-cutting/) | Billing, i18n, GDPR, security, performance                         |
| Learning records (7)       | [`docs/learnings/`](../learnings/)         | Implementation learnings and anti-regression patterns              |
| Implementation plans (5)   | [`docs/plans/`](../plans/)                 | Detailed step-by-step implementation plans                         |
| Research reports (4)       | [`docs/research/`](../research/)           | Workforce management, production architecture, AI council, LiveKit |
| Detailed build steps       | [`docs/BUILD_ORDER.md`](../BUILD_ORDER.md) | Step-by-step implementation tasks per wave                         |
