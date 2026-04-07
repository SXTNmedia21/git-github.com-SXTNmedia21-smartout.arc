---
title: "STATE — System State of Truth"
status: in_progress
updated: 2026-04-07
created: 2026-03-08
last-verified: 2026-04-07 (light touch-up only)
last-full-audit: 2026-03-27
module: all
tags: [state, audit, gaps, architecture, cascade]
---

# STATE — System State of Truth

> Single source of truth for what exists, what's missing, and what to build next.
> Organized by the Cascade Core canonical model: **I1 + 6D + 4C + K1a/K1b**.
> Last full audit: 2026-03-27. Last light touch-up: 2026-04-07.
> Canonical spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

> **Trust hierarchy:** Active Work + ADR/Learning deltas + Recently Merged below are current as of 2026-04-07. Architecture sections (Cascade dimensions, 10 gaps, build order) were last verified 2026-03-27 — structure is still valid but specific counts and "% built" may have drifted. For worktree truth see `docs/DASHBOARD.md`. For session continuity see `docs/SESSION.md`.

---

## Active Work (2026-04-07 — quick reconciliation, not full audit)

Authoritative source: `docs/DASHBOARD.md`. This section is a snapshot only.

### Active Worktrees

| WT   | Branch                       | Status      | Notes                                                |
| ---- | ---------------------------- | ----------- | ---------------------------------------------------- |
| wt-1 | `feat/journey-harness-poc`   | in_progress | Council-verified plan, 11 tasks, ADR-0071 inheritance |
| wt-3 | `feat/agent-harness`         | paused      | Phase 1-5 done, ADR-0073, ready for `/close-feature` |

All other worktrees free. See DASHBOARD for full slot map.

### Parked Branches (no worktree)

None (all branches merged or cleaned 2026-04-07).

### Recently Merged (since 2026-03-26, authoritative: DASHBOARD.md)

| Date       | Branch                               | What                                             |
| ---------- | ------------------------------------ | ------------------------------------------------ |
| 2026-04-07 | `feat/employee-contract-management`  | Employee contract CRUD + invitation SECURITY DEFINER RPC |
| 2026-04-07 | `feat/tooling-optimization`          | Skills authority model, CLAUDE.md slim           |
| 2026-04-07 | `feat/invitation-rls-fix`            | Invitation RLS hardening                         |
| 2026-04-06 | `feat/deployment-pipeline`           | 3-branch flow, ADR-0071 preview-env              |
| 2026-04-06 | `feat/council-review-fixes`          | 6 blocking issues from council review            |
| 2026-03-29 | `feat/interactive-dashboard`         | Dashboard interactivity phase                    |
| 2026-03-29 | `feat/telemetry-botsson-reactive`    | Botsson reactive telemetry                       |
| 2026-03-28 | `feat/telegram-walkai-adapter`       | Telegram admin bridge (ADR-0059)                 |
| 2026-03-28 | `feat/profession-system`             | Profession system                                |
| 2026-03-28 | `feat/sjohuset-simulator`            | Sjøhuset simulator                               |
| 2026-03-28 | `feat/season-operations-loop`        | Season ops loop                                  |
| 2026-03-28 | `feat/financial-esp-ux`              | Financial ESP UX                                 |
| 2026-03-28 | `feat/gamification-foundation`       | Gamification foundation                          |
| 2026-03-28 | `feat/komm-migration`                | Communication system consolidation               |
| 2026-03-28 | `fix/comms-council-fixes`            | Council review feedback on comms                 |
| 2026-03-28 | `feat/landing-token-migration`       | Landing page token migration                     |
| 2026-03-28 | `feat/setup-wizard-shell-migration`  | Unified wizard shell (ADR-0060/0061)             |
| 2026-03-27 | `feat/entity-drawer`                 | Entity detail drawer                             |
| 2026-03-27 | `feat/notification-fixes`            | Notification system fixes                        |
| 2026-03-27 | `feat/setup-guide-navigation`        | Setup guide routing                              |
| 2026-03-27 | `feat/setup-flow-redesign`           | Join/setup flow redesign                         |
| 2026-03-27 | `feat/onboarding-cleanup`            | Onboarding wizard cleanup                        |
| 2026-03-27 | `feat/nordic-split-design-sync`      | Dark mode tokens + section comments              |
| 2026-03-27 | `feat/mobile-wiring-fixes`           | 7 orphaned mobile features connected             |
| 2026-03-27 | `feat/website-factory-b2`            | Security fixes — auth, RLS, N+1, telemetry       |

Also shipped since last audit (not in DASHBOARD Recent Closures table): `feat/agent-harness` (wt-3, Phase 1-5 done, **paused awaiting /close-feature**, ADR-0073).

### Free Worktree Slots

wt-2, wt-4, wt-5, wt-6, wt-7, wt-8, wt-9, wt-10, wt-11, wt-12, wt-13, wt-15, wt-20 (wt-1 and wt-3 occupied)

---

## ADR / Learning Changes Since Last Full Audit (2026-03-27 → 2026-04-07)

### New ADRs (9 accepted/proposed)

| ADR  | Title                                     | Status   | Why it matters |
| ---- | ----------------------------------------- | -------- | -------------- |
| 0066 | Temporal Shift Lock Architecture          | accepted | DB-canonical lock across web/voice/MCP channels |
| 0067 | Smart Cover via Event Engine              | accepted | Shift cover workflow via engine_process |
| 0068 | Simulation Schema and Service             | proposed | Cascade simulator for live demo + CI |
| 0069 | Session Execution Ownership (EF + Engine) | accepted | EF owns execution, Engine owns side-effects |
| 0070 | Emma-Wizard Bridge                        | accepted | Tool-based agent control over wizard flows, supersedes parts of ADR-0049 |
| 0071 | Preview Environment Architecture          | accepted | 3-branch flow (development → preview → main), asymmetric Docker |
| 0072 | Vercel Multi-Service Migration — Rejected | accepted | Council 3/3: undocumented experimentalServices, WebSockets blocker |
| 0073 | AI Eval Harness                           | accepted | Two-layer test surface (unit mocked + evals gated on RUN_EVALS=1) |
| 0074 | Protocol Verification Engine              | accepted | Mission target=DB, JSONB storage, extends ADR-0031/0038 |

### ADR Number Collisions Resolved 2026-04-07

Six total collisions discovered during docs audit, resolved via renumbering into 0052/0053/0054 gaps:

| Was | Became | Reason kept original slot                       |
| --- | ------ | ------------------------------------------------ |
| 0049 guardian-websocket        | **0052** | agent-sdk kept 0049 (ADR-0070 supersedes-link)    |
| 0058 simulation-schema         | **0053** | livekit kept 0058 (registered first, WORKLOG refs) |
| 0059 edge-functions-own-call   | **0054** | platform-admin kept 0059 (HANDOFF + council refs) |
| 0071 protocol-verification     | **0074** | preview-environment kept 0071 (7+ live refs: CI, husky, ADR-0072) |

### Learning Log — New + Renumbered (since 2026-03-27)

New learnings 0018–0027 (10 entries): runtime doc truth sync, live ops feed hygiene, shift-lock multi-channel enforcement, absence approval prerequisite, disabled toggle semantics, journey DB tables = dev tracking, rescue != re-engagement, stage engine WebSocket Vercel blocker, drawer API boundary verification, Botsson mutation tools must emit.

Learning collisions resolved:
- 0001 websocket-jwt-auth → **0015** (turbopack kept 0001)
- 0002 guardian-event-dedup → **0028** (middleware-cookie kept 0002)

### Final Counts (verified 2026-04-07)

