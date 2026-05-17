---
title: "Smartout Documentation Index"
updated: 2026-04-27
last-reconciled: 2026-04-27
---

# Smartout Documentation Index

Master navigation map for all documentation. An agent reads this to find any document. Regenerated 2026-04-27 from filesystem truth.

## Start Here

- **[docs/ORIENTATION.md](ORIENTATION.md)** — Boot-sequence cheat sheet, "where does X live" lookup, trust hierarchy, safety nets. The North Star document for any agent or human starting a session. Added per ADR-0075.
- **[docs/architecture/BOTSSON-SYSTEM-MAP.md](architecture/BOTSSON-SYSTEM-MAP.md)** — End-to-end pipe diagram for Botsson Arena + Stage Engine. Color-coded (🟢/🟡/🔴) component status. Authoritative for what exists, what's half-wired, and what's missing. Read before any AI-harness work.
- **[docs/STATE.md](STATE.md)** / **[docs/STATE-SUMMARY.md](STATE-SUMMARY.md)** — Current system state snapshot (drift-prone — see trust banner).
- **[docs/DASHBOARD.md](DASHBOARD.md)** — Live git state (active worktrees, free slots, pending journeys).
- **[docs/BUILD_ORDER.md](BUILD_ORDER.md)** — Build / migration ordering reference.

## Source of Truth Hierarchy

