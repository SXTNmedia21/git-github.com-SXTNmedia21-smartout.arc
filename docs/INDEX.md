---
title: "Smartout Documentation Index"
updated: 2026-03-12
---

# Smartout Documentation Index

Master navigation map for all documentation. An agent reads this to find any document.

## Source of Truth Hierarchy

1. **Code + database schema** -- implementation always wins
2. **CLAUDE.md** -- conventions, rules, verified facts
3. **docs/reference/** -- detailed lookup during coding
4. **docs/modules/** -- business logic per module
5. **docs/architecture/** -- system design decisions
6. **docs/cross-cutting/** -- concerns spanning modules
7. **docs/archive/** -- historical, never loaded actively

## All Documents

### Reference (Layer 1)

| id                 | File                                             | Status    | Key Tables   |
| ------------------ | ------------------------------------------------ | --------- | ------------ |
| REF_DATABASE       | reference/DATABASE.md                            | canonical | [all tables] |
| REF_ROUTES         | reference/ROUTES.md                              | canonical | --           |
| REF_PACKAGES       | reference/PACKAGES.md                            | canonical | --           |
| REF_ENV            | reference/ENV_VARS.md                            | canonical | --           |
| REF_API_ENDPOINTS  | reference/API_ENDPOINT_REFERENCE.md              | canonical | --           |
| REF_API_DATA       | reference/API_DATA_DICTIONARY.md                 | canonical | --           |
| REF_API_OVERVIEW   | reference/API_REFERENCE_OVERVIEW.md              | canonical | --           |
| REF_API_VERSIONING | reference/API_VERSIONING_AND_LIFECYCLE.md        | canonical | --           |
| REF_API_VISIBILITY | reference/API_VISIBILITY_AND_RELEASE_PROFILES.md | canonical | --           |
| REF_API_INVENTORY  | reference/API_INVENTORY_AND_COVERAGE.md          | canonical | --           |

### Modules (Layer 2)

| id        | File                                          | Status      | Key Tables                                                 |
| --------- | --------------------------------------------- | ----------- | ---------------------------------------------------------- |
| MODULE_01 | modules/SMARTOUT_MODULE_1_ONBOARDING.md       | canonical   | onboarding_session                                         |
| MODULE_02 | modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md    | canonical   | department, location, team                                 |
| MODULE_03 | modules/SMARTOUT_MODULE_3_SCHEDULING.md       | canonical   | schedule_shift                                             |
| MODULE_04 | modules/SMARTOUT_MODULE_4_OPERATIONS.md       | canonical   | department_session, session_task                           |
| MODULE_05 | modules/SMARTOUT_MODULE_5_HACCP.md            | canonical   | asset, control_list                                        |
| MODULE_06 | modules/SMARTOUT_MODULE_6_TRAINING.md         | canonical   | procedure, knowledge_test                                  |
| MODULE_07 | modules/SMARTOUT_MODULE_7_ABSENCE.md          | draft       | --                                                         |
| MODULE_08 | modules/SMARTOUT_MODULE_8_PAYROLL.md          | draft       | --                                                         |
| MODULE_09 | modules/SMARTOUT_MODULE_9_COMMUNICATION.md    | canonical   | notification_outbox, notification_preference               |
| MODULE_10 | modules/SMARTOUT_MODULE_10_REPORTS.md         | design-spec | custom_report                                              |
| MODULE_11 | modules/SMARTOUT_MODULE_11_SETTINGS.md        | draft       | --                                                         |
| MODULE_12 | modules/SMARTOUT_MODULE_12_AI.md              | canonical   | onboarding_session                                         |
| MODULE_13 | modules/SMARTOUT_MODULE_13_MULTITENANT.md     | canonical   | workspace, company, company_member                         |
| MODULE_14 | modules/SMARTOUT_MODULE_14_PRODUCTION.md      | canonical   | --                                                         |
| MODULE_15 | modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md | canonical   | season                                                     |
| MODULE_17 | modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md  | canonical   | platform_audit_log, platform_metrics_daily, landing_config |
| MODULE_18 | modules/SMARTOUT_MODULE_18_WEBRTC.md          | canonical   | --                                                         |

### Architecture (Layer 3)

| id                | File                                                       | Status                |
| ----------------- | ---------------------------------------------------------- | --------------------- |
| CORE_ARCH_V2      | architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md              | canonical             |
| UI_ARCH           | architecture/SMARTOUT_UI_ARCHITECTURE.md                   | draft                 |
| PROD_ARCH         | architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md           | canonical             |
| FOUND_ARCH        | architecture/SMARTOUT_FOUNDATION_ARCHITECTURE.md           | canonical             |
| FOUND_DATA_MODEL  | architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md             | canonical             |
| FOUND_PRODUCT_ID  | architecture/SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md       | canonical             |
| IMPL_GUIDE        | architecture/SMARTOUT_IMPLEMENTATION_GUIDE.md              | canonical             |
| PACKAGES_ARCH     | architecture/SMARTOUT_PACKAGES_ARCHITECTURE.md             | canonical             |
| CONTRACT_ARCH     | architecture/SMARTOUT_CONTRACT_SYSTEM.md                   | canonical             |
| TELEMETRY_ARCH    | architecture/SMARTOUT_TELEMETRY_ARCHITECTURE.md            | canonical             |
| SUBDOMAIN_ARCH    | architecture/SMARTOUT_Subdomain_Routing_Architecture.md    | canonical             |
| WS_ONBOARD_ARCH   | architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md | canonical             |
| NEXTRA_ARCH       | architecture/SMARTOUT_docs_NEXTRA_architecture.md          | superseded (ADR-0030) |
| ORG_ROADMAP       | architecture/SMARTOUT_ORG_STRUCTURE_ROADMAP.md             | canonical             |
| APPENDIX_ENUMS    | architecture/SMARTOUT_APPENDIX_ENUMS.md                    | canonical             |
| ARCH_REPORTS_KPIS | architecture/SMARTOUT_MODULE_10_REPORTS_AND_KPIS.md        | canonical             |
| PERF_GOVERNANCE   | architecture/PERFORMANCE_BUILD_GOVERNANCE.md               | canonical             |
| PRD_03            | architecture/PRD-03_Avstemmingssystem.md                   | canonical             |
| SCHED_UX_AUDIT    | architecture/SCHEDULE_PAGE_UX_AUDIT_AND_WORKFLOWS.md       | canonical             |

### Cross-Cutting

| id                   | File                                                        | Status    |
| -------------------- | ----------------------------------------------------------- | --------- |
| XCUT_LEGAL_GDPR      | cross-cutting/SMARTOUT_CROSSCUT_LEGAL_GDPR_COMPLIANCE.md    | canonical |
| XCUT_CONTRACTS       | cross-cutting/SMARTOUT_CROSSCUT_CONTRACTS_CERTIFICATIONS.md | canonical |
| XCUT_BILLING         | cross-cutting/SMARTOUT_CROSSCUT_BILLING_STRIPE.md           | canonical |
| XCUT_I18N            | cross-cutting/SMARTOUT_CROSSCUT_I18N.md                     | canonical |
| XCUT_SECURITY        | cross-cutting/SMARTOUT_CROSSCUT_SECURITY_INFRA.md           | canonical |
| XCUT_PERF_CHECKLIST  | cross-cutting/performance-checklist.md                      | canonical |
| XCUT_PERF_GOVERNANCE | cross-cutting/performance-governance.md                     | canonical |
| XCUT_API_CLIENT      | cross-cutting/API_CLIENT_SETUP_AND_BYOK.md                  | canonical |
| XCUT_API_GOVERNANCE  | cross-cutting/API_GOVERNANCE_AND_DATA_SHARING.md            | canonical |
| XCUT_API_RELEASE     | cross-cutting/API_RELEASE_GATES_AND_COMPLIANCE.md           | canonical |
| XCUT_VERCEL_OPS      | cross-cutting/vercel-operations-review.md                   | canonical |

### Protocols (Enforcement)

High-level rules that MUST be followed. No exceptions.

| id                  | File                       | Scope                          |
| ------------------- | -------------------------- | ------------------------------ |
| PROTO_SECURITY      | protocols/SECURITY.md      | Secrets, auth, RLS, API keys   |
| PROTO_DOCUMENTATION | protocols/DOCUMENTATION.md | Source of truth, doc standards |
| PROTO_KNOWLEDGE     | protocols/KNOWLEDGE.md     | ADRs, learnings, templates     |

### Templates

Reusable document templates in `docs/templates/`.

| id           | File                      | Purpose                      |
| ------------ | ------------------------- | ---------------------------- |
| TPL_DECISION | templates/decision.md     | ADR template                 |
| TPL_LEARNING | templates/learning.md     | Learning record template     |
| TPL_ARCH     | templates/architecture.md | Architecture doc template    |
| TPL_PLAN     | templates/plan.md         | Implementation plan template |

### Decisions (ADRs)

See `docs/decisions/0000-decision-log.md` -- 48 ADRs (0001-0048).

| id       | File                                                     | Subject                                      |
| -------- | -------------------------------------------------------- | -------------------------------------------- |
| ADR_0001 | decisions/0001-use-turborepo-pnpm.md                     | Turborepo + pnpm workspaces                  |
| ADR_0002 | decisions/0002-state-vs-hooks.md                         | State-driven vs hook-driven logic            |
| ADR_0003 | decisions/0003-shadcn-integration.md                     | shadcn/ui integration                        |
| ADR_0004 | decisions/0004-unified-telemetry-engine.md               | Unified telemetry (PostHog)                  |
| ADR_0005 | decisions/0005-testing-infrastructure.md                 | Testing four-layer strategy                  |
| ADR_0006 | decisions/0006-secrets-and-environment.md                | Env vars and secrets                         |
| ADR_0007 | decisions/0007-dashboard-architecture.md                 | Dashboard layout & nav                       |
| ADR_0008 | decisions/0008-dashboard-scroll-behavior.md              | Dashboard scroll behavior                    |
| ADR_0009 | decisions/0009-tailwind-v4-css-config.md                 | Tailwind CSS v4                              |
| ADR_0010 | decisions/0010-ai-sdk-openrouter.md                      | AI SDK with OpenRouter                       |
| ADR_0011 | decisions/0011-user-identity-table-naming.md             | user_identity table name                     |
| ADR_0012 | decisions/0012-subscription-on-company.md                | Subscription on company table                |
| ADR_0013 | decisions/0013-database-types-generation.md              | Auto-generated DB types                      |
| ADR_0014 | decisions/0014-posthog-eu-proxy.md                       | PostHog EU proxy                             |
| ADR_0015 | decisions/0015-bubble-rebuild-strategy.md                | Bubble.io rebuild strategy                   |
| ADR_0016 | decisions/0016-services-directory.md                     | Services directory                           |
| ADR_0017 | decisions/0017-enterprise-infrastructure.md              | Enterprise infrastructure                    |
| ADR_0018 | decisions/0018-tanstack-table-recharts-platform-admin.md | TanStack Table + Recharts                    |
| ADR_0019 | decisions/0019-performance-build-governance.md           | Performance governance                       |
| ADR_0020 | decisions/0020-vercel-hosting-strategy.md                | Vercel hosting strategy                      |
| ADR_0021 | decisions/0021-subdomain-workspace-routing.md            | Subdomain routing                            |
| ADR_0022 | decisions/0022-notification-service-architecture.md      | Notification service                         |
| ADR_0023 | decisions/0023-global-scrollbar-standard.md              | Global scrollbar standard                    |
| ADR_0024 | decisions/0024-contract-system-architecture.md           | Contract system                              |
| ADR_0025 | decisions/0025-documentation-restructuring.md            | Docs restructuring (YAML, layers, archive)   |
| ADR_0026 | decisions/0026-template-editor-redesign-attachments.md   | Template editor redesign                     |
| ADR_0027 | decisions/0027-pricing-terms-table.md                    | Pricing terms table                          |
| ADR_0028 | decisions/0028-api-key-management-system.md              | API key management system                    |
| ADR_0029 | decisions/0029-workspace-api-gateway.md                  | Workspace API gateway                        |
| ADR_0030 | decisions/0030-documentation-in-landing-app.md           | Documentation in landing app                 |
| ADR_0031 | decisions/0031-journey-portal-system.md                  | Journey portal system                        |
| ADR_0032 | decisions/0032-schedule-local-state-architecture.md      | Schedule local state architecture            |
| ADR_0033 | decisions/0033-documentation-rag-pgvector.md             | Documentation RAG with pgvector              |
| ADR_0034 | decisions/0034-documentation-enforcement-pipeline.md     | Documentation enforcement pipeline           |
| ADR_0035 | decisions/0035-docker-network-infra.md                   | Docker network infrastructure (superseded)   |
| ADR_0036 | decisions/0036-shift-mcp-server.md                       | Shift MCP server                             |
| ADR_0037 | decisions/0037-landing-event-tracking.md                 | Landing page event tracking                  |
| ADR_0038 | decisions/0038-journey-agent-output-generators.md        | Journey agent & output generators            |
| ADR_0039 | decisions/0039-infra-consolidation.md                    | Infrastructure consolidation                 |
| ADR_0040 | decisions/0040-infrastructure-in-monorepo.md             | Infrastructure stays in monorepo             |
| ADR_0041 | decisions/0041-onboarding-wizard-step-architecture.md    | Onboarding wizard step architecture          |
| ADR_0042 | decisions/0042-agent-architecture.md                     | Agent architecture — Stage Engine agent mode |
| ADR_0043 | decisions/0043-emergency-contact-on-user-identity.md     | Emergency contact on user_identity           |
| ADR_0044 | decisions/0044-invitation-table-naming.md                | Invitation table naming                      |
| ADR_0045 | decisions/0045-sendgrid-transactional-email.md           | SendGrid transactional email                 |
| ADR_0046 | decisions/0046-block-based-landing-page-builder.md       | Block-based landing page builder             |
| ADR_0047 | decisions/0047-schedule-db-persistence.md                | Schedule DB persistence with TanStack Query  |
| ADR_0048 | decisions/0048-daily-close-engine.md                     | DailyCloseEngine state machine               |

### Learnings

See `docs/learnings/0000-learning-log.md` -- 13 learning records.

| id         | File                                                       | Subject                          |
| ---------- | ---------------------------------------------------------- | -------------------------------- |
| LEARN_0001 | learnings/0001-turbopack-x-forwarded-host.md               | Turbopack x-forwarded-host       |
| LEARN_0002 | learnings/0002-middleware-cookie-preservation.md           | Middleware cookie preservation   |
| LEARN_0003 | learnings/0003-optimistic-locking-supabase.md              | Optimistic locking in Supabase   |
| LEARN_0004 | learnings/0004-webhook-status-regression.md                | Webhook status regression        |
| LEARN_0005 | learnings/0005-github-repo-name-vs-local-dir.md            | GitHub repo name vs local dir    |
| LEARN_0006 | learnings/0006-docuseal-webhook-verification.md            | DocuSeal webhook verification    |
| LEARN_0007 | learnings/0007-performance-governance-warn-to-fail.md      | Performance governance rollout   |
| LEARN_0008 | learnings/0008-vercel-x-forwarded-host-400.md              | Vercel x-forwarded-host 400      |
| LEARN_0009 | learnings/0009-vercelignore-depth-matching.md              | .vercelignore depth matching     |
| LEARN_0010 | learnings/0010-vercel-turborepo-root-directory.md          | Vercel Turborepo root directory  |
| LEARN_0011 | learnings/0011-framer-motion-landing-animation-patterns.md | Framer Motion animation patterns |
| LEARN_0012 | learnings/0012-mcp-sdk-package-structure.md                | MCP SDK package structure        |
| LEARN_0013 | learnings/0013-ultravox-http-tool-parameters.md            | Ultravox HTTP tool parameters    |

### Plans

Active plans in `docs/plans/`. Completed plans in `docs/plans/completed/`.

| File                                                        | Status    | Module     |
| ----------------------------------------------------------- | --------- | ---------- |
| plans/BUILD_ORDER.md                                        | canonical | meta       |
| plans/PLAN-journey-portal.md                                | completed | onboarding |
| plans/PLAN-landing-optimization.md                          | completed | landing    |
| plans/PLAN-onboarding-redesign.md                           | completed | onboarding |
| plans/PLAN-onboarding-intelligence-pipeline.md              | completed | onboarding |
| plans/2026-03-01-journey-portal-fixes.md                    | completed | onboarding |
| plans/2026-03-01-journey-portal-hardening.md                | completed | onboarding |
| plans/2026-03-01-landing-page-builder-design.md             | draft     | landing    |
| plans/2026-03-03-onboarding-redesign.md                     | completed | onboarding |
| plans/2026-03-03-onboarding-redesign-spec.md                | completed | onboarding |
| plans/2026-03-03-voice-agent-client-tools-design.md         | completed | ai         |
| plans/2026-03-03-voice-client-tools-plan.md                 | completed | ai         |
| plans/2026-03-07-agent-profile-system-design.md             | completed | ai         |
| plans/2026-03-07-agent-profile-implementation.md            | completed | ai         |
| plans/2026-03-07-voice-agent-context.md                     | completed | ai         |
| plans/2026-03-10-onboarding-intelligence-pipeline.md        | completed | onboarding |
| plans/2026-03-10-onboarding-intelligence-pipeline-design.md | completed | onboarding |

### User Journeys

31 journey documents in `docs/journeys/`.

| File                                            | Module        | Description                           |
| ----------------------------------------------- | ------------- | ------------------------------------- |
| `journeys/admin-workspace-setup.md`             | onboarding    | 15-step admin wizard flow             |
| `journeys/employee-invitation-accept.md`        | onboarding    | Invite channels + acceptance flow     |
| `journeys/trainee-mode-core.md`                 | onboarding    | Trainee checkpoints + module journeys |
| `journeys/JOURNEY-onboarding-flow.md`           | onboarding    | Scroll-based onboarding flow          |
| `journeys/JOURNEY-onboarding-redesign.md`       | onboarding    | Onboarding redesign journeys          |
| `journeys/JOURNEY-dashboard-redesign.md`        | dashboard     | Dashboard redesign                    |
| `journeys/JOURNEY-dashboard-evolution.md`       | dashboard     | Dashboard evolution tracks            |
| `journeys/JOURNEY-dashboard-polish.md`          | dashboard     | Dashboard polish                      |
| `journeys/JOURNEY-schedule-v2.md`               | schedule      | Schedule v2                           |
| `journeys/JOURNEY-schedule-ui.md`               | schedule      | Schedule UI redesign                  |
| `journeys/JOURNEY-schedule-db-persistence.md`   | schedule      | Schedule DB persistence               |
| `journeys/JOURNEY-people-module-v2.md`          | org-structure | People module v2                      |
| `journeys/JOURNEY-entity-detail-pages.md`       | org-structure | Entity detail pages                   |
| `journeys/JOURNEY-team-member-management.md`    | org-structure | Team member management                |
| `journeys/JOURNEY-operations-ui-redesign.md`    | operations    | Operations UI redesign                |
| `journeys/JOURNEY-daily-standup.md`             | operations    | Daily standup / close engine          |
| `journeys/JOURNEY-operation.md`                 | operations    | Season operations                     |
| `journeys/JOURNEY-communications-finish.md`     | comms         | Communications finish                 |
| `journeys/JOURNEY-landing-analytics.md`         | landing       | Landing analytics                     |
| `journeys/JOURNEY-landing-optimization.md`      | landing       | Landing optimization                  |
| `journeys/JOURNEY-landing-sessions-leads.md`    | landing       | Landing sessions + leads              |
| `journeys/JOURNEY-auth-screens-redesign.md`     | auth          | Auth screens redesign                 |
| `journeys/JOURNEY-keys-admin-ui-v2.md`          | platform      | API keys admin UI                     |
| `journeys/JOURNEY-fix-keys-admin-bugs.md`       | platform      | Keys admin bug fixes                  |
| `journeys/JOURNEY-services-health-dashboard.md` | platform      | Services health dashboard             |
| `journeys/JOURNEY-agent-architecture.md`        | ai            | Agent architecture                    |
| `journeys/JOURNEY-agent-profile-system.md`      | ai            | Agent profile system                  |
| `journeys/JOURNEY-voice-agent-fix.md`           | ai            | Voice agent fixes                     |
| `journeys/JOURNEY-stage-engine-local.md`        | ai            | Stage engine local setup              |
| `journeys/JOURNEY-fix-crash-useworkspace.md`    | dashboard     | Fix useWorkspace crash                |
| `journeys/JOURNEY-journey-testing-system.md`    | meta          | Journey testing system                |

### Research

| id                  | File                                                                                | Status    |
| ------------------- | ----------------------------------------------------------------------------------- | --------- |
| RESEARCH_WORKFORCE  | research/Workforce management research report.md                                    | canonical |
| RESEARCH_LIVEKIT    | research/LiveKit as Smartout's real-time.md                                         | canonical |
| RESEARCH_PROD_ARCH  | research/Production architecture for a Norwegian hospitality SaaS on Supabase.md    | canonical |
| RESEARCH_AI_COUNCIL | research/Seven AI Council personas for Smartout's Norwegian hospitality platform.md | canonical |
| RESEARCH_PRICING    | research/Pricing card prompt.md                                                     | draft     |
| RESEARCH_DOCUSEAL   | research/DocuSeal API complete integration reference.md                             | canonical |

### Roadmaps

| id              | File                                   | Status    |
| --------------- | -------------------------------------- | --------- |
| ROADMAP_API_KPI | roadmaps/API_KPI_AND_REVIEW_CADENCE.md | canonical |
| ROADMAP_API     | roadmaps/API_ROADMAP.md                | canonical |
| PROJECT_ROADMAP | roadmaps/project-roadmap.md            | canonical |

### Additional Reference

| id                 | File                                    | Status    |
| ------------------ | --------------------------------------- | --------- |
| DB_REVIEW_20260228 | reference/DATABASE_REVIEW_2026-02-28.md | canonical |
| GIT_WORKFLOW       | reference/GIT-WORKFLOW.md               | canonical |

### User Manual

Norwegian user-facing documentation. Future Nextra content. Swedish stubs in `User Manual/sv/`.

| id           | File                               | Status | Language |
| ------------ | ---------------------------------- | ------ | -------- |
| MANUAL_INDEX | User Manual/INDEX.md               | draft  | no       |
| MANUAL_01    | User Manual/01-kom-i-gang.md       | draft  | no       |
| MANUAL_02    | User Manual/02-onboarding.md       | draft  | no       |
| MANUAL_03    | User Manual/03-vaktplan.md         | draft  | no       |
| MANUAL_04    | User Manual/04-ansatte.md          | draft  | no       |
| MANUAL_05    | User Manual/05-oppgaver-rutiner.md | draft  | no       |
| MANUAL_06    | User Manual/06-haccp.md            | draft  | no       |
| MANUAL_07    | User Manual/07-kommunikasjon.md    | draft  | no       |
| MANUAL_08    | User Manual/08-ai-assistent.md     | draft  | no       |
| MANUAL_09    | User Manual/09-rapporter.md        | draft  | no       |
| MANUAL_10    | User Manual/10-innstillinger.md    | draft  | no       |

### Archive

Superseded files moved to `docs/archive/`.

| id                    | File                                        | Superseded By | Reason                      |
| --------------------- | ------------------------------------------- | ------------- | --------------------------- |
| ARCH_V1_REVISED       | archive/SMARTOUT_V1_REVISED_ARCHITECTURE.md | CORE_ARCH_V2  | Replaced by v2 architecture |
| ARCH_REBUILD_STRATEGY | archive/SMARTOUT_REBUILD_STRATEGY.md        | CORE_ARCH_V2  | Incorporated into v2        |
| ARCH_FULL_INDEX       | archive/smartout-full-index-v2.md           | INDEX         | Replaced by this index      |
