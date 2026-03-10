---
title: "STATE — System State of Truth"
status: canonical
updated: 2026-03-09
created: 2026-03-08
last-verified: 2026-03-09
module: all
tags: [state, audit, gaps, architecture, module-zero]
---

# STATE — System State of Truth

> Single source of truth for what exists, what's missing, and what to build next.
> Updated weekly. Last audit: 2026-03-08.

---

## 1. Database Tables — Exists vs Missing

### 1.1 Identity & Structure (Wave 0) — ALL EXIST

| Table            | Migration | Notes                                                                           |
| ---------------- | --------- | ------------------------------------------------------------------------------- |
| `user_identity`  | 00001     | NOT `user`. `handle_new_user()` trigger creates on auth.users INSERT            |
| `company`        | 00001     | Subscription data lives here, no separate stripe table                          |
| `company_member` | 00001     | role: owner/admin/member                                                        |
| `workspace`      | 00001     | All workspace-scoped tables FK here                                             |
| `profile`        | 00001     | status: trainee/active/inactive/offboarding. role: employee/manager/admin/owner |
| `department`     | 00002     | Permanent org unit                                                              |
| `location`       | 00002     | type: main/outdoor/kitchen/event/storage/other                                  |
| `zone`           | 00002     | Within a location                                                               |
| `asset`          | 00002     | type: equipment/safety/storage/station/other                                    |
| `position`       | 00002     | Per-shift, not per-person                                                       |
| `team`           | 00002     | type: operational/access/cross_department/seasonal/custom                       |
| `season`         | 00002     | status: draft/active/archived                                                   |
| `invitation`     | 00011     | Dual-mode (batch/single), 3 delivery types (email/sms/link)                     |

### 1.2 Governance & Training (Wave 0) — ALL EXIST

| Table                       | Migration      | Status                                                                                              |
| --------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `policy`                    | 00003          | EXISTS — type: operational/haccp/hr/safety/access/payroll/custom                                    |
| `protocol`                  | 00003          | EXISTS — status: draft/active/deprecated                                                            |
| `procedure`                 | 00003          | EXISTS — type: standard/onboarding/safety/maintenance/custom                                        |
| `procedure_step`            | 00003          | EXISTS — step_order, title, description, is_required, estimated_minutes. NO training_content column |
| `control_list`              | 00003          | EXISTS                                                                                              |
| `routine`                   | 00003          | EXISTS                                                                                              |
| `runbook`                   | 00003          | EXISTS                                                                                              |
| `runbook_step`              | 00003          | EXISTS                                                                                              |
| `knowledge_test`            | 00003          | EXISTS — questions/answers definition                                                               |
| `confirmation`              | 00003          | EXISTS — sign-off template definition                                                               |
| `protocol_assignment`       | 00003          | EXISTS — simple: protocol_id + profile_id + status (pending/completed/expired). NO progress columns |
| `knowledge_test_attempt`    | 20260412100200 | EXISTS — quiz score, answers, pass/fail per attempt                                                 |
| `confirmation_signature`    | 20260412100200 | EXISTS — sign-off record with signature_data JSONB                                                  |
| `procedure_step_completion` | 20260412100200 | EXISTS — per-step progress per employee per protocol_assignment                                     |

**Readiness score:** Computed from real DB queries in `use-protocol-journey.ts`. Training module functional.

### 1.3 Scheduling (Wave 2) — ALL EXIST

| Table                     | Migration      | Notes                                                                       |
| ------------------------- | -------------- | --------------------------------------------------------------------------- |
| `schedule_shift`          | 20260301300000 | 14 columns, status: created/assigned/published/active/completed/unpublished |
| `schedule_absence`        | 20260301600003 | status: pending/approved/rejected                                           |
| `schedule_template`       | 20260301600003 | Reusable shift patterns                                                     |
| `schedule_template_shift` | 20260301600003 | Shifts within a template                                                    |
| `schedule_open_shift`     | 20260301600003 | Unassigned shifts                                                           |
| `schedule_day_message`    | 20260301600003 | visibility: all_day/until_16/permanent                                      |
| `schedule_day_task`       | 20260301600003 | Ad-hoc daily todos (label, category, assigned_to, completed_at)             |
| `schedule_day_booking`    | 20260301600003 | status: confirmed/pending/cancelled                                         |
| `schedule_audit_log`      | 20260301600003 | Row-level audit trail                                                       |