1. **Code + database schema** — implementation always wins
2. **CLAUDE.md** — conventions, rules, verified facts
   - 2.5. **docs/ORIENTATION.md** — boot-time reading order and "where does X live"
   - 2.5. **Cascade Core Foundation spec** — canonical cascade architecture (`superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
3. **docs/decisions/** — accepted ADRs (code-review reviewed, in git blame)
4. **docs/DASHBOARD.md** — live git state (active worktrees, free slots, pending journeys)
5. **~/dev/second-brain-v2/ops/activity-log.md** — append-only session/event audit trail
6. **claude-mem (MCP)** — cross-session narrative memory
7. **docs/STATE.md** — current system state, gaps (human-maintained snapshot, may drift — see trust banner at top of file)
8. **docs/reference/** — detailed lookup during coding
9. **docs/protocols/** — enforcement protocols (security, env, knowledge, deployment)
10. **docs/architecture/** — system design decisions
11. **docs/engines/** — industry engine packaging and event-layer specialization
12. **docs/modules/** — business logic per module (slim — most module docs migrated)
13. **docs/superpowers/specs/** — design specs feeding council reviews
14. **docs/archive/** — historical, never loaded actively

> `docs/SESSION.md` deleted per ADR-0075. Narrative role migrated to activity-log + claude-mem.
> `docs/cross-cutting/` and `docs/roadmaps/` (lowercase) folders no longer exist — content migrated to architecture/, protocols/, and `docs/engines/system-intelligence/packages/` (formerly `docs/Protokol/`, moved 2026-04-28).

## Counts (verified 2026-04-27)

| Asset | Count |
| --- | --- |
| ADRs | 202 (highest 0213; gaps 0092, 0159, 0203, 0204, 0206–0212) |
| Learnings | 131 (highest 0143; gaps 0130–0141) |
| Active plans | 65 (6 campaigns + 59 PLAN-/ROADMAP-) |
| Completed plans | 18 |
| Journeys | 156 |
| Protocols | 13 |
| Templates | 6 |
| Architecture docs | 25 |
| Reference docs | 21 |
| Engines docs | 32 |
| Research papers | 11 |
| Superpowers specs | 103 |
| Worklogs | 76 |
| Audits | 5 |
| Reports | 10 |
| Council logs | 1 |
| Design docs | 10 |
| Agent docs | 13 |
| Guides | 2 |
| Handoffs | 2 |
| Followups | 1 |
| Legal | 3 |
| LeadGen | 5 |
| Protokol packages | 11 |
| User Manual pages | 30 (en/nb/sv) |
| Upstream PRs | 1 |
| Archive files | 1 |

## Top-Level Files

| File | Purpose |
| --- | --- |
| docs/INDEX.md | This file |
| docs/ORIENTATION.md | North Star cheat sheet |
| docs/STATE.md | System state snapshot |
| docs/STATE-SUMMARY.md | Condensed state summary |
| docs/DASHBOARD.md | Live git state |
| docs/BUILD_ORDER.md | Build ordering reference |

## Reference (Layer 1)

| id                 | File                                             | Status    |
| ------------------ | ------------------------------------------------ | --------- |
| REF_DATABASE       | reference/DATABASE.md                            | canonical |
| REF_DB_REVIEW      | reference/DATABASE_REVIEW_2026-02-28.md          | canonical |
| REF_ROUTES         | reference/ROUTES.md                              | canonical |
| REF_PACKAGES       | reference/PACKAGES.md                            | canonical |
| REF_ENV            | reference/ENV_VARS.md                            | canonical |
| REF_API_ENDPOINTS  | reference/API_ENDPOINT_REFERENCE.md              | canonical |
| REF_API_DATA       | reference/API_DATA_DICTIONARY.md                 | canonical |
| REF_API_OVERVIEW   | reference/API_REFERENCE_OVERVIEW.md              | canonical |
| REF_API_VERSIONING | reference/API_VERSIONING_AND_LIFECYCLE.md        | canonical |
| REF_API_VISIBILITY | reference/API_VISIBILITY_AND_RELEASE_PROFILES.md | canonical |
| REF_API_INVENTORY  | reference/API_INVENTORY_AND_COVERAGE.md          | canonical |
| REF_API_KEY_REG    | reference/API_KEY_REGISTRY.md                    | canonical |
| REF_SERVICES_ARCH  | reference/SERVICES_ARCHITECTURE.md               | canonical |
| REF_SERVICE_ROUTING| reference/SERVICE_ROUTING.md                     | canonical |
| REF_EDGE_FUNCTIONS | reference/EDGE_FUNCTIONS_REFERENCE.md            | canonical |
| REF_API_ROUTES     | reference/API_ROUTES_REFERENCE.md                | canonical |
| REF_SCRAPLING_API  | reference/SCRAPLING_API.md                       | canonical |
| REF_EDDA_API       | reference/EDDA-API-INTEGRATION.md                | canonical |
| REF_SECRET_LIVE    | reference/SECRET_MANAGEMENT_LIVE.md              | canonical |
| REF_STAGE_ENGINE   | reference/STAGE_ENGINE_TRAINER_GUIDE.md          | canonical |
| REF_GIT_WORKFLOW   | reference/GIT-WORKFLOW.md                        | superseded (pointer to ADR-0265) |

## Modules

Most module docs migrated to architecture/ + decisions/. Three remain:

| id              | File                              | Status |
| --------------- | --------------------------------- | ------ |
| MOD_BILLING     | modules/MODULE_BILLING.md         | active |
| MOD_COMMUNICATION | modules/MODULE_COMMUNICATION.md | active |
| MOD_YEAR_WHEEL  | modules/MODULE_YEAR_WHEEL_PRD.md  | active |

## Architecture

| id                  | File                                                     | Status     |
| ------------------- | -------------------------------------------------------- | ---------- |
| ARCH_BOTSSON_MAP    | architecture/BOTSSON-SYSTEM-MAP.md                       | canonical  |
| ARCH_BOTSSON_SOUL   | architecture/BOTSSON_SOUL_ARCHITECTURE.md                | draft      |
| ARCH_HARNESS        | architecture/HARNESS-ARCHITECTURE.md                     | in_progress |
| ARCH_STAGE_ENGINE   | architecture/STAGE-ENGINE.md                             | in_progress |
| ARCH_INVARIANTS     | architecture/INVARIANTS.md                               | canonical  |
| ARCH_AI_RUNTIME_DEF | architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md          | canonical  |
| ARCH_AI_RUNTIME_RB  | architecture/AI_RUNTIME_RUNBOOK.md                       | canonical  |
| ARCH_PRD_03         | architecture/PRD-03_Avstemmingssystem.md                 | canonical  |
| ARCH_SCHED_UX_AUDIT | architecture/SCHEDULE_PAGE_UX_AUDIT_AND_WORKFLOWS.md     | canonical  |
| ARCH_SHIFT_LIFECYCLE| architecture/SHIFT_LIFECYCLE_MAP.md                      | canonical  |
| ARCH_APPENDIX_ENUMS | architecture/SMARTOUT_APPENDIX_ENUMS.md                  | canonical  |
| ARCH_CONTRACT       | architecture/SMARTOUT_CONTRACT_SYSTEM.md                 | canonical  |
| ARCH_CORE_V2        | architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md            | canonical  |
| ARCH_FOUND_PROD_ID  | architecture/SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md     | canonical  |
| ARCH_REPORTS_KPIS   | architecture/SMARTOUT_MODULE_10_REPORTS_AND_KPIS.md      | canonical  |
| ARCH_PACKAGES       | architecture/SMARTOUT_PACKAGES_ARCHITECTURE.md           | canonical  |
| ARCH_PROD           | architecture/SMARTOUT_PRODUCTION_ARCHITECTURE.md         | canonical  |
| ARCH_SECRET_API     | architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md       | canonical  |
| ARCH_SUBDOMAIN      | architecture/SMARTOUT_Subdomain_Routing_Architecture.md  | canonical  |
| ARCH_TELEMETRY      | architecture/SMARTOUT_TELEMETRY_ARCHITECTURE.md          | canonical  |
| ARCH_WS_ONBOARD     | architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md | canonical |
| ARCH_CASCADE_BACKFILL | architecture/cascade-backfill-plan.md                  | active     |
| ARCH_CASCADE_LEGACY | architecture/cascade-legacy-usage-inventory.md           | active     |
| ARCH_CASCADE_CUTOVER| architecture/cascade-runtime-cutover-checklist.md        | active     |
| ARCH_CASCADE_SPREAD | architecture/cascade-spreadsheet-overview.md             | reference  |
| ARCH_INFRA_EDGE     | architecture/infra-layer-edge-functions-architecture.md  | canonical  |
| ARCH_PROG_INTEL     | architecture/progressive-intelligence-protocol.md        | active     |
| ARCH_VOICE_AUTH     | architecture/workspace-authority-chain.md                | canonical  |

## Cascade Architecture

| id                | File                                                             | Status    |
| ----------------- | ---------------------------------------------------------------- | --------- |
| CASCADE_SPEC      | superpowers/specs/2026-03-21-cascade-scheduling-system-design.md | canonical |
| CASCADE_BACKFILL  | architecture/cascade-backfill-plan.md                            | active    |
| CASCADE_LEGACY    | architecture/cascade-legacy-usage-inventory.md                   | active    |
| CASCADE_CUTOVER   | architecture/cascade-runtime-cutover-checklist.md                | active    |
| CASCADE_SPREAD    | architecture/cascade-spreadsheet-overview.md                     | reference |

## Protocols (Enforcement)

High-level rules that MUST be followed.

| id                | File                                            | Scope                                          |
| ----------------- | ----------------------------------------------- | ---------------------------------------------- |
| PROTO_SECURITY    | protocols/SECURITY.md                           | Secrets, auth, RLS, API keys                   |
| PROTO_AUTH        | protocols/AUTH_SECURITY.md                      | Auth flows, OTP, rate limiting                 |
| PROTO_DOC         | protocols/DOCUMENTATION.md                      | Source of truth, doc standards                 |
| PROTO_KNOWLEDGE   | protocols/KNOWLEDGE.md                          | ADRs, learnings, templates                     |
| PROTO_ENV         | protocols/ENV_PROTOCOL.md                       | Environment variables, vault, op run           |
| PROTO_ENV_VERIFY  | protocols/ENV_VERIFICATION.md                   | Env verification procedures                    |
| PROTO_DEPLOY      | protocols/DEPLOYMENT.md                         | Deployment workflow                            |
| ~~PROTO_DEPLOY_DASH~~ | ~~protocols/DEPLOYMENT-DASHBOARD.md~~       | ~~Deployment dashboard reference~~ (deleted 2026-05-04 per ADR-0265) |
| PROTO_CI_PGTAP    | protocols/CI_PGTAP.md                           | pgTAP CI suite                                 |
| PROTO_VERIFY_MAN  | protocols/PROTOCOL-VERIFICATION-MANUAL.md       | Protocol verification                          |
| PROTO_JOURNEY_INF | protocols/JOURNEY-INFERENCE-WORK-INSTRUCTION.md | Journey inference work instructions            |
| PROTO_SHIFT_LOCK  | protocols/SHIFT_LOCK_OPS_QUERIES.md             | Shift lock ops queries                         |
| PROTO_SHIFT_ROLL  | protocols/SHIFT_LOCK_ROLLOUT.md                 | Shift lock rollout                             |

## Templates

Reusable document templates in `docs/templates/`.

| id           | File                              | Purpose                       |
| ------------ | --------------------------------- | ----------------------------- |
| TPL_DECISION | templates/decision.md             | ADR template                  |
| TPL_LEARNING | templates/learning.md             | Learning record template      |
| TPL_ARCH     | templates/architecture.md         | Architecture doc template     |
| TPL_PLAN     | templates/plan.md                 | Implementation plan template  |
| TPL_PLANVER  | templates/plan-verification.md    | Plan completeness check       |
| TPL_FEATVER  | templates/feature-verification.md | Code correctness verification |

## Decisions (ADRs)

See `docs/decisions/0000-decision-log.md` — **202 ADR files** (highest ADR-0213 as of 2026-04-27).

**Gaps:** 0092, 0159, 0203, 0204, 0206, 0207, 0208, 0209, 0210, 0211, 0212. Next number: 0214.

**Status breakdown:** 163 accepted, 22 proposed, 1 canonical, 6 superseded, 1 done, 9 with `Accepted` (capital A — needs normalization). Proposed-and-not-accepted: 0053, 0122, 0123, 0124, 0135, 0136, 0152, 0153, 0154, 0155, 0158, 0167, 0168, 0169, 0183, 0191, 0192, 0194, 0195, 0196, 0197, 0205.

| id | File | Status | Subject |
| --- | --- | --- | --- |
| ADR_0001 | docs/decisions/0001-use-turborepo-pnpm.md | accepted | Adopt Turborepo & pnpm Workspaces |
| ADR_0002 | docs/decisions/0002-state-vs-hooks.md | accepted | State-Driven vs Hook-Driven Logic Boundaries |
| ADR_0003 | docs/decisions/0003-shadcn-integration.md | accepted | UI Framework and Local Styling Strategy |
| ADR_0004 | docs/decisions/0004-unified-telemetry-engine.md | accepted | Unified Telemetry & Audit Trail Engine |
| ADR_0005 | docs/decisions/0005-testing-infrastructure.md | accepted | Testing Infrastructure — Four-Layer Strategy |
| ADR_0006 | docs/decisions/0006-secrets-and-environment.md | accepted | Environment Variables, Secrets & Module Boundaries |
| ADR_0007 | docs/decisions/0007-dashboard-architecture.md | accepted | Dashboard App Layout & Navigation State |
| ADR_0008 | docs/decisions/0008-dashboard-scroll-behavior.md | accepted | Dashboard Scroll Behavior & Dynamic Layout |
| ADR_0009 | docs/decisions/0009-tailwind-v4-css-config.md | accepted | Tailwind CSS v4 with CSS-Based Configuration |
| ADR_0010 | docs/decisions/0010-ai-sdk-openrouter.md | accepted | AI SDK with OpenRouter Provider |
| ADR_0011 | docs/decisions/0011-user-identity-table-naming.md | accepted | User Table Named user_identity (Not user) |
| ADR_0012 | docs/decisions/0012-subscription-on-company.md | accepted | Subscription Data on Company Table (No Separate Table) |
| ADR_0013 | docs/decisions/0013-database-types-generation.md | accepted | Auto-Generated Database Types Workflow |
| ADR_0014 | docs/decisions/0014-posthog-eu-proxy.md | accepted | PostHog EU Instance with Reverse Proxy |
| ADR_0015 | docs/decisions/0015-bubble-rebuild-strategy.md | accepted | Bubble.io Rebuild Strategy |
| ADR_0016 | docs/decisions/0016-services-directory.md | accepted | Services Directory for Backend Microservices |
| ADR_0017 | docs/decisions/0017-enterprise-infrastructure.md | Accepted | Enterprise Infrastructure — Shared Configs, Design System, Monitoring |
| ADR_0018 | docs/decisions/0018-tanstack-table-recharts-platform-admin.md | accepted | TanStack Table and Recharts for Platform Admin |
| ADR_0019 | docs/decisions/0019-performance-build-governance.md | accepted | Performance and Build Governance System |
| ADR_0020 | docs/decisions/0020-vercel-hosting-strategy.md | Accepted | Vercel Hosting with Dual-Project Split |
| ADR_0021 | docs/decisions/0021-subdomain-workspace-routing.md | Accepted | Subdomain-Based Workspace Routing |
| ADR_0022 | docs/decisions/0022-notification-service-architecture.md | accepted | Email/Notification Service Architecture |
| ADR_0023 | docs/decisions/0023-global-scrollbar-standard.md | accepted | Global Scrollbar Standard via Design Tokens |
| ADR_0024 | docs/decisions/0024-contract-system-architecture.md | accepted | Contract System Architecture |
| ADR_0025 | docs/decisions/0025-documentation-restructuring.md | accepted | Documentation Restructuring -- Layered System with YAML Frontmatter |
| ADR_0026 | docs/decisions/0026-template-editor-redesign-attachments.md | Accepted | Template Editor Redesign with PDF Attachments |
| ADR_0027 | docs/decisions/0027-pricing-terms-table.md | Accepted | Pricing Terms Table for Workspace Commercial Model |
| ADR_0028 | docs/decisions/0028-api-key-management-system.md | Accepted | API Key Management System |
| ADR_0029 | docs/decisions/0029-workspace-api-gateway.md | Accepted | Workspace API Gateway |
| ADR_0030 | docs/decisions/0030-documentation-in-landing-app.md | accepted | Documentation System in Landing App (Nextra Removal) |
| ADR_0031 | docs/decisions/0031-journey-portal-system.md | accepted | Journey Portal System |
| ADR_0032 | docs/decisions/0032-schedule-local-state-architecture.md | accepted | Schedule Page Local State Architecture |
| ADR_0033 | docs/decisions/0033-documentation-rag-pgvector.md | accepted | Documentation RAG with pgvector |
| ADR_0034 | docs/decisions/0034-documentation-enforcement-pipeline.md | accepted | Documentation Enforcement Pipeline |
| ADR_0035 | docs/decisions/0035-docker-network-infra.md | superseded | Docker Network Infrastructure |
| ADR_0036 | docs/decisions/0036-shift-mcp-server.md | accepted | Shift MCP Server |
| ADR_0037 | docs/decisions/0037-landing-event-tracking.md | accepted | Landing Page Event Tracking |
| ADR_0038 | docs/decisions/0038-journey-agent-output-generators.md | accepted | Journey Agent & Output Generators |
| ADR_0039 | docs/decisions/0039-infra-consolidation.md | accepted | Infrastructure Consolidation |
| ADR_0040 | docs/decisions/0040-infrastructure-in-monorepo.md | accepted | Infrastructure stays in monorepo |
| ADR_0041 | docs/decisions/0041-onboarding-wizard-step-architecture.md | accepted | Onboarding Wizard Step Architecture |
| ADR_0042 | docs/decisions/0042-agent-architecture.md | accepted | Agent Architecture — Stage Engine Agent Mode |
| ADR_0043 | docs/decisions/0043-emergency-contact-on-user-identity.md | accepted | Emergency Contact on user_identity |
| ADR_0044 | docs/decisions/0044-invitation-table-naming.md | accepted | Invitation Table Naming |
| ADR_0045 | docs/decisions/0045-sendgrid-transactional-email.md | accepted | SendGrid for Transactional Email |
| ADR_0046 | docs/decisions/0046-block-based-landing-page-builder.md | superseded | Block-based Landing Page Builder |
| ADR_0047 | docs/decisions/0047-schedule-db-persistence.md | accepted | Schedule DB Persistence with TanStack Query |
| ADR_0048 | docs/decisions/0048-daily-close-engine.md | accepted | DailyCloseEngine — State Machine + Reconciliation System |
| ADR_0049 | docs/decisions/0049-agent-sdk-package.md | accepted | Agent SDK Package — @smartout/agent-sdk |
| ADR_0050 | docs/decisions/0050-port-standardization-and-vault-secrets.md | accepted | Port Standardization & Vault Secrets Strategy |
| ADR_0051 | docs/decisions/0051-unified-ai-runtime-system-definition.md | accepted | Unified AI Runtime System Definition v1 |
| ADR_0052 | docs/decisions/0052-guardian-websocket-architecture.md | accepted | Guardian Real-Time WebSocket Architecture |
| ADR_0053 | docs/decisions/0053-simulation-schema-and-simulator-service.md | proposed | Simulation schema and simulator microservice |
| ADR_0054 | docs/decisions/0054-edge-functions-own-call-orchestration.md | accepted | Edge Functions Own Call Orchestration |
| ADR_0055 | docs/decisions/0055-two-vault-environment-isolation.md | superseded | Two-Vault Environment Isolation |
| ADR_0056 | docs/decisions/0056-cascade-core-foundation-schema.md | done | Cascade Core Foundation Schema |
| ADR_0057 | docs/decisions/0057-payroll-schema-separation.md | accepted | Payroll Schema Separation |
| ADR_0058 | docs/decisions/0058-livekit-as-webrtc-provider.md | accepted | LiveKit as WebRTC Provider |
| ADR_0059 | docs/decisions/0059-platform-admin-pipeline.md | accepted | Platform Admin Pipeline Separation |
| ADR_0060 | docs/decisions/0060-unified-wizard-shell.md | accepted | Unified Wizard Shell in packages/ui |
| ADR_0061 | docs/decisions/0061-walkai-semantic-tagging.md | accepted | Walk AI Semantic Tagging Convention |
| ADR_0062 | docs/decisions/0062-industry-intelligence-consolidation.md | accepted | Industry Intelligence Consolidation |
| ADR_0063 | docs/decisions/0063-communication-system-consolidation.md | accepted | Communication System Consolidation — Komm Canonical, Chat Frozen |
| ADR_0064 | docs/decisions/0064-dynamic-landing-engine.md | accepted | Dynamic Landing Engine — Supersedes Block-based Builder |
| ADR_0065 | docs/decisions/0065-hospitality-operations-cockpit-v1-contract.md | accepted | Hospitality Operations Cockpit V1 Contract |
| ADR_0066 | docs/decisions/0066-temporal-shift-lock-architecture.md | accepted | Temporal Shift Lock Architecture |
| ADR_0067 | docs/decisions/0067-smart-cover-via-event-engine.md | accepted | Smart Cover via Event Engine |
| ADR_0068 | docs/decisions/0068-simulation-schema-and-service.md | accepted | Simulation Schema and Dedicated Service |
| ADR_0069 | docs/decisions/0069-session-execution-ownership.md | accepted | Session Execution Ownership: Edge Functions + Engine Side-Effects |
| ADR_0070 | docs/decisions/0070-emma-wizard-bridge.md | accepted | Emma-Wizard Bridge: tool-based agent control over wizard flows |
| ADR_0071 | docs/decisions/0071-preview-environment-architecture.md | accepted | Preview Environment Architecture |
| ADR_0072 | docs/decisions/0072-vercel-multi-service-rejected.md | accepted | Vercel multi-service migration — rejected pending platform investigation |
| ADR_0073 | docs/decisions/0073-ai-eval-harness.md | accepted | ADR-0073 — Eval harness for packages/ai |
| ADR_0074 | docs/decisions/0074-protocol-verification-engine.md | accepted | Protocol Verification Engine Architecture |
| ADR_0075 | docs/decisions/0075-knowledge-system-consolidation.md | accepted | Knowledge System Consolidation — DASHBOARD/SESSION vs Second Brain + claude-mem |
| ADR_0076 | docs/decisions/0076-contract-composition-as-cascade-derivation.md | accepted | Contract Composition as Cascade Derivation |
| ADR_0077 | docs/decisions/0077-contract-intake-pii-handling.md | accepted | Contract Intake — PII Handling and Storage |
| ADR_0078 | docs/decisions/0078-engine-process-channel-restriction.md | accepted | Engine Process Channel Restriction |
| ADR_0079 | docs/decisions/0079-adr-0024-amendment-employment-vs-platform-contracts.md | accepted | ADR-0024 Amendment — employment_contract vs contract System Separation |
| ADR_0080 | docs/decisions/0080-compliance-drift-signal-read-only.md | accepted | Compliance Drift Signal — Read-Only View, Not a Cascade Derivation |
| ADR_0081 | docs/decisions/0081-admin-pii-bypass-security-definer-rpc.md | accepted | Admin PII Bypass via SECURITY DEFINER RPC |
| ADR_0082 | docs/decisions/0082-contract-drafts-are-not-versions.md | accepted | Contract Drafts Are Not Versions — Versioning Starts at Send |
| ADR_0083 | docs/decisions/0083-strike-mcp-registration.md | accepted | Strike MCP Registered as Dev-Only Data Source |
| ADR_0084 | docs/decisions/0084-telemetry-conditional-exports.md | accepted | Telemetry package conditional exports for client/server split |
| ADR_0085 | docs/decisions/0085-year-wheel-governance-policy.md | accepted | Year Wheel Governance Policy |
| ADR_0086 | docs/decisions/0086-entity-drawer-surface-pattern.md | accepted | Entity Drawer Surface Pattern |
| ADR_0087 | docs/decisions/0087-communications-as-cascade-consumer.md | accepted | Communications as Cascade Consumer — C2 Contract |
| ADR_0088 | docs/decisions/0088-ai-operations-intelligence-capability.md | accepted | AI Operations Intelligence as Capability, Not Daemon |
| ADR_0089 | docs/decisions/0089-walkai-bridge-architecture.md | accepted | WalkAi Bridge Architecture — Client vs Server Tools |
| ADR_0090 | docs/decisions/0090-framework-rule-evaluation-config-schema.md | accepted | Framework Rule Evaluation Config JSON Schema |
| ADR_0091 | docs/decisions/0091-governance-gate-placement-postgres-rpc.md | accepted | Governance Gate Placement — Postgres RPC (SECURITY DEFINER) |
| ADR_0093 | docs/decisions/0093-contract-draft-proposals-unified-cascade.md | accepted | Contract Draft Proposals Flow Through Unified apply_cascade() |
| ADR_0094 | docs/decisions/0094-framework-rule-severity-enum.md | accepted | Framework Rule Severity as Enum |
| ADR_0095 | docs/decisions/0095-shift-lifecycle-five-layer-architecture.md | accepted | Shift Lifecycle Five-Layer Architecture |
| ADR_0096 | docs/decisions/0096-schedule-shift-vs-department-session.md | accepted | schedule_shift vs department_session — Formal Relation |
| ADR_0097 | docs/decisions/0097-time-entry-as-reality-source.md | accepted | time_entry as D6 Reality Source (Immutable) |
| ADR_0098 | docs/decisions/0098-engine-state-as-coordination-spor.md | accepted | engine_state as Coordination Spor, Not Truth Owner |
| ADR_0099 | docs/decisions/0099-unified-authority-gate.md | accepted | Unified Authority-Gate Across agent-router and engine-dispatch |
| ADR_0100 | docs/decisions/0100-daily-close-as-aggregate-consumer.md | accepted | daily_close as Department-Aggregate Consumer of Settled Shifts |
| ADR_0101 | docs/decisions/0101-four-eyes-extension-gate-action.md | accepted | Four-Eyes Extension of gate_action RPC |
| ADR_0102 | docs/decisions/0102-evidence-tier-enum.md | accepted | evidence_tier Enum for Protocol Proof Requirements |
| ADR_0103 | docs/decisions/0103-observer-request-c4-decision-layer.md | accepted | observer_request in C4 Decision Layer |
| ADR_0104 | docs/decisions/0104-notification-consolidation-roadmap.md | accepted | Notification Consolidation Roadmap |
| ADR_0105 | docs/decisions/0105-inspection-link-public-access-pattern.md | accepted | inspection_link Public-Access Pattern |
| ADR_0106 | docs/decisions/0106-effective-dating-governance-content.md | accepted | Effective-Dating Strategy for Governance Content |
| ADR_0107 | docs/decisions/0107-botsson-provider-channel-derivation.md | accepted | BotssonProvider Channel Derivation (closes ADR-0078 mobile gap) |
| ADR_0108 | docs/decisions/0108-use-shift-lifecycle-platform-neutral.md | accepted | useShiftLifecycle Platform-Neutral Contract |
| ADR_0109 | docs/decisions/0109-migrated-contract-shell-block-and-supersede.md | accepted | Migrated Contract Shell — Block-and-Supersede Rule for Bubble-Imported Contracts |
| ADR_0110 | docs/decisions/0110-payroll-ledger-archive-semantics.md | accepted | Payroll Ledger Archive — Read-Only Bubble Historical Semantics |
| ADR_0111 | docs/decisions/0111-employment-contract-detail-versioning.md | accepted | Employment Contract Detail — Append-Only Versioning of Tripletex-Canonical Fields |
| ADR_0112 | docs/decisions/0112-intent-classifier-coverage-invariant.md | accepted | ADR-0112 — Intent Classifier Coverage Invariant |
| ADR_0113 | docs/decisions/0113-dashboard-context-decomposition-completion.md | accepted | DashboardContext Decomposition Completion |
| ADR_0114 | docs/decisions/0114-server-actions-canonical-mutation-primitive.md | accepted | Server Actions as Canonical User-Initiated Mutation Primitive |
| ADR_0115 | docs/decisions/0115-rsc-migration-pattern-dashboard-routes.md | accepted | RSC Migration Pattern for Dashboard Routes |
| ADR_0116 | docs/decisions/0116-runtime-telemetry-standard.md | accepted | ADR-0116 — Runtime Telemetry Standard for services/ |
| ADR_0117 | docs/decisions/0117-authority-model-after-phase-4.md | accepted | ADR-0117 — Authority Model after Phase 4 (Single Source via gate_action) |
| ADR_0118 | docs/decisions/0118-invoice-engine-as-c3-commercial-consumer.md | accepted | ADR-0118 — Invoice Engine as C3 Commercial Consumer |
| ADR_0119 | docs/decisions/0119-usage-snapshot-reproducibility.md | accepted | ADR-0119 — Usage Snapshot Reproducibility + Active-User Counting Predicate |
| ADR_0120 | docs/decisions/0120-invoice-immutability-credit-note-policy.md | accepted | ADR-0120 — Invoice Immutability + Credit Note Policy |
| ADR_0121 | docs/decisions/0121-pricing-terms-billing-engine-extension.md | accepted | ADR-0121 — pricing_terms Extension for Billing Engine |
| ADR_0122 | docs/decisions/0122-governance-telemetry-quad-destination.md | proposed | ADR-0122 — Governance Telemetry Quad-Destination Routing |
| ADR_0123 | docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md | proposed | ADR-0123 — ADR-0029 Amendment: Pre-Workspace Edge Function Exceptions |
| ADR_0124 | docs/decisions/0124-polymorphic-fk-documentation-convention.md | proposed | ADR-0124 — Polymorphic FK Documentation Convention |
| ADR_0125 | docs/decisions/0125-billing-activity-log-as-platform-scoped-audit.md | accepted | billing_activity_log as platform-scoped audit trail for billing |
| ADR_0126 | docs/decisions/0126-integration-sync-as-event-engine-process.md | accepted | Integration Sync as Event Engine Process, Not Parallel Motor |
| ADR_0127 | docs/decisions/0127-billing-dispatch-rule-2-level-evaluation.md | accepted | Billing Dispatch Rule 2-Level Evaluation with Suppress Semantics |
| ADR_0128 | docs/decisions/0128-invoice-delivery-columns-deprecation-lifecycle.md | accepted | invoice.delivery_* Columns Deprecation Lifecycle |
| ADR_0129 | docs/decisions/0129-billing-integration-adapter-pattern.md | accepted | Billing Integration Adapter Pattern + Placeholder Audit-Safety |
| ADR_0130 | docs/decisions/0130-fase-2-scope-exclusion-contract-onboarding.md | accepted | Fase 2 Scope Exclusion — Contract Onboarding Extracted to Fase 2.5 |
| ADR_0131 | docs/decisions/0131-stripe-connect-platform-model.md | accepted | Stripe Connect Platform Model — Smartout-Owned |
| ADR_0132 | docs/decisions/0132-mobile-thin-client-via-web-bff.md | accepted | Mobile is a Thin Client; AI/Capabilities Route Through Web BFF |
| ADR_0133 | docs/decisions/0133-web-composes-mobile-executes.md | accepted | Web Composes, Mobile Executes — Cascade Surface Boundary |
| ADR_0134 | docs/decisions/0134-mobile-telemetry-contract-enforcement.md | accepted | Mobile Telemetry Contract Enforcement — workspace_id and actor_id Required |
| ADR_0135 | docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md | proposed | Mobile Voice via LiveKit (Not Ultravox) |
| ADR_0136 | docs/decisions/0136-witness-with-camera-evidence-model.md | proposed | Witness-with-Camera Evidence Model for Control_List and Protocol Completion |
| ADR_0137 | docs/decisions/0137-gate-action-stacking-semantics.md | draft | Gate Action Stacking Semantics — gate_action × cascade_gate_write |
| ADR_0138 | docs/decisions/0138-agent-tool-result-gate-outcome.md | draft | Agent Tool Result Contract with Gate Outcomes |
| ADR_0139 | docs/decisions/0139-color-proposed-pending-state-ux.md | draft | `--color-proposed` Token + Pending-State UX Contract |
| ADR_0140 | docs/decisions/0140-governance-provenance-jsonb.md | accepted | Governance table provenance convention via `provenance JSONB` |
| ADR_0141 | docs/decisions/0141-payment-attempt-pii-redaction-retention.md | accepted | payment_attempt PII Redaction + Retention Policy |
| ADR_0142 | docs/decisions/0142-invoice-refund-flow-adr-0120-amendment.md | accepted | Invoice Refund Flow — ADR-0120 Amendment for Stripe Refunds |
| ADR_0143 | docs/decisions/0143-dunning-via-engine-process.md | accepted | Automated Dunning via engine_process, Not n8n |
| ADR_0144 | docs/decisions/0144-invoice-delivery-columns-drop-gate.md | accepted | invoice.delivery_* DROP COLUMN Lifecycle Gate (ADR-0128 Amendment) |
| ADR_0145 | docs/decisions/0145-workspace-oauth-token-storage-supabase-vault.md | superseded | Workspace Integration OAuth Token Storage — Supabase Vault |
| ADR_0146 | docs/decisions/0146-peppol-ehf-transport-via-tickstar.md | superseded | Peppol EHF Transport via Tickstar SaaS Access Point |
| ADR_0147 | docs/decisions/0147-integration-poll-payments-separate-engine-process.md | superseded | integration_poll_payments as Separate engine_process from integration_sync |
| ADR_0148 | docs/decisions/0148-ehf-export-csv-pdf-platform-admin.md | accepted | EHF-leveranse via månedlig CSV/PDF-eksport fra platform-admin |
| ADR_0149 | docs/decisions/0149-strike-mcp-telemetry-boundary.md | accepted | Strike-MCP Telemetry Boundary |
| ADR_0150 | docs/decisions/0150-source-discriminator-trigger-filters.md | accepted | Source Discriminator Pattern + Trigger Filters for Migration Provenance |
| ADR_0151 | docs/decisions/0151-stage-engine-profile-id-server-derivation.md | accepted | Stage-engine must re-derive profile_id server-side |
| ADR_0152 | docs/decisions/0152-activity-trail-fail-fast-contract.md | proposed | activity-trail provider must fail-fast on missing IDs, not silently drop |
| ADR_0153 | docs/decisions/0153-expo-web-surface-classification.md | proposed | Expo-web Surface Classification |
| ADR_0154 | docs/decisions/0154-unified-overlay-system.md | proposed | Unified Overlay System — EntityDrawer + EntityFormDialog |
| ADR_0155 | docs/decisions/0155-livekit-calls-in-expo-web.md | proposed | LiveKit Calls Are Supported In Expo-web |
| ADR_0156 | docs/decisions/0156-day-control-panel-canonical-admin-surface.md | accepted | Day-Control Panel as Canonical D6 Admin Surface |
| ADR_0157 | docs/decisions/0157-server-actions-scope-amendment-adr-0114.md | accepted | Server Actions Scope — Amendment to ADR-0114 |
| ADR_0158 | docs/decisions/0158-packages-ui-dual-platform-strategy.md | proposed | packages/ui — Dual-Platform Consumption Strategy (web + mobile RN) |
| ADR_0160 | docs/decisions/0160-channel-event-vs-engine-event-boundary.md | accepted | channel_event vs engine_event boundary |
| ADR_0161 | docs/decisions/0161-helpdesk-ontology-ticket-as-engine-state.md | accepted | Helpdesk ontology — ticket as engine_state |
| ADR_0162 | docs/decisions/0162-helpdesk-query-capability-placement.md | accepted | helpdesk_query capability placement and isolation |
| ADR_0163 | docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md | accepted | ADR-0078 amendment — allowedChannels mandatory for PII capabilities |
| ADR_0164 | docs/decisions/0164-season-namespace-unification-telemetry.md | accepted | Season-namespace unification for year-wheel telemetry events |
| ADR_0165 | docs/decisions/0165-progressive-channel-discriminator.md | accepted | Progressive Channel discriminator — helpdesk as flag, not subtype |
| ADR_0166 | docs/decisions/0166-pii-public-mode-redaction.md | accepted | PII redaction in public-mode helpdesk channels — soft-hold classifier |
| ADR_0167 | docs/decisions/0167-invitation-tokens-as-credentials.md | proposed | Invitation Tokens Are Credentials, Not Identifiers |
| ADR_0168 | docs/decisions/0168-magic-link-as-default-auth-method.md | proposed | Magic Link as Default Authentication Method |
| ADR_0169 | docs/decisions/0169-partial-unique-index-pending-invitation.md | proposed | Partial Unique Index on Pending Invitations |
| ADR_0170 | docs/decisions/0170-react-context-packages-as-peer-dependencies.md | accepted | React context packages are peerDependencies in workspace libraries |
| ADR_0171 | docs/decisions/0171-journey-ir-canonical-package-path.md | accepted | JourneyIR canonical package path — packages/journey-ir |
| ADR_0172 | docs/decisions/0172-journey-version-status-enum-lifecycle.md | accepted | journey_version_status enum + journey lifecycle state model |
| ADR_0173 | docs/decisions/0173-journey-capability-model.md | accepted | Journey capability model — four named capabilities |
| ADR_0174 | docs/decisions/0174-adr-0074-journey-ir-unification-completion.md | accepted | ADR-0074 Protocol Verification Engine unification completion — JourneyIR as single source |
| ADR_0175 | docs/decisions/0175-journey-telemetry-contract.md | accepted | Journey telemetry contract — five registered emit events |
| ADR_0176 | docs/decisions/0176-journey-c4-authority-seed.md | accepted | Journey capability C4 authority seed — mandatory non-default rows |
| ADR_0177 | docs/decisions/0177-journey-runner-ui-contract.md | accepted | Journey Runner UI contract — Fjernkontroll state machine + store-listing schema |
| ADR_0178 | docs/decisions/0178-journey-ir-v2-schema-expansion.md | accepted | JourneyIR v2 schema expansion — additive runner bindings |
| ADR_0179 | docs/decisions/0179-browser-mutations-via-nextjs-route-handlers.md | accepted | Browser-Originated Mutations Route Through Next.js Route Handlers |
| ADR_0180 | docs/decisions/0180-engine-event-parity-contract.md | accepted | Engine Event Parity Contract for Telemetry |
| ADR_0181 | docs/decisions/0181-k1a-k1b-template-inheritance-drift-detection.md | accepted | K1a→K1b Template Inheritance & Drift Detection |
| ADR_0182 | docs/decisions/0182-template-vs-contract-lifecycle-separation.md | accepted | Template vs Contract Lifecycle Separation |
| ADR_0183 | docs/decisions/0183-industry-intelligence-capability.md | proposed | industry_intelligence Capability (proposed, deferred) |
| ADR_0184 | docs/decisions/0184-session-recorder.md | accepted | Session Recorder Architecture |
| ADR_0185 | docs/decisions/0185-platform-admin-session-intervention.md | accepted | Platform Admin Session Intervention — Whisper + Flag + Force-Stop |
| ADR_0186 | docs/decisions/0186-guardian-bus-pg-notify.md | accepted | Guardian event delivery via pg LISTEN/NOTIFY |
| ADR_0187 | docs/decisions/0187-session-state-events-single-emit-source.md | accepted | Session state-change events have exactly one emit source |
| ADR_0188 | docs/decisions/0188-handoff-notes-column-deprecation.md | accepted | Legacy `department_session.handoff_notes` column deprecation |
| ADR_0189 | docs/decisions/0189-authority-seed-parity-ci-check.md | accepted | Authority seed parity enforced via CI check |
| ADR_0190 | docs/decisions/0190-authority-parity-cascade-gate-write-orthogonal-controls.md | accepted | Authority parity for cascade_gate_write (pathway B) via orthogonal controls |
| ADR_0191 | docs/decisions/0191-agent-capability-tool-auth-passing-pattern.md | proposed | Agent capability tool auth-passing pattern |
| ADR_0192 | docs/decisions/0192-authority-seed-bootstrap-trigger-pattern.md | proposed | Authority seed bootstrap-trigger pattern |
| ADR_0193 | docs/decisions/0193-adr-0134-amendment-non-empty-string-brand-for-telemetry-ids.md | accepted | Amendment to ADR-0134: NonEmptyString brand for telemetry actor_id/workspace_id |
| ADR_0194 | docs/decisions/0194-journey-ir-v2-to-engine-missions-mapping.md | proposed | JourneyIR v2.1 → engine_missions mapping |
| ADR_0195 | docs/decisions/0195-authority-loader-full-dotted-key-preservation.md | proposed | Authority loader full dotted-key preservation |
| ADR_0196 | docs/decisions/0196-journey-engine-invariants-11-12-13.md | proposed | Journey Engine Invariants 11 / 12 / 13 |
| ADR_0197 | docs/decisions/0197-phantom-contracts-promotion.md | proposed | Phantom contracts — promotion of L-0094 after 5th occurrence with new failure mode |
| ADR_0198 | docs/decisions/0198-capability-definition-typed-fields.md | accepted | CapabilityDefinition typed fields — allowedChannels required, toolAuthPattern required, emitPrefix explicit |
| ADR_0199 | docs/decisions/0199-harness-invariants-doc-ci-mapping.md | accepted | Harness invariants — compiled index with CI-enforcement mapping |
| ADR_0200 | docs/decisions/0200-atomic-season-activation-rpc-d1-cascade.md | accepted | Atomic Season Activation — Trigger-Extension D1 Cascade + RPC Race Guard |
| ADR_0201 | docs/decisions/0201-season-agent-capability.md | accepted | Season Agent Capability — Five Tools, Authority Seed, Intent Classifier |
| ADR_0202 | docs/decisions/0202-season-server-action-capability-namespace.md | accepted | Season Server-Action Capability Namespace |
| ADR_0205 | docs/decisions/0205-dual-gate-reconciliation-wizard-override-bff-and-server-action.md | proposed | Dual-gate pattern for reconciliation wizard override — BFF + Server Action each need their own capability |
| ADR_0213 | docs/decisions/0213-campaign-prs-use-merge-commit-not-squash.md | accepted | Campaign-PRs use merge-commit, not squash |

## Learnings

See `docs/learnings/0000-learning-log.md` — **131 learning files** (highest L-0143 as of 2026-04-27).

**Gaps:** 0130, 0131, 0132, 0133, 0134, 0135, 0136, 0137, 0138, 0139, 0140, 0141.

**Status breakdown:** 86 canonical, 26 accepted, 18 done, 1 in_progress.

| id | File | Status | Subject |
| --- | --- | --- | --- |
| LEARN_0001 | docs/learnings/0001-turbopack-x-forwarded-host.md | canonical | Next.js Turbopack sets x-forwarded-host in development |
| LEARN_0002 | docs/learnings/0002-middleware-cookie-preservation.md | canonical | Next.js middleware must copy cookies to redirect responses |
| LEARN_0003 | docs/learnings/0003-optimistic-locking-supabase.md | canonical | Optimistic locking pattern for Supabase concurrent writes |
| LEARN_0004 | docs/learnings/0004-webhook-status-regression.md | canonical | Webhook status regression guard pattern |
| LEARN_0005 | docs/learnings/0005-github-repo-name-vs-local-dir.md | canonical | GitHub repo name differs from local directory name |
| LEARN_0006 | docs/learnings/0006-docuseal-webhook-verification.md | canonical | DocuSeal uses plain shared secret for webhook verification |
| LEARN_0007 | docs/learnings/0007-performance-governance-warn-to-fail.md | canonical | Warn-to-fail Performance and Build Governance scales better than immediate hard-fail |
| LEARN_0008 | docs/learnings/0008-vercel-x-forwarded-host-400.md | canonical | Vercel always sets x-forwarded-host — never treat it as suspicious |
| LEARN_0009 | docs/learnings/0009-vercelignore-depth-matching.md | canonical | .vercelignore patterns without leading / match at any depth |
| LEARN_0010 | docs/learnings/0010-vercel-turborepo-root-directory.md | canonical | Vercel Turborepo monorepo — Root Directory is app dir, not monorepo root |
| LEARN_0011 | docs/learnings/0011-framer-motion-landing-animation-patterns.md | canonical | Framer Motion Landing Page Animation Patterns |
| LEARN_0012 | docs/learnings/0012-mcp-sdk-package-structure.md | canonical | MCP TypeScript SDK uses single package with deep imports |
| LEARN_0013 | docs/learnings/0013-ultravox-http-tool-parameters.md | canonical | Ultravox HTTP tools: no headers on http object, use staticParameters |
| LEARN_0014 | docs/learnings/0014-supabase-gen-types-stdout-noise.md | done | Supabase gen types prints debug line to stdout |
| LEARN_0015 | docs/learnings/0015-websocket-jwt-auth-browser.md | canonical | Browser WebSocket API Cannot Send Custom Headers |
| LEARN_0016 | docs/learnings/0016-season-type-enum-mismatch.md | canonical | Season Type Enum Mismatch |
| LEARN_0017 | docs/learnings/0017-progressive-save-pattern.md | canonical | Progressive Save Pattern |
| LEARN_0018 | docs/learnings/0018-runtime-doc-truth-sync.md | canonical | Runtime-Doc Truth Sync Before Prioritization |
| LEARN_0019 | docs/learnings/0019-live-ops-feed-hygiene.md | canonical | Live Ops Feed Hygiene |
| LEARN_0020 | docs/learnings/0020-shift-lock-multi-channel-enforcement.md | canonical | Shift Lock Must Be DB-Canonical |
| LEARN_0021 | docs/learnings/0021-absence-approval-prerequisite.md | done | Absence Approval is a Prerequisite for Absence-Triggered Workflows |
| LEARN_0022 | docs/learnings/0022-disabled-toggle-semantics-and-action-cta-clarity.md | done | Disabled Toggle Semantics and Action CTA Clarity in Cockpit Flows |
| LEARN_0023 | docs/learnings/0023-journey-db-tables-are-dev-tracking.md | done | Journey DB tables are dev-tracking artifacts |
| LEARN_0024 | docs/learnings/0024-rescue-is-not-reengagement.md | done | Rescue and re-engagement are distinct problems |
| LEARN_0025 | docs/learnings/0025-stage-engine-websocket-vercel-blocker.md | accepted | Learning 0025: Stage Engine WebSockets are a Vercel Fluid Compute blocker |
| LEARN_0026 | docs/learnings/0026-drawer-api-boundary-verification.md | canonical | Drawer→API boundary requires end-to-end shape verification |
| LEARN_0027 | docs/learnings/0027-botsson-mutation-tools-must-emit.md | canonical | Every Botsson mutation tool must call emit() — capability layer is part of telemetry coverage |
| LEARN_0028 | docs/learnings/0028-guardian-event-dedup.md | canonical | Avoid Duplicate Guardian Events Across Lifecycle Layers |
| LEARN_0029 | docs/learnings/0029-four-parallel-permission-mechanisms-ontology-smell.md | canonical | Four Parallel Permission Mechanisms Is An Ontology Drift Smell |
| LEARN_0030 | docs/learnings/0030-contract-word-overloaded-across-two-systems.md | canonical | contract" Word Overloaded Across Two Unrelated Systems |
| LEARN_0031 | docs/learnings/0031-clickable-row-action-propagation-contract.md | canonical | Clickable row actions require propagation contract |
| LEARN_0032 | docs/learnings/0032-app-router-rename-blast-radius.md | canonical | App Router directory renames are safer than they appear |
| LEARN_0033 | docs/learnings/0033-migration-attestation-not-apply-ready.md | accepted | Learning 0033 — Migration attestation completeness ≠ apply-readiness |
| LEARN_0034 | docs/learnings/0034-capability-without-emit-invisible-to-cascade.md | captured | Learning 0034 — A capability without emit() is invisible to the cascade |
| LEARN_0035 | docs/learnings/0035-schema-unique-invalidates-bookkeeping.md | canonical | Schema UNIQUE constraints invalidate bookkeeping-container migration patterns |
| LEARN_0036 | docs/learnings/0036-worktree-edit-hygiene.md | captured | Learning 0036 — Worktree Edit Hygiene |
| LEARN_0037 | docs/learnings/0037-hono-appenv-subroute-drift.md | captured | Learning 0037 — Hono AppEnv Sub-Route Generic Drift |
| LEARN_0038 | docs/learnings/0038-registry-destinations-provider-silent-drop.md | captured | Learning 0038 — Registry destinations can claim routes providers silently drop |
| LEARN_0039 | docs/learnings/0039-voice-message-preview-pii-vector.md | captured | Learning 0039 — Voice message_preview in analytics is a PII vector (ADR-0077 reinforcement) |
| LEARN_0040 | docs/learnings/0040-identity-boundary-ontology-pre-workspace-flows.md | canonical | Learning 0040 — Identity-Boundary Ontology: Pre-Workspace Flows Are a Distinct Class |
| LEARN_0041 | docs/learnings/0041-registry-declaration-gap-partial-routing.md | canonical | Learning 0041 — Registry Declaration Gap: emit() Called ≠ Mutation Audit-Covered |
| LEARN_0042 | docs/learnings/0042-plan-documents-not-ground-truth-migration-deps.md | canonical | Plan documents are not ground truth for migration dependencies |
| LEARN_0043 | docs/learnings/0043-plan-audit-column-table-identity-verification.md | canonical | Audit claims about column→table identity must be verified against information_schema, not source migrations or grep |
| LEARN_0044 | docs/learnings/0044-mobile-parity-framing-creates-feature-graveyards.md | canonical | 'Mobile parity with web' framing creates feature graveyards — ontology must come before features |
| LEARN_0045 | docs/learnings/0045-telemetry-emit-exists-but-payload-broken.md | canonical | Telemetry corruption ships silently when emit() exists but payload is malformed |
| LEARN_0046 | docs/learnings/0046-ai-provider-promises-must-match-capability-reality.md | canonical | AI provider promises must match capability reality — no theatre providers |
| LEARN_0047 | docs/learnings/0047-channel-security-needs-tool-execution-path.md | canonical | ADR-0078 channel security requires a tool execution path — without it the guard is vacuous |
| LEARN_0048 | docs/learnings/0048-two-reviewer-ontology-convergence-is-high-signal.md | canonical | Two reviewers from different domains converging on the same ontology is a high-signal moment |
| LEARN_0049 | docs/learnings/0049-hidden-route-groups-are-dead-but-loaded-code.md | canonical | Hidden route groups (href: null) are dead-but-loaded code — Expo Router compiles all of app/ |
| LEARN_0050 | docs/learnings/0050-migration-as-knowledge-extraction.md | canonical | Migration is knowledge extraction, not table-by-table transfer |
| LEARN_0051 | docs/learnings/0051-post-impl-trace-beats-per-file-review.md | canonical | Post-implementation trace catches what per-file review misses — 4-layer model |
| LEARN_0052 | docs/learnings/0052-idempotency-claims-require-on-conflict-evidence.md | canonical | Migration idempotency claims require ON CONFLICT evidence, not manifest assertions |
| LEARN_0053 | docs/learnings/0053-source-term-is-overloaded-verify-semantics.md | canonical | `source` is an overloaded term — verify semantics before citing convention |
| LEARN_0054 | docs/learnings/0054-grep-based-site-inventories-inflate-scope.md | canonical | Grep-based site inventories inflate scope and miss integrity breaches |
| LEARN_0055 | docs/learnings/0055-pilot-establishing-trap-unproven-patterns.md | canonical | Bundling N untested patterns into one 'pilot' guarantees pattern inversion |
| LEARN_0056 | docs/learnings/0056-optimistic-cache-proposed-branch-silent-staleness.md | canonical | TanStack useMutation + optimistic updates silently drops 'proposed' outcomes on refetch |
| LEARN_0057 | docs/learnings/0057-gatedupdate-entity-id-column-zero-row-trap.md | canonical | Optional `entityIdColumn` default silently corrupts audit provenance |
| LEARN_0058 | docs/learnings/0058-client-asserted-profile-id-forgeable-audit-actor.md | canonical | `agent-router` forwards `profile_id` from request body without `auth.uid()` verification |
| LEARN_0059 | docs/learnings/0059-grep-count-briefings-undercount-without-code-trace.md | canonical | Grep-count briefings undercount by 3-5x without code-trace pairing |
| LEARN_0060 | docs/learnings/0060-theatre-verdicts-have-layers.md | canonical | 'Theatre' verdicts have layers — transport, telemetry, design presence |
| LEARN_0061 | docs/learnings/0061-orphan-capability-invisible-until-trigger-points-at-it.md | canonical | Orphan capability code is invisible until an engine_trigger points at it |
| LEARN_0062 | docs/learnings/0062-security-definer-rpcs-change-threat-model.md | canonical | SECURITY DEFINER RPCs change threat model — don't call them 'ceremony' without tracing |
| LEARN_0063 | docs/learnings/0063-diagnosis-before-patch-gate-for-crash-bugs.md | accepted | Diagnosis-before-patch gate for crash bugs |
| LEARN_0064 | docs/learnings/0064-phase-enum-ui-vs-db-drift.md | canonical | Phase Enum UI-vs-DB Drift — Use Named Derivation Helpers |
| LEARN_0065 | docs/learnings/0065-fact-check-must-grep-alter-not-just-create-table.md | canonical | Phase 2.5 Fact-Check Must Grep Columns Across ALL Migrations, Not Just CREATE TABLE |
| LEARN_0066 | docs/learnings/0066-default-allow-capability-authority-cve-trap.md | accepted | Default-allow capability authority is a CVE-class trap |
| LEARN_0067 | docs/learnings/0067-dead-infra-has-a-clock.md | accepted | Dead infrastructure has a clock — wire it before new work |
| LEARN_0068 | docs/learnings/0068-gate-action-layer-1-silent-for-ad-hoc-chat.md | accepted | gate_action Layer 1 is silent for ad-hoc agent-router paths |
| LEARN_0069 | docs/learnings/0069-channel-term-has-four-meanings.md | accepted | The word 'channel' has four meanings in this codebase |
| LEARN_0070 | docs/learnings/0070-sibling-table-pattern-not-ontology-answer.md | accepted | Sibling table pattern is not an ontology answer |
| LEARN_0071 | docs/learnings/0071-owner-enum-collision-across-tables.md | accepted | role='owner' enum collides across tables |
| LEARN_0072 | docs/learnings/0072-registerevent-untyped-at-emit-sites-without-extends-baseevent.md | canonical | registerEvent() without extends BaseEvent is untyped at emit sites |
| LEARN_0073 | docs/learnings/0073-ui-widget-namespace-is-not-telemetry-namespace.md | canonical | UI-widget namespace is not telemetry namespace |
| LEARN_0074 | docs/learnings/0074-spec-scope-reset-must-log-against-superseded-spec.md | canonical | Spec scope-reset must log against the superseded spec |
| LEARN_0075 | docs/learnings/0075-migration-atomicity-widen-introduce-tighten.md | canonical | Migration atomicity — type-widen, introduce, tighten (0a/0b/0c pattern) |
| LEARN_0076 | docs/learnings/0076-established-pattern-bypass.md | accepted | Established-pattern bypass: new feature silently ignores workspace-aware infrastructure |
| LEARN_0077 | docs/learnings/0077-adr-fail-closed-without-retrofit.md | accepted | ADR fail-closed enforcement on shared registry without consumer audit = init-time break |
| LEARN_0078 | docs/learnings/0078-plan-file-decay.md | accepted | PLAN-file decay: status field drifts while code ships |
| LEARN_0079 | docs/learnings/0079-ui-terminal-engine-state-must-stamp-completed-at.md | canonical | UI-driven terminal engine_state transitions must stamp completed_at |
| LEARN_0080 | docs/learnings/0080-reassignment-must-demote-prior-holder.md | canonical | Reassignment mutations must demote the prior holder |
| LEARN_0081 | docs/learnings/0081-supabase-mock-echoes-column-names.md | canonical | Supabase chainable-proxy mocks echo any column name — schema divergence is invisible to tests |
| LEARN_0082 | docs/learnings/0082-trust-hierarchy-coherence-fails-on-partial-refresh.md | canonical | Trust-hierarchy coherence fails when lower-tier docs refresh without upper-tier sync |
| LEARN_0083 | docs/learnings/0083-registered-telemetry-event-without-producer-is-phantom-contract.md | canonical | Registered telemetry event without producer is a phantom contract |
| LEARN_0084 | docs/learnings/0084-adr-renumber-mid-session-leaves-ghost-slots.md | canonical | ADR renumber-mid-session leaves ghost slots unless explicitly documented |
| LEARN_0085 | docs/learnings/0085-dispatcher-entity-pk-gap.md | canonical | Dispatcher ENTITY_PK map is a hand-maintained ceiling for capability-tool entity coverage |
| LEARN_0086 | docs/learnings/0086-channel-ai-policy-half-wired.md | canonical | channel_ai_policy plumbing ≠ feature — 'reuse' is misleading when only one consumer reads one mode |
| LEARN_0087 | docs/learnings/0087-mock-surface-trap-expands-with-additive-columns.md | canonical | Mock-surface trap expands linearly with additive schema — new columns need mock audit before migration lands |
| LEARN_0088 | docs/learnings/0088-ontology-change-vs-presentation-change.md | canonical | Ontology change ≠ presentation change — UX needs satisfiable by read-time queries do not justify FK columns |
| LEARN_0089 | docs/learnings/0089-ghost-routes-in-public-routes.md | canonical | Ghost Routes in PUBLIC_ROUTES Are Worse Than 404s |
| LEARN_0090 | docs/learnings/0090-enum-expansion-vs-timestamp-column.md | canonical | Enum Expansion vs Timestamp Column — Cascade-Shape Decision Heuristic |
| LEARN_0091 | docs/learnings/0091-semantic-conflict-resolution-per-minority.md | canonical | Semantic Conflict Resolution Must Be Explicit Per-Minority in Council Synthesis |
| LEARN_0092 | docs/learnings/0092-lockfile-must-be-regenerated-with-package-json.md | canonical | Version bumps in package.json are no-ops until pnpm install regenerates the lockfile |
| LEARN_0093 | docs/learnings/0093-ghost-dependency-is-latent-trap.md | canonical | Ghost dependencies (declared but never imported) are latent traps |
| LEARN_0094 | docs/learnings/0094-phantom-emit-contracts-recurring.md | canonical | Phantom emit contracts — recurring across specs |
| LEARN_0095 | docs/learnings/0095-long-spec-internal-contradictions.md | canonical | Long specs accumulate internal contradictions between revisions |
| LEARN_0096 | docs/learnings/0096-code-trace-catches-schema-fiction.md | canonical | Code-trace catches schema-fiction that concept-review approves |
| LEARN_0097 | docs/learnings/0097-c4-authority-defaults-are-not-free.md | canonical | C4 authority defaults are not free — capabilities must seed explicitly |
| LEARN_0098 | docs/learnings/0098-global-scripts-cutover-ownership.md | canonical | Global scripts are not owned by the campaign that refactors them |
| LEARN_0099 | docs/learnings/0099-prior-council-verdict-staleness-pattern.md | done | Prior-council-verdict staleness pattern — cite-and-verify before Phase 3 |
| LEARN_0100 | docs/learnings/0100-tabs-in-hub-vs-split-ia-resolution.md | done | Tabs-in-hub vs split-IA — resolve by splitting at route, unifying at entry |
| LEARN_0101 | docs/learnings/0101-primecontext-enrichment-alternative-to-removing-affordance.md | done | primeContext enrichment is the fix when an AI affordance feels broken — not removal |
| LEARN_0102 | docs/learnings/0102-briefing-granularity-vs-schema-reality.md | done | Briefing granularity mismatch — per-tool vs per-capability authority |
| LEARN_0103 | docs/learnings/0103-per-capability-vs-inline-gate-action.md | done | Per-capability vs inline gate_action — when each is appropriate |
| LEARN_0104 | docs/learnings/0104-event-registered-ahead-of-emit-scaffolding.md | done | Event-registered-ahead-of-emit — canonical scaffolding order |
| LEARN_0105 | docs/learnings/0105-dead-code-claim-requires-import-graph.md | done | Dead code claim must be verified by import-graph, not name pattern |
| LEARN_0106 | docs/learnings/0106-nordic-split-adoption-requires-pr-set-audit.md | done | Nordic Split token adoption requires PR-set audit, not just current-file |
| LEARN_0107 | docs/learnings/0107-authority-appearance-not-presence.md | canonical | Authority Appearance ≠ Authority Presence — `gateAction` Call Is Intent, Not Evidence |
| LEARN_0108 | docs/learnings/0108-triple-writer-pattern-recurs.md | canonical | Triple-Writer (and Quadruple-Writer) Pattern Recurs Across Campaigns |
| LEARN_0109 | docs/learnings/0109-append-log-projection-pattern.md | canonical | Append-Log + Projection Column Is the Right Hybrid When Readers ≫ Writers |
| LEARN_0110 | docs/learnings/0110-db-triggers-must-gate.md | canonical | DB Triggers That Emit Domain Events Must Gate Like Application Writers |
| LEARN_0111 | docs/learnings/0111-ci-capability-seed-parity.md | canonical | CI Must Enforce Capability Literal ↔ Seed-Migration Parity via AST, Not Regex |
| LEARN_0112 | docs/learnings/0112-two-gate-pathways-parity-covers-one.md | canonical | Two Gate Pathways — Parity Gate Covers ADR-0099, Not ADR-0091 |
| LEARN_0113 | docs/learnings/0113-grep-count-audit-inflation-recurrence.md | canonical | Grep-count audit inflation — recurrence of L-0054 pattern |
| LEARN_0114 | docs/learnings/0114-bootstrap-single-writer-silent-default.md | canonical | Bootstrap-cascade single-writer silent default — provisioning step failure hides in mutation default-permit |
| LEARN_0115 | docs/learnings/0115-ontology-pass-does-not-imply-runtime-pass.md | accepted | Ontology PASS does not imply runtime PASS |
| LEARN_0116 | docs/learnings/0116-sibling-tool-architectural-inconsistency-trust-gate-failure.md | accepted | Sibling-tool architectural inconsistency = Trust Gate failure |
| LEARN_0117 | docs/learnings/0117-grep-based-structural-claims-must-be-code-traced.md | accepted | Grep-based structural claims must be code-traced (5th occurrence — PROMOTED to hard rule) |
| LEARN_0118 | docs/learnings/0118-every-capability-tool-requires-e2e-trust-gate-test.md | accepted | Every capability tool requires E2E Trust Gate test before merge |
| LEARN_0119 | docs/learnings/0119-e2e-fixture-infra-must-be-idempotent-and-verified.md | done | E2E fixture infrastructure must be idempotent AND verified before the first test runs |
| LEARN_0120 | docs/learnings/0120-recorder-before-writer-dead-letter-trap.md | accepted | Recorder-before-writer is a dead-letter trap |
| LEARN_0121 | docs/learnings/0121-whisper-not-takeover.md | accepted | Whisper ≠ takeover — metadata injection is a legitimate C4 control surface |
| LEARN_0122 | docs/learnings/0122-tiered-retention-resolves-capture-vs-retention.md | accepted | Tiered retention resolves capture-vs-retention false dichotomy |
| LEARN_0123 | docs/learnings/0123-code-trace-catches-what-grep-briefing-misses.md | accepted | Code-trace catches what grep-briefing misses |
| LEARN_0124 | docs/learnings/0124-phantom-body-vs-phantom-emit.md | accepted | Phantom body vs phantom emit — two shapes of the same anti-pattern |
| LEARN_0125 | docs/learnings/0125-test-spirit-vs-letter-ok-true-is-not-artefact-assertion.md | accepted | Test spirit vs letter — asserting `ok:true` is not asserting the artefact |
| LEARN_0126 | docs/learnings/0126-ontology-gap-is-an-adr-not-effort.md | accepted | Ontology gap is an ADR, not effort — when two data models diverge, the gap is a contract decision |
| LEARN_0127 | docs/learnings/0127-loader-level-bugs-evade-grep-audits.md | accepted | Loader-level bugs evade grep-audits — end-to-end code-trace required |
| LEARN_0128 | docs/learnings/0128-doc-agents-must-verify-db-invariants.md | accepted | Doc agents must verify DB-level invariants before declaring regressions |
| LEARN_0129 | docs/learnings/0129-code-trace-shortcut-substitutes-for-council-only-on-pure-design.md | accepted | Code-trace-shortcut substitutes for full council only on pure design decisions |
| LEARN_0142 | docs/learnings/0142-squash-merge-erodes-adr-falsifiability.md | canonical | Squash-merge erodes ADR falsifiability for multi-phase work |
| LEARN_0143 | docs/learnings/0143-pattern-claims-must-be-quantified-not-generalized.md | canonical | Pattern claims should be quantified, not generalized |

## Plans

Active plans in `docs/plans/`. Completed plans in `docs/plans/completed/`.

### Campaigns (long-lived)

| File                                  | Status |
| ------------------------------------- | ------ |
| plans/CAMPAIGN-botsson-arena.md       | active |
| plans/CAMPAIGN-daily-operation.md     | active |
| plans/CAMPAIGN-helpdesk.md            | active |
| plans/CAMPAIGN-journey-engine.md      | active |
| plans/CAMPAIGN-schedule-harness.md    | active |
| plans/CAMPAIGN-year-wheel.md          | active |

### Active plans

| File                                                  |
| ----------------------------------------------------- |
| plans/BUILD_ORDER.md (also at docs/BUILD_ORDER.md)    |
| plans/ROADMAP-ai-harness.md                           |
| plans/PLAN-botsson-observability-foundation.md        |
| plans/PLAN-botsson-overlay-implementation.md          |
| plans/PLAN-cascade-gate-write.md                      |
| plans/PLAN-closure.md                                 |
| plans/PLAN-contract-hub-fix-forward.md                |
| plans/PLAN-contract-hub-redesign.md                   |
| plans/PLAN-contract-intake-gate-fix.md                |
| plans/PLAN-cutover-backend.md                         |
| plans/PLAN-daily-operation-recon-v2.md                |
| plans/PLAN-dashboard-fix.md                           |
| plans/PLAN-day-control-gaps.md                        |
| plans/PLAN-dispatcher-entity-pk.md                    |
| plans/PLAN-domain-taxonomy.md                         |
| plans/PLAN-dual-gate-reconciliation.md                |
| plans/PLAN-employee-availability-v1.md                |
| plans/PLAN-engine-memory-writer.md                    |
| plans/PLAN-followups.md                               |
| plans/PLAN-gatedwrite-pilot.md                        |
| plans/PLAN-gatedwrite-wave-2a.md                      |
| plans/PLAN-handover-migration.md                      |
| plans/PLAN-harness-hardening.md                       |
| plans/PLAN-helpdesk-phase-0.md                        |
| plans/PLAN-journey-engine-honesty.md                  |
| plans/PLAN-journey-s1-1-telemetry-foundation.md       |
| plans/PLAN-journey-s1-2-enum-lifecycle.md             |
| plans/PLAN-journey-s1-3-authority-seed.md             |
| plans/PLAN-journey-s1-4-capability-skeletons.md       |
| plans/PLAN-mobile-parity-poc.md                       |
| plans/PLAN-mobile-shift-completion.md                 |
| plans/PLAN-mobile-trust-freeze-week1.md               |
| plans/PLAN-mobile-voice-wiring.md                     |
| plans/PLAN-nordic-split-final.md                      |
| plans/PLAN-nordic-split-hub.md                        |
| plans/PLAN-nordic-split-org-dialogs.md                |
| plans/PLAN-nordic-split-phase-1.md                    |
| plans/PLAN-nordic-split-phase-2.md                    |
| plans/PLAN-nordic-split-phase-3a-schedule.md          |
| plans/PLAN-nordic-split-reports.md                    |
| plans/PLAN-ops-intelligence-phase1.md                 |
| plans/PLAN-overview-v2.md                             |
| plans/PLAN-perf-sprint-wave-1.md                      |
| plans/PLAN-pii-classifier.md                          |
| plans/PLAN-progressive-channel-schema.md              |
| plans/PLAN-recon-wizard-mobile.md                     |
| plans/PLAN-session-lifecycle.md                       |
| plans/PLAN-shared-primitives.md                       |
| plans/PLAN-shift-swap-harness.md                      |
| plans/PLAN-shift-timeline-ui.md                       |
| plans/PLAN-stage-engine-profile-id-derivation.md      |
| plans/PLAN-strike-mcp-verification.md                 |
| plans/PLAN-strom-mcp-migration-check.md               |
| plans/PLAN-tariff-tz-hardening.md                     |
| plans/PLAN-test-verification.md                       |
| plans/PLAN-training-schema-foundation.md              |
| plans/PLAN-tripletex-ready-schema.md                  |
| plans/PLAN-unified-authority-gate.md                  |
| plans/PLAN-year-wheel.md                              |
| plans/platform-admin-communications-gap-plan.md       |

### Completed plans (`docs/plans/completed/`)

| File                                                |
| --------------------------------------------------- |
| completed/PLAN-absence-approval.md                  |
| completed/PLAN-agent-harness.md                     |
| completed/PLAN-auth-security-friction.md            |
| completed/PLAN-botsson-chat-input-request.md        |
| completed/PLAN-contract-preview-editor.md           |
| completed/PLAN-contract-workspace-tab.md            |
| completed/PLAN-council-review-fixes.md              |
| completed/PLAN-deployment-pipeline.md               |
| completed/PLAN-drift-insights.md                    |
| completed/PLAN-employee-contract-management.md      |
| completed/PLAN-gamification-foundation.md           |
| completed/PLAN-husky-branch-guard.md                |
| completed/PLAN-interactive-dashboard.md             |
| completed/PLAN-invitation-rls-fix.md                |
| completed/PLAN-profession-system.md                 |
| completed/PLAN-season-operations-loop.md            |
| completed/PLAN-telegram-walkai-adapter.md           |
| completed/PLAN-tooling-optimization.md              |

## User Journeys

156 journey documents in `docs/journeys/`. Files follow `JOURNEY-<feature>.md` naming. Manual-test specs at `MANUAL-TEST-*.md`. See folder for full list. Highlights:

| File                                            | Module        |
| ----------------------------------------------- | ------------- |
| journeys/admin-workspace-setup.md               | onboarding    |
| journeys/employee-invitation-accept.md          | onboarding    |
| journeys/trainee-mode-core.md                   | onboarding    |
| journeys/JOURNEY-onboarding-flow.md             | onboarding    |
| journeys/JOURNEY-onboarding-redesign.md         | onboarding    |
| journeys/JOURNEY-cascade-foundation.md          | cascade       |
| journeys/JOURNEY-cascade-five-dimensions.md     | cascade       |
| journeys/JOURNEY-cascade-gate-write.md          | cascade       |
| journeys/JOURNEY-schedule-v2.md                 | schedule      |
| journeys/JOURNEY-schedule-ui.md                 | schedule      |
| journeys/JOURNEY-schedule-db-persistence.md     | schedule      |
| journeys/JOURNEY-mal-modus-schedule.md          | schedule      |
| journeys/JOURNEY-shift-clock.md                 | schedule      |
| journeys/JOURNEY-mobile-employee-login.md       | mobile        |
| journeys/JOURNEY-mobile-shifts-overview.md      | mobile        |
| journeys/JOURNEY-mobile-parity-poc.md           | mobile        |
| journeys/JOURNEY-helpdesk-web.md                | helpdesk      |
| journeys/JOURNEY-helpdesk-mobile.md             | helpdesk      |
| journeys/JOURNEY-helpdesk-primitives.md         | helpdesk      |
| journeys/JOURNEY-journey-s1-1-telemetry-foundation.md | journey-engine |
| journeys/JOURNEY-journey-s1-2-enum-lifecycle.md | journey-engine |
| journeys/JOURNEY-journey-s1-3-authority-seed.md | journey-engine |
| journeys/JOURNEY-journey-s1-4-capability-skeletons.md | journey-engine |
| journeys/JOURNEY-year-wheel.md                  | year-wheel    |
| journeys/JOURNEY-overview-v2.md                 | overview      |
| journeys/JOURNEY-recon-v2.md                    | reconciliation|
| journeys/JOURNEY-billing-engine-fase-1.md       | billing       |
| journeys/JOURNEY-billing-engine-fase-2.md       | billing       |
| journeys/JOURNEY-billing-engine-fase-3a.md      | billing       |
| journeys/JOURNEY-billing-engine-fase-3b.md      | billing       |
| journeys/JOURNEY-platform-k1a-curation.md       | platform      |
| journeys/MANUAL-TEST-dev-prod-fix.md            | manual-test   |
| journeys/MANUAL-TEST-fase3a-dunning-opt-out.md  | manual-test   |

## Research

| id                  | File                                                                                | Status    |
| ------------------- | ----------------------------------------------------------------------------------- | --------- |
| RESEARCH_WORKFORCE  | research/Workforce management research report.md                                    | canonical |
| RESEARCH_LIVEKIT    | research/LiveKit as Smartout's real-time.md                                         | canonical |
| RESEARCH_PROD_ARCH  | research/Production architecture for a Norwegian hospitality SaaS on Supabase.md    | canonical |
| RESEARCH_AI_COUNCIL | research/Seven AI Council personas for Smartout's Norwegian hospitality platform.md | canonical |
| RESEARCH_PRICING    | research/Pricing card prompt.md                                                     | draft     |
| RESEARCH_DOCUSEAL   | research/DocuSeal API complete integration reference.md                             | canonical |
| RESEARCH_INVESTOR   | research/INVESTOR-RESEARCH.md                                                       | canonical |
| RESEARCH_REACTIVE   | research/RESEARCH_RESULTS_REACTIVE_OPERATIONS_ENGINE.md                             | canonical |
| RESEARCH_VIKTIGE    | research/VIKTIGA FUNKSJONER SOM SMARTOUT LØSER.md                                   | reference |
| RESEARCH_CONNECTEAM | research/Connecteam help desk analyse.md                                            | reference |
| RESEARCH_AGUI       | research/ag-ui: Six technical questions and awnsers.md                              | reference |

## Engines

Central package split:

- `engines/system-intelligence/` — global platform machinery (renamed 2026-04-28 from `system-inteligence`)
- `engines/industri-inteligence/` — domain specialization (hospitality)
- `engines/artificial-inteligence/` — pointer package to canonical AI runtime docs

| id                                    | File                                                                                                         | Status    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- |
| ENGINE_SYSTEM_INTELLIGENCE            | engines/system-intelligence/README.md                                                                        | draft     |
| ENGINE_SYSTEM_INTELLIGENCE_OVERVIEW   | engines/system-intelligence/00-overview.md                                                                   | draft     |
| ENGINE_SYSTEM_PRD                     | engines/system-intelligence/01-prd.md                                                                        | draft     |
| ENGINE_SYSTEM_ARCHITECTURE            | engines/system-intelligence/02-architecture.md                                                               | draft     |
| ENGINE_SYSTEM_LIFECYCLE               | engines/system-intelligence/04-lifecycle.md                                                                  | draft     |
| ENGINE_SYSTEM_PROTOCOL_PIPELINE       | engines/system-intelligence/05-protocol-pipeline.md                                                          | draft     |
| ENGINE_SYSTEM_IR_TEMPLATE             | engines/system-intelligence/06-ir-template.md                                                                | draft     |
| ENGINE_SYSTEM_JOURNEY_PACKAGE_COMPILER | engines/system-intelligence/07-journey-package-compiler.md                                                  | draft     |
| ENGINE_SYSTEM_RESCUE_PROMPT           | engines/system-intelligence/10-rescue-prompt-spec.md                                                         | draft     |
| ENGINE_AI_INTEL                       | engines/artificial-inteligence/README.md                                                                     | reference |
| ENGINE_INDUSTRY_INTEL                 | engines/industri-inteligence/hospitalety/README.md                                                           | draft     |
| ENGINE_INDUSTRY_CORE                  | engines/industri-inteligence/hospitalety/00-engine-core.md                                                   | draft     |
| ENGINE_AI_COUNCIL_STD                 | engines/industri-inteligence/hospitalety/01-ai-council/README.md                                             | draft     |
| ENGINE_AI_COUNCIL_RESTO               | engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md                                 | draft     |
| ENGINE_DEFAULT_POLICIES               | engines/industri-inteligence/hospitalety/02-default-policies/README.md                                       | draft     |
| ENGINE_POLICY_CATALOG                 | engines/industri-inteligence/hospitalety/02-default-policies/restaurant-policy-catalog.md                    | draft     |
| ENGINE_TEMPLATE_TAXONOMY              | engines/industri-inteligence/hospitalety/03-templates/README.md                                              | draft     |
| ENGINE_TEMPLATE_STRUCTURE             | engines/industri-inteligence/hospitalety/03-templates/business-structure-template.md                         | draft     |
| ENGINE_TEMPLATE_PIPELINE              | engines/industri-inteligence/hospitalety/03-templates/task-pipeline-template.md                              | draft     |
| ENGINE_TEMPLATE_JOURNEY               | engines/industri-inteligence/hospitalety/03-templates/journey-template.md                                    | draft     |
| ENGINE_TEMPLATE_RESTO_STRUCT          | engines/industri-inteligence/hospitalety/03-templates/restaurant-business-structure-template.md              | draft     |
| ENGINE_TEMPLATE_RESTO_PIPELINES       | engines/industri-inteligence/hospitalety/03-templates/restaurant-task-pipelines-template.md                  | draft     |
| ENGINE_TEMPLATE_RESTO_JOURNEYS        | engines/industri-inteligence/hospitalety/03-templates/restaurant-journey-template-catalog.md                 | draft     |
| ENGINE_RESEARCH_PACK                  | engines/industri-inteligence/hospitalety/04-research/README.md                                               | draft     |
| ENGINE_RESEARCH_RESTO                 | engines/industri-inteligence/hospitalety/04-research/restaurant-research-pack.md                             | draft     |
| ENGINE_TESTING_RESTO                  | engines/industri-inteligence/hospitalety/05-testing/README.md                                                | draft     |
| ENGINE_TESTING_RESTO_PROFILES         | engines/industri-inteligence/hospitalety/05-testing/restaurant-testing-profiles.md                           | draft     |
| ENGINE_RELEVANCE_RESTO                | engines/industri-inteligence/hospitalety/06-relevance-map/restaurant-relevance-map.md                        | draft     |
| ENGINE_HANDBOOK_STRUCTURE             | engines/industri-inteligence/hospitalety/07-company-handbook/README.md                                       | draft     |
| ENGINE_HANDBOOK_RESTO                 | engines/industri-inteligence/hospitalety/07-company-handbook/restaurant-company-handbook-template.md         | draft     |
| ENGINE_ROLE_CAP_STRUCT                | engines/industri-inteligence/hospitalety/08-role-capability-profiles/README.md                               | draft     |
| ENGINE_ROLE_CAP_RESTO                 | engines/industri-inteligence/hospitalety/08-role-capability-profiles/restaurant-role-capability-baseline.md  | draft     |
| ENGINE_ENV_STRUCT                     | engines/industri-inteligence/hospitalety/09-environment-profile/README.md                                    | draft     |
| ENGINE_ENV_RESTO                      | engines/industri-inteligence/hospitalety/09-environment-profile/restaurant-environment-baseline.md           | draft     |
| ENGINE_NICHE_LAYER                    | engines/industri-inteligence/hospitalety/10-niche-profiles/README.md                                         | draft     |
| ENGINE_NICHE_SKELETON                 | engines/industri-inteligence/hospitalety/10-niche-profiles/niche-layer-skeleton.md                           | draft     |
| ENGINE_NICHE_TAX_RESTO                | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-taxonomy.md                      | draft     |
| ENGINE_NICHE_TPL_RESTO                | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-profile-template.md              | draft     |
| ENGINE_NICHE_EX_RESTO                 | engines/industri-inteligence/hospitalety/10-niche-profiles/restaurant-niche-italian-premium-service.md       | draft     |

## Superpowers Specs

103 design specs in `docs/superpowers/specs/`. Feed council reviews. Naming: `YYYY-MM-DD-<feature>-design.md`. Sample of recent / canonical:

| File | Purpose |
| ---- | ------- |
| superpowers/specs/2026-03-21-cascade-scheduling-system-design.md | Cascade Core Foundation spec (CASCADE_SPEC) |
| superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md | Journey Runner Suite v1.6.0 |
| superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md | Session recorder design |
| superpowers/specs/2026-04-19-year-wheel-holistic-design.md | Year wheel holistic redesign |
| superpowers/specs/2026-04-17-billing-engine-fase-3b-design.md | Billing engine fase 3b |
| superpowers/specs/2026-04-14-ai-operations-intelligence-design.md | AI ops intelligence |
| superpowers/specs/2026-04-09-agent-harness-foundation-design.md | Agent harness foundation |

Folders also: `superpowers/mockups/`, `superpowers/notes/`, `superpowers/plans/`.

## Council

| File | Purpose |
| ---- | ------- |
| council/COUNCIL-LOG.md | All council session verdicts, knowledge captures |

## Audits

| File | Date |
| ---- | ---- |
| audits/AUDIT-P-001-2026-04-13.md | 2026-04-13 |
| audits/AUDIT-P-LOGIN-2026-04-13.md | 2026-04-13 |
| audits/AUDIT-P-LOGIN-2026-04-14.md | 2026-04-14 |
| audits/AUDIT-pg-net-callers-2026-04-15.md | 2026-04-15 |
| audits/AUDIT-supabase-preview-ci-2026-04-15.md | 2026-04-15 |

## Reports

| File |
| ---- |
| reports/2026-03-18-teknisk-revisjonsrapport.md |
| reports/2026-03-24-worktree-cleanup-fuckups.md |
| reports/DEEP-SYSTEM-DOCUMENTATION-2026-03-24.md |
| reports/FULL-REPO-AUDIT-2026-03-24.md |
| reports/Smartout features.md |
| reports/Smartout hva du får.md |
| reports/Smartout konkurrentanalyse.md |
| reports/Smartout onboarding-nivåer.md |
| reports/Smartout prising grunnlag.md |
| reports/telemetry-registry-audit-2026-04-17.md |

## Worklogs

76 worklogs in `docs/worklogs/`. Naming: `WORKLOG-<feature>.md`. See folder.

## Handoffs

| File |
| ---- |
| handoffs/2026-03-19-vaktlista-and-operating-hours-cascade.md |
| handoffs/2026-03-20-cascade-plan-revision.md |

> Older handoffs cleared 2026-04-27 (commit `0d968ec6` removed 34 unstatussed handoffs already landed in git).

## Followups

| File |
| ---- |
| followups/OVERVIEW-V2-DEBT-TICKETS.md |

## Design

| File | Purpose |
| ---- | ------- |
| design/README.md | Design system overview |
| design/SMARTOUT-DESIGN-SPEC.md | Master design spec |
| design/BOTSSON-OVERLAY-BRIEF.md | Botsson overlay design |
| design/colors.md | Color tokens |
| design/typography.md | Typography |
| design/motion.md | Motion / spring physics |
| design/components.md | Component patterns |
| design/patterns.md | Pattern library |
| design/mobile.md | Mobile design |
| design/mobile-layout.md | Mobile layout |

## Agents

Documentation for the agent framework + per-agent design.

| File |
| ---- |
| agents/SHARED_DESIGN_PRINCIPLES.md |
| agents/LISE_DASHBOARD_GUIDE.md |
| agents/framework/AGENT_DRIVEN_UI_ARCHITECTURE.md |
| agents/framework/EVENT_MOTOR.md |
| agents/framework/VECTOR_INDEX_ATTRIBUTES.md |
| agents/frontend-design/INSTRUCTION.md |
| agents/frontend-design/SUBAGENT_SPEC.md |
| agents/frontend-design/ONBOARDING_SYSTEM_DESIGN.md |
| agents/frontend-design/LEARNING_LOOP.md |
| agents/mobile-design/INSTRUCTION.md |
| agents/mobile-design/SUBAGENT_SPEC.md |
| agents/mobile-design/hypotheses.md |
| agents/mobile-design/LEARNING_LOOP.md |

## Guides

| File |
| ---- |
| guides/GUIDE-P-001.md |
| guides/GUIDE-P-LOGIN.md |

## Legal

| File |
| ---- |
| legal/databehandlingsavtale.md |
| legal/lisens-og-brukeravtale.md |
| legal/tiltaksdokument-personvern.md |

## Marketing

> Renamed from `leadGen/` 2026-05-05. Lives under `business/marketing/`.

| File |
| ---- |
| business/marketing/README.md |
| business/marketing/landing-spec.md |
| business/marketing/landing-content.md |
| business/marketing/components/seo-cta-benchmark.md |
| business/marketing/landing-action-grid.md |
| business/marketing/archive/landing-master-v1-superseded.md |

## Protokol Packages

| File |
| ---- |
| Protokol/API_KPI_AND_REVIEW_CADENCE.md |
| Protokol/API_ROADMAP.md |
| Protokol/project-roadmap.md |
| Protokol/punch-into-shift/Journey.md |
| Protokol/punch-into-shift/Roadmap.md |
| Protokol/check-my-schedule/Journey.md |
| Protokol/check-my-schedule/Roadmap.md |
| Protokol/admin-onboarding-package/Journey.md |
| Protokol/admin-onboarding-package/Mission.md |
| Protokol/admin-onboarding-package/Roadmap.md |
| Protokol/admin-onboarding-package/Lisence.md |

## User Manual

Norwegian (nb) primary, English (en) full, Swedish (sv) partial.

| File | Language |
| ---- | -------- |
| User Manual/INDEX.md | meta |
| User Manual/en/00-smartout-overview.md | en |
| User Manual/en/01-getting-started.md | en |
| User Manual/en/02-onboarding.md | en |
| User Manual/en/03-shift-planning.md | en |
| User Manual/en/04-staff-management.md | en |
| User Manual/en/05-tasks-and-routines.md | en |
| User Manual/en/06-haccp.md | en |
| User Manual/en/07-communication.md | en |
| User Manual/en/08-ai-assistant.md | en |
| User Manual/en/09-reports.md | en |
| User Manual/en/10-settings.md | en |
| User Manual/nb/00-smartout-overview.md | nb |
| User Manual/nb/01-kom-i-gang.md | nb |
| User Manual/nb/02-onboarding.md | nb |
| User Manual/nb/03-vaktplan.md | nb |
| User Manual/nb/04-ansatte.md | nb |
| User Manual/nb/05-oppgaver-rutiner.md | nb |
| User Manual/nb/06-haccp.md | nb |
| User Manual/nb/07-kommunikasjon.md | nb |
| User Manual/nb/08-ai-assistent.md | nb |
| User Manual/nb/09-rapporter.md | nb |
| User Manual/nb/10-innstillinger.md | nb |
| User Manual/sv/02-vaktplan.md | sv |
| User Manual/sv/03-uppgaver.md | sv |
| User Manual/sv/04-rutiner.md | sv |
| User Manual/sv/05-kommunikation.md | sv |
| User Manual/sv/06-rapporter.md | sv |
| User Manual/sv/07-on-boarding.md | sv |
| User Manual/sv/08-ansatta.md | sv |
| User Manual/sv/09-haccp-mat-syn.md | sv |
| User Manual/sv/10-lisa-ai-assistent-och-installningar.md | sv |

## Upstream PRs

| File |
| ---- |
| upstream-prs/vercel-plugin-ai-sdk-generateObject-fix.md |

## Needs-Rewrite

Folder marked archived 2026-04-07; rewrite pending. Contents preserved for reference.

| File |
| ---- |
| needs-rewrite/README.md |
| needs-rewrite/REWRITE-INSTRUCTIONS-architecture.md |
| needs-rewrite/REWRITE-INSTRUCTIONS-misc.md |
| needs-rewrite/REWRITE-INSTRUCTIONS-system-intelligence.md |
| needs-rewrite/00-core-state-engine.md |
| needs-rewrite/01-system-architecture-contracts.md |
| needs-rewrite/02-agent-framework-runtime.md |
| needs-rewrite/SMARTOUT_ADMIN_KEY_MANAGEMENT.md |
| needs-rewrite/SMARTOUT_IMPLEMENTATION_GUIDE.md |
| needs-rewrite/SMARTOUT_PLATTFORMEN.md |
| needs-rewrite/SMARTOUT_UI_ARCHITECTURE.md |
| needs-rewrite/admin-onboarding.md |

## Archive

Single remaining archive file. Older content moved/deleted.

| File |
| ---- |
| archive/* (1 file, see folder) |

## Missions

`docs/missions/` is empty (placeholder for runtime mission specs).

## Changelog

| Date | Change |
| ---- | ------ |
| 2026-04-22 | Last partial reconciliation (counts stale by 2026-04-27) |
| 2026-04-27 | Full regeneration from filesystem; ADR/learning tables expanded; cross-cutting + lower-case roadmaps removed; new sections (audits, council, design, agents, superpowers, leadGen, etc.) added |
