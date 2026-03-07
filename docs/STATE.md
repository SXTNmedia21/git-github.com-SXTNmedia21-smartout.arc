---
title: "STATE — System State of Truth"
status: canonical
updated: 2026-04-11
created: 2026-04-11
module: all
tags: [state, audit, gaps, architecture, module-zero]
---

# STATE — System State of Truth

> Single source of truth for what exists, what's missing, and what to build next.
> Updated weekly. Last audit: 2026-04-11.

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

### 1.2 Governance & Training (Wave 0) — TABLES EXIST, TRACKING MISSING

| Table                       | Migration | Status                                                                                              |
| --------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `policy`                    | 00003     | EXISTS — type: operational/haccp/hr/safety/access/payroll/custom                                    |
| `protocol`                  | 00003     | EXISTS — status: draft/active/deprecated                                                            |
| `procedure`                 | 00003     | EXISTS — type: standard/onboarding/safety/maintenance/custom                                        |
| `procedure_step`            | 00003     | EXISTS — step_order, title, description, is_required, estimated_minutes. NO training_content column |
| `control_list`              | 00003     | EXISTS                                                                                              |
| `routine`                   | 00003     | EXISTS                                                                                              |
| `runbook`                   | 00003     | EXISTS                                                                                              |
| `runbook_step`              | 00003     | EXISTS                                                                                              |
| `knowledge_test`            | 00003     | EXISTS — questions/answers definition                                                               |
| `confirmation`              | 00003     | EXISTS — sign-off template definition                                                               |
| `protocol_assignment`       | 00003     | EXISTS — simple: protocol_id + profile_id + status (pending/completed/expired). NO progress columns |
| `knowledge_test_attempt`    | —         | MISSING — no way to record quiz scores                                                              |
| `confirmation_signature`    | —         | MISSING — no way to record sign-offs                                                                |
| `procedure_step_completion` | —         | MISSING — no way to track which steps an employee has finished                                      |

**Impact:** Readiness score hardcoded to `false` in `use-protocol-journey.ts:80`. Training module cannot function.

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

### 1.4 Operations (Wave 3) — PARTIAL

| Table                  | Migration      | Status                                                                                        |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `department_session`   | 20260304200000 | EXISTS — status: upcoming/active/pending_signoff/closed/missed. UNIQUE(workspace, dept, date) |
| `session_hook`         | —              | MISSING — no hook definitions (pre_open, open, scheduled, pre_close, close)                   |
| `session_task`         | —              | MISSING — operational tasks tied to session hooks (different from schedule_day_task)          |
| `session_note`         | —              | MISSING — handoff/closing notes per session                                                   |
| `daily_reconciliation` | 20260304200100 | EXISTS — status: open/submitted/awaiting_approval/approved/locked/unreconciled                |
| `deviation`            | 20260304200200 | EXISTS — domain: safety/customer/procedure/system/material                                    |
| `shift_approval`       | 20260304200200 | EXISTS — status: pending/approved/edited/disputed                                             |

**Impact:** Nothing creates department sessions. Schedule publish has no side effects. The entire operations layer is inert.

### 1.5 Season Planning (Wave 6) — ALL EXIST

| Table           | Migration      | Notes                                        |
| --------------- | -------------- | -------------------------------------------- |
| `season_budget` | 20260306100000 | 1:1 with season. status: draft/active/locked |
| `day_factor`    | 20260306100000 | Weekday weight distribution                  |
| `hour_factor`   | 20260306100000 | Hourly weight distribution                   |

### 1.6 Engine Tables — ALL EXIST

