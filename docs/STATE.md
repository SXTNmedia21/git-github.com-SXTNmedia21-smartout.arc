---
title: "STATE — System State of Truth"
status: canonical
updated: 2026-03-22
created: 2026-03-08
last-verified: 2026-03-22
module: all
tags: [state, audit, gaps, architecture, cascade]
---

# STATE — System State of Truth

> Single source of truth for what exists, what's missing, and what to build next.
> Organized by the Cascade Core canonical model: **I1 + 6D + 4C + K1a/K1b**.
> Updated weekly. Last audit: 2026-03-22.
> Canonical spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

---

## 1. Database Tables — By Cascade Dimension

**Totals:** 147 tables, 88 enums, 130 migrations, 31 Edge Functions, 54 ADRs, 18 learnings.

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

**Pure functions:** `evaluateFrameworkRules()` in `evaluate-framework-rules.ts` — SKELETON. Entity matching works, multi-rule chaining NOT implemented.
**UI:** NONE. No framework viewer, no rule override editor, no trigger management.

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

**Pure functions:** NONE. No demand propagation (season_budget -> daily targets).
**Calculation engine:** `apps/web/src/lib/season-calculations.ts` — pure functions for budget math, no DB deps.
**UI:** `/dashboard/season` with 4 tabs — WORKING. No daily target propagation view.

### 1.5 D5 — Service Concept (Driftskonsept)

> What kind of operation are we? (Parameterizes D1-D4 and D6)

No dedicated tables — D5 lives as configuration that parameterizes coefficients in other dimensions.