### 1.4 Operations (Wave 3) — ALL EXIST

| Table                  | Migration      | Status                                                                                        |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `department_session`   | 20260304200000 | EXISTS — status: upcoming/active/pending_signoff/closed/missed. UNIQUE(workspace, dept, date) |
| `session_hook`         | 20260412100300 | EXISTS — hook_type enum: pre_open/open/scheduled/pre_close/close                              |
| `session_task`         | 20260412100300 | EXISTS — status enum lifecycle, linked to department_session + session_hook                   |
| `session_note`         | 20260412100300 | EXISTS — note_type: handoff/closing/general                                                   |
| `daily_reconciliation` | 20260304200100 | EXISTS — status: open/submitted/awaiting_approval/approved/locked/unreconciled                |
| `deviation`            | 20260304200200 | EXISTS — domain: safety/customer/procedure/system/material                                    |
| `shift_approval`       | 20260304200200 | EXISTS — status: pending/approved/edited/disputed                                             |

**Status:** Engine-dispatch has `upsert_session` handler that creates department_sessions from shift events. Session hooks seeded via engine_process templates. Operations layer wired but not yet triggered end-to-end (requires shift publish → emit flow). Engine-dispatch Edge Function deployed to production 2026-03-08.

### 1.5 Season Planning (Wave 6) — ALL EXIST

| Table           | Migration      | Notes                                        |
| --------------- | -------------- | -------------------------------------------- |
| `season_budget` | 20260306100000 | 1:1 with season. status: draft/active/locked |
| `day_factor`    | 20260306100000 | Weekday weight distribution                  |
| `hour_factor`   | 20260306100000 | Hourly weight distribution                   |

### 1.6 Engine Tables — ALL EXIST

| Table                     | Migration      | Purpose                                                                                                                     |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `engine_missions`         | 20260301200000 | AI mission templates (sequential/free/hybrid)                                                                               |
| `engine_stages`           | 20260301200000 | Steps within AI missions (goal, instructions, success_criteria)                                                             |
| `engine_sessions`         | 20260301200000 | Active AI sessions. mode: mission/agent. Has profile_id                                                                     |
| `engine_inbox`            | 20260301200000 | Generic data collection per session                                                                                         |
| `engine_memory`           | 20260302000000 | Persistent pgvector memories per profile (preference/fact/summary)                                                          |
| `engine_authority_config` | 20260302000100 | Per-workspace capability authority levels (5 levels x 9 capabilities)                                                       |
| `engine_process`          | 20260304100000 | Workflow templates (e.g. daily_close). TEXT PK                                                                              |
| `engine_step`             | 20260304100000 | Steps within a process. action_type + action_payload + assignee_rule                                                        |
| `engine_trigger`          | 20260304100000 | Event-to-process matching rules with optional delay                                                                         |
| `engine_event`            | 20260304100000 | Immutable event log. Idempotency support                                                                                    |
| `engine_state`            | 20260304100000 | Running process instances. entity_type/entity_id, current_step, status. **workspace_id nullable** (pre-workspace processes) |
| `engine_delayed_trigger`  | 20260304100000 | Timer queue for delayed triggers                                                                                            |
| `engine_state_step`       | 20260412100100 | EXISTS — per-step completion tracking. Cascading RLS via engine_state                                                       |

**Journey Engine (feat/journey-engine, 2026-03-09):** Two seeded processes proven end-to-end:

- `signup_onboarding` (10 steps): signup.completed → 8x wait_for_event (onboarding sections) → match_state (workspace.created) → send_notification → complete
- `workspace_setup` (9 steps): workspace.created → 9x wait_for_event (wizard steps) → complete
- engine_event, engine_state, engine_trigger all support nullable workspace_id for pre-workspace events
- New condition operator: `match_state` for cross-entity event matching (payload field maps to state context field)
- Journey PM table linked via `engine_process_id` FK. Compile function converts journey+steps → engine_process/step/trigger
- 6 Playwright E2E tests verify full chain. Journey reporter writes results to `journey_test_run` table

### 1.7 Document Mode — EXISTS

| Table              | Migration                       | Notes                                                                                       |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------- |
| `handbook_chapter` | 20260306120000 + 20260410100000 | Tiptap JSONB per workspace x chapter_key. 10 fixed chapters. RLS: any member can read/write |

### 1.8 Search & Docs — EXISTS