| Table                     | Migration      | Purpose                                                                |
| ------------------------- | -------------- | ---------------------------------------------------------------------- |
| `engine_missions`         | 20260301200000 | AI mission templates (sequential/free/hybrid)                          |
| `engine_stages`           | 20260301200000 | Steps within AI missions (goal, instructions, success_criteria)        |
| `engine_sessions`         | 20260301200000 | Active AI sessions. mode: mission/agent. Has profile_id                |
| `engine_inbox`            | 20260301200000 | Generic data collection per session                                    |
| `engine_memory`           | 20260302000000 | Persistent pgvector memories per profile (preference/fact/summary)     |
| `engine_authority_config` | 20260302000100 | Per-workspace capability authority levels (5 levels x 9 capabilities)  |
| `engine_process`          | 20260304100000 | Workflow templates (e.g. daily_close). TEXT PK                         |
| `engine_step`             | 20260304100000 | Steps within a process. action_type + action_payload + assignee_rule   |
| `engine_trigger`          | 20260304100000 | Event-to-process matching rules with optional delay                    |
| `engine_event`            | 20260304100000 | Immutable event log. Idempotency support                               |
| `engine_state`            | 20260304100000 | Running process instances. entity_type/entity_id, current_step, status |
| `engine_delayed_trigger`  | 20260304100000 | Timer queue for delayed triggers                                       |
| `engine_state_step`       | —              | MISSING — per-step completion tracking on instances                    |

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

| Page             | Route                       | Status      | Notes                                                                                                                                        |
| ---------------- | --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule Planner | `/dashboard/schedule`       | WORKING     | Full week/day/month views, DnD shifts, Day Control Panel, publish workflow, Realtime on 6 tables                                             |
| People           | `/dashboard/people`         | WORKING     | DataTable, invite status, employee cards, row actions                                                                                        |
| Reports          | `/dashboard/reports`        | WORKING     | ReportsPageShell, AI chat panel, saved reports, deep insights                                                                                |
| Chat             | `/dashboard/chat`           | WORKING     | ChatShell, real-time messages, DMs, conversation management                                                                                  |
| Governance       | `/dashboard/governance`     | PARTIAL     | GovernanceOverview, ProtocolEmployeeList, OverdueAlerts work. EmployeeJourneyMap hardcodes isCompleted=false. No CRUD for policies/protocols |
| Operations       | `/dashboard/operations`     | PLACEHOLDER | Route exists, no operational dashboard                                                                                                       |
| Daily Close      | `/dashboard/close`          | WORKING     | CloseOutFlow, checklist, gatekeeper, image upload, settlement validation                                                                     |
| Reconciliation   | `/dashboard/reconciliation` | WORKING     | DayList, DayApproval, ShiftApproval, Revenue, Deviation sections                                                                             |
| Season           | `/dashboard/season`         | WORKING     | 4 tabs: overview, budget, day-factors, hour-factors                                                                                          |
| Organization     | `/dashboard/organization`   | WORKING     | Department/location/team/position list, CRUD dialogs                                                                                         |
| Settings         | `/dashboard/settings`       | PARTIAL     | Tab navigation, opening hours. No general settings, branding, notifications                                                                  |
| AI               | `/dashboard/ai`             | WORKING     | Full Mr. Botsson interface                                                                                                                   |

### 2.3 Document View (Handbok)

| Component                | Status  | Notes                                               |
| ------------------------ | ------- | --------------------------------------------------- |
| DocumentModeShell        | WORKING | Full layout with canvas + panel                     |
| DocumentModeCanvas       | WORKING | Tiptap editor, loads/saves from handbook_chapter    |
| DocumentModeSidebar      | WORKING | 10 fixed chapter navigation                         |
| DocumentModeToolbar      | WORKING | Formatting toolbar                                  |
| DocumentModePanel        | WORKING | 3 tabs: tools, actions, settings                    |
| Employee handbook reader | MISSING | Employees cannot read chapters their admin wrote    |
| Handbook-to-RAG pipeline | MISSING | Saved chapters not chunked into workspace_doc_chunk |

### 2.4 Employee Views (My View / Arbeidsrom)