- **ADRs:** 75 total, 0001–0074, no gaps, no collisions
- **Learnings:** 29 total, 0001–0028, no gaps, no collisions
- **Journeys:** 91 total (was 31 in stale INDEX)
- **docs/ root:** 5 files (was 22 before cleanup)
- **docs/handoffs/:** 34 files (consolidated from root + subdir)

---

## Control Gate — Onboarding Contract

Current repo truth for onboarding ownership:

- `/join` is public intake. It captures raw business input and may provision or enrich a workspace shell, but it is not the canonical owner of cascade runtime truth.
- `/onboarding` is the authenticated bootstrap/finalization surface. This is where the active flow calls `finalize-workspace` / `finalize_onboarding_workspace` to turn provisional input into authoritative workspace records.
- `/dashboard/setup` is the post-bootstrap setup guide. It is routed by real setup completeness and should never be described as the source of workspace runtime truth.
- `workspace.onboarding_completed` is a bootstrap/finalization signal, not the dashboard setup-guide visibility switch.
- Legacy compatibility paths such as `activate-workspace` still exist in code. Treat them as compatibility flow, not the canonical cascade-first contract.

---

## 1. Database Tables — By Cascade Dimension

**Totals:** ~216 tables (179 public + 23 payroll + 13 websites + 1 timesheet), 124 enums, 210 migrations, 43 Edge Functions, 63 ADRs, 19 learnings.

### 1.0 Identity & Platform (Pre-Cascade)

Tables that exist before any workspace or cascade dimension. Not dimension-scoped.

| Table                                 | Migration | Cascade | Notes                                                                |
| ------------------------------------- | --------- | ------- | -------------------------------------------------------------------- |
| `user_identity`                       | 00001     | —       | NOT `user`. `handle_new_user()` trigger creates on auth.users INSERT |
| `company`                             | 00001     | —       | Subscription data lives here, no separate stripe table               |
| `company_member`                      | 00001     | —       | role: owner/admin/member                                             |
| `workspace`                           | 00001     | —       | All workspace-scoped tables FK here                                  |
| `invitation`                          | 00011     | —       | Dual-mode (batch/single), 3 delivery types (email/sms/link)          |
| `onboarding_session`                  | 00009     | —       | Persisted onboarding wizard state                                    |
| `platform_api_key`                    | 20260228  | —       | SHA-256 hashed API keys. type: workspace/service                     |
| `platform_doc` + `platform_doc_chunk` | 20260301  | —       | Platform documentation RAG                                           |
| `activity_trail`                      | 00005     | —       | Audit log. Telemetry activity_trail provider writes here             |
| `notification_queue`                  | 00006     | —       | Notification dispatch queue                                          |
| `signup_progress`                     | 20260415  | —       | Onboarding guide progress tracking                                   |

### 1.1 D1 — Operational Envelope (Driftsrammer)

> When/where/with what capacity?

| Table                        | Migration      | Status | Notes                                                       |
| ---------------------------- | -------------- | ------ | ----------------------------------------------------------- |
| `department`                 | 00002          | EXISTS | Permanent org unit. `department_type` enum added by A1      |
| `location`                   | 00002          | EXISTS | type: main/outdoor/kitchen/event/storage/other              |
| `zone`                       | 00002          | EXISTS | Within a location                                           |
| `asset`                      | 00002          | EXISTS | type: equipment/safety/storage/station/other                |
| `position`                   | 00002          | EXISTS | Per-shift, not per-person                                   |
| `department_operating_hours` | 20260421100200 | EXISTS | Cascade runtime truth for hours. Replaces `operating_hours` |
| `department_hours_override`  | 20260421100200 | EXISTS | Date-specific overrides (holidays, events)                  |
| `planning_cycle`             | 20260421100200 | EXISTS | Planning horizon definition. status: draft/active/archived  |
| `planning_event`             | 20260421100200 | EXISTS | Events affecting capacity (festivals, holidays, closures)   |
| `asset_maintenance`          | 20260407       | EXISTS | Equipment maintenance tracking                              |

**Pure functions:** `resolveEffectiveHours()` in `apps/web/src/lib/cascade/resolve-hours.ts` — DONE.
**UI:** Operating hours in settings — PARTIAL. No override editor, no planning cycle UI.

### 1.2 D2 — Resource Availability (Resurstilgang)

> Who is available now and within planning horizon?

| Table                      | Migration      | Status | Notes                                                                              |
| -------------------------- | -------------- | ------ | ---------------------------------------------------------------------------------- |
| `profile`                  | 00001          | EXISTS | status: trainee/active/inactive/offboarding. role: employee/manager/admin/owner    |
| `team`                     | 00002          | EXISTS | type: operational/access/cross_department/seasonal/custom                          |
| `employment_contract`      | 00012          | EXISTS | DocuSign/DocuSeal integration. status: draft/sent/viewed/signed/expired/terminated |
| `employee_payroll_profile` | 20260421100200 | EXISTS | Cascade A1. Payroll category, hourly rate, contract type                           |
| `schedule_absence`         | 20260301600003 | EXISTS | status: pending/approved/rejected                                                  |
| `agent_profile`            | 20260307       | EXISTS | AI agent identity and personality                                                  |
| `agent_relationship`       | 20260307       | EXISTS | Per agent-profile familiarity/trust/sentiment tracking                             |

**Pure functions:** NONE. No resource matching or availability resolution.
**UI:** People page, employee cards — WORKING. No payroll profile editor, no tariff override UI.

### 1.3 D3 — Rules & Constraints (Regler og begrensninger)

> What is allowed/required/forbidden?

| Table                         | Migration      | Status | Notes                                                                   |
| ----------------------------- | -------------- | ------ | ----------------------------------------------------------------------- |
| `regulatory_framework`        | 20260421200100 | EXISTS | Versioned loadable framework. K1a platform-owned when workspace_id NULL |
| `framework_rule`              | 20260421200100 | EXISTS | type: gate/constraint/advisory/commercial                               |
| `framework_trigger`           | 20260421200100 | EXISTS | type: 7 values. mode: state_change/time_based/threshold/external_event  |
| `workspace_framework_binding` | 20260421200100 | EXISTS | Links workspace to active framework version                             |
| `workspace_rule_override`     | 20260421200100 | EXISTS | Workspace customization of framework rules                              |
| `workspace_trigger_override`  | 20260421200100 | EXISTS | Workspace customization of trigger thresholds                           |
| `tariff_rate_table`           | 20260421100200 | EXISTS | Cascade A1. NULL workspace_id = platform baseline (K1a)                 |
| `public_holiday`              | 20260421100200 | EXISTS | Norway data seeded in 20260422200000                                    |

**Pure functions:** `evaluateFrameworkRules()` — DONE (full D3 evaluation with enforcement levels). `resolveTariffRate()` — DONE (seniority, fagbrev, overtime).
**UI:** Framework Rules, Tariff Rates, Change Proposals tabs in Settings — WORKING. No standalone framework viewer.

### 1.4 D4 — Demand Signal (Ettersporselsignal)

> How much activity to prepare for?

| Table                  | Migration      | Status | Notes                                                   |
| ---------------------- | -------------- | ------ | ------------------------------------------------------- |
| `season`               | 00002          | EXISTS | status: draft/active/archived                           |
| `season_budget`        | 20260306100000 | EXISTS | 1:1 with season. status: draft/active/locked            |
| `day_factor`           | 20260306100000 | EXISTS | Weekday weight distribution                             |
| `hour_factor`          | 20260306100000 | EXISTS | Hourly weight distribution                              |
| `planning_event`       | 20260421100200 | EXISTS | Shared with D1 (events affect both capacity and demand) |
| `workspace_kpi_target` | 20260302       | EXISTS | Operational KPI targets                                 |
| `workspace_budget`     | 20260302       | EXISTS | Per-date operational budget targets                     |