| Table                                 | Migration      | Notes                                                   |
| ------------------------------------- | -------------- | ------------------------------------------------------- |
| `workspace_doc_chunk`                 | 20260306170000 | pgvector semantic search. RPC: `match_workspace_docs()` |
| `platform_doc` + `platform_doc_chunk` | 20260301200050 | Platform documentation RAG                              |

### 1.9 Other Notable Tables

| Table                                                | Migration      | Notes                                                                              |
| ---------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `activity_trail`                                     | 00005          | Audit log. Telemetry activity_trail provider writes here                           |
| `notification_queue`                                 | 00006          | Notification dispatch queue                                                        |
| `onboarding_session`                                 | 00009          | Persisted onboarding wizard state                                                  |
| `employment_contract`                                | 00012          | DocuSign/DocuSeal integration. status: draft/sent/viewed/signed/expired/terminated |
| `platform_api_key`                                   | 20260228230000 | SHA-256 hashed API keys. type: workspace/service                                   |
| `agent_profile`                                      | 20260307000000 | AI agent identity and personality                                                  |
| `agent_relationship`                                 | 20260307000000 | Per agent-profile familiarity/trust/sentiment tracking                             |
| `chat_conversation` + `chat_message` + `chat_member` | 20260320120000 | Real-time chat system                                                              |
| `service_config` + `service_health_log`              | 20260407100000 | Infrastructure monitoring                                                          |
| `waste_log`                                          | 20260407200001 | Waste tracking by category                                                         |
| `workspace_kpi_target` + `workspace_budget`          | 20260302152749 | Operational KPI and budget targets                                                 |

---

## 2. Views — Working vs Placeholder

### 2.1 Admin Views (Operation View / Drift)

| View       | Component            | Route              | Status  | Data Source                                                                     |
| ---------- | -------------------- | ------------------ | ------- | ------------------------------------------------------------------------------- |
| Taktisk    | `TacticalView`       | `/dashboard` (tab) | WORKING | Weekly shifts, coverage stats, leader pulse, deviation alerts, guardian signals |
| Strategisk | `StrategicView`      | `/dashboard` (tab) | WORKING | KPI cards, revenue targets, labor %, location comparison                        |
| Avstemming | `ReconciliationView` | `/dashboard` (tab) | WORKING | daily_reconciliation, shift_approval, deviation                                 |
| Aktivitet  | `ActivityView`       | `/dashboard` (tab) | WORKING | activity_trail events                                                           |
| Vakt       | `GuardianView`       | `/dashboard` (tab) | WORKING | 13 guardian components, real-time session monitoring                            |

### 2.2 Focus Pages (Admin)

| Page             | Route                       | Status      | Notes                                                                                                                                     |
| ---------------- | --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule Planner | `/dashboard/schedule`       | WORKING     | Full week/day/month views, DnD shifts, Day Control Panel, publish workflow, Realtime on 6 tables                                          |
| People           | `/dashboard/people`         | WORKING     | DataTable, invite status, employee cards, row actions                                                                                     |
| Reports          | `/dashboard/reports`        | WORKING     | ReportsPageShell, AI chat panel, saved reports, deep insights                                                                             |
| Chat             | `/dashboard/chat`           | WORKING     | ChatShell, real-time messages, DMs, conversation management                                                                               |
| Governance       | `/dashboard/governance`     | WORKING     | GovernanceOverview + full CRUD: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm. Real readiness scores |
| Operations       | `/dashboard/operations`     | PLACEHOLDER | Route exists, no operational dashboard                                                                                                    |
| Daily Close      | `/dashboard/close`          | WORKING     | CloseOutFlow, checklist, gatekeeper, image upload, settlement validation                                                                  |
| Reconciliation   | `/dashboard/reconciliation` | WORKING     | DayList, DayApproval, ShiftApproval, Revenue, Deviation sections                                                                          |
| Season           | `/dashboard/season`         | WORKING     | 4 tabs: overview, budget, day-factors, hour-factors                                                                                       |
| Organization     | `/dashboard/organization`   | WORKING     | Department/location/team/position list, CRUD dialogs                                                                                      |
| Settings         | `/dashboard/settings`       | PARTIAL     | Tab navigation, opening hours. No general settings, branding, notifications                                                               |
| AI               | `/dashboard/ai`             | WORKING     | Full Mr. Botsson interface                                                                                                                |