| Page           | Route                        | Status      | Notes                                                                                    |
| -------------- | ---------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Oversikt       | `/dashboard` (employee mode) | WORKING     | EmployeeDashboard: today's shift, upcoming shifts, readiness score, open shifts to claim |
| Min vaktplan   | `/dashboard/my-schedule`     | PLACEHOLDER | "Under construction" shell                                                               |
| Min opplaering | `/dashboard/my-training`     | PLACEHOLDER | "Under construction" shell                                                               |
| Min profil     | `/dashboard/my-cv`           | PARTIAL     | Route exists, personal profile view                                                      |
| Min lonn       | `/dashboard/my-salary`       | PLACEHOLDER | "Under construction" shell                                                               |

---

## 3. The 10 Gaps

### Gap 1: No Event Emission (FOUNDATIONAL)

**What:** The Event Engine (`engine_event` -> `engine_trigger` -> `engine_state`) is fully built. The `engine-dispatch` Edge Function processes events, matches triggers, creates state, and executes steps. But **nothing in the application emits events**.

**Why it matters:** Without events, every module is an island. Schedules don't create sessions. Invites don't assign protocols. Closes don't trigger reconciliation.

**Fix:** Connect telemetry `emit()` to `engine_event` as a fourth destination (see Gap 2).

### Gap 2: Two Disconnected Event Systems (FOUNDATIONAL)

**What:** Two event systems exist independently:

| System    | Package                            | Writes to                         | Purpose             |
| --------- | ---------------------------------- | --------------------------------- | ------------------- |
| Telemetry | `@smartout/telemetry`              | PostHog + activity_trail + logger | Analytics, audit    |
| Engine    | `engine_event` + `engine-dispatch` | engine_trigger -> engine_state    | Workflow automation |

Telemetry has 11 typed events, routing, categories, entity refs. Engine has dispatch, trigger matching, step execution. Neither talks to the other.

Additionally, telemetry `emit()` is never called from UI code. The `useTrack` hook exists but 0 components import it.

**Fix:**

1. Add `"engine_event"` as fourth destination in `registry.ts`
2. Write `providers/engine-event.ts` that calls `engine-dispatch` Edge Function
3. Wire `emit()` into every TanStack Query mutation `onSuccess`
4. Map telemetry event names to engine event_types

### Gap 3: No Completion Tracking Infrastructure (FOUNDATIONAL)

**What:** Three tables are missing:

| Missing Table               | Purpose                                        | Blocks                              |
| --------------------------- | ---------------------------------------------- | ----------------------------------- |
| `knowledge_test_attempt`    | Record quiz scores per employee per test       | Training module, readiness score    |
| `confirmation_signature`    | Record sign-offs per employee per confirmation | Training module, compliance         |
| `procedure_step_completion` | Track which steps an employee has finished     | Training module, procedure progress |

`protocol_assignment` is too simple — only `status` (pending/completed/expired) with no intermediate tracking.

**Evidence:** `use-protocol-journey.ts:80` — `isCompleted: false, // MVP: not tracked in DB yet`

**Fix:** Create these three tables + add progress columns to `protocol_assignment` (or compute from joins).

### Gap 4: No Per-Step Instance Tracking on Engine State

**What:** `engine_state` tracks `current_step` (single integer) and `result` (JSONB blob). Works for sequential system-driven processes (DailyClose). Breaks for employee-facing workflows where:

- Steps can be done out of order
- Each step needs who-completed-it + when + evidence
- Multiple steps can be in-progress simultaneously

**Fix:** Create `engine_state_step` table:

```
state_id, step_order, status (pending/active/completed/skipped/failed),
completed_by (FK profile), completed_at, result (JSONB — quiz score, signature ref)
```

### Gap 5: Schedule -> Operations Disconnect

**What:** Publishing shifts (`usePublishShifts`) updates `schedule_shift.status` to "published" and `is_published` to true. No side effects — no department_session creation, no event emission, no guardian notification.

The `department_session` table exists with the right schema. The DailyClose process is seeded with 10 steps and 2 triggers (`department_session.pending_signoff`, `shift.last_checkout`). But nothing creates sessions or emits these events.

