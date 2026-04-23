---
title: "Smartout Documentation Index"
updated: 2026-04-22
last-reconciled: 2026-04-22
---

# Smartout Documentation Index

Master navigation map for all documentation. An agent reads this to find any document.

## Start Here

- **[docs/ORIENTATION.md](ORIENTATION.md)** — Boot-sequence cheat sheet, "where does X live" lookup, trust hierarchy, safety nets. The North Star document for any agent or human starting a session. Added per ADR-0075.
- **[docs/architecture/BOTSSON-SYSTEM-MAP.md](architecture/BOTSSON-SYSTEM-MAP.md)** — End-to-end pipe diagram for Botsson Arena + Stage Engine. Color-coded (🟢/🟡/🔴) component status. Authoritative for what exists, what's half-wired, and what's missing. Read before any AI-harness work.

## Source of Truth Hierarchy

1. **Code + database schema** -- implementation always wins
2. **CLAUDE.md** -- conventions, rules, verified facts
   2.5. **docs/ORIENTATION.md** -- boot-time reading order and "where does X live"
   2.5. **Cascade Core Foundation spec** -- canonical cascade architecture (`superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
3. **docs/decisions/** -- accepted ADRs (code-review reviewed, in git blame)
4. **docs/DASHBOARD.md** -- live git state (active worktrees, free slots, pending journeys)
5. **~/dev/second-brain-v2/ops/activity-log.md** -- append-only session/event audit trail
6. **claude-mem (MCP)** -- cross-session narrative memory
7. **docs/STATE.md** -- current system state, gaps (human-maintained snapshot, may drift — see trust banner at top of file)
8. **docs/reference/** -- detailed lookup during coding
9. **docs/engines/** -- industry engine packaging and event-layer specialization
10. **docs/modules/** -- business logic per module
11. **docs/architecture/** -- system design decisions
12. **docs/cross-cutting/** -- concerns spanning modules
13. **docs/archive/** -- historical, never loaded actively

> Reconciled 2026-04-07 with ORIENTATION.md's trust hierarchy. STATE.md moved from layer 2.5 to layer 7 because it self-flags as drift-prone; DASHBOARD is closer to "now" truth.

> `docs/SESSION.md` is **deleted** per ADR-0075. Narrative role migrated to activity-log + claude-mem.

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
| REF_SERVICES_ARCH  | reference/SERVICES_ARCHITECTURE.md               | canonical | --           |
| REF_EDGE_FUNCTIONS | reference/EDGE_FUNCTIONS_REFERENCE.md            | canonical | --           |
| REF_API_ROUTES     | reference/API_ROUTES_REFERENCE.md                | canonical | --           |
| REF_SCRAPLING_API  | reference/SCRAPLING_API.md                       | canonical | --           |
| REF_STAGE_ENGINE   | reference/STAGE_ENGINE_TRAINER_GUIDE.md          | canonical | ai           |

### Modules (Layer 2)

| id                | File                                          | Status      | Key Tables                                                 |
| ----------------- | --------------------------------------------- | ----------- | ---------------------------------------------------------- |
| MODULE_01         | modules/SMARTOUT_MODULE_1_ONBOARDING.md       | canonical   | onboarding_session                                         |
| MODULE_02         | modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md    | canonical   | department, location, team                                 |
| MODULE_03         | modules/SMARTOUT_MODULE_3_SCHEDULING.md       | canonical   | schedule_shift                                             |
| MODULE_04         | modules/SMARTOUT_MODULE_4_OPERATIONS.md       | canonical   | department_session, session_task                           |
| MODULE_05         | modules/SMARTOUT_MODULE_5_HACCP.md            | canonical   | asset, control_list                                        |
| MODULE_06         | modules/SMARTOUT_MODULE_6_TRAINING.md         | canonical   | procedure, knowledge_test                                  |
| MODULE_07         | modules/SMARTOUT_MODULE_7_ABSENCE.md          | draft       | --                                                         |
| MODULE_08         | modules/SMARTOUT_MODULE_8_PAYROLL.md          | draft       | --                                                         |
| MODULE_09         | modules/SMARTOUT_MODULE_9_COMMUNICATION.md    | canonical   | notification_outbox, notification_preference               |
| MODULE_10         | modules/SMARTOUT_MODULE_10_REPORTS.md         | design-spec | custom_report                                              |
| MODULE_11         | modules/SMARTOUT_MODULE_11_SETTINGS.md        | draft       | --                                                         |
| MODULE_12         | modules/SMARTOUT_MODULE_12_AI.md              | canonical   | onboarding_session                                         |
| MODULE_13         | modules/SMARTOUT_MODULE_13_MULTITENANT.md     | canonical   | workspace, company, company_member                         |
| MODULE_14         | modules/SMARTOUT_MODULE_14_PRODUCTION.md      | canonical   | --                                                         |
| MODULE_15         | modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md | canonical   | season                                                     |
| MODULE_17         | modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md  | canonical   | platform_audit_log, platform_metrics_daily, landing_config |
| MODULE_18         | modules/SMARTOUT_MODULE_18_WEBRTC.md          | canonical   | --                                                         |
| MODULE_4_5        | modules/SMARTOUT_MODULE_4.5_DAILY_SATTLED.md  | in_progress | --                                                         |
| MODULE_19         | modules/SMARTOUT_MODULE_19_MENU_PRODUCTION.md | draft       | --                                                         |
| MODULE_20         | modules/SMARTOUT_MODULE_20_INVENTORY.md       | draft       | --                                                         |
| MODULE_AGENT_SDK  | modules/MODULE_AGENT_SDK.md                   | in_progress | --                                                         |
| JOURNEY_DEEP_SPEC | modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md | in_progress | journey                                                    |
| JOURNEY_DEV_PLAN  | modules/journey/SMARTOUT_JOURNEY_DEV_PLAN.md  | in_progress | journey                                                    |
| JOURNEY_REGISTRY  | modules/journey/SMARTOUT_JOURNEY_REGISTRY.md  | in_progress | journey                                                    |

### Architecture (Layer 3)

| id                 | File                                                       | Status                                                   |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------------- |
| CORE_ARCH_V2       | architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md              | canonical                                                |
| UI_ARCH            | needs-rewrite/SMARTOUT_UI_ARCHITECTURE.md                  | folder marked archived 2026-04-07, pending rewrite       |
| PROD_ARCH          | architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md           | canonical                                                |
| FOUND_ARCH         | archive/SMARTOUT_FOUNDATION_ARCHITECTURE.md                | archived (merged into CORE_ARCH_V2)                      |
| FOUND_DATA_MODEL   | archive/SMARTOUT_FOUNDATION_DATA_MODEL.md                  | archived (merged into CORE_ARCH_V2)                      |
| FOUND_PRODUCT_ID   | architecture/SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md       | canonical                                                |
| IMPL_GUIDE         | needs-rewrite/SMARTOUT_IMPLEMENTATION_GUIDE.md             | folder marked archived 2026-04-07, pending rewrite       |
| PACKAGES_ARCH      | architecture/SMARTOUT_PACKAGES_ARCHITECTURE.md             | canonical                                                |
| CONTRACT_ARCH      | architecture/SMARTOUT_CONTRACT_SYSTEM.md                   | canonical                                                |
| TELEMETRY_ARCH     | architecture/SMARTOUT_TELEMETRY_ARCHITECTURE.md            | canonical                                                |
| SUBDOMAIN_ARCH     | architecture/SMARTOUT_Subdomain_Routing_Architecture.md    | canonical                                                |
| WS_ONBOARD_ARCH    | architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md | canonical                                                |
| NEXTRA_ARCH        | archive/SMARTOUT_docs_NEXTRA_architecture.md               | archived (ADR-0030)                                      |
| ORG_ROADMAP        | archive/SMARTOUT_ORG_STRUCTURE_ROADMAP.md                  | archived (cascade)                                       |
| APPENDIX_ENUMS     | architecture/SMARTOUT_APPENDIX_ENUMS.md                    | canonical                                                |
| ARCH_REPORTS_KPIS  | architecture/SMARTOUT_MODULE_10_REPORTS_AND_KPIS.md        | canonical                                                |
| PERF_GOVERNANCE    | architecture/PERFORMANCE_BUILD_GOVERNANCE.md               | canonical                                                |
| PRD_03             | architecture/PRD-03_Avstemmingssystem.md                   | canonical                                                |
| SCHED_UX_AUDIT     | architecture/SCHEDULE_PAGE_UX_AUDIT_AND_WORKFLOWS.md       | canonical                                                |
| AI_RUNTIME_DEF     | architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md            | canonical                                                |
| AI_RUNTIME_RUNBOOK | architecture/AI_RUNTIME_RUNBOOK.md                         | canonical                                                |
| AGENT_FRAMEWORK    | archive/agent-framework.md                                 | archived (superseded by AI_RUNTIME_SYSTEM_DEFINITION_V1) |

### Cascade Architecture

| id                    | File                                                             | Status                                              | Description                                                                                              |
| --------------------- | ---------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| CASCADE_SPEC          | superpowers/specs/2026-03-21-cascade-scheduling-system-design.md | canonical                                           | Cascade Core Foundation spec — I1+6D+4C+K1a/K1b, framework model, proposal pipeline, bootstrap, adapters |
| CASCADE_MASTER        | archive/cascade-spreadsheet-overview.md                          | archived (merged into CASCADE_SPEC)                 |
| CASCADE_INVESTIGATION | archive/INVESTIGATION_OPERATING_HOURS_CORE_STRUCTURE.md          | archived (findings canonicalized into CASCADE_SPEC) |
| CASCADE_ADR_DRAFT     | decisions/ADR-DRAFT-core-hierarchy-cascade.md                    | draft                                               | Draft ADR for core hierarchy changes                                                                     |

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
| PROTO_SECURITY      | protocols/SECURITY.md      | Secrets, auth, RLS, API keys                         |
| PROTO_DOCUMENTATION | protocols/DOCUMENTATION.md | Source of truth, doc standards                       |
| PROTO_KNOWLEDGE     | protocols/KNOWLEDGE.md     | ADRs, learnings, templates                           |
| PROTO_ENV           | protocols/ENV_PROTOCOL.md  | Environment variables, vault, op run                 |
| PROTO_AUTH          | protocols/AUTH_SECURITY.md | Auth flows, OTP, rate limiting, sandbox              |

### Templates

Reusable document templates in `docs/templates/`.

| id           | File                              | Purpose                       |
| ------------ | --------------------------------- | ----------------------------- |
| TPL_DECISION | templates/decision.md             | ADR template                  |
| TPL_LEARNING | templates/learning.md             | Learning record template      |
| TPL_ARCH     | templates/architecture.md         | Architecture doc template     |
| TPL_PLAN     | templates/plan.md                 | Implementation plan template  |
| TPL_PLANVER  | templates/plan-verification.md    | Plan completeness check       |
| TPL_FEATVER  | templates/feature-verification.md | Code correctness verification |

### Decisions (ADRs)

See `docs/decisions/0000-decision-log.md` -- **163 ADR files** on disk as of 2026-04-20 (gap at ADR-0159; slot reserved after 2026-04-19 kanaler-som-helpdesk council renumbered 0156-0159 → 0160-0163 to resolve a mid-session collision with feat/overview-v2. Do not reuse 0159. Next number: 0165.). Latest: ADR-0164 (season-namespace-unification-telemetry, 2026-04-20). **12 ADRs** still `proposed` and not yet accepted: 0053, 0122, 0123, 0124, 0135, 0136, 0151, 0152, 0153, 0154, 0155, 0158.

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
| ADR_0049 | decisions/0049-agent-sdk-package.md                      | Agent SDK package — @smartout/agent-sdk      |
| ADR_0050 | decisions/0050-port-standardization-and-vault-secrets.md | Port standardization + vault secrets         |
| ADR_0051 | decisions/0051-unified-ai-runtime-system-definition.md   | Unified AI runtime system definition         |
| ADR_0052 | decisions/0052-guardian-websocket-architecture.md        | Guardian WebSocket architecture (renumbered from 0049) |
| ADR_0053 | decisions/0053-simulation-schema-and-simulator-service.md | Simulation schema + simulator service (renumbered from 0058) |
| ADR_0054 | decisions/0054-edge-functions-own-call-orchestration.md  | Edge Functions own call orchestration (renumbered from 0059) |
| ADR_0055 | decisions/0055-two-vault-environment-isolation.md        | Two-vault environment isolation              |
| ADR_0056 | decisions/0056-cascade-core-foundation-schema.md         | Cascade Core Foundation schema               |
| ADR_0057 | decisions/0057-payroll-schema-separation.md              | Payroll schema separation                    |
| ADR_0058 | decisions/0058-livekit-as-webrtc-provider.md             | LiveKit as WebRTC provider                   |
| ADR_0059 | decisions/0059-platform-admin-pipeline.md                | Platform admin pipeline                      |
| ADR_0060 | decisions/0060-unified-wizard-shell.md                   | Unified wizard shell                         |
| ADR_0061 | decisions/0061-walkai-semantic-tagging.md                | WalkAi semantic tagging                      |
| ADR_0062 | decisions/0062-industry-intelligence-consolidation.md    | Industry intelligence consolidation          |
| ADR_0063 | decisions/0063-communication-system-consolidation.md     | Communication system consolidation           |
| ADR_0064 | decisions/0064-dynamic-landing-engine.md                 | Dynamic landing engine                       |
| ADR_0065 | decisions/0065-hospitality-operations-cockpit-v1-contract.md | Hospitality ops cockpit v1 contract      |
| ADR_0066 | decisions/0066-temporal-shift-lock-architecture.md       | Temporal shift lock architecture             |
| ADR_0067 | decisions/0067-smart-cover-via-event-engine.md           | Smart cover via Event Engine                 |
| ADR_0068 | decisions/0068-simulation-schema-and-service.md          | Simulation schema + service                  |
| ADR_0069 | decisions/0069-session-execution-ownership.md            | Session execution ownership (EF + Engine)    |
| ADR_0070 | decisions/0070-emma-wizard-bridge.md                     | Emma-Wizard bridge tool architecture         |
| ADR_0071 | decisions/0071-preview-environment-architecture.md       | Preview environment architecture (3-branch flow) |
| ADR_0072 | decisions/0072-vercel-multi-service-rejected.md          | Vercel multi-service migration — rejected    |
| ADR_0073 | decisions/0073-ai-eval-harness.md                        | AI eval harness for packages/ai (two-layer)  |
| ADR_0074 | decisions/0074-protocol-verification-engine.md           | Protocol Verification Engine (renumbered from 0071) |

> All ADR collisions resolved 2026-04-07: guardian-ws → 0052, simulation-schema → 0053, edge-functions-own-call → 0054. No gaps in 0001–0074.

### Learnings

See `docs/learnings/0000-learning-log.md` -- **82 learning records** (L-0001 through L-0081 as of 2026-04-20; L-0082/0083/0084 added from 2026-04-20 verification council). Most recent capture lessons from the helpdesk Phase 1 UI merge (L-0079 terminal engine_state must stamp completed_at, L-0080 reassignment demotes prior holder, L-0081 Supabase chainable-proxy mocks echo column names — 3rd occurrence, promoted to process rule).

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
| LEARN_0014 | learnings/0014-supabase-gen-types-stdout-noise.md          | Supabase gen types stdout noise  |
| LEARN_0015 | learnings/0015-websocket-jwt-auth-browser.md               | WebSocket JWT auth (browser) — renumbered from 0001 |
| LEARN_0016 | learnings/0016-season-type-enum-mismatch.md                | Season type enum mismatch        |
| LEARN_0017 | learnings/0017-progressive-save-pattern.md                 | Progressive save pattern         |
| LEARN_0018 | learnings/0018-runtime-doc-truth-sync.md                   | Runtime doc truth sync           |
| LEARN_0019 | learnings/0019-live-ops-feed-hygiene.md                    | Live ops feed hygiene            |
| LEARN_0020 | learnings/0020-shift-lock-multi-channel-enforcement.md     | Shift-lock multi-channel enforcement |
| LEARN_0021 | learnings/0021-absence-approval-prerequisite.md            | Absence approval prerequisite    |
| LEARN_0022 | learnings/0022-disabled-toggle-semantics-and-action-cta-clarity.md | Disabled toggle semantics + CTA clarity |
| LEARN_0023 | learnings/0023-journey-db-tables-are-dev-tracking.md       | Journey DB tables = dev tracking |
| LEARN_0024 | learnings/0024-rescue-is-not-reengagement.md               | Rescue is not re-engagement      |
| LEARN_0025 | learnings/0025-stage-engine-websocket-vercel-blocker.md    | Stage engine WebSocket Vercel blocker |
| LEARN_0026 | learnings/0026-drawer-api-boundary-verification.md         | Drawer API boundary verification |
| LEARN_0027 | learnings/0027-botsson-mutation-tools-must-emit.md         | Botsson mutation tools must emit |
| LEARN_0028 | learnings/0028-guardian-event-dedup.md                     | Guardian event dedup — renumbered from 0002 |

> All learning collisions resolved 2026-04-07: websocket-jwt → 0015, guardian-event-dedup → 0028. No gaps in 0001–0028.

### Plans

Active plans in `docs/plans/`. Completed plans in `docs/plans/completed/`.

| File                                                        | Status    | Module     |
| ----------------------------------------------------------- | --------- | ---------- |
| plans/BUILD_ORDER.md                                        | canonical | meta       |
| plans/CAMPAIGN-botsson-arena.md                             | active    | botsson    |
| plans/ROADMAP-ai-harness.md                                 | active    | botsson    |
| plans/PLAN-botsson-observability-foundation.md              | ready     | ai-agent   |
| plans/PLAN-contract-intake-gate-fix.md                      | ready     | ai-agent   |
| plans/PLAN-stage-engine-profile-id-derivation.md            | ready     | ai-agent   |
| plans/PLAN-engine-memory-writer.md                          | ready     | ai-agent   |
| plans/PLAN-dual-gate-composition.md                         | ready     | authority  |
| plans/archive/PLAN-dual-gate-reconciliation-2026-04-23-rejected.md | archived  | authority  |
| plans/PLAN-mobile-voice-wiring.md                           | ready     | ai-agent   |
| plans/PLAN-helpdesk-phase-0.md                              | in_progress | comms   |
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

91 journey documents in `docs/journeys/` (2026-04-07 count). Sample below — see folder for full list.

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

### Engines

Central package split:

- `engines/system-inteligence/` for global platform machinery (state engine, agent runtime, contracts, verification).
- `engines/industri-inteligence/` for domain specialization (industry, niche, role capability, environment, testing, handbook).
- `engines/artificial-inteligence/` as pointer package to canonical AI runtime docs.
- `archive/artificial-inteligence/` for archived split runtime snapshots (00-05).

| id                                    | File                                                                                                        | Status    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| ENGINE_SYSTEM_INTEL                   | engines/system-inteligence/README.md                                                                        | draft     |
| ENGINE_SYSTEM_STATE_CORE              | engines/system-inteligence/00-core-state-engine.md                                                          | draft     |
| ENGINE_SYSTEM_CONTRACTS               | engines/system-inteligence/01-system-architecture-contracts.md                                              | draft     |
| ENGINE_SYSTEM_AGENT_RUNTIME           | engines/system-inteligence/02-agent-framework-runtime.md                                                    | draft     |
| ENGINE_SYSTEM_NOTIFICATIONS           | engines/system-inteligence/03-notification-intelligence.md                                                  | draft     |
| ENGINE_SYSTEM_GOVERNANCE              | engines/system-inteligence/04-state-machine-governance.md                                                   | draft     |
| ENGINE_SYSTEM_VERIFICATION            | engines/system-inteligence/05-verification-safety-and-learning.md                                           | draft     |
| ENGINE_SYSTEM_SENSORY                 | engines/system-inteligence/06-autonomous-sensory-runtime.md                                                 | draft     |
| ENGINE_SYSTEM_JOURNEY_COMPILER        | engines/system-inteligence/07-journey-package-compiler.md                                                   | draft     |
| ENGINE_SYSTEM_EVENT_ENVELOPE          | engines/system-inteligence/08-event-envelope-spec.md                                                        | draft     |
| ENGINE_SYSTEM_GOLD_PACKAGE_ONBOARDING | engines/system-inteligence/09-gold-package-admin-onboarding.md                                              | draft     |
| ENGINE_SYSTEM_IMPL_GAP_PLAN           | engines/system-inteligence/10-implementation-and-gap-plan.md                                                | draft     |
| ENGINE_AI_INTEL                       | engines/artificial-inteligence/README.md                                                                    | reference |
| ENGINE_AI_ARCHIVE                     | archive/artificial-inteligence/README.md                                                                    | archived  |
| ENGINE_INDUSTRY_INTEL                 | engines/industri-inteligence/hospitalety/README.md                                                          | draft     |
| ENGINE_INDUSTRY_CORE                  | engines/industri-inteligence/hospitalety/00-engine-core.md                                                  | draft     |
| ENGINE_AI_COUNCIL_STANDARD            | engines/industri-inteligence/hospitalety/01-ai-council/README.md                                            | draft     |
| ENGINE_AI_COUNCIL_RESTO               | engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md                                | draft     |
| ENGINE_DEFAULT_POLICIES               | engines/industri-inteligence/hospitalety/02-default-policies/README.md                                      | draft     |
| ENGINE_POLICY_CATALOG                 | engines/industri-inteligence/hospitalety/02-default-policies/restaurant-policy-catalog.md                   | draft     |
| ENGINE_TEMPLATE_TAXONOMY              | engines/industri-inteligence/hospitalety/03-templates/README.md                                             | draft     |
| ENGINE_TEMPLATE_STRUCTURE             | engines/industri-inteligence/hospitalety/03-templates/business-structure-template.md                        | draft     |
| ENGINE_TEMPLATE_PIPELINE              | engines/industri-inteligence/hospitalety/03-templates/task-pipeline-template.md                             | draft     |
| ENGINE_TEMPLATE_JOURNEY               | engines/industri-inteligence/hospitalety/03-templates/journey-template.md                                   | draft     |
| ENGINE_TEMPLATE_RESTO_STRUCTURE       | engines/industri-inteligence/hospitalety/03-templates/restaurant-business-structure-template.md             | draft     |
| ENGINE_TEMPLATE_RESTO_PIPELINES       | engines/industri-inteligence/hospitalety/03-templates/restaurant-task-pipelines-template.md                 | draft     |
| ENGINE_TEMPLATE_RESTO_JOURNEYS        | engines/industri-inteligence/hospitalety/03-templates/restaurant-journey-template-catalog.md                | draft     |
| ENGINE_RESEARCH_PACK                  | engines/industri-inteligence/hospitalety/04-research/README.md                                              | draft     |
| ENGINE_RESEARCH_RESTO                 | engines/industri-inteligence/hospitalety/04-research/restaurant-research-pack.md                            | draft     |
| ENGINE_TESTING_RESTO                  | engines/industri-inteligence/hospitalety/05-testing/README.md                                               | draft     |
| ENGINE_TESTING_RESTO_PROFILES         | engines/industri-inteligence/hospitalety/05-testing/restaurant-testing-profiles.md                          | draft     |
| ENGINE_RELEVANCE_RESTO                | engines/industri-inteligence/hospitalety/06-relevance-map/restaurant-relevance-map.md                       | draft     |
| ENGINE_HANDBOOK_STRUCTURE             | engines/industri-inteligence/hospitalety/07-company-handbook/README.md                                      | draft     |
| ENGINE_HANDBOOK_RESTO                 | engines/industri-inteligence/hospitalety/07-company-handbook/restaurant-company-handbook-template.md        | draft     |
| ENGINE_ROLE_CAPABILITY_STRUCTURE      | engines/industri-inteligence/hospitalety/08-role-capability-profiles/README.md                              | draft     |
| ENGINE_ROLE_CAPABILITY_RESTO          | engines/industri-inteligence/hospitalety/08-role-capability-profiles/restaurant-role-capability-baseline.md | draft     |
| ENGINE_ENVIRONMENT_STRUCTURE          | engines/industri-inteligence/hospitalety/09-environment-profile/README.md                                   | draft     |
| ENGINE_ENVIRONMENT_RESTO              | engines/industri-inteligence/hospitalety/09-environment-profile/restaurant-environment-baseline.md          | draft     |
| ENGINE_NICHE_LAYER                    | engines/industri-inteligence/hospitalety/10-niche-profiles/README.md                                        | draft     |
| ENGINE_NICHE_SKELETON                 | engines/industri-inteligence/hospitalety/10-niche-profiles/niche-layer-skeleton.md                          | draft     |
| ENGINE_NICHE_TAXONOMY_RESTO           | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-taxonomy.md                     | draft     |
| ENGINE_NICHE_TEMPLATE_RESTO           | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-profile-template.md             | draft     |
| ENGINE_NICHE_EXAMPLE_RESTO            | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-italian-premium-service.md      | draft     |

### Roadmaps

| id                               | File                                   | Status    |
| -------------------------------- | -------------------------------------- | --------- |
| ROADMAP_API_KPI                  | roadmaps/API_KPI_AND_REVIEW_CADENCE.md | canonical |
| ROADMAP_API                      | roadmaps/API_ROADMAP.md                | canonical |
| PROJECT_ROADMAP                  | roadmaps/project-roadmap.md            | canonical |
| ROADMAP_ADMIN_ONBOARDING_JOURNEY | Roadmaps/Admin onboarding/Journey.md   | draft     |
| ROADMAP_ADMIN_ONBOARDING_MISSION | Roadmaps/Admin onboarding/Mission.md   | draft     |
| ROADMAP_ADMIN_ONBOARDING_LICENSE | Roadmaps/Admin onboarding/Lisence.md   | draft     |

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