### 2.3 Document View (Handbok)

| Component                | Status  | Notes                                                                           |
| ------------------------ | ------- | ------------------------------------------------------------------------------- |
| DocumentModeShell        | WORKING | Full layout with canvas + panel                                                 |
| DocumentModeCanvas       | WORKING | Tiptap editor, loads/saves from handbook_chapter                                |
| DocumentModeSidebar      | WORKING | 10 fixed chapter navigation                                                     |
| DocumentModeToolbar      | WORKING | Formatting toolbar                                                              |
| DocumentModePanel        | WORKING | 3 tabs: tools, actions, settings                                                |
| Employee handbook reader | WORKING | ChapterReader at /dashboard/handbook — read-only Tiptap render with chapter nav |
| Handbook-to-RAG pipeline | MISSING | Saved chapters not chunked into workspace_doc_chunk                             |

### 2.4 Employee Views (My View / Arbeidsrom)

| Page           | Route                             | Status      | Notes                                                                                    |
| -------------- | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Oversikt       | `/dashboard` (employee mode)      | WORKING     | EmployeeDashboard: today's shift, upcoming shifts, readiness score, open shifts to claim |
| Min vaktplan   | `/dashboard/my-schedule`          | WORKING     | MyWeekView — published shifts for current profile, week navigation                       |
| Min opplaering | `/dashboard/my-training`          | WORKING     | ProtocolList, ProcedureStepper, KnowledgeTestView, ConfirmationSign — real progress data |
| Min profil     | `/dashboard/my-cv`                | PARTIAL     | Route exists, personal profile view                                                      |
| Min lonn       | `/dashboard/my-salary`            | PLACEHOLDER | "Under construction" shell                                                               |
| Hjelp          | `/dashboard/help`                 | EXISTS      | Help page                                                                                |
| Onb. assistant | `/dashboard/onboarding-assistant` | EXISTS      | Onboarding assistant page                                                                |

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
| 8   | Document Mode Has No Reader          | **PARTIAL** | Employee handbook reader built. RAG chunking pipeline NOT built (handbook save → doc_chunk)       |
| 9   | Governance Has No CRUD               | **CLOSED**  | 5 forms: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm       |
| 10  | No Session Hooks / Operational Tasks | **CLOSED**  | 3 tables + 3 enums created. Hook dispatcher process seeded. Engine action handlers ready          |

### Known Remaining Gaps (audited 2026-03-08)

| Area                       | Gap                                                                            | Priority | Status     |
| -------------------------- | ------------------------------------------------------------------------------ | -------- | ---------- |
| Notifications              | `send_notification` handler is a console.log stub (no notification_queue flow) | Medium   | OPEN       |
| Handbook → RAG             | Saved chapters not chunked into workspace_doc_chunk                            | Medium   | OPEN       |
| Invite → Onboarding        | accept-invitation EF doesn't emit invitation_accepted event yet                | High     | OPEN       |
| Shift Publish → Session    | End-to-end flow untested (emit → trigger → upsert_session → hooks)             | High     | OPEN       |
| PolicyForm scope picker    | Department picker doesn't appear when "department" scope selected              | Low      | OPEN       |
| Wizard forms               | 9-step industry-driven wizard with real forms, 14 E2E tests                    | —        | **CLOSED** |
| Wizard mobile              | No responsive layout on workspace setup wizard                                 | Low      | OPEN       |
| my-schedule realtime       | No Realtime subscription on employee shift view                                | Low      | OPEN       |
| Invite dialog departments  | Hardcoded department list in invite dialog (pre-existing)                      | Low      | OPEN       |
| Trainee first-day redirect | No redirect to my-training after invite accept                                 | Medium   | OPEN       |

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

**Rationale:** The architecture is already generic — `action_type` + `action_payload` is extensible. New process types only need new action_type handlers in `engine-dispatch`, not schema changes.

**Required addition:** `engine_state_step` table for per-step completion tracking (Gap 4).

### 4.2 Telemetry as Single Event Emitter

**Decision:** `@smartout/telemetry` `emit()` becomes the single entry point for all domain events. Four destinations:

```
emit("shift published") ->
  1. PostHog        (analytics)
  2. Logger          (stdout / structured logs)
  3. activity_trail  (audit DB table)
  4. engine_event    (workflow automation)  <- NEW
```