**Fix:** When shifts are published for a date, emit `"shift published"` event. Engine trigger creates department_session. Session lifecycle emits further events (pending_signoff -> DailyClose).

### Gap 6: Invite -> Trainee Dead End

**What:** `accept-invitation` Edge Function creates:

- Auth user via `auth.admin.createUser()`
- Updates `user_identity` with name
- Creates `profile` with `status: 'trainee'`
- Inserts `team_member` rows
- Redirects to `/dashboard`

Does NOT create: journey data, protocol assignments, trainee progress records, or any first-day experience. Employee lands on EmployeeDashboard with nothing trainee-specific.

**Fix:** Emit `"invitation.accepted"` event. Engine trigger starts onboarding process that assigns protocols and creates trainee journey state.

### Gap 7: Employee-Facing Pages Are Shells

**What:** Four employee routes are placeholder shells:

| Route                    | Current state                |
| ------------------------ | ---------------------------- |
| `/dashboard/my-schedule` | "Under construction" message |
| `/dashboard/my-training` | "Under construction" message |
| `/dashboard/my-salary`   | "Under construction" message |
| `/dashboard/my-cv`       | Partial — basic profile view |

The EmployeeDashboard landing page (`/dashboard` in employee mode) works — shows today's shift, upcoming shifts, readiness score, open shifts.

**Fix:** Build after Gaps 1-6 are resolved. My-schedule needs published shifts query. My-training needs completion tracking tables. My-salary needs payroll tables.

### Gap 8: Document Mode Has No Reader

**What:** Admins can write 10 handbook chapters via Tiptap editor. Content stored as JSONB in `handbook_chapter`. But:

