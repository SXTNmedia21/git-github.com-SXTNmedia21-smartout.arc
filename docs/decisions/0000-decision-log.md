---
title: Decision Log
status: in_progress
updated: 2026-03-12
created: 2026-02-27
module: meta
tags: [decisions, adr, index]
---

# Decision Log

> Master index of all Architecture Decision Records (ADRs). Updated when new ADRs are created.

| #    | File                                           | Subject                                      | Status     | Date       |
| ---- | ---------------------------------------------- | -------------------------------------------- | ---------- | ---------- |
| 0001 | 0001-use-turborepo-pnpm.md                     | Turborepo + pnpm workspaces                  | accepted   | 2026-02-27 |
| 0002 | 0002-state-vs-hooks.md                         | State-driven vs hook-driven logic            | accepted   | 2026-02-27 |
| 0003 | 0003-shadcn-integration.md                     | shadcn/ui integration                        | accepted   | 2026-02-27 |
| 0004 | 0004-unified-telemetry-engine.md               | Unified telemetry (PostHog)                  | accepted   | 2026-02-27 |
| 0005 | 0005-testing-infrastructure.md                 | Testing four-layer strategy                  | accepted   | 2026-02-27 |
| 0006 | 0006-secrets-and-environment.md                | Env vars and secrets                         | accepted   | 2026-02-27 |
| 0007 | 0007-dashboard-architecture.md                 | Dashboard layout & nav                       | accepted   | 2026-02-27 |
| 0008 | 0008-dashboard-scroll-behavior.md              | Dashboard scroll behavior                    | accepted   | 2026-02-27 |
| 0009 | 0009-tailwind-v4-css-config.md                 | Tailwind CSS v4                              | accepted   | 2026-02-27 |
| 0010 | 0010-ai-sdk-openrouter.md                      | AI SDK with OpenRouter                       | accepted   | 2026-02-27 |
| 0011 | 0011-user-identity-table-naming.md             | user_identity table name                     | accepted   | 2026-02-27 |
| 0012 | 0012-subscription-on-company.md                | Subscription on company table                | accepted   | 2026-02-27 |
| 0013 | 0013-database-types-generation.md              | Auto-generated DB types                      | accepted   | 2026-02-27 |
| 0014 | 0014-posthog-eu-proxy.md                       | PostHog EU proxy                             | accepted   | 2026-02-27 |
| 0015 | 0015-bubble-rebuild-strategy.md                | Bubble.io rebuild strategy                   | accepted   | 2026-02-27 |
| 0016 | 0016-services-directory.md                     | Services directory                           | accepted   | 2026-02-27 |
| 0017 | 0017-enterprise-infrastructure.md              | Enterprise infrastructure                    | accepted   | 2026-02-27 |
| 0018 | 0018-tanstack-table-recharts-platform-admin.md | TanStack Table + Recharts                    | accepted   | 2026-02-27 |
| 0019 | 0019-performance-build-governance.md           | Performance governance                       | accepted   | 2026-02-27 |
| 0020 | 0020-vercel-hosting-strategy.md                | Vercel hosting strategy                      | accepted   | 2026-02-28 |
| 0021 | 0021-subdomain-workspace-routing.md            | Subdomain routing                            | accepted   | 2026-02-28 |
| 0022 | 0022-notification-service-architecture.md      | Notification service                         | accepted   | 2026-02-28 |
| 0023 | 0023-global-scrollbar-standard.md              | Global scrollbar standard                    | accepted   | 2026-02-28 |
| 0024 | 0024-contract-system-architecture.md           | Contract system                              | accepted   | 2026-02-28 |
| 0025 | 0025-documentation-restructuring.md            | Docs restructuring (YAML, layers, archive)   | accepted   | 2026-02-28 |
| 0026 | 0026-template-editor-redesign-attachments.md   | Template editor redesign                     | accepted   | 2026-02-28 |
| 0027 | 0027-pricing-terms-table.md                    | Pricing terms table                          | accepted   | 2026-02-28 |
| 0028 | 0028-api-key-management-system.md              | API key management system                    | accepted   | 2026-02-28 |
| 0029 | 0029-workspace-api-gateway.md                  | Workspace API gateway                        | accepted   | 2026-02-28 |
| 0030 | 0030-documentation-in-landing-app.md           | Documentation in landing app                 | accepted   | 2026-02-28 |
| 0031 | 0031-journey-portal-system.md                  | Journey portal system                        | accepted   | 2026-03-01 |
| 0032 | 0032-schedule-local-state-architecture.md      | Schedule local state architecture            | accepted   | 2026-03-01 |
| 0033 | 0033-documentation-rag-pgvector.md             | Documentation RAG with pgvector              | accepted   | 2026-03-01 |
| 0034 | 0034-documentation-enforcement-pipeline.md     | Documentation enforcement pipeline           | accepted   | 2026-03-01 |
| 0035 | 0035-docker-network-infra.md                   | Docker network infrastructure                | superseded | 2026-03-01 |
| 0036 | 0036-shift-mcp-server.md                       | Shift MCP server                             | accepted   | 2026-03-01 |
| 0037 | 0037-landing-event-tracking.md                 | Landing page event tracking                  | accepted   | 2026-03-01 |
| 0038 | 0038-journey-agent-output-generators.md        | Journey agent & output generators            | accepted   | 2026-03-01 |
| 0039 | 0039-infra-consolidation.md                    | Infrastructure consolidation                 | accepted   | 2026-03-01 |
| 0040 | 0040-infrastructure-in-monorepo.md             | Infrastructure stays in monorepo             | accepted   | 2026-03-01 |
| 0041 | 0041-onboarding-wizard-step-architecture.md    | Onboarding wizard step architecture          | accepted   | 2026-03-01 |
| 0042 | 0042-agent-architecture.md                     | Agent architecture — Stage Engine agent mode | accepted   | 2026-03-02 |
| 0043 | 0043-emergency-contact-on-user-identity.md     | Emergency contact on user_identity           | accepted   | 2026-03-03 |
| 0044 | 0044-invitation-table-naming.md                | Invitation table naming                      | accepted   | 2026-03-03 |
| 0045 | 0045-sendgrid-transactional-email.md           | SendGrid transactional email                 | accepted   | 2026-03-06 |
| 0046 | 0046-block-based-landing-page-builder.md       | Block-based landing page builder             | accepted   | 2026-03-02 |
| 0047 | 0047-schedule-db-persistence.md                | Schedule DB persistence with TanStack Query  | accepted   | 2026-03-01 |
| 0048 | 0048-daily-close-engine.md                     | DailyCloseEngine state machine               | accepted   | 2026-03-04 |

## Feature-Specific Decision Logs

Feature-level decisions are logged in the WORKLOG for each feature branch. See `docs/worklogs/WORKLOG-*.md` for per-feature decisions.