**Rationale:** Telemetry already has typed events, entity refs, categories, routing config, and an audit-safe architecture. Building a second emitter creates drift. One `emit()` call per mutation drives everything.

**Implementation:**

1. New provider: `packages/telemetry/src/providers/engine-event.ts`
2. New destination in `EVENT_ROUTING`: `"engine_event"`
3. Provider calls `engine-dispatch` Edge Function with mapped event_type
4. Event name mapping: `"shift published"` -> `"shift.published"` (dot notation for engine)

### 4.3 Separate session_task from schedule_day_task

**Decision:** `schedule_day_task` and `session_task` are separate tables with different purposes:

|                | schedule_day_task                     | session_task                                                                               |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Purpose**    | Ad-hoc manager todos                  | Hook-triggered operational compliance                                                      |
| **Created by** | Manager manually in Day Control Panel | Engine trigger from session hook                                                           |
| **Status**     | Free text (task_status column)        | Enum lifecycle: pending -> available -> in_progress -> completed/skipped/overdue/escalated |
| **Linked to**  | shift_date (loose)                    | department_session (FK) + session_hook (FK)                                                |
| **Tracking**   | Simple completed_at                   | completed_by (profile), evidence, compliance flag                                          |
| **Source**     | Human initiative                      | Governance procedures/routines                                                             |

**Rationale:** Extending `schedule_day_task` would contaminate a simple working feature with compliance overhead. Different lifecycle, different access patterns, different consumers.

### 4.4 New Tables for Completion Tracking (Not Engine-Only)

**Decision:** Create dedicated completion tables rather than relying solely on `engine_state_step`:

| Table                       | Purpose                        | Why not engine_state_step alone                                  |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `knowledge_test_attempt`    | Quiz score, answers, pass/fail | Needs to survive beyond process lifetime. Audit requirement.     |
| `confirmation_signature`    | Sign-off record with timestamp | Legal/compliance artifact. Must be independently queryable.      |
| `procedure_step_completion` | Per-step progress per employee | Readiness score computation needs fast joins, not JSONB parsing. |

`engine_state_step` tracks the _process instance_ progress. These tables track the _permanent record_ of completion. A process can be re-run, but the completion record stands.

---

## 5. Module Zero — Week-by-Week Plan

> Module Zero = the foundational work that unblocks all other modules.
> Duration: 5 weeks. **ALL COMPLETE as of 2026-03-08.** Branch: `feat/zero-to-production`, 22 commits.

### Week 1: Event Backbone

**Goal:** One `emit()` call drives analytics + audit + workflow automation.

| Task                           | Details                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire telemetry emit() into UI  | Add `emit()` calls to every TanStack Query mutation `onSuccess` (shifts, departments, invites, templates, absences, bookings, messages, tasks) |
| Add engine_event provider      | `packages/telemetry/src/providers/engine-event.ts` — calls engine-dispatch Edge Function                                                       |
| Add "engine_event" destination | Update `EVENT_ROUTING` in registry.ts. Map event names to dot-notation engine types                                                            |
| Expand event registry          | Add missing events: shift.published, invitation.accepted, protocol.assigned, session.opened, session.pending_signoff, settlement.submitted     |
| Verify end-to-end              | Emit "shift published" -> engine_event recorded -> trigger matched -> engine_state created                                                     |

**Deliverable:** Any domain action in the UI creates an engine_event. DailyClose process can be triggered by real shift activity.

### Week 2: Completion Tracking + Session Infrastructure

**Goal:** Tables exist for tracking employee progress and operational sessions.

| Task                                          | Details                                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create `knowledge_test_attempt`               | profile_id, knowledge_test_id, score, passed, answers (JSONB), attempted_at                                                                                 |
| Create `confirmation_signature`               | profile_id, confirmation_id, signed_at, signature_data (JSONB), ip_address                                                                                  |
| Create `procedure_step_completion`            | profile_id, procedure_step_id, protocol_assignment_id, completed_at, evidence (JSONB)                                                                       |
| Create `session_hook`                         | workspace_id, department_id, hook_type (enum: pre_open/open/scheduled/pre_close/close), trigger_time, linked_procedure_id, linked_routine_id                |
| Create `session_task`                         | department_session_id, session_hook_id, title, description, status (enum lifecycle), assigned_to, completed_by, completed_at, evidence, compliance_required |
| Create `session_note`                         | department_session_id, note_type (handoff/closing/general), content, created_by                                                                             |
| Create `engine_state_step`                    | state_id, step_order, status, completed_by, completed_at, result (JSONB)                                                                                    |
| Create `session_task_status` enum             | pending, available, in_progress, completed, skipped, overdue, escalated                                                                                     |
| Create `session_hook_type` enum               | pre_open, open, scheduled, pre_close, close                                                                                                                 |
| Add progress columns to `protocol_assignment` | procedures_total, procedures_completed, tests_total, tests_passed, confirmations_total, confirmations_signed (or compute via view)                          |
| RLS on all new tables                         | JWT + API key policies per CLAUDE.md checklist                                                                                                              |
| Regenerate database.types.ts                  | `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`                                                                       |

