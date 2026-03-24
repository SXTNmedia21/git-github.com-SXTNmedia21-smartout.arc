---
title: Decision Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: hms
tags: [decisions]
---

# Decision Log — hms-phase-1

| #   | Date       | Decision                                                                            | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | HMS hooks in apps/web, not packages/hms — depend on DashboardContext and @/ aliases | accepted |
| 2   | 2026-03-22 | packages/hms as skeleton for future mobile parity                                   | accepted |
| 3   | 2026-03-22 | Governance page redirects to /dashboard/hms (old components preserved)              | accepted |
| 4   | 2026-03-22 | Web direct insert for deviations, mobile keeps offline queue                        | accepted |
| 5   | 2026-03-22 | Shared deviation contract (Zod schema) in packages/hms                              | accepted |
| 6   | 2026-03-22 | 3 employee Drift layouts by context (timeline, list, card stack)                    | accepted |
| 7   | 2026-03-22 | Admin Drift = table, Admin Avvik = kanban + list toggle                             | accepted |
| 8   | 2026-03-22 | Soft sign-off with warnings, not hard gates (Phase 3)                               | accepted |
| 9   | 2026-03-22 | CLAUDE.md: mandatory DB schema brainstorm for every feature                         | accepted |

module: cross-cutting
module: unspecified
tags: [decisions]

---

# Decision Log — cascade-foundation

| #   | Date       | Decision                                                                                                                  | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | Dual-layer architecture: client pure functions for instant feedback + server engine actions for authoritative computation | accepted |
| 2   | 2026-03-22 | Skip server-side RPC for shift validation in this phase — no API consumers yet                                            | accepted |
| 3   | 2026-03-22 | Cost snapshots on both publish (planned) and completion (actual) — append-only                                            | accepted |
| 4   | 2026-03-22 | Push + invalidate for demand propagation (workspace_budget rows)                                                          | accepted |
| 5   | 2026-03-22 | Admin cascade visibility in settings tabs, not a top-level governance page                                                | accepted |
| 6   | 2026-03-22 | Contract-payroll sync via DB trigger (not Edge Function)                                                                  | accepted |
| 7   | 2026-03-22 | Department classification via name matching with confidence levels                                                        | accepted |
| 8   | 2026-03-22 | activate-workspace bootstrap hook deferred due to prompt hook constraint                                                  | deferred |

# Decision Log — fix-invitation-flow

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |

# Decision Log — sjohuset-simulator

| #   | Date       | Decision                                                                                         | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-23 | ADR-0058: Dedicated simulation schema + services/simulator Hono microservice for cascade testing | proposed |

---

# Decision Log — journey-engine

| #   | Date       | Decision                                                                                                          | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-08 | wait_for_event conditions are resumption-only — executeStep skips condition check for wait_for_event action types | Accepted |
| 2   | 2026-03-08 | engine_state.workspace_id nullable — pre-workspace processes (signup_onboarding) start before workspace exists    | Accepted |
| 3   | 2026-03-08 | engine_trigger.workspace_id nullable — global triggers match all workspaces                                       | Accepted |
| 4   | 2026-03-08 | engine_event.workspace_id nullable — events can fire before workspace creation                                    | Accepted |
| 5   | 2026-03-08 | match_state operator for cross-entity event matching — payload field maps to state context field                  | Accepted |
| 6   | 2026-03-08 | entity_id matching relaxed — events without entity_id match all waiting states (non-entity-scoped events)         | Accepted |
| 7   | 2026-03-08 | Compile function is pure — no DB deps, converts journey PM rows to engine_process/step/trigger structs            | Accepted |
| 8   | 2026-03-08 | E2E tests are API-driven — hit engine-dispatch via fetch, no browser required                                     | Accepted |
| 9   | 2026-03-08 | engine_process.id is human-readable TEXT PK (signup_onboarding, workspace_setup)                                  | Accepted |

## scrapling-extract

| #   | Date       | Decision                                                                                                          | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-10 | Use /extract/document (not /extract) for file upload endpoints to avoid conflict with existing URL-based /extract | accepted |

---

# Decision Log — adminpage-speed

| #   | Date       | Decision                                                                                                                 | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-10 | Cache TTL: 30s for real-time pages (users, audit, workspaces, landing), 60s for stable pages (billing, contracts, comms) | Accepted |
| 2   | 2026-03-10 | Reduce query limits to 100-200 instead of server-side pagination — platform-admin has low data volume at current scale   | Accepted |
| 3   | 2026-03-10 | Consolidate landing queries from 11→8 instead of full rewrite — maximum impact with minimal risk                         | Accepted |
| 4   | 2026-03-10 | Centralize URL templates in platform-admin-routes.ts — no hardcoded paths scattered across components                    | Accepted |
| 5   | 2026-03-10 | Workspace notes moved from platform_audit_log to own workspace_note table — audit is immutable, notes need edit/delete   | Accepted |

module: webrtc
tags: [decisions]

---

# Decision Log — livekit-phase2

| #   | Date       | Decision                                                                                | Status   |
| --- | ---------- | --------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | ADR-0058: LiveKit as WebRTC provider (Deno SDK, RN support, AI agents, EU, open source) | accepted |
| 2   | 2026-03-22 | ADR-0059: Edge Functions own call orchestration (mobile parity, singular truth)         | accepted |
| 3   | 2026-03-22 | Signaling via Supabase Realtime Broadcast, not custom WebSocket server                  | accepted |
| 4   | 2026-03-22 | Shared data layer in packages/walkieTalkie — web + mobile use identical mutations       | accepted |
| 5   | 2026-03-22 | Room name format: {workspaceId}:{channelId} — parseable by webhooks                     | accepted |
| 6   | 2026-03-22 | PTT as pure state machine in shared package, platform-specific UI adapters              | accepted |

---

# Decision Log — setup-flow-redesign

| #   | Date       | Decision                                                                                                                                              | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | Use field_sources JSONB column on company_details for per-field provenance tracking                                                                   | accepted |
| 2   | 2026-03-22 | Dashboard wizard reads from DB tables (company, company_details, company_opening_hours, company_social_media), never from workspace.intelligence_data | accepted |
| 3   | 2026-03-22 | Remove isDark prop entirely; replace all 299 ternaries with CSS variable design tokens                                                                | accepted |
| 4   | 2026-03-22 | Extend finalize_onboarding_workspace RPC to upsert company_details + company_social_media during finalization                                         | accepted |
| 5   | 2026-03-22 | Support both old keys (brregData/scrapedData) and new keys (brreg/scraped) in useIndustryPackage for backwards compatibility                          | accepted |