**Pure functions:** `propagateBudgetTargets()` in `propagate-budget-targets.ts` — DONE. Budget target propagation tested.
**Calculation engine:** `apps/web/src/lib/season-calculations.ts` — pure functions for budget math, no DB deps.
**UI:** `/dashboard/season` with 4 tabs — WORKING. No daily target propagation view.

### 1.5 D5 — Service Concept (Driftskonsept)

> What kind of operation are we? (Parameterizes D1-D4 and D6)

No dedicated tables — D5 lives as configuration that parameterizes coefficients in other dimensions.

| Source                    | Status | Notes                                                                                                                                     |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hospitality.ts`          | EXISTS | Industry package loader with corrected fallback tariff values. Runtime tariff truth is DB-first (`tariff_rate_table` + framework tables). |
| `use-industry-package.ts` | EXISTS | Hook for loading industry config                                                                                                          |
| Niche profiles (docs)     | DRAFT  | Restaurant type parameterization (fine-dining, fast-casual, pub)                                                                          |

**Status:** Runtime tariff resolution is DB-first (`tariff_rate_table` + framework tables). `hospitality.ts` remains bootstrap/fallback data.

### 1.6 D6 — Production & Product (Produksjon og produkt)

> What to produce, what is the state? (Temporal debt accumulates across days)

| Table                         | Migration      | Status | Notes                                                                       |
| ----------------------------- | -------------- | ------ | --------------------------------------------------------------------------- |
| `schedule_shift`              | 20260301300000 | EXISTS | 14 columns, status: created/assigned/published/active/completed/unpublished |
| `schedule_template`           | 20260301600003 | EXISTS | Reusable shift patterns                                                     |
| `schedule_template_shift`     | 20260301600003 | EXISTS | Shifts within a template                                                    |
| `schedule_open_shift`         | 20260301600003 | EXISTS | Unassigned shifts                                                           |
| `schedule_day_message`        | 20260301600003 | EXISTS | visibility: all_day/until_16/permanent                                      |
| `schedule_day_task`           | 20260301600003 | EXISTS | Ad-hoc daily todos                                                          |
| `schedule_day_booking`        | 20260301600003 | EXISTS | status: confirmed/pending/cancelled                                         |
| `schedule_audit_log`          | 20260301600003 | EXISTS | Row-level audit trail                                                       |
| `department_session`          | 20260304200000 | EXISTS | status: upcoming/active/pending_signoff/closed/missed                       |
| `session_hook`                | 20260412100300 | EXISTS | hook_type: pre_open/open/scheduled/pre_close/close                          |
| `session_task`                | 20260412100300 | EXISTS | Status enum lifecycle, linked to department_session + session_hook          |
| `session_note`                | 20260412100300 | EXISTS | note_type: handoff/closing/general                                          |
| `deviation`                   | 20260304200200 | EXISTS | domain: safety/customer/procedure/system/material                           |
| `shift_approval`              | 20260304200200 | EXISTS | status: pending/approved/edited/disputed                                    |
| `waste_log`                   | 20260407       | EXISTS | Waste tracking by category                                                  |
| `supplier` + `supplier_order` | 20260407       | EXISTS | Vendor management and cost analysis                                         |
| `shift_clock_config`          | 20260422500000 | EXISTS | Per-workspace clock config (GPS required, break rules, supplement rules)    |
| `shift_note`                  | 20260422500100 | EXISTS | Per-shift notes from employees                                              |

**Pure functions:** `computeAnchoredTime()` in `compute-anchored-shift.ts` — DONE. ShiftClock state machine + GPS distance + break classifier + points calculator in `packages/shift-clock/` — DONE (21 tests).
**Edge Function:** `shift-clock-compliance` — GPS fence, rest period, weekly hours validation.
**UI:** Schedule planner, daily close, reconciliation — WORKING. Operations dashboard — WORKING. ShiftClock employee punch (web + mobile) — WORKING. ShiftClock leader overview with realtime — WORKING. Ad-hoc shift creation + open shift claiming — WORKING.

### 1.7 C1 — Observability & Calibration

> What happened vs plan? How to correct?

| Table                  | Migration      | Status | Notes                                                                 |
| ---------------------- | -------------- | ------ | --------------------------------------------------------------------- |
| `daily_reconciliation` | 20260304200100 | EXISTS | status: open/submitted/awaiting_approval/approved/locked/unreconciled |
| `planning_factors`     | 20260421100200 | EXISTS | Planned vs actual comparison                                          |
| `adjustment_factors`   | 20260421100200 | EXISTS | EWMA state for correction loop                                        |

**Pure functions:** NONE. No EWMA calculation, no variance analysis, no correction loop.
**UI:** Reconciliation page — WORKING (read-only). No calibration view, no adjustment UI.

### 1.8 C3 — Commercial & Outcome

> What value was created? What does it cost?

| Table                 | Migration      | Status | Notes                                                         |
| --------------------- | -------------- | ------ | ------------------------------------------------------------- |
| `shift_cost_snapshot` | 20260421100200 | EXISTS | Append-only cost audit. base_rate, supplements, overtime_cost |

**Pure functions:** Cost calculation via `resolveTariffRate()` in cascade lib — tariff → cost snapshot path exists.
**UI:** my-salary (PeriodList + PayslipDetail + BalancesSidebar) — WORKING. Mobile payroll screens (PayrollHome, supplements, payslip detail) — WORKING. No admin cost analysis dashboard.

### 1.9 C4 — Policy & Governance

> What is the system ALLOWED to do?

| Table                     | Migration      | Status | Notes                                                                 |
| ------------------------- | -------------- | ------ | --------------------------------------------------------------------- |
| `change_proposal`         | 20260421100200 | EXISTS | Terraform-style plan/apply. status: pending/approved/rejected/applied |
| `engine_authority_config` | 20260302000100 | EXISTS | Per-workspace capability authority levels (5 levels x 9 capabilities) |

**Pure functions:** `validateProposalFreshness()` in `validate-proposal-freshness.ts` — DONE (state hash computation).
**UI:** NONE. No change proposal viewer, no approval workflow, no policy override editor.

### 1.10 K1a — Industry Knowledge Base (Platform-owned)

> Shared per vertical. Rare mutations (new tariff rates, updated labor law).

| Table                  | Cascade Role | Notes                                       |
| ---------------------- | ------------ | ------------------------------------------- |
| `regulatory_framework` | K1a          | Platform-level when workspace_id IS NULL    |
| `framework_rule`       | K1a          | Platform baseline rules                     |
| `framework_trigger`    | K1a          | Platform baseline triggers                  |
| `tariff_rate_table`    | K1a          | Platform baseline rates (NULL workspace_id) |
| `public_holiday`       | K1a          | Norway 2026 data seeded                     |

**Bootstrap templates:** 13 SQL files in `supabase/templates/restaurant/` — EXISTS but NOT integrated into workspace creation.

### 1.11 K1b — Workspace Knowledge Base (Tenant-isolated)

> Continuously learned. C1 writes here.

| Table                 | Migration      | Status | Notes                                                   |
| --------------------- | -------------- | ------ | ------------------------------------------------------- |
| `workspace_doc_chunk` | 20260306170000 | EXISTS | pgvector semantic search. RPC: `match_workspace_docs()` |
| `engine_memory`       | 20260302000000 | EXISTS | Persistent pgvector memories per profile                |
| `handbook_chapter`    | 20260306120000 | EXISTS | Tiptap JSONB per workspace x chapter_key. 10 chapters   |

**RAG pipeline:** DONE. `ingest-workspace-knowledge` Edge Function chunks handbook, policy, protocol → embeds via OpenRouter → upserts to `workspace_doc_chunk`. Triggered on Setup wizard completion.
**UI:** Handbook editor — WORKING. Semantic search — NONE.

### 1.12 Governance Content Layer (Cross-dimensional)

Content definitions consumed by D6 production and the Event Engine.

| Table                       | Migration      | Status | Notes                                                          |
| --------------------------- | -------------- | ------ | -------------------------------------------------------------- |
| `policy`                    | 00003          | EXISTS | type: operational/haccp/hr/safety/access/payroll/custom        |
| `protocol`                  | 00003          | EXISTS | status: draft/active/deprecated                                |
| `procedure`                 | 00003          | EXISTS | type: standard/onboarding/safety/maintenance/custom            |
| `procedure_step`            | 00003          | EXISTS | step_order, title, description, is_required, estimated_minutes |
| `control_list`              | 00003          | EXISTS |                                                                |
| `routine`                   | 00003          | EXISTS |                                                                |
| `runbook` + `runbook_step`  | 00003          | EXISTS |                                                                |
| `knowledge_test`            | 00003          | EXISTS | Questions/answers definition                                   |
| `confirmation`              | 00003          | EXISTS | Sign-off template definition                                   |
| `protocol_assignment`       | 00003          | EXISTS | protocol_id + profile_id + status (pending/completed/expired)  |
| `knowledge_test_attempt`    | 20260412100200 | EXISTS | Quiz score, answers, pass/fail per attempt                     |
| `confirmation_signature`    | 20260412100200 | EXISTS | Sign-off record with signature_data JSONB                      |
| `procedure_step_completion` | 20260412100200 | EXISTS | Per-step progress per employee per protocol_assignment         |

**Readiness score:** Computed from real DB queries in `use-protocol-journey.ts`. Training module functional.

### 1.13 Event Engine (Workflow Runtime)

Cascade is a PRODUCER of events; Event Engine is the CONSUMER.

| Table                    | Migration      | Status | Notes                                                        |
| ------------------------ | -------------- | ------ | ------------------------------------------------------------ |
| `engine_missions`        | 20260301200000 | EXISTS | AI mission templates (sequential/free/hybrid)                |
| `engine_stages`          | 20260301200000 | EXISTS | Steps within AI missions                                     |
| `engine_sessions`        | 20260301200000 | EXISTS | Active AI sessions. mode: mission/agent                      |
| `engine_inbox`           | 20260301200000 | EXISTS | Generic data collection per session                          |
| `engine_process`         | 20260304100000 | EXISTS | Workflow templates. TEXT PK                                  |
| `engine_step`            | 20260304100000 | EXISTS | Steps within a process. action_type + action_payload         |
| `engine_trigger`         | 20260304100000 | EXISTS | Event-to-process matching rules                              |
| `engine_event`           | 20260304100000 | EXISTS | Immutable event log. Idempotency support                     |
| `engine_state`           | 20260304100000 | EXISTS | Running process instances. workspace_id nullable             |
| `engine_delayed_trigger` | 20260304100000 | EXISTS | Timer queue for delayed triggers                             |
| `engine_state_step`      | 20260412100100 | EXISTS | Per-step completion tracking. Cascading RLS via engine_state |

### 1.14 Other Tables

| Table                                                | Migration | Notes                            |
| ---------------------------------------------------- | --------- | -------------------------------- |
| `chat_conversation` + `chat_message` + `chat_member` | 20260320  | Real-time chat system            |
| `service_config` + `service_health_log`              | 20260407  | Infrastructure monitoring        |
| `document_extraction_log`                            | 20260416  | AI document analysis persistence |

---

## 2. Views — Working vs Placeholder

### 2.1 Admin Views (Operation View / Drift)

| View       | Component            | Route              | Cascade | Status  | Data Source                                                                     |
| ---------- | -------------------- | ------------------ | ------- | ------- | ------------------------------------------------------------------------------- |
| Taktisk    | `TacticalView`       | `/dashboard` (tab) | D6      | WORKING | Weekly shifts, coverage stats, leader pulse, deviation alerts, guardian signals |
| Strategisk | `StrategicView`      | `/dashboard` (tab) | C1/C3   | WORKING | KPI cards, revenue targets, labor %, location comparison                        |
| Avstemming | `ReconciliationView` | `/dashboard` (tab) | C1      | WORKING | daily_reconciliation, shift_approval, deviation                                 |
| Aktivitet  | `ActivityView`       | `/dashboard` (tab) | —       | WORKING | activity_trail events                                                           |
| Vakt       | `GuardianView`       | `/dashboard` (tab) | C4      | WORKING | 13 guardian components, real-time session monitoring                            |

### 2.2 Focus Pages (Admin)

| Page             | Route                       | Cascade | Status  | Notes                                                                                                                                                                                                     |
| ---------------- | --------------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule Planner | `/dashboard/schedule`       | D6      | WORKING | Full week/day/month views, DnD shifts, Day Control Panel, publish workflow, Realtime on 6 tables, ad-hoc shift creation, open shift claiming                                                              |
| People           | `/dashboard/people`         | D2      | WORKING | DataTable, invite status, employee cards, row actions                                                                                                                                                     |
| Reports          | `/dashboard/reports`        | C1/C3   | WORKING | ReportsPageShell, AI chat panel, saved reports, deep insights                                                                                                                                             |
| Kommunikasjon    | `/dashboard/komm`           | C2      | WORKING | KommShell: chat, DMs, voice (LiveKit). Migrated from /chat (ADR-0063)                                                                                                                                     |
| HMS              | `/dashboard/hms`            | C4      | WORKING | GovernanceOverview + full CRUD: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm. Real readiness scores                                                                 |
| Operations       | `/dashboard/operations`     | D6      | WORKING | Live stress-level dashboard: 4 metric cards, queries department_session + session_task + schedule_shift + deviation. Auto-refresh 60s                                                                     |
| Daily Close      | `/dashboard/close`          | D6/C1   | WORKING | CloseOutFlow, checklist, gatekeeper, image upload, settlement validation                                                                                                                                  |
| Reconciliation   | `/dashboard/reconciliation` | C1      | WORKING | DayList, DayApproval, ShiftApproval, Revenue, Deviation sections                                                                                                                                          |
| Season           | `/dashboard/season`         | D4      | WORKING | 4 tabs: overview, budget, day-factors, hour-factors                                                                                                                                                       |
| Organization     | `/dashboard/organization`   | D1      | WORKING | Department/location/team/position list, CRUD dialogs                                                                                                                                                      |
| Settings         | `/dashboard/settings`       | D1      | PARTIAL | 16 tabs, 5 sections. 11 working (hours, payroll, supplements, meals, shifts, breaks, working time, holidays, framework, tariffs, proposals). 5 placeholder (general, KPI, notifications, teams, security) |
| AI               | `/dashboard/ai`             | C2      | WORKING | Full Mr. Botsson interface                                                                                                                                                                                |

### 2.3 Document View (Handbok)

| Component                | Cascade | Status  | Notes                                                                           |
| ------------------------ | ------- | ------- | ------------------------------------------------------------------------------- |
| DocumentModeShell        | K1b     | WORKING | Full layout with canvas + panel                                                 |
| DocumentModeCanvas       | K1b     | WORKING | Tiptap editor, loads/saves from handbook_chapter                                |
| DocumentModeSidebar      | K1b     | WORKING | 10 fixed chapter navigation                                                     |
| DocumentModeToolbar      | K1b     | WORKING | Formatting toolbar                                                              |
| DocumentModePanel        | K1b     | WORKING | 3 tabs: tools, actions, settings                                                |
| Employee handbook reader | K1b     | WORKING | ChapterReader at /dashboard/handbook — read-only Tiptap render with chapter nav |
| Handbook-to-RAG pipeline | K1b     | DONE    | `ingest-workspace-knowledge` EF: chunk → embed → workspace_doc_chunk            |

### 2.4 Employee Views (My View / Arbeidsrom)

| Page           | Route                             | Cascade | Status      | Notes                                                                                       |
| -------------- | --------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------- |
| Oversikt       | `/dashboard` (employee mode)      | D6      | WORKING     | EmployeeDashboard: today's shift, upcoming shifts, readiness score, open shifts to claim    |
| Min vaktplan   | `/dashboard/my-schedule`          | D6      | WORKING     | MyWeekView — published shifts for current profile, week navigation                          |
| Min opplaering | `/dashboard/my-training`          | —       | WORKING     | ProtocolList, ProcedureStepper, KnowledgeTestView, ConfirmationSign — real progress data    |
| Min profil     | `/dashboard/my-cv`                | D2      | PLACEHOLDER | "Under construction" shell                                                                  |
| Min lonn       | `/dashboard/my-salary`            | C3      | WORKING     | PeriodList + PayslipDetail + BalancesSidebar, queries payroll tables                        |
| Hjelp          | `/dashboard/help`                 | —       | PLACEHOLDER | Stub "under construction". No sidebar link. Candidate for deletion                          |
| Onb. assistant | `/dashboard/onboarding-assistant` | I1      | EXISTS      | Onboarding assistant page                                                                   |
| ShiftClock     | `/dashboard/shift-clock`          | D6      | WORKING     | Full punch clock: GPS fence, break tracking, supplements, chat, notes, points. Web + mobile |
| ShiftClock (L) | `/dashboard/shift-clock/leader`   | D6      | WORKING     | Leader overview: realtime employee status, active shifts, compliance alerts                 |

### 2.5 Hidden Pages (no sidebar link, accessible via deep navigation)

| Route                       | Accessible via             | Status  | Notes                                     |
| --------------------------- | -------------------------- | ------- | ----------------------------------------- |
| `/dashboard/close`          | Botsson voice tools        | WORKING | CloseOutFlow, checklist, image upload     |
| `/dashboard/handbook`       | Botsson voice tools        | WORKING | ChapterReader — employee handbook         |
| `/dashboard/notifications`  | NotificationBell component | WORKING | Notification center                       |
| `/dashboard/reconciliation` | DailyStatusBar widget      | WORKING | Full reconciliation dashboard             |
| `/dashboard/governance`     | Direct URL only            | DEAD    | Pure redirect to `/dashboard/hms`. Delete |

### 2.6 Orphaned Components (never imported, candidate for deletion)

| Component                   | Location                                  | Notes                                 |
| --------------------------- | ----------------------------------------- | ------------------------------------- |
| `SwipeReconciliation.tsx`   | `apps/web/src/components/dashboard/`      | Replaced by ReconciliationDashboard   |
| `agent-card.tsx`            | `apps/web/src/components/`                | Never imported                        |
| `trial-banner.tsx`          | `apps/web/src/components/`                | Never imported                        |
| `workspace-list-client.tsx` | `apps/web/src/components/platform-admin/` | Never imported                        |
| `variant-badge.tsx`         | `apps/landing/src/components/`            | Dev/test variant selector, never used |

---

## 3. The 10 Gaps — Status After Module Zero

> All 10 gaps identified 2026-03-08 have been addressed by `feat/zero-to-production` (30+ commits).
> Full audit performed 2026-03-08. Typecheck 19/19 GREEN. Wizard redesign + 8 E2E tests added 2026-03-08.

| Gap | Description                          | Status      | Resolution                                                                                                    |
| --- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | No Event Emission                    | **CLOSED**  | emit() wired into all TanStack Query mutations. engine_event as 4th telemetry destination                     |
| 2   | Two Disconnected Event Systems       | **CLOSED**  | engine-event provider calls engine-dispatch. Registry-driven event routing is canonical. Client relay via API |
| 3   | No Completion Tracking               | **CLOSED**  | 3 tables created (knowledge_test_attempt, confirmation_signature, procedure_step_completion)                  |
| 4   | No Per-Step Instance Tracking        | **CLOSED**  | engine_state_step table with cascading RLS. 13 action handlers in engine-dispatch                             |
| 5   | Schedule -> Operations Disconnect    | **PARTIAL** | upsert_session handler exists. Emit on shift publish wired. End-to-end flow not yet tested                    |
| 6   | Invite -> Trainee Dead End           | **CLOSED**  | Complete invite journey: multi-channel, mobile accept, welcome page, profile_status = trainee                 |
| 7   | Employee Pages Are Shells            | **CLOSED**  | my-schedule (MyWeekView), my-training (4 components), handbook (ChapterReader) all built                      |
| 8   | Document Mode Has No Reader          | **CLOSED**  | Employee handbook reader built. RAG pipeline DONE: `ingest-workspace-knowledge` EF chunks → embeds → upserts  |
| 9   | Governance Has No CRUD               | **CLOSED**  | 5 forms: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm                   |
| 10  | No Session Hooks / Operational Tasks | **CLOSED**  | 3 tables + 3 enums created. Hook dispatcher process seeded. Engine action handlers ready                      |

### Known Remaining Gaps (audited 2026-03-27)

| Area                       | Gap                                                                                                                                                                                                                                                                                                                                                                                                                 | Cascade | Priority | Status  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- | ------- |
| Notifications              | `send_notification` is implemented in `engine-dispatch` and inserts into `notification_outbox`. Remaining gap: downstream delivery workers/channel adapters and observability hardening (`docs/superpowers/specs/2026-03-24-notification-system-design.md`)                                                                                                                                                         | —       | High     | PARTIAL |
| Handbook -> RAG            | EF exists (`ingest-workspace-knowledge`). Auto-trigger on chapter save not yet wired                                                                                                                                                                                                                                                                                                                                | K1b     | Medium   | PARTIAL |
| Invite -> Onboarding       | Complete invite journey merged (multi-channel, mobile accept, welcome page)                                                                                                                                                                                                                                                                                                                                         | D2      | High     | DONE    |
| Shift Publish -> Session   | End-to-end flow untested (emit -> trigger -> upsert_session -> hooks)                                                                                                                                                                                                                                                                                                                                               | D6      | High     | OPEN    |
| Shift temporal lock        | DB-canonical lock + reason-coded errors + rollout modes (`enforce/shadow/off`) + audit trail + workspace-api/UI policy control shipped. High-access override in enforce mode is audited. Platform-admin alerts active on health + dashboard. Rollout protocol: `docs/protocols/SHIFT_LOCK_ROLLOUT.md`. Ops SQL pack: `docs/protocols/SHIFT_LOCK_OPS_QUERIES.md`. Remaining: DST/timezone edge-case matrix hardening | D6/C4   | High     | PARTIAL |
| PolicyForm scope picker    | Department picker doesn't appear when "department" scope selected                                                                                                                                                                                                                                                                                                                                                   | C4      | Low      | OPEN    |
| Wizard mobile              | Unified wizard shell merged (ADR-0060), Join wizard migrated                                                                                                                                                                                                                                                                                                                                                        | I1      | Low      | DONE    |
| my-schedule realtime       | No Realtime subscription on employee shift view                                                                                                                                                                                                                                                                                                                                                                     | D6      | Low      | OPEN    |
| Invite dialog departments  | Fixed in `feat/staff-handling-complete`                                                                                                                                                                                                                                                                                                                                                                             | D2      | Low      | DONE    |
| Trainee first-day redirect | No redirect to my-training after invite accept                                                                                                                                                                                                                                                                                                                                                                      | D2      | Medium   | OPEN    |
| Operations dashboard UI    | Full live dashboard with stress metrics, 4 cards, auto-refresh 60s                                                                                                                                                                                                                                                                                                                                                  | D6      | High     | DONE    |
| Login/Join redirect        | Join flow tokens + setup-flow-redesign merged                                                                                                                                                                                                                                                                                                                                                                       | —       | Medium   | DONE    |
| Agent chat UI              | `feat/emma-arena-views` (wt-3) — spec done, settings persistence done, implementation not started                                                                                                                                                                                                                                                                                                                   | C2      | Medium   | PARKED  |
| Settings module            | 13/16 tabs working. Missing: general, KPI, teams                                                                                                                                                                                                                                                                                                                                                                    | D1      | Medium   | PARTIAL |
| Agent authority defaults   | Unified default fallback to `read_only` across Stage Engine and Botsson mission runner routers                                                                                                                                                                                                                                                                                                                      | C4      | High     | DONE    |
| Employee agent access      | Employees can't interact with agents from /my-schedule or /my-training                                                                                                                                                                                                                                                                                                                                              | C2      | Low      | OPEN    |
| ShiftClock (web+mobile)    | Full punch clock with GPS, breaks, supplements, leader view, compliance EF                                                                                                                                                                                                                                                                                                                                          | D6      | High     | DONE    |
| Unified Wizard Shell       | WizardShell component, Join wizard migrated, ADR-0060 + ADR-0061                                                                                                                                                                                                                                                                                                                                                    | I1      | Medium   | DONE    |
| Mobile payroll screens     | PayrollHome, supplements, payslip detail screens built                                                                                                                                                                                                                                                                                                                                                              | C3      | Medium   | DONE    |
| Dead UI components         | 5 orphaned components never imported + 2 dead pages (help, governance redirect). Audit 2026-03-28                                                                                                                                                                                                                                                                                                                   | —       | Low      | OPEN    |
| Payroll schema             | 23 tables migrated to `payroll` schema. Migration ordering fixed (department_shift_type_config). Validated via db reset                                                                                                                                                                                                                                                                                             | D3/C3   | —        | DONE    |
| Stale branches             | 12 remote branches deleted 2026-03-28. 3 local branches parked (emma-arena, sjohuset, onboarding)                                                                                                                                                                                                                                                                                                                   | —       | —        | DONE    |

---

## 4. Architecture Decisions

### 4.1 Event Engine as Universal Workflow Runtime

**Decision:** The Event Engine (`engine_process` + `engine_step` + `engine_state` + `engine_trigger` + `engine_event`) serves as the universal workflow runtime for orchestrated workflows, but not for the independent cascade proposal pipeline:

| Process            | entity_type         | Trigger event                      | Steps                                                                | Status         |
| ------------------ | ------------------- | ---------------------------------- | -------------------------------------------------------------------- | -------------- |
| Signup Onboarding  | user_identity       | signup.completed                   | 8 wait (onboarding sections) + match_state (workspace) + notify      | **E2E PROVEN** |
| Workspace Setup    | workspace           | workspace.created                  | 9 wait (wizard steps)                                                | **E2E PROVEN** |
| Daily Close        | department_session  | session.pending_signoff            | 10 seeded steps (assign_task, validate_settlement, etc.)             | Seeded         |
| Onboarding Journey | profile             | invitation.accepted                | Present content, administer test, collect signature, check readiness | Seeded         |
| Training Protocol  | protocol_assignment | protocol.assigned                  | Per-procedure steps, knowledge tests, confirmations                  | Seeded         |
| HACCP Daily        | department_session  | session_hook.pre_open              | CCP verification, temperature logging, deviation handling            | Planned        |
| Session Hooks      | department_session  | session.opened / session.pre_close | Trigger routine tasks at specific times                              | Seeded         |

**Rationale:** Architecture is generic — `action_type` + `action_payload` is extensible. New workflow types only need new action_type handlers. Cascade remains separate because preview/apply, freshness checks, and framework gating are different lifecycle semantics.

### 4.2 Telemetry as Single Event Emitter

**Decision:** `@smartout/telemetry` `emit()` is the single entry point for all domain events. Four destinations: PostHog (analytics), Logger (stdout), activity_trail (audit), engine_event (workflow automation).

**Cascade relationship:** `apply_cascade()` emits domain events via `emit()` which flow through `engine_dispatch`. Cascade is the producer; Event Engine is the consumer.

### 4.3 Separate session_task from schedule_day_task

**Decision:** `schedule_day_task` (ad-hoc manager todos, D6) and `session_task` (hook-triggered compliance, D6/C4) are separate tables with different purposes, lifecycles, and access patterns.

### 4.4 Completion Tracking Tables (Not Engine-Only)

**Decision:** Dedicated tables (`knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion`) for permanent records that survive beyond process lifetime. `engine_state_step` tracks process instance progress; completion tables track audit-grade evidence.

### 4.5 Cascade Core Foundation — Independent Layer

**Decision:** Cascade Core Foundation spec complete. Canonical model: I1 + 6D + 4C + K1a/K1b.

**Implementation status:**

- Phase A (schema): **DONE** — 7 migrations committed (A1 extensions, enums, domain tables, alter existing + A2 enums, framework tables, cleanup markers)
- Phase B (pure functions): **DONE** — 9 functions, 8 test files in `apps/web/src/lib/cascade/`
- Phase C (bootstrap): **PARTIAL** — bootstrap-cascade EF wired into finalize-workspace. Framework seed still missing
- Phase D (adapters): **NOT STARTED**

**Cascade <-> Event Engine:** Cascade operates as an independent service layer. It does NOT run inside `engine_process`/`engine_state`. On successful apply, `apply_cascade()` emits domain events via `emit()`.

**Note:** `ADR-DRAFT-core-hierarchy-cascade.md` still contains unresolved hierarchy notes, but the canonical schema decision is `ADR-0056` (accepted). Treat the draft as follow-up clarification work, not as a blocker to the accepted cascade boundary.

---

## 5. Cascade Build Order

> Replaces the completed Module Zero plan. Organized by cascade delivery phase.
> Each item shows current status and what blocks it.

### Phase A — Schema (DONE)

All cascade tables, enums, and RLS policies are committed.

| Migration           | Content                                                                                                                                                                                                                                   | Status |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1 extensions       | btree_gist for EXCLUDE USING gist                                                                                                                                                                                                         | DONE   |
| A1 enums            | 10 domain enums (department_type, shift_function, anchor_type, etc.)                                                                                                                                                                      | DONE   |
| A1 domain tables    | 11 tables: employee_payroll_profile, department_operating_hours, department_hours_override, planning_cycle, planning_event, planning_factors, adjustment_factors, shift_cost_snapshot, change_proposal, tariff_rate_table, public_holiday | DONE   |
| A1 alter existing   | New fields on 7 existing tables (department, profile, schedule_shift, etc.)                                                                                                                                                               | DONE   |
| A2 enums            | 6 framework enums                                                                                                                                                                                                                         | DONE   |
| A2 framework tables | 6 tables: regulatory_framework, framework_rule, framework_trigger, workspace_framework_binding, workspace_rule_override, workspace_trigger_override                                                                                       | DONE   |
| A2 cleanup markers  | Legacy truth source annotations                                                                                                                                                                                                           | DONE   |

**VALIDATED:** All migrations run via `supabase db reset` (2026-03-28). Payroll schema migration reordered (department_shift_type_config moved to 20260422110750).

### Phase B — Pure Functions (DONE)

Location: `apps/web/src/lib/cascade/` — 11 files, 8 test files

| Function                      | Dimension | Status | Notes                                                             |
| ----------------------------- | --------- | ------ | ----------------------------------------------------------------- |
| `resolveEffectiveHours()`     | D1        | DONE   | Midnight-crossing, priority: override > season > default > closed |
| `computeAnchoredTime()`       | D6        | DONE   | Shift anchor computation. Tested                                  |
| `evaluateFrameworkRules()`    | D3        | DONE   | Full D3 rule evaluation with enforcement levels. Tested           |
| `validateProposalFreshness()` | C4        | DONE   | State hash computation. Tested                                    |
| `resolveTariffRate()`         | D3/C3     | DONE   | Tariff resolution with seniority, fagbrev, overtime. Tested       |
| `buildEntityContext()`        | C2        | DONE   | Entity context loader. Tested                                     |
| `computeProposalPreview()`    | C4        | DONE   | Change proposal preview. Tested                                   |
| `propagateBudgetTargets()`    | D4        | DONE   | Budget target propagation. Tested                                 |
| `getTariffContext()`          | D3        | DONE   | DB query helper for tariff resolution                             |

### Phase C — Bootstrap & I1 Integration (MOSTLY DONE)

| Item                                                                               | Status | Blocker                                                                      |
| ---------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Hospitality docs package (AI council, policies, niche profiles, role capabilities) | DRAFT  | Content incomplete — all docs still draft status                             |
| 13 SQL bootstrap templates (`supabase/templates/restaurant/`)                      | EXISTS | Integrated via bootstrap-cascade EF                                          |
| `_apply.sql` orchestrator                                                          | EXISTS | Called via `bootstrap-cascade` EF during workspace creation                  |
| `hospitality.ts` industry package                                                  | EXISTS | Corrected fallback package (tier 3). Runtime tariff resolution is DB-first   |
| Workspace creation calls I1 bootstrap                                              | DONE   | `finalize-workspace` calls `bootstrap-cascade` EF. Errors surfaced to caller |
| Framework seed (hospitality.no.default.v1)                                         | DONE   | Migration 20260424100000: regulatory_framework + rules + triggers + tariff   |
| Public holiday seed                                                                | DONE   | Norway 2026 data in migration 20260422200000                                 |
| Operating hours backfill from legacy                                               | DONE   | Migration 20260422100000                                                     |

### Phase D — Adapters & External Integration (NOT STARTED)

| Item                           | Status      | Notes                                        |
| ------------------------------ | ----------- | -------------------------------------------- |
| Tripletex payroll sync adapter | NOT STARTED | Needs tariff resolution RPC first            |
| External ERP adapter spine     | NOT STARTED | Contracts defined in spec, no implementation |
| External calendar sync         | NOT STARTED |                                              |

### Phase E — Control Plane Behavior (NOT STARTED)

| Item                                  | Plane | Status      | Notes                                                        |
| ------------------------------------- | ----- | ----------- | ------------------------------------------------------------ |
| EWMA calibration runner               | C1    | NOT STARTED | daily_reconciliation -> adjustment_factors update            |
| Variance analysis + correction loop   | C1    | NOT STARTED | Compares planned vs actual, triggers adjustments             |
| Context synthesis (relevance scoring) | C2    | NOT STARTED | semantic search on workspace_doc_chunk + engine_memory       |
| Explanation generation                | C2    | NOT STARTED | Natural language context for manager decisions               |
| Cost calculation pipeline             | C3    | NOT STARTED | shift -> tariff_rate_table resolution -> shift_cost_snapshot |
| Commercial reporting                  | C3    | NOT STARTED | Cost attribution, revenue tracking                           |
| Change proposal lifecycle             | C4    | NOT STARTED | Create, preview, approve/reject, apply mutations             |
| Framework evaluation pipeline         | C4    | NOT STARTED | Trigger dispatch -> rule evaluation -> outcome               |
| Policy audit trail                    | C4    | NOT STARTED | Logging all evaluations with reasons                         |

### Phase F — Missing RPCs & Services

| RPC / Service                                             | Dimension | Status  | Notes                                                       |
| --------------------------------------------------------- | --------- | ------- | ----------------------------------------------------------- |
| `resolve_tariff_rate(profile_id, date)`                   | D3/C3     | DONE    | `resolveTariffRate()` + `getTariffContext()` in cascade lib |
| `get_cascade_context(workspace_id, date)`                 | C2        | PARTIAL | `buildEntityContext()` exists, full cascade context TBD     |
| `apply_change_proposal(proposal_id)`                      | C4        | PARTIAL | `computeProposalPreview()` done, apply mutation TBD         |
| `compute_daily_budget_targets(season_id, date)`           | D4        | DONE    | `propagateBudgetTargets()` in cascade lib                   |
| `evaluate_framework_rules(workspace_id, trigger, entity)` | D3/C4     | DONE    | `evaluateFrameworkRules()` in cascade lib                   |
| Cascade bootstrap service                                 | I1        | DONE    | `bootstrap-cascade` EF called by `finalize-workspace`       |

### Build Priority (Recommended Order)

**Priority 1 — Blocking product features:**

1. ~~Validate A1+A2 migrations via `supabase db reset`~~ — DONE
2. ~~Integrate I1 bootstrap into workspace creation~~ — DONE (`finalize-workspace` → `bootstrap-cascade`)
3. Validate and enforce DB-first tariff resolution path (`tariff_rate_table`) across runtime flows
4. ~~Seed hospitality.no.default.v1 framework~~ — DONE (migration 20260424100000)
5. ~~Complete `evaluateFrameworkRules()`~~ — DONE (full D3 evaluation with enforcement levels)

**Priority 2 — Unlocks scheduling + payroll:**

6. Build `resolve_tariff_rate()` RPC
7. Build cost calculation pipeline (shift -> tariff -> shift_cost_snapshot)
8. Build change_proposal lifecycle (create, preview, apply)
9. Build D4 demand propagation (season_budget -> daily targets)
10. Build D2 resource availability resolver

**Priority 3 — Unlocks intelligence layer:**

11. C1 calibration runner (EWMA + correction loop)
12. C2 context synthesis (semantic search + explanation)
13. C3 commercial reporting
14. C4 framework evaluation pipeline with audit trail
15. Handbook -> RAG chunking pipeline (K1b)

---

## 6. Migration Inventory

### Sequential (00001-00013)

| Number | Name                       | Content                                                                                                                                      |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 00001  | identity_tables            | user_identity, company, company_member, workspace, profile                                                                                   |
| 00002  | structure_tables           | department, location, zone, team, season, position                                                                                           |
| 00003  | governance_tables          | policy, protocol, procedure, procedure_step, control_list, routine, runbook, runbook_step, knowledge_test, confirmation, protocol_assignment |
| 00004  | rls_policies               | RLS on identity + structure tables                                                                                                           |
| 00005  | activity_trail             | Audit log table                                                                                                                              |
| 00006  | notification_engine        | Notification queue                                                                                                                           |
| 00007  | onboarding_rpc             | Onboarding RPCs                                                                                                                              |
| 00008  | company_scraped_data       | Web scraping storage                                                                                                                         |
| 00009  | onboarding_v3              | Onboarding session persistence                                                                                                               |
| 00010  | org_structure_updates      | Asset types, structure refinements                                                                                                           |
| 00011  | employee_invitations       | Invitation table + invite_status enum                                                                                                        |
| 00012  | profile_logs_and_contracts | Employment contracts, communication tables                                                                                                   |
| 00013  | platform_admin_tables      | Platform admin infrastructure                                                                                                                |

### Cascade Core Foundation (A1 + A2)

| Migration                                        | Phase | Content                                         |
| ------------------------------------------------ | ----- | ----------------------------------------------- |
| `20260421100000_cascade_a1_extensions.sql`       | A1    | Enable btree_gist for EXCLUDE USING gist        |
| `20260421100100_cascade_a1_enums.sql`            | A1    | 10 domain enums                                 |
| `20260421100200_cascade_a1_domain_tables.sql`    | A1    | 11 domain tables with RLS                       |
| `20260421100300_cascade_a1_alter_existing.sql`   | A1    | New fields on 7 existing tables                 |
| `20260421200000_cascade_a2_enums.sql`            | A2    | 6 framework enums                               |
| `20260421200100_cascade_a2_framework_tables.sql` | A2    | 6 framework tables + change_proposal FK upgrade |
| `20260421210000_cascade_cleanup_markers.sql`     | A2    | Legacy truth source annotations                 |

**Status:** Migration files committed. Additional framework seed in `20260424100000`. Not yet validated via `supabase db reset`.

### ShiftClock Feature Migrations

| Migration                                           | Purpose                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `20260422500000_shift_clock_config.sql`             | D6: Per-workspace shift clock configuration |
| `20260422500100_shift_note.sql`                     | D6: Per-shift employee notes                |
| `20260422500200_alter_time_entry_gps.sql`           | D6: GPS columns on time entries             |
| `20260422500300_alter_schedule_shift_adhoc.sql`     | D6: Ad-hoc shift support on schedule_shift  |
| `20260422500400_alter_manual_supplement_claims.sql` | D6: Manual supplement claim columns         |

### Latest Timestamped (post-April 2026)

| Migration                                            | Purpose                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `20260424200000_shift_clock_cascade_fixes.sql`       | D6: ShiftClock cascade alignment fixes                                    |
| `20260424100000_seed_hospitality_framework.sql`      | K1a: Seed hospitality.no.default.v1 framework (rules + triggers + tariff) |
| `20260422200000_seed_norway_public_holidays.sql`     | K1a: Norway 2026 public holiday data                                      |
| `20260422100000_backfill_department_hours.sql`       | D1: Backfill from legacy operating_hours                                  |
| `20260416200000_season_opening_hours.sql`            | Season opening hours per department                                       |
| `20260416100000_document_extraction_logs.sql`        | AI document analysis persistence                                          |
| `20260415200000_setup_documents_storage_policy.sql`  | Storage bucket policy for setup docs                                      |
| `20260415100000_add_onboarding_guide_progress.sql`   | Onboarding guide progress tracking                                        |
| `20260413100000_fix_company_org_number_nullable.sql` | Allow nullable org_number for new companies                               |

### Enum Count

**124 custom enums** (72 original + 16 Cascade + 36 from shift-clock, HMS, channels, sessions, etc.). Notable additions:

- Cascade A1: `department_type`, `shift_function`, `anchor_type`, `change_proposal_status`, `planning_event_category`, `planning_event_source`, `planning_cycle_status`, `cascade_initiator`, `tariff_source`, `evaluation_outcome`
- Cascade A2: `framework_trigger_type`, `framework_rule_type`, `framework_trigger_mode`, `external_provider`, `sync_direction`, `sync_status`
- Session: `session_hook_type`, `session_task_status`, `session_note_type`
- Other: `chat_conversation_type`, `waste_category`, `service_status`, `service_type`

---

## 7. Telemetry System — Current State

### Package: `@smartout/telemetry`

**Control-gate note:** Telemetry code is the source of truth. For exact event names,
routing, and implemented destinations, verify `packages/telemetry/src/registry.ts`
and `packages/telemetry/src/emit.ts` before trusting summary counts below.

| File                          | Purpose                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `registry.ts`                 | SmartoutEvent registry, BaseEvent shape, EVENT_ROUTING map               |
| `emit.ts`                     | Router: checks routing config and dispatches implemented providers       |
| `providers/posthog-client.ts` | PostHog browser-safe adapter (split from posthog.ts)                     |
| `providers/posthog.ts`        | PostHog server-only adapter (loaded via dynamic import)                  |
| `providers/logger.ts`         | Structured stdout logging (server-only, dynamic import)                  |
| `providers/activity-trail.ts` | Writes to `activity_trail` table (server-only, dynamic import)           |
| `providers/engine-event.ts`   | Calls engine-dispatch Edge Function (dual: server direct / client relay) |
| `hooks/use-track.ts`          | React hook for client-side tracking                                      |
| `react.ts`                    | React bindings                                                           |

### Destinations (implemented: 4)

| Destination      | Transport                                  | Purpose             |
| ---------------- | ------------------------------------------ | ------------------- |
| `posthog`        | PostHog EU (browser SDK or posthog-node)   | Analytics           |
| `logger`         | Structured stdout (server-only)            | Debugging           |
| `activity_trail` | INSERT to activity_trail table             | Audit               |
| `engine_event`   | POST to engine-dispatch EF (or /api relay) | Workflow automation |

**Declared but not fully implemented in `emit.ts`:** `notifications` exists in the
telemetry destination type system and routing metadata, but it is not yet a live
delivery branch in `emit.ts`.

### Registered Events

The registry has grown well beyond the original starter event set. Do not rely on
older fixed event counts here; inspect `packages/telemetry/src/registry.ts` for the
current authoritative set.

Coverage now spans auth, onboarding, org structure, scheduling, contracts,
operations, HACCP, training, communication, system, navigation, channels, and
website-related domains.

### Usage

`emit()` wired into 15 files across wizard-steps and TanStack Query hooks via `onSuccess`. Client events relay through `/api/telemetry` API route (Zod-validated, rate-limited, actor_id enforced). Server-side calls engine-dispatch EF directly via `supabase.functions.invoke()`.

---

## 8. Cascade Implementation Summary

| Layer                    | Status      | %        | Next Action                                                                |
| ------------------------ | ----------- | -------- | -------------------------------------------------------------------------- |
| Schema (Phase A)         | DONE        | 100%     | Validate via `supabase db reset`                                           |
| Pure Functions (Phase B) | DONE        | 100%     | 9 functions, 8 test files in cascade lib                                   |
| Bootstrap (Phase C)      | MOSTLY DONE | 85%      | Framework seeded. Remaining: keep DB-first tariff path hardened in runtime |
| Service Logic (Phase D)  | MINIMAL     | 10%      | Build tariff RPC + change proposal lifecycle                               |
| Control Planes (Phase E) | NOT STARTED | 0%       | C4 governance first (change proposals)                                     |
| UI (Cascade-specific)    | PARTIAL     | 30%      | Season + reconciliation working, governance/cost missing                   |
| **Overall**              |             | **~55%** |                                                                            |

**Single most important next step:** Add end-to-end verification for shift publish -> engine dispatch -> upsert_session -> hooks/tasks, then build change proposal lifecycle (C4).

---

## 9. Known Environment Quirks

Things that work on Pontus's machine but require manual setup or workarounds on a fresh clone.

### vercel-plugin/ai-sdk validator false-positive on `generateObject`

The Claude Code `vercel-plugin/ai-sdk` PostToolUse validator falsely claims `generateObject was removed in AI SDK v6` and blocks Edit/Write on any file mentioning the function. Verified empirically wrong (function exists at `node_modules/.pnpm/ai@6.0.103/dist/index.d.ts:5158`, exported at line 6383, `NoObjectGeneratedError` class also present). Vercel's own `common-errors.md:73` says "deprecated", not removed.

**Workaround**: run `node scripts/patch-vercel-plugin-ai-sdk.mjs` to idempotently downgrade the rule severity (`error` → `recommended`) and correct the message text in all affected plugin cache files. The rule lives in 10 files across 4 plugin installations, including the `generated/skill-manifest.json` files which are what the validator actually loads at runtime.

**When to re-run**: after any Claude Code plugin auto-update (cache files get rewritten), or if the validator suddenly starts producing the false-positive error.

**Long-term fix**: file an upstream PR against `vercel/vercel-plugin` to land the correction once and for all. Tracked in `docs/decisions/0073-ai-eval-harness.md` (hook addendum).