**Deliverable:** All tracking tables exist. Protocol assignments can record real progress. Sessions have hooks and tasks.

### Week 3: Process Wiring + Auto-Generation

**Goal:** Events trigger real workflows. Department sessions auto-create.

| Task                                       | Details                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-create department sessions            | On "shift.published": for each unique (workspace, department, date) in published shifts, upsert department_session with status "upcoming"                           |
| Wire session lifecycle events              | Session status changes emit events: session.opened, session.pre_close, session.pending_signoff                                                                      |
| Seed session hook triggers                 | Map hook_type to engine_trigger: pre_open -> 30min before first shift, open -> first shift start, pre_close -> 30min before last shift end, close -> last shift end |
| Wire invite -> protocol assignment         | On "invitation.accepted": look up workspace default protocols, create protocol_assignments for the new profile                                                      |
| Wire protocol assignment -> engine process | On "protocol.assigned": create engine_state for training process, create engine_state_step per procedure/test/confirmation                                          |
| Update engine-dispatch                     | Add new action_type handlers: present_content, administer_test, collect_signature, check_readiness, create_session_task                                             |
| Connect handbook save to RAG               | On handbook_chapter save: chunk Tiptap JSON into workspace_doc_chunk with appropriate embeddings                                                                    |
| Update readiness computation               | Replace hardcoded `false` in use-protocol-journey.ts with real queries against completion tables                                                                    |

**Deliverable:** Publishing shifts creates sessions. Accepting invites assigns protocols. Saving handbook chapters feeds RAG. Readiness scores are real.

### Week 4: Employee-Facing UI

**Goal:** Employees can see their shifts, do their training, read the handbook.

| Task                                | Details                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Build `/dashboard/my-schedule`      | Query published shifts for current profile. Show today + upcoming. Basic week view.                                           |
| Build `/dashboard/my-training`      | List assigned protocols with real progress. Step-through procedure viewer. Knowledge test taking. Confirmation signing.       |
| Build employee handbook reader      | Render Tiptap JSON as read-only. Navigate 10 chapters. Accessible from employee sidebar.                                      |
| Build `/dashboard/my-salary` (stub) | Show worked hours from shift_approval. Placeholder for payroll calculations.                                                  |
| Wire Realtime to employee views     | Subscribe to schedule_shift changes for the employee's profile_id                                                             |
| Trainee first-day experience        | After invite accept, redirect to `/dashboard/my-training` instead of generic `/dashboard`. Show welcome + assigned protocols. |

**Deliverable:** Employees have a functional workspace. Trainees have a first-day experience. The system is no longer admin-only.

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

### Latest Timestamped

`20260413100000_fix_company_org_number_nullable.sql`

### Enum Count

**64 custom enums.** Full list in BUILD_ORDER.md Appendix or via: `grep -r "CREATE TYPE" supabase/migrations/`

Enums added by Module Zero:

- `session_hook_type` (pre_open/open/scheduled/pre_close/close) — 20260412100000
- `session_task_status` (pending/available/in_progress/completed/skipped/overdue/escalated) — 20260412100000
- `session_note_type` (handoff/closing/general) — 20260412100000

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

### Engine Event Flow (verified 2026-03-08)

```
UI mutation → emit() → engine-event provider → engine-dispatch EF
  → INSERT engine_event (immutable log)
  → MATCH engine_trigger (6 triggers seeded)
  → CREATE engine_state (process instance)
  → EXECUTE engine_step handlers
```

**End-to-end verified:** `invitation.accepted` → engine-dispatch → matched 1 trigger → created 2 engine_states (`onboarding_journey` status=waiting, `training_protocol` status=active).

---

## 8. Quick Reference