- Employees cannot read the handbook (no reader view)
- Content is not chunked into `workspace_doc_chunk` (agents can't search it)
- No connection between handbook chapters and governance protocols

**Fix:**

1. Build employee handbook reader (render Tiptap JSON as read-only)
2. On chapter save, chunk content into `workspace_doc_chunk` for RAG
3. Optionally link chapters to protocols

### Gap 9: Governance Has No CRUD

**What:** The governance page (`/dashboard/governance`) shows a read-only overview:

- GovernanceOverview — protocol cards with completion % (fake — always shows based on assignment count, not actual completion)
- ProtocolEmployeeList — employee list per protocol
- OverdueAlerts — overdue training alerts

But there is no UI for:

- Creating/editing policies
- Creating/editing protocols
- Building procedures (step-by-step)
- Creating knowledge tests
- Creating confirmation templates
- Assigning protocols to employees

The DB tables for all of these exist (00003_governance_tables.sql). Only the admin UI is missing.

**Fix:** Build governance CRUD. This is a standard admin UI task, not architecturally complex.

### Gap 10: No Session Hooks or Operational Tasks

**What:** The Module 4 spec describes session hooks (pre_open, open, scheduled, pre_close, close) that trigger procedures and routines as `session_task` records. None of this exists:

- `session_hook` table — MISSING
- `session_task` table — MISSING (different from `schedule_day_task` which is ad-hoc todos)
- `session_note` table — MISSING
- Auto-triggering via time-based hooks — NOT BUILT
- Connection between governance procedures and operational tasks — NOT BUILT

`schedule_day_task` is a simple todo list (label, category, status as free text). `session_task` would be a hook-triggered, compliance-tracked operational task tied to a department session with a proper status lifecycle.

**Fix:** Create session_hook, session_task, session_note tables. Wire hooks to engine_trigger. These are new action_types in the Event Engine, not a separate system.

---

## 4. Architecture Decisions

### 4.1 Event Engine as Universal Runtime

**Decision:** The Event Engine (`engine_process` + `engine_step` + `engine_state` + `engine_trigger` + `engine_event`) will serve as the universal workflow runtime for ALL process types:

| Process            | entity_type         | Trigger event                      | Steps                                                                |
| ------------------ | ------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Daily Close        | department_session  | session.pending_signoff            | 10 seeded steps (assign_task, validate_settlement, etc.)             |
| Onboarding Journey | profile             | invitation.accepted                | Present content, administer test, collect signature, check readiness |
| Training Protocol  | protocol_assignment | protocol.assigned                  | Per-procedure steps, knowledge tests, confirmations                  |
| HACCP Daily        | department_session  | session_hook.pre_open              | CCP verification, temperature logging, deviation handling            |
| Session Hooks      | department_session  | session.opened / session.pre_close | Trigger routine tasks at specific times                              |

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
> Duration: 4 weeks. Sequence matters — each week builds on the previous.

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

`20260411120000_workspace_kpi_copy.sql`

### Enum Count

**61 custom enums.** Full list in BUILD_ORDER.md Appendix or via: `grep -r "CREATE TYPE" supabase/migrations/`

Key enums that DO NOT exist yet and must be created:

- `session_task_status` (pending/available/in_progress/completed/skipped/overdue/escalated)
- `session_hook_type` (pre_open/open/scheduled/pre_close/close)

---

## 7. Telemetry System — Current State

### Package: `@smartout/telemetry`

| File                          | Purpose                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `registry.ts`                 | 11 typed events, BaseEvent shape, EntityRef, ActionVerb, EVENT_ROUTING map |
| `emit.ts`                     | Router: checks routing config, dispatches to providers                     |
| `providers/posthog.ts`        | PostHog EU (client + server)                                               |
| `providers/logger.ts`         | Structured stdout logging                                                  |
| `providers/activity-trail.ts` | Writes to `activity_trail` table via service role                          |
| `hooks/use-track.ts`          | React hook for client-side tracking                                        |
| `react.ts`                    | React bindings                                                             |

### Registered Events (11)

| Event               | Category      | Destinations                    |
| ------------------- | ------------- | ------------------------------- |
| auth signed_up      | auth          | posthog, logger                 |
| auth signed_in      | auth          | posthog, logger                 |
| auth signed_out     | auth          | posthog                         |
| department created  | org_structure | posthog, logger, activity_trail |
| department updated  | org_structure | posthog, logger, activity_trail |
| department archived | org_structure | posthog, logger, activity_trail |
| shift created       | scheduling    | posthog, logger, activity_trail |
| shift updated       | scheduling    | posthog, logger, activity_trail |
| shift deleted       | scheduling    | posthog, logger, activity_trail |
| page viewed         | navigation    | posthog                         |
| button clicked      | navigation    | posthog                         |

### Usage: 0 call sites

`emit()` is never called from app code. `useTrack` hook is never imported. The `/api/telemetry` route exists but no client sends to it.

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

| What                             | Path                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| DashboardShell                   | `apps/web/src/components/dashboard/DashboardShell.tsx`            |
| AdminDashboard                   | `apps/web/src/components/dashboard/AdminDashboard.tsx`            |
| EmployeeDashboard                | `apps/web/src/components/dashboard/EmployeeDashboard.tsx`         |
| Telemetry package                | `packages/telemetry/src/`                                         |
| Engine dispatch                  | `supabase/functions/engine-dispatch/index.ts`                     |
| Schedule hooks                   | `apps/web/src/app/dashboard/schedule/_hooks/`                     |
| Dashboard hooks                  | `apps/web/src/app/dashboard/_hooks/`                              |
| Document Mode                    | `apps/web/src/app/dashboard/_components/document-mode/`           |
| Governance page                  | `apps/web/src/app/dashboard/governance/`                          |
| Readiness hook (hardcoded false) | `apps/web/src/app/dashboard/_hooks/use-protocol-journey.ts:80`    |
| Agent router                     | `services/stage-engine/src/core/agent-router.ts`                  |
| DailyClose seed                  | `supabase/migrations/20260304300000_seed_daily_close_process.sql` |
| Process tables                   | `supabase/migrations/20260304100000_engine_process_tables.sql`    |

---

_Next update: Week of 2026-04-18_
_Owner: Pontus Lindroth_
