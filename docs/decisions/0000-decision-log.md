---
title: Decision Log
status: in_progress
updated: 2026-03-08
created: 2026-03-08
module: cross-cutting
tags: [decisions]
---

# Decision Log — journey-package-skills

| #   | Date       | Decision                                                                                                         | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-06 | Mission skill produces both Mission.md + seed SQL (executable artifact, not just design doc)                     | Accepted |
| 2   | 2026-03-06 | Observability contract mandatory in every mission (three pillars: results, trackability, triggerability)         | Accepted |
| 3   | 2026-03-06 | Journey steps don't map 1:1 to mission stages (UI-only steps and confirmations should merge)                     | Accepted |
| 4   | 2026-03-06 | Triage gate: not every journey needs a mission (system journeys get stub Mission.md with status: not-applicable) | Accepted |
| 5   | 2026-03-06 | Agent-added stages are valid (greeting/wrapup stages may have no Journey step)                                   | Accepted |
| 6   | 2026-03-06 | Guardian integration is automatic, not manual (events flow through emitGuardianEvent())                          | Accepted |
| 7   | 2026-03-06 | journey_step_id is the Guardian bridge (without it on engine_stages, Guardian evaluator skips the stage)         | Accepted |

---

# Decision Log — unified-context-search

| #   | Date       | Decision                                                                                        | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-06 | 3-layer architecture: System (deterministic) → Intelligence (role scaffolding) → AI (assistant) | Accepted |
| 2   | 2026-03-06 | Separate workspace_doc_chunk from platform_doc_chunk (workspace RLS vs global)                  | Accepted |
| 3   | 2026-03-06 | cmdk prefix modes: ? knowledge, @ people, > commands                                            | Accepted |
| 4   | 2026-03-06 | Search orchestrator runs 3 modes in parallel with hard cap per group (5)                        | Accepted |
| 5   | 2026-03-06 | Semantic search ships as empty stub (instance + dependency work immediately)                    | Accepted |
| 6   | 2026-03-06 | Bootstrap endpoint cached 30s with stale-while-revalidate 120s                                  | Accepted |
| 7   | 2026-03-06 | svcTable() helper pattern for unapplied-migration type casts (easy grep + remove)               | Accepted |

---

# Decision Log — season-creation-wizard

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |

module: governance
tags: [decisions]

---

# Decision Log — governance-admin-ui

updated: 2026-03-06
created: 2026-03-06
module: meta
updated: 2026-03-06
created: 2026-03-06
module: document
tags: [decisions]

---

# Decision Log — document-mode

| #   | Date       | Decision                                                                                                | Status | Module     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | 2026-03-08 | Bypass finalize-workspace Edge Function — call `finalize_onboarding_workspace` RPC directly from client | active | onboarding |
| 2   | 2026-03-08 | RPC creates company on-the-fly if workspace was provisioned without one (NULL company_id)               | active | onboarding |
| 3   | 2026-03-08 | Season stage transitions use calendar-based Guardian (not manual user triggers)                         | active | operations |
| 4   | 2026-03-08 | Calendar Guardian queries season table directly for dates (not session collected_data)                  | active | operations |
| 5   | 2026-03-08 | SeasonCard uses hardcoded phase colors for data-visualization semantics                                 | active | operations |
| 6   | 2026-03-08 | useActiveSeason infers "running" stage when no engine session exists for active season                  | active | operations |
| 7   | 2026-03-08 | Season tools use SeasonToolContext with workspace_id + supabase client                                  | active | operations |
| 8   | 2026-03-06 | Adopt AI runtime canonical spec (`AI_RUNTIME_SYSTEM_DEFINITION_V1`) as single source of truth           | active | ai         |
| #   | Date       | Decision                                                                                                | Status |
| --- | ----       | --------                                                                                                | ------ |

status: done
updated: 2026-03-08
created: 2026-03-06
module: infra
tags: [decisions]

---

# Decision Log — infra-hardening

| #   | Date       | Decision                                                                                        | Status |
| --- | ---------- | ----------------------------------------------------------------------------------------------- | ------ |
| 1   | 2026-03-07 | Use SAMEORIGIN not DENY for X-Frame-Options — may need iframe embedding                         | active |
| 2   | 2026-03-07 | HSTS without preload — irreversible commitment, not safe for all subdomains yet                 | active |
| 3   | 2026-03-07 | No global Caddy write timeout — would kill SSE/streaming responses at 30s                       | active |
| 4   | 2026-03-07 | Prod service ports bound to 127.0.0.1 — health-check.sh needs host access, no internet exposure | active |
| 5   | 2026-03-07 | Pin n8n to 2.10.4 — prevent :latest breaking changes on deploy                                  | active |
| 6   | 2026-03-07 | Stage Engine gets 300s transport timeouts + flush_interval -1 for AI streaming                  | active |

# Decision Log — zero-to-production

| #   | Date       | Decision                                                                                                          | Status |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | 2026-03-08 | "Confirm, don't create" wizard UX — pre-fill from scraped/intelligence data, user confirms rather than creates    | active |
| 2   | 2026-03-08 | Industry package system — NACE code detection drives template suggestions (hospitality first, default fallback)   | active |
| 3   | 2026-03-08 | Shared wizardState object passed to all steps (vs. per-step local state) for cross-step data visibility           | active |
| 4   | 2026-03-08 | setupDismissed local state pattern — prevents useLayoutEffect from re-mounting dismissed wizard                   | active |
| 5   | 2026-03-08 | E2E test isolation via docker exec psql — move workspace data to temp UUID instead of REST API cascade deletes    | active |
| 6   | 2026-03-08 | STEP_TO_MODULE auto-advance — wizard skips to first step whose module is incomplete, prevents re-doing done steps | active |