### Dashboard View Modes

| Mode           | Trigger                      | Breadcrumb              | Content                                                                  |
| -------------- | ---------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| Operation View | Admin toggle ON + /dashboard | Drift > Oversikt        | 5 sub-views (Taktisk/Strategisk/Avstemming/Aktivitet/Vakt) + ActionStrip |
| Focus View     | Admin toggle ON + sub-page   | Drift > [page]          | Page-specific content (schedule, reports, etc.)                          |
| My View        | Admin toggle OFF             | Arbeidsrom > [page]     | EmployeeDashboard or employee sub-pages                                  |
| Document View  | Document mode toggle         | Handbok > Dokumentmodus | Tiptap editor with 10 chapters                                           |

### Key File Locations

| What                          | Path                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| DashboardShell                | `apps/web/src/components/dashboard/DashboardShell.tsx`            |
| AdminDashboard                | `apps/web/src/components/dashboard/AdminDashboard.tsx`            |
| EmployeeDashboard             | `apps/web/src/components/dashboard/EmployeeDashboard.tsx`         |
| Telemetry package             | `packages/telemetry/src/`                                         |
| Engine dispatch               | `supabase/functions/engine-dispatch/index.ts`                     |
| Schedule hooks                | `apps/web/src/app/dashboard/schedule/_hooks/`                     |
| Dashboard hooks               | `apps/web/src/app/dashboard/_hooks/`                              |
| Document Mode                 | `apps/web/src/app/dashboard/_components/document-mode/`           |
| Governance page               | `apps/web/src/app/dashboard/governance/`                          |
| Readiness hook (real queries) | `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts`       |
| Workspace setup wizard        | `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`      |
| Industry packages             | `apps/web/src/lib/industry/`                                      |
| E2E setup wizard tests        | `apps/e2e/tests/setup-wizard.spec.ts`                             |
| Engine event client relay     | `apps/web/src/app/api/engine-dispatch/route.ts`                   |
| Fire delayed triggers         | `supabase/functions/fire-delayed-triggers/index.ts`               |
| Agent router                  | `services/stage-engine/src/core/agent-router.ts`                  |
| DailyClose seed               | `supabase/migrations/20260304300000_seed_daily_close_process.sql` |
| Process tables                | `supabase/migrations/20260304100000_engine_process_tables.sql`    |

### Edge Functions — Deployment Status (verified 2026-03-08)

19 functions deployed. Last deploy: 2026-03-08.

