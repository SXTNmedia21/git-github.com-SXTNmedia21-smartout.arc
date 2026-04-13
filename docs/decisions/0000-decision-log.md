---
title: Decision Log
status: canonical
updated: 2026-04-13
created: 2026-02-27
module: meta
tags: [decisions, adr, index]
---

# Decision Log

> Index of all accepted ADRs. Rebuilt 2026-04-07 after discovering the file had accumulated
> concatenated per-feature tables from multiple merged branches (each feature branch wrote
> its own `0000-decision-log.md` during work, and merges concatenated the frontmatters mid-file).
>
> **Source of truth:** individual `NNNN-*.md` files in this directory. This index is a
> regenerated view — if it disagrees with a file, the file wins.
>
> **Per-feature decision tables** (previously embedded here) have been removed. They live in
> `docs/handoffs/HANDOFF-<feature>.md` and in `activity-log.md` (per ADR-0075).
>
> **2026-04-10 note:** ADR-0037 received an addendum clarifying expanded landing event taxonomy,
> Supabase operational source-of-truth, and Phase 1 Platform Admin -> PostHog bridge ID contract.
>
> Ordered newest first.

| ADR | Date | Title | Status |
|-----|------|-------|--------|
| [ADR-0086](0086-entity-drawer-surface-pattern.md) | 2026-04-13 | Entity Drawer Surface Pattern (renumbered from ADR-0068 collision on 2026-04-13) | accepted |
| [ADR-0085](0085-year-wheel-governance-policy.md) | 2026-04-10 | Year Wheel Governance Policy — single active cycle per workspace, max 1 active season | accepted |
| [ADR-0084](0084-telemetry-conditional-exports.md) | 2026-04-09 | Telemetry package conditional exports — react-server/default split to isolate posthog-node from client bundle, /api/telemetry proxy for server-only destinations | accepted |
| [ADR-0083](0083-strike-mcp-registration.md) | 2026-04-08 | Strike MCP Registered as Dev-Only Data Source — repo-level .mcp.json with .env.local token, 1Password deferred as debt | accepted |
| [ADR-0082](0082-contract-drafts-are-not-versions.md) | 2026-04-08 | Contract Drafts Are Not Versions — versioning starts at send, idempotency on send endpoint | accepted |
| [ADR-0081](0081-admin-pii-bypass-security-definer-rpc.md) | 2026-04-08 | Admin PII Bypass via SECURITY DEFINER RPC — dashboard-only, never via agent, with employee notification | accepted |
| [ADR-0080](0080-compliance-drift-signal-read-only.md) | 2026-04-08 | Compliance Drift Signal — read-only materialized view, not a cascade derivation | accepted |
| [ADR-0079](0079-adr-0024-amendment-employment-vs-platform-contracts.md) | 2026-04-08 | ADR-0024 Amendment — employment_contract vs contract system separation | accepted |
| [ADR-0078](0078-engine-process-channel-restriction.md) | 2026-04-08 | Engine Process Channel Restriction — allowed_channels + defence in depth for PII | accepted |
| [ADR-0077](0077-contract-intake-pii-handling.md) | 2026-04-08 | Contract Intake PII Handling — personnummer/bank encryption, no-echo, engine_memory sensitivity | accepted |
| [ADR-0076](0076-contract-composition-as-cascade-derivation.md) | 2026-04-08 | Contract Composition as Cascade Derivation — compliance via change_proposal, overrides as JSONB provenance | accepted |
| [ADR-0075](0075-knowledge-system-consolidation.md) | 2026-04-07 | Knowledge System Consolidation — slim DASHBOARD, delete SESSION.md, migrate narrative to activity-log + claude-mem | accepted |
| [ADR-0074](0074-protocol-verification-engine.md) | 2026-03-29 | Protocol Verification Engine Architecture (renumbered from 0071 on 2026-04-07) | accepted |
| [ADR-0073](0073-ai-eval-harness.md) | 2026-04-06 | AI Eval Harness for `packages/ai` — two-layer test surface (unit mocked + evals gated) | accepted |
| [ADR-0072](0072-vercel-multi-service-rejected.md) | 2026-04-07 | Vercel multi-service migration — rejected pending platform investigation | accepted |
| [ADR-0071](0071-preview-environment-architecture.md) | 2026-04-06 | Preview Environment Architecture — 3-branch flow (dev → preview → main) | accepted |
| [ADR-0070](0070-emma-wizard-bridge.md) | 2026-03-28 | Emma-Wizard Bridge — tool-based agent control over wizard flows (supersedes parts of ADR-0049) | accepted |
| [ADR-0069](0069-session-execution-ownership.md) | 2026-03-28 | Session Execution Ownership — Edge Functions own execution, Engine owns side-effects | accepted |
| [ADR-0068](0068-simulation-schema-and-service.md) | 2026-03-28 | Simulation Schema and Dedicated Service | accepted |
| [ADR-0067](0067-smart-cover-via-event-engine.md) | 2026-03-28 | Smart Cover via Event Engine | accepted |
| [ADR-0066](0066-temporal-shift-lock-architecture.md) | 2026-03-28 | Temporal shift lock architecture | accepted |
| [ADR-0065](0065-hospitality-operations-cockpit-v1-contract.md) | 2026-03-28 | Hospitality Operations Cockpit v1 Read/Action Contract | accepted |
| [ADR-0064](0064-dynamic-landing-engine.md) | 2026-03-28 | Dynamic Landing Engine | accepted |
| [ADR-0063](0063-communication-system-consolidation.md) | 2026-03-28 | Communication System Consolidation | accepted |
| [ADR-0062](0062-industry-intelligence-consolidation.md) | 2026-03-28 | Industry Intelligence Consolidation | accepted |
| [ADR-0061](0061-walkai-semantic-tagging.md) | 2026-03-28 | WalkAi Semantic Tagging Convention | accepted |
| [ADR-0060](0060-unified-wizard-shell.md) | 2026-03-28 | Unified Wizard Shell in packages/ui | accepted |
| [ADR-0059](0059-platform-admin-pipeline.md) | 2026-03-28 | Platform Admin Pipeline Separation — routeAdminMessage() vs routeAgentMessage() | accepted |
| [ADR-0058](0058-livekit-as-webrtc-provider.md) | 2026-03-22 | LiveKit as WebRTC Provider | accepted |
| [ADR-0057](0057-payroll-schema-separation.md) | 2026-03-28 | Payroll Schema Separation | accepted |
| [ADR-0056](0056-cascade-core-foundation-schema.md) | 2026-03-21 | Cascade Core Foundation Schema (I1+6D+4C+K1a/K1b) | done |
| [ADR-0055](0055-two-vault-environment-isolation.md) | 2026-03-17 | Two-Vault Environment Isolation (superseded by ADR-0071) | superseded |
| [ADR-0054](0054-edge-functions-own-call-orchestration.md) | 2026-03-22 | Edge Functions Own Call Orchestration (renumbered from 0059 on 2026-04-07) | accepted |
| [ADR-0053](0053-simulation-schema-and-simulator-service.md) | 2026-03-23 | Dedicated simulation schema and simulator microservice for cascade system testing (renumbered from 0058 on 2026-04-07) | proposed |
| [ADR-0052](0052-guardian-websocket-architecture.md) | 2026-03-14 | Guardian Real-Time WebSocket Architecture (renumbered from 0049 on 2026-04-07) | accepted |
| [ADR-0051](0051-unified-ai-runtime-system-definition.md) | 2026-03-14 | Unified AI Runtime System Definition v1 | accepted |
| [ADR-0050](0050-port-standardization-and-vault-secrets.md) | 2026-03-14 | Port Standardization & Vault Secrets Strategy | accepted |
| [ADR-0049](0049-agent-sdk-package.md) | 2026-03-06 | Agent SDK Package — `@smartout/agent-sdk` | accepted |
| [ADR-0048](0048-daily-close-engine.md) | 2026-03-06 | DailyCloseEngine Architecture | accepted |
| [ADR-0047](0047-schedule-db-persistence.md) | 2026-03-06 | Schedule DB Persistence with TanStack Query | accepted |
| [ADR-0046](0046-block-based-landing-page-builder.md) | 2026-03-01 | Block-based Landing Page Builder (superseded by ADR-0064) | superseded |
| [ADR-0045](0045-sendgrid-transactional-email.md) | 2026-03-01 | SendGrid for Transactional Email Over Resend | accepted |
| [ADR-0044](0044-invitation-table-naming.md) | 2026-03-01 | Invitation Table Named `invitation` Not `workspace_invite` | accepted |
| [ADR-0043](0043-emergency-contact-on-user-identity.md) | 2026-03-01 | Emergency Contact Fields on user_identity Table | accepted |
| [ADR-0042](0042-agent-architecture.md) | 2026-03-02 | Agent Architecture — Stage Engine Agent Mode | accepted |
| [ADR-0041](0041-onboarding-wizard-step-architecture.md) | 2026-03-01 | Onboarding Wizard Step Architecture | accepted |
| [ADR-0040](0040-infrastructure-in-monorepo.md) | 2026-03-01 | Infrastructure stays in monorepo | accepted |
| [ADR-0039](0039-infra-consolidation.md) | 2026-03-01 | Infrastructure Consolidation | accepted |
| [ADR-0038](0038-journey-agent-output-generators.md) | 2026-03-01 | Journey Agent & Output Generators | accepted |
| [ADR-0037](0037-landing-event-tracking.md) | 2026-03-01 | Landing Page Event Tracking | accepted |
| [ADR-0036](0036-shift-mcp-server.md) | 2026-03-01 | Shift MCP Server | accepted |
| [ADR-0035](0035-docker-network-infra.md) | 2026-03-01 | Docker Network Infrastructure (superseded by ADR-0039) | superseded |
| [ADR-0034](0034-documentation-enforcement-pipeline.md) | 2026-03-01 | Documentation Enforcement Pipeline | accepted |
| [ADR-0033](0033-documentation-rag-pgvector.md) | 2026-03-01 | Documentation RAG with pgvector | accepted |
| [ADR-0032](0032-schedule-local-state-architecture.md) | 2026-03-01 | Schedule Page Local State Architecture | accepted |
| [ADR-0031](0031-journey-portal-system.md) | 2026-03-01 | Journey Portal System | accepted |
| [ADR-0030](0030-documentation-in-landing-app.md) | 2026-02-28 | Documentation System in Landing App (Nextra Removal) | accepted |
| [ADR-0029](0029-workspace-api-gateway.md) | 2026-02-28 | Workspace API Gateway | accepted |
| [ADR-0028](0028-api-key-management-system.md) | 2026-02-28 | API Key Management System | accepted |
| [ADR-0027](0027-pricing-terms-table.md) | 2026-02-28 | Pricing Terms Table for Workspace Commercial Model | accepted |
| [ADR-0026](0026-template-editor-redesign-attachments.md) | 2026-02-28 | Template Editor Redesign with PDF Attachments | accepted |
| [ADR-0025](0025-documentation-restructuring.md) | 2026-02-28 | Documentation Restructuring — Layered System with YAML Frontmatter | accepted |
| [ADR-0024](0024-contract-system-architecture.md) | 2026-02-28 | Contract System Architecture | accepted |
| [ADR-0023](0023-global-scrollbar-standard.md) | 2026-02-28 | Global Scrollbar Standard via Design Tokens | accepted |
| [ADR-0022](0022-notification-service-architecture.md) | 2026-02-28 | Email/Notification Service Architecture | accepted |
| [ADR-0021](0021-subdomain-workspace-routing.md) | 2026-02-28 | Subdomain-Based Workspace Routing | accepted |
| [ADR-0020](0020-vercel-hosting-strategy.md) | 2026-02-28 | Vercel Hosting with Dual-Project Split | accepted |
| [ADR-0019](0019-performance-build-governance.md) | 2026-02-27 | Performance and Build Governance System | accepted |
| [ADR-0018](0018-tanstack-table-recharts-platform-admin.md) | 2026-02-27 | TanStack Table and Recharts for Platform Admin | accepted |
| [ADR-0017](0017-enterprise-infrastructure.md) | 2026-02-27 | Enterprise Infrastructure — Shared Configs, Design System, Monitoring | accepted |
| [ADR-0016](0016-services-directory.md) | 2026-02-27 | Services Directory for Backend Microservices | accepted |
| [ADR-0015](0015-bubble-rebuild-strategy.md) | 2026-02-27 | Bubble.io Rebuild Strategy | accepted |
| [ADR-0014](0014-posthog-eu-proxy.md) | 2026-02-27 | PostHog EU Instance with Reverse Proxy | accepted |
| [ADR-0013](0013-database-types-generation.md) | 2026-02-27 | Auto-Generated Database Types Workflow | accepted |
| [ADR-0012](0012-subscription-on-company.md) | 2026-02-27 | Subscription Data on Company Table (No Separate Table) | accepted |
| [ADR-0011](0011-user-identity-table-naming.md) | 2026-02-27 | User Table Named `user_identity` (Not `user`) | accepted |
| [ADR-0010](0010-ai-sdk-openrouter.md) | 2026-02-27 | AI SDK with OpenRouter Provider | accepted |
| [ADR-0009](0009-tailwind-v4-css-config.md) | 2026-02-27 | Tailwind CSS v4 with CSS-Based Configuration | accepted |
| [ADR-0008](0008-dashboard-scroll-behavior.md) | 2026-02-27 | Dashboard Scroll Behavior & Dynamic Layout | accepted |
| [ADR-0007](0007-dashboard-architecture.md) | 2026-02-27 | Dashboard App Layout & Navigation State | accepted |
| [ADR-0006](0006-secrets-and-environment.md) | 2026-02-27 | Environment Variables, Secrets & Module Boundaries | accepted |
| [ADR-0005](0005-testing-infrastructure.md) | 2026-02-27 | Testing Infrastructure — Four-Layer Strategy | accepted |
| [ADR-0004](0004-unified-telemetry-engine.md) | 2026-02-27 | Unified Telemetry & Audit Trail Engine | accepted |
| [ADR-0003](0003-shadcn-integration.md) | 2026-02-27 | UI Framework and Local Styling Strategy | accepted |
| [ADR-0002](0002-state-vs-hooks.md) | 2026-02-27 | State-Driven vs Hook-Driven Logic Boundaries | accepted |
| [ADR-0001](0001-use-turborepo-pnpm.md) | 2026-02-27 | Adopt Turborepo & pnpm Workspaces | accepted |

## Integrity

- **86 ADRs** (0001-0086, ADR-0000 is this index)
- **0 number collisions** (verified 2026-04-13 — ADR-0068 entity-drawer collision resolved by renumbering to 0086)
- **0 number gaps** (0052/0053/0054 previously gaps, now occupied by renumbered collision resolvers)
- **Renumbered 2026-04-07:** 0049 guardian-ws → 0052, 0058 simulation → 0053, 0059 edge-functions → 0054, 0071 protocol-verification → 0074 (see ADR-0075 context)
- **Renumbered 2026-04-13:** ADR-0068-entity-drawer-surface-pattern → 0086 (collision with 0068-simulation-schema-and-service)
- **Archived 2026-04-13:** ADR-DRAFT-core-hierarchy-cascade — superseded by cascade spec
- **Superseded:** 0035 (→0039), 0046 (→0064), 0055 (→0071)