| Source                    | Status | Notes                                                                                                                                                             |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hospitality.ts`          | EXISTS | Industry package loader. **Tariff rates are WRONG** (kveldstillegg: 56 should be 15.65, helgetillegg: 56 should be 29.74, helligdagstillegg: 133% should be 100%) |
| `use-industry-package.ts` | EXISTS | Hook for loading industry config                                                                                                                                  |
| Niche profiles (docs)     | DRAFT  | Restaurant type parameterization (fine-dining, fast-casual, pub)                                                                                                  |

**Status:** Hardcoded in TypeScript. Should source from `tariff_rate_table` + `regulatory_framework` at runtime.

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

**Pure functions:** `computeAnchoredTime()` in `compute-anchored-shift.ts` — DONE.
**UI:** Schedule planner, daily close, reconciliation — WORKING. Operations dashboard — PARTIAL (route exists, no UI).

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

**Pure functions:** NONE. No cost calculation functions.
**UI:** NONE. No cost analysis dashboard, no commercial reporting.

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

**RAG pipeline:** MISSING. Handbook save does NOT chunk into workspace_doc_chunk.
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

| Page             | Route                       | Cascade | Status  | Notes                                                                                                                                     |
| ---------------- | --------------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule Planner | `/dashboard/schedule`       | D6      | WORKING | Full week/day/month views, DnD shifts, Day Control Panel, publish workflow, Realtime on 6 tables                                          |
| People           | `/dashboard/people`         | D2      | WORKING | DataTable, invite status, employee cards, row actions                                                                                     |
| Reports          | `/dashboard/reports`        | C1/C3   | WORKING | ReportsPageShell, AI chat panel, saved reports, deep insights                                                                             |
| Chat             | `/dashboard/chat`           | C2      | WORKING | ChatShell, real-time messages, DMs, conversation management                                                                               |
| Governance       | `/dashboard/governance`     | C4      | WORKING | GovernanceOverview + full CRUD: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm. Real readiness scores |
| Operations       | `/dashboard/operations`     | D6      | PARTIAL | Route exists, engine-dispatch + session tables wired, but no operational dashboard UI yet                                                 |
| Daily Close      | `/dashboard/close`          | D6/C1   | WORKING | CloseOutFlow, checklist, gatekeeper, image upload, settlement validation                                                                  |
| Reconciliation   | `/dashboard/reconciliation` | C1      | WORKING | DayList, DayApproval, ShiftApproval, Revenue, Deviation sections                                                                          |
| Season           | `/dashboard/season`         | D4      | WORKING | 4 tabs: overview, budget, day-factors, hour-factors                                                                                       |
| Organization     | `/dashboard/organization`   | D1      | WORKING | Department/location/team/position list, CRUD dialogs                                                                                      |
| Settings         | `/dashboard/settings`       | D1      | PARTIAL | Tab navigation, opening hours. No general settings, branding, notifications                                                               |
| AI               | `/dashboard/ai`             | C2      | WORKING | Full Mr. Botsson interface                                                                                                                |

### 2.3 Document View (Handbok)

| Component                | Cascade | Status  | Notes                                                                           |
| ------------------------ | ------- | ------- | ------------------------------------------------------------------------------- |
| DocumentModeShell        | K1b     | WORKING | Full layout with canvas + panel                                                 |
| DocumentModeCanvas       | K1b     | WORKING | Tiptap editor, loads/saves from handbook_chapter                                |
| DocumentModeSidebar      | K1b     | WORKING | 10 fixed chapter navigation                                                     |
| DocumentModeToolbar      | K1b     | WORKING | Formatting toolbar                                                              |
| DocumentModePanel        | K1b     | WORKING | 3 tabs: tools, actions, settings                                                |
| Employee handbook reader | K1b     | WORKING | ChapterReader at /dashboard/handbook — read-only Tiptap render with chapter nav |
| Handbook-to-RAG pipeline | K1b     | MISSING | Saved chapters not chunked into workspace_doc_chunk                             |

### 2.4 Employee Views (My View / Arbeidsrom)

| Page           | Route                             | Cascade | Status      | Notes                                                                                    |
| -------------- | --------------------------------- | ------- | ----------- | ---------------------------------------------------------------------------------------- |
| Oversikt       | `/dashboard` (employee mode)      | D6      | WORKING     | EmployeeDashboard: today's shift, upcoming shifts, readiness score, open shifts to claim |
| Min vaktplan   | `/dashboard/my-schedule`          | D6      | WORKING     | MyWeekView — published shifts for current profile, week navigation                       |
| Min opplaering | `/dashboard/my-training`          | —       | WORKING     | ProtocolList, ProcedureStepper, KnowledgeTestView, ConfirmationSign — real progress data |
| Min profil     | `/dashboard/my-cv`                | D2      | PARTIAL     | Route exists, personal profile view                                                      |
| Min lonn       | `/dashboard/my-salary`            | C3      | PLACEHOLDER | "Under construction" shell                                                               |
| Hjelp          | `/dashboard/help`                 | —       | EXISTS      | Help page                                                                                |
| Onb. assistant | `/dashboard/onboarding-assistant` | I1      | EXISTS      | Onboarding assistant page                                                                |

---

## 3. The 10 Gaps — Status After Module Zero

> All 10 gaps identified 2026-03-08 have been addressed by `feat/zero-to-production` (30+ commits).
> Full audit performed 2026-03-08. Typecheck 19/19 GREEN. Wizard redesign + 8 E2E tests added 2026-03-08.

| Gap | Description                          | Status      | Resolution                                                                                        |
| --- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| 1   | No Event Emission                    | **CLOSED**  | emit() wired into all TanStack Query mutations. engine_event as 4th telemetry destination         |
| 2   | Two Disconnected Event Systems       | **CLOSED**  | engine-event provider calls engine-dispatch. 26 typed events in registry. Client relay via API    |
| 3   | No Completion Tracking               | **CLOSED**  | 3 tables created (knowledge_test_attempt, confirmation_signature, procedure_step_completion)      |
| 4   | No Per-Step Instance Tracking        | **CLOSED**  | engine_state_step table with cascading RLS. 13 action handlers in engine-dispatch                 |
| 5   | Schedule -> Operations Disconnect    | **PARTIAL** | upsert_session handler exists. Emit on shift publish wired. End-to-end flow not yet tested        |
| 6   | Invite -> Trainee Dead End           | **PARTIAL** | invitation_accepted event registered. Engine trigger seeded. accept-invitation EF not yet updated |
| 7   | Employee Pages Are Shells            | **CLOSED**  | my-schedule (MyWeekView), my-training (4 components), handbook (ChapterReader) all built          |
| 8   | Document Mode Has No Reader          | **PARTIAL** | Employee handbook reader built. RAG chunking pipeline NOT built (handbook save -> doc_chunk)      |
| 9   | Governance Has No CRUD               | **CLOSED**  | 5 forms: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm       |
| 10  | No Session Hooks / Operational Tasks | **CLOSED**  | 3 tables + 3 enums created. Hook dispatcher process seeded. Engine action handlers ready          |

### Known Remaining Gaps (audited 2026-03-22)

| Area                       | Gap                                                                             | Cascade | Priority | Status |
| -------------------------- | ------------------------------------------------------------------------------- | ------- | -------- | ------ |
| Notifications              | `send_notification` handler is a console.log stub (no notification_queue flow)  | —       | Medium   | OPEN   |
| Handbook -> RAG            | Saved chapters not chunked into workspace_doc_chunk                             | K1b     | Medium   | OPEN   |
| Invite -> Onboarding       | accept-invitation EF doesn't emit invitation_accepted event yet                 | D2      | High     | OPEN   |
| Shift Publish -> Session   | End-to-end flow untested (emit -> trigger -> upsert_session -> hooks)           | D6      | High     | OPEN   |
| PolicyForm scope picker    | Department picker doesn't appear when "department" scope selected               | C4      | Low      | OPEN   |
| Wizard mobile              | No responsive layout on workspace setup wizard                                  | I1      | Low      | OPEN   |
| my-schedule realtime       | No Realtime subscription on employee shift view                                 | D6      | Low      | OPEN   |
| Invite dialog departments  | Hardcoded department list in invite dialog                                      | D2      | Low      | OPEN   |
| Trainee first-day redirect | No redirect to my-training after invite accept                                  | D2      | Medium   | OPEN   |
| Operations dashboard UI    | Route exists, tables exist, engine wired — no actual operational dashboard UI   | D6      | High     | OPEN   |
| Login/Join redirect        | Hype sequence redirect (window.location.href) untested. Auth required for /join | —       | Medium   | OPEN   |
| Agent chat UI              | `/dashboard/chat` shows "coming soon" for AI chat tab                           | C2      | Medium   | OPEN   |
| Settings module            | Only opening hours config done. No general settings, branding, notifications    | D1      | Medium   | OPEN   |
| Employee agent access      | Employees can't interact with agents from /my-schedule or /my-training          | C2      | Low      | OPEN   |

---

## 4. Architecture Decisions

### 4.1 Event Engine as Universal Runtime

**Decision:** The Event Engine (`engine_process` + `engine_step` + `engine_state` + `engine_trigger` + `engine_event`) will serve as the universal workflow runtime for ALL process types:

| Process            | entity_type         | Trigger event                      | Steps                                                                | Status         |
| ------------------ | ------------------- | ---------------------------------- | -------------------------------------------------------------------- | -------------- |
| Signup Onboarding  | user_identity       | signup.completed                   | 8 wait (onboarding sections) + match_state (workspace) + notify      | **E2E PROVEN** |
| Workspace Setup    | workspace           | workspace.created                  | 9 wait (wizard steps)                                                | **E2E PROVEN** |
| Daily Close        | department_session  | session.pending_signoff            | 10 seeded steps (assign_task, validate_settlement, etc.)             | Seeded         |
| Onboarding Journey | profile             | invitation.accepted                | Present content, administer test, collect signature, check readiness | Seeded         |
| Training Protocol  | protocol_assignment | protocol.assigned                  | Per-procedure steps, knowledge tests, confirmations                  | Seeded         |
| HACCP Daily        | department_session  | session_hook.pre_open              | CCP verification, temperature logging, deviation handling            | Planned        |
| Session Hooks      | department_session  | session.opened / session.pre_close | Trigger routine tasks at specific times                              | Seeded         |

**Rationale:** Architecture is generic — `action_type` + `action_payload` is extensible. New process types only need new action_type handlers.

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
- Phase B (pure functions): **PARTIAL** — 4/6 done in `apps/web/src/lib/cascade/`
- Phase C (bootstrap): **PARTIAL** — 13 SQL templates exist, NOT integrated into workspace creation
- Phase D (adapters): **NOT STARTED**

**Cascade <-> Event Engine:** Cascade operates as an independent service layer. It does NOT run inside `engine_process`/`engine_state`. On successful apply, `apply_cascade()` emits domain events via `emit()`.

**Open:** ADR-DRAFT has 6 unresolved hierarchy decisions awaiting Pontus.

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

**NOT YET VALIDATED:** Migrations committed but not yet run via `supabase db reset`.

### Phase B — Pure Functions (PARTIAL — 4/6)

Location: `apps/web/src/lib/cascade/`

| Function                       | Dimension | Status      | Notes                                                                                     |
| ------------------------------ | --------- | ----------- | ----------------------------------------------------------------------------------------- |
| `resolveEffectiveHours()`      | D1        | DONE        | Handles dept hours + overrides. Tested                                                    |
| `computeAnchoredTime()`        | D6        | DONE        | Shift time calculation. Tested                                                            |
| `evaluateFrameworkRules()`     | D3        | SKELETON    | Entity matching works. Multi-rule chaining, employee-context, complex evaluation NOT done |
| `validateProposalFreshness()`  | C4        | DONE        | State hash computation. Tested                                                            |
| Resource availability resolver | D2        | NOT STARTED | Availability windows, contract constraints, absence overlay                               |
| Demand propagation             | D4        | NOT STARTED | season_budget -> day_factor -> hour_factor -> daily targets                               |
| C1 calibration (EWMA)          | C1        | NOT STARTED | Variance tracking, correction factors, adjustment loop                                    |
| C3 cost calculation            | C3        | NOT STARTED | shift -> tariff resolution -> cost snapshot population                                    |

### Phase C — Bootstrap & I1 Integration (PARTIAL)

| Item                                                                               | Status      | Blocker                                                                    |
| ---------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| Hospitality docs package (AI council, policies, niche profiles, role capabilities) | DRAFT       | Content incomplete — all docs still draft status                           |
| 13 SQL bootstrap templates (`supabase/templates/restaurant/`)                      | EXISTS      | Not integrated                                                             |
| `_apply.sql` orchestrator                                                          | EXISTS      | Not called during workspace creation                                       |
| `hospitality.ts` industry package                                                  | EXISTS      | Tariff rates WRONG. Should source from tariff_rate_table                   |
| Workspace creation calls I1 bootstrap                                              | NOT STARTED | **CRITICAL BLOCKER** — new workspaces don't get cascade data               |
| Framework seed (hospitality.no.default.v1)                                         | NOT STARTED | Needs regulatory_framework + framework_rule + framework_trigger population |
| Public holiday seed                                                                | DONE        | Norway 2026 data in migration 20260422200000                               |
| Operating hours backfill from legacy                                               | DONE        | Migration 20260422100000                                                   |

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

| RPC / Service                                             | Dimension | Status      | Notes                                         |
| --------------------------------------------------------- | --------- | ----------- | --------------------------------------------- |
| `resolve_tariff_rate(profile_id, date)`                   | D3/C3     | NOT STARTED | Needed for payroll sync + cost calculation    |
| `get_cascade_context(workspace_id, date)`                 | C2        | NOT STARTED | Needed for interaction plane                  |
| `apply_change_proposal(proposal_id)`                      | C4        | NOT STARTED | Terraform-style apply                         |
| `compute_daily_budget_targets(season_id, date)`           | D4        | NOT STARTED | season -> day_factor -> daily targets         |
| `evaluate_framework_rules(workspace_id, trigger, entity)` | D3/C4     | NOT STARTED | Trigger dispatch                              |
| Cascade bootstrap service                                 | I1        | NOT STARTED | Integrate \_apply.sql into workspace creation |

### Build Priority (Recommended Order)

**Priority 1 — Blocking product features:**

1. Validate A1+A2 migrations via `supabase db reset`
2. Integrate I1 bootstrap into workspace creation (call \_apply.sql during finalize-workspace)
3. Fix hospitality.ts tariff rates OR source from tariff_rate_table
4. Seed hospitality.no.default.v1 framework (regulatory_framework + rules + triggers)
5. Complete `evaluateFrameworkRules()` — multi-rule chaining

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

**Status:** Migration files committed. Not yet validated via `supabase db reset`.

### Latest Timestamped (post-April 2026)

| Migration                                            | Purpose                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `20260422200000_seed_norway_public_holidays.sql`     | K1a: Norway 2026 public holiday data        |
| `20260422100000_backfill_department_hours.sql`       | D1: Backfill from legacy operating_hours    |
| `20260416200000_season_opening_hours.sql`            | Season opening hours per department         |
| `20260416100000_document_extraction_logs.sql`        | AI document analysis persistence            |
| `20260415200000_setup_documents_storage_policy.sql`  | Storage bucket policy for setup docs        |
| `20260415100000_add_onboarding_guide_progress.sql`   | Onboarding guide progress tracking          |
| `20260413100000_fix_company_org_number_nullable.sql` | Allow nullable org_number for new companies |

### Enum Count

**88 custom enums** (72 existing + 16 new from Cascade). Notable additions:

- Cascade A1: `department_type`, `shift_function`, `anchor_type`, `change_proposal_status`, `planning_event_category`, `planning_event_source`, `planning_cycle_status`, `cascade_initiator`, `tariff_source`, `evaluation_outcome`
- Cascade A2: `framework_trigger_type`, `framework_rule_type`, `framework_trigger_mode`, `external_provider`, `sync_direction`, `sync_status`
- Session: `session_hook_type`, `session_task_status`, `session_note_type`
- Other: `chat_conversation_type`, `waste_category`, `service_status`, `service_type`

---

## 7. Telemetry System — Current State

### Package: `@smartout/telemetry`

| File                          | Purpose                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `registry.ts`                 | 26 typed events, BaseEvent shape, EVENT_ROUTING map                      |
| `emit.ts`                     | Router: checks routing config, dispatches to 4 providers                 |
| `providers/posthog-client.ts` | PostHog browser-safe adapter (split from posthog.ts)                     |
| `providers/posthog.ts`        | PostHog server-only adapter (loaded via dynamic import)                  |
| `providers/logger.ts`         | Structured stdout logging (server-only, dynamic import)                  |
| `providers/activity-trail.ts` | Writes to `activity_trail` table (server-only, dynamic import)           |
| `providers/engine-event.ts`   | Calls engine-dispatch Edge Function (dual: server direct / client relay) |
| `hooks/use-track.ts`          | React hook for client-side tracking                                      |
| `react.ts`                    | React bindings                                                           |

### Destinations (4)

| Destination      | Transport                                  | Purpose             |
| ---------------- | ------------------------------------------ | ------------------- |
| `posthog`        | PostHog EU (browser SDK or posthog-node)   | Analytics           |
| `logger`         | Structured stdout (server-only)            | Debugging           |
| `activity_trail` | INSERT to activity_trail table             | Audit               |
| `engine_event`   | POST to engine-dispatch EF (or /api relay) | Workflow automation |

### Registered Events (26)

Auth (3), org_structure (3), scheduling (4), operations (5), training (5), reconciliation (2), handbook (1), navigation (2).

22 of 26 events route to `engine_event`. Only `auth signed_up/in/out`, `page viewed`, and `button clicked` skip engine dispatch.

### Usage

`emit()` wired into 15 files across wizard-steps and TanStack Query hooks via `onSuccess`. Client events relay through `/api/telemetry` API route (Zod-validated, rate-limited, actor_id enforced). Server-side calls engine-dispatch EF directly via `supabase.functions.invoke()`.

---

## 8. Cascade Implementation Summary

| Layer                    | Status      | %        | Next Action                                              |
| ------------------------ | ----------- | -------- | -------------------------------------------------------- |
| Schema (Phase A)         | DONE        | 100%     | Validate via `supabase db reset`                         |
| Pure Functions (Phase B) | PARTIAL     | 60%      | Complete D3 rule evaluation, add D2/D4                   |
| Bootstrap (Phase C)      | PARTIAL     | 40%      | **CRITICAL:** Wire I1 into workspace creation            |
| Service Logic (Phase D)  | MINIMAL     | 10%      | Build tariff RPC + change proposal lifecycle             |
| Control Planes (Phase E) | NOT STARTED | 0%       | C4 governance first (change proposals)                   |
| UI (Cascade-specific)    | PARTIAL     | 30%      | Season + reconciliation working, governance/cost missing |
| **Overall**              |             | **~40%** |                                                          |

**Single most important next step:** Integrate I1 bootstrap into workspace creation so new workspaces get cascade data.