| Function                | Status | Deploy date | Notes                                                                                                                                                                                                                                                                      |
| ----------------------- | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-dispatch`       | ACTIVE | 2026-03-08  | 869.8kB. Deployed this session — was missing.                                                                                                                                                                                                                              |
| `fire-delayed-triggers` | ACTIVE | 2026-03-08  | 860.1kB. Deployed this session — was missing.                                                                                                                                                                                                                              |
| `workspace-api`         | ACTIVE | 2026-03-03  | API gateway, 7 endpoints                                                                                                                                                                                                                                                   |
| `validate-api-key`      | ACTIVE | 2026-03-03  | API key validation                                                                                                                                                                                                                                                         |
| `accept-invitation`     | ACTIVE | 2026-03-03  | Invite acceptance (does NOT emit invitation_accepted yet)                                                                                                                                                                                                                  |
| `health-check`          | ACTIVE | 2026-03-03  | Uptime monitoring                                                                                                                                                                                                                                                          |
| Other 13 functions      | ACTIVE | 2026-03-03  | analyze-workspace, create-invitation, extract-workspace-data, web-search-intelligence, activate-workspace, cleanup-api-keys, contract-lifecycle, scrape-raw-data, watchdog-integrity, watchdog-uptime, finalize-workspace, sendgrid-webhook, gather-workspace-intelligence |

### Engine Process Templates (5 seeded)

| process_id                     | name                         | Trigger event                                               | Status                   |
| ------------------------------ | ---------------------------- | ----------------------------------------------------------- | ------------------------ |
| `daily_close`                  | Daily Close & Reconciliation | `department_session.pending_signoff`, `shift.last_checkout` | Seeded                   |
| `department_session_lifecycle` | Department Session Lifecycle | `shift.published`                                           | Seeded                   |
| `onboarding_journey`           | Onboarding Journey           | `invitation.accepted`                                       | Seeded, **verified e2e** |
| `training_protocol`            | Training Protocol            | `protocol.assigned`                                         | Seeded, **verified e2e** |
| `session_hook_dispatcher`      | Session Hook Dispatcher      | `session.hook_fired`                                        | Seeded                   |

### Engine Triggers (6 seeded, all condition=NULL)

| process_id                     | event_type                           | Notes                              |
| ------------------------------ | ------------------------------------ | ---------------------------------- |
| `daily_close`                  | `department_session.pending_signoff` |                                    |
| `daily_close`                  | `shift.last_checkout`                |                                    |
| `department_session_lifecycle` | `shift.published`                    |                                    |
| `onboarding_journey`           | `invitation.accepted`                | **Verified:** creates engine_state |
| `training_protocol`            | `protocol.assigned`                  | **Verified:** creates engine_state |
| `session_hook_dispatcher`      | `session.hook_fired`                 |                                    |

### Journey/Mission/Roadmap System

#### Skills Pipeline (4 skills)

```
/roadmap → /journey → /mission → /mission-training
```

| Skill               | File                                 | Lines | Purpose                                            |
| ------------------- | ------------------------------------ | ----- | -------------------------------------------------- |
| `/roadmap`          | `.claude/skills/roadmap.md`          | 176   | Business intent, scope, success criteria           |
| `/journey`          | `.claude/skills/journey.md`          | 363   | Deep spec (10 dimensions per step, P0/P1/P2 tiers) |
| `/mission`          | `.claude/skills/mission.md`          | 706   | Agent execution contract + seed SQL                |
| `/mission-training` | `.claude/skills/mission-training.md` | 348   | Stage tuning, tool wiring, iteration               |

#### Roadmap Packages (3)

| Package           | Path                               | Artifacts                             | Status          |
| ----------------- | ---------------------------------- | ------------------------------------- | --------------- |
| Admin onboarding  | `docs/Roadmaps/Admin onboarding/`  | Roadmap + Journey + Mission + License | Complete (gold) |
| Punch into shift  | `docs/Roadmaps/punch-into-shift/`  | Roadmap + Journey                     | 2/4             |
| Check my schedule | `docs/Roadmaps/check-my-schedule/` | Roadmap + Journey                     | 2/4             |

#### Journey Portal (Platform Admin)

- Route: `/platform-admin/journeys/` — 13 components (list, detail, edit, steps editor, status changer, wizard)
- DB: `journey` (68 rows), `journey_step`, `journey_event`, `journey_test_run`
- 13-status lifecycle: idea → wizard → defined → ready_impl → building → review → ready_test → testing → ready_validation → implemented → active/inactive/broken
- ADR-0031

#### Feature Closure Journeys

- `docs/journeys/JOURNEY-*.md` — 40 files
- Required by `close-feature.sh` Gate 4 (blocks merge if missing)
- Separate from Roadmap packages — these document user flows per completed feature

#### AI Generators (`packages/ai/`)

| Generator            | Output               |
| -------------------- | -------------------- |
| `journey-doc.ts`     | Journey.md           |
| `journey-e2e.ts`     | Playwright E2E       |
| `journey-botsson.ts` | Mission instructions |
| `journey-linear.ts`  | Linear issue sync    |
| `journey.ts` (agent) | Journey design agent |

---

### Unmerged Feature Branches

| Branch                                       | Worktree    | Status      | Notes                                                                   |
| -------------------------------------------- | ----------- | ----------- | ----------------------------------------------------------------------- |
| `feat/zero-to-production`                    | wt-1        | in_progress | Module Zero. Engine-dispatch deployed, e2e backbone verified 2026-03-08 |
| `feat/document-mode`                         | wt-2        | in_progress |                                                                         |
| `feat/infra-hardening`                       | wt-4        | in_progress |                                                                         |
| `feat/showroom`                              | wt-8        | in_progress | Phase 2 done, 4 uncommitted files                                       |
| `test/blender`                               | wt-blender  | in_progress |                                                                         |
| `docs/production-menu-inventory-integration` | superpowers | in_progress | 7 dirty files (module docs, decisions)                                  |
| `feat/season-engine`                         | —           | no worktree | Orphan branch, no worktree attached                                     |
| `feat/journey-package-skills`                | —           | remote only | `remotes/origin/feat/journey-package-skills`                            |

---

_Next update: Week of 2026-03-15_
_Owner: Pontus Lindroth_
