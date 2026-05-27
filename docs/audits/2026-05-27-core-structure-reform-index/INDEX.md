---
title: "Core Structure Reform — Entity Index & Impact Analysis"
status: draft
created: 2026-05-27
updated: 2026-05-27
module: core-structure
tags: [audit, core-structure, reform, schema, adrs, domains, modules]
---

# Core Structure Reform — Entity Index & Impact Analysis

> Comprehensive inventory of ADRs, domain spines, module docs, migrations, and code references that touch Core Structure entities. This audit is READ-ONLY; it informs a forthcoming schema reform that will likely drop `schedule_shift.location_id` / `department_id` / `zone`, introduce `shift_zone` M:N junction, and clarify D1 naming.

---

## §1. ADR Inventory

### Critical path ADRs (entity-shaping)

| ADR | Title | Status | Entities touched | Verdict | Notes |
|---|---|---|---|---|---|
| **ADR-0367** | Day Line Area-Anchored Runtime + Core-Structure Clarification | **ACCEPTED** v1.1 | `department`, `location` (as "area"), `zone`, `asset`, `position`, `department_location` (NEW), `schedule_shift.location_id`, `session_hook`, `schedule_day_booking`, `day_line` (NEW), `shift_session` (NEW) | **KEEP** (foundational) | Tri-layer D6 model: department_session → day_line → shift_session. Introduces `department_location` M:N junction explicitly. Specifies `location` = "area" semantically in V1. Zone/asset remain unmodelled in V1. Mandates `day_line_status` derived (not stored). |
| **ADR-0056** | Cascade Core Foundation Schema | **ACCEPTED** | `department`, `location`, `position`, `zone`, `asset`, `department_operating_hours`, `planning_cycle` (D1 envelope), employment_contract, profile, workspace, schedule_shift | **KEEP** | Canonical D1–D6 cascade model. `schedule_shift` belongs to D6 Production; carries `location_id` + `department_id` per Cascade scope. `profile.location_id` mentioned as nullable but deprecated by ADR-0367. |
| **ADR-0240** | Frozen-4 Boundaries | **ACCEPTED** | `department`, `schedule_shift`, payroll tables | **KEEP** (cross-cutting) | Boundaries freeze at merge: D1 writes forbidden on development after dependent D6 works. Core Structure changes freeze department/location definitions; payroll freezes. |
| **ADR-0392** | Domain Steward — 8-File Spine + Mirror | **ACCEPTED** | `department`, `location`, `zone`, `asset`, `position`, `department_location` | **KEEP** (governance) | Introduces domain-spine pattern: `docs/domains/core-structure/` owns canonical schema truth with `mirror: verified` / `aspirational` / `mixed` metadata. Code-wins precedence. Spines at `_DASHBOARD.md` per entity. |
| **ADR-0298** | Task Ontology — Five Sources | **ACCEPTED** | `session_task` (D6 Production), `profile` (actor), `department_id` (scope), schedule_shift implicit | **KEEP** | Unions 4 read sources (session, day_ad_hoc, personal, emma) + 1 runtime. Reads department context for task scope. Schedule_shift implicit in shift_session layer (ADR-0367). |
| **ADR-0367 Rule 2** | `session_hook` is template, NOT extended with `day_line_id` | **ACCEPTED** v1.1 | `session_hook`, `day_line` (ADR-0367 new), `department_session`, `department_id`, `hook_type` | **KEEP** | Clarifies `session_hook` fires daily via template per `(workspace_id, department_id, hook_type)` — does NOT carry instance-level `day_line_id`. Unmodelled-entity risk: old draft proposed `day_line_id` on hooks; code-audit rejected per lifecycle semantics. |
| **ADR-0367 Rule 1b** | `session_hook` UNIQUE constraint on template triple | **ACCEPTED** v1.1 | `session_hook`, `department_id`, `workspace_id` | **KEEP** (schema enforcement gate) | Migration must add `UNIQUE (workspace_id, department_id, hook_type)`. Rule enforces invariant: one hook per template triple. Requires pre-dedup backfill. |
| **ADR-0204** | Gated Mutation — Composition Orchestrator | **ACCEPTED** | `department_id` (scope), `profile` (actor), workspace_id (RLS root) | **KEEP** (cross-cutting) | Mutation pattern: server-resolve ID (ADR-0151), gate-action check, emit telemetry. Applies to all D1–D6 writes. Core Structure writes must resolve `department_id` from body or context; no client-side forgery (ADR-0151). |
| **ADR-0151** | Server-Resolved IDs (implicit) | **ACCEPTED** | `workspace_id`, `department_id`, `profile_id`, `location_id` (all must be server-resolved, never client-provided) | **KEEP** (security foundational) | Client never supplies `department_id` / `location_id` / `profile_id` / `workspace_id` on insert/update. Server resolves from JWT (workspace_id, profile_id) and business logic (department_id from party/role context). Forgeable IDs = ADR-0151 breach. |
| **ADR-0133** | Web Composes, Mobile Executes | **ACCEPTED** | `department`, `location`, `schedule_shift` (web owns authoring/D1–D5, mobile owns D6 execution only) | **KEEP** (surface boundary) | Mobile is thin client: no department creation, no location edits, no shift scheduling. Web owns all authoring. Mobile uses `department_id` / `location_id` as read-only context. Reform: mobile surfaces stay thin-client. |
| **ADR-0078** | Engine Process Channel Restriction | **ACCEPTED** | `department_id` (scope), engine_process (dispatch), channel (chat/voice) | **KEEP** | Channels routed server-side; client sends hint, BFF enforces. Department-scoped voice authoring only on chat (ADR-0078 + ADR-0133). No voice shift authoring on mobile. |
| **ADR-0156** | Day Control Panel — Canonical Admin Surface | **ACCEPTED** | `day_line` (ADR-0367 new table), `department_id`, `location_id`, `department_session` | **KEEP** | TidslinjeTab is web-only authoring surface for D6 day-level operations. Admin triggers day opens/closes per `(department_id, location_id, date)` via day_line model (ADR-0367). |
| **ADR-0095** | Shift Lifecycle — Five-Layer Architecture | **ACCEPTED** | `schedule_shift`, `shift_session` (ADR-0367 new), `department_id`, `location_id`, clock-in/checkout via shift-lifecycle RPC | **KEEP** | 5 shift states (scheduled → checked_in → checked_out → settled → archived). Shift belongs to schedule, but runtime witness (clock-in/out) anchors to shift_session + location_id (ADR-0367). |
| **ADR-0096** | schedule_shift vs department_session | **ACCEPTED** | `schedule_shift` (D2 resource planning), `department_session` (D6 aggregate), `location_id`, `department_id` | **KEEP** | Clear orthogonality: schedule_shift is resource planning (who works when). department_session is D6 aggregate per `(workspace, department, date)`. ADR-0367 adds day_line to split aggregate (payroll) from program (execution). |
| **ADR-0218** | Operating Hours — Source of Truth | **ACCEPTED** | `department_operating_hours` (CANONICAL D1), `workspace_operating_hours` (D5 base), `department_hours_override` (exceptions) | **KEEP** | `department_operating_hours` is runtime truth. Schema: `(workspace_id, department_id, weekday, start_time, end_time)`. Plan against this; no other "hours" table is authoritative. `operating_hours` (legacy) is DEAD. |
| **ADR-0200** | Atomic Season Activation — D1 Cascade Gate | **ACCEPTED** | `department_id`, `planning_cycle`, `season_budget`, D1 envelope | **KEEP** | Season create/activate is D1 atomic RPC. Affects department scope + D1 rules. Freezes pre-existing D1 data. Multi-department seasons must touch all relevant `department_id` rows. |
| **ADR-0287** | Gate Action Mandatory on Mutation Capability Tools | **ACCEPTED** | `department_id` (scope), workspace_id (RLS anchor), all D1–D6 capability tools | **KEEP** (cross-cutting) | Every capability tool mutation MUST include `gate_action()` check. Department-scoped writes check `is_admin_or_manager_in_department()`. Core Structure write tools: add-department, update-department, add-location, etc. |

### Supporting ADRs (schema, telemetry, authority)

| ADR | Title | Status | Entities touched | Verdict | Notes |
|---|---|---|---|---|---|
| ADR-0353 | Workspace Framework Binding Bootstrap | ACCEPTED | `department`, workspace, `framework_rule`, tariff context | **KEEP** (cross-cutting) | Bootstrap wires regulatory framework to workspace + department scope. Department is rule-binding unit. |
| ADR-0355 | Workspace Union Binding Lifecycle & Cache Trigger | ACCEPTED | `department`, workspace, union/tariff bindings | **KEEP** | Department-scoped union rules. Tariff rates per `department_id`. Cache invalidation on department changes. |
| ADR-0351 | Workspace Supplement Policy — Tariff Floor | ACCEPTED | `department`, tariff, payroll | **KEEP** (payroll dependent) | Department-scoped supplements. Payroll-critical; department changes = tariff refresh. |
| ADR-0387 | Role Mandatory Compliance — Hospitality Intelligence (I1) | ACCEPTED | `profile.role` (as operational compliance role, not identity role), `department_id`, procedures | **KEEP** (i1-anchored) | Department-scoped procedures require role in `profile.role` (trainee/active/inactive/offboarding). Not identity.role. Compliance gates on department role. |
| ADR-0336 (implied) | Department Manager | ACCEPTED | `department.manager_id` (FK → profile), `department_id` | **KEEP** | Department has optional leader profile. Manager = department_id → profile_id binding. |
| ADR-0363 | Get Phase Boundaries — Presentation Ontology | ACCEPTED | `department_session`, `day_line` (ADR-0367), `shift_session` (ADR-0367), phase derivation | **KEEP** | Derives phase from D6 state: scheduled → open → in_progress → closed → settled. Department_session + day_line + shift_session all have phase. |
| ADR-0287 | Gate Action Audit Symmetry (ADR-0356 tie-in) | ACCEPTED | `department_id`, gate_action mandatory on D1–D6 mutations | **KEEP** (audit) | Mutation audit trail requires gate_action per ADR-0287. Delegation capability (ADR-0356) also emits gate_action. Core Structure mutations: add_department, update_location, etc. all audit via gate_action. |
| ADR-0324 | Page Tool Authority Semantics | ACCEPTED | `department_id`, authority gates on page-tool pairs | **KEEP** (page-level) | Department-scoped authority: page + tool combo checks `is_admin_or_manager_in_department()`. TidslinjeTab page-tools check department authority. |
| ADR-0346 | Lonnsgrunnlag Positioning — Canonical | ACCEPTED | `schedule_shift`, payroll-window, `department_id` | **KEEP** (payroll) | Payroll window scoped to `(department_id, date_range)`. Schedule_shift carries department context. Reform: position & zone changes do NOT affect lonnsgrunnlag scope (department-based, not role-based). |
| ADR-0298 R6 | Chat-only V1 for create_personal, cancel_personal | ACCEPTED | `personal_task`, `profile_id` (actor), `department_id` (implicit), PII gates | **KEEP** | Personal tasks read-only on voice (ADR-0133 + ADR-0078). Chat-only tool gates to hide PII. Reform: department context remains for task filtering. |
| ADR-0415 | Server Actions vs Capability Tools Decision Tree | ACCEPTED | `department_id` (scope), all D1–D6 mutations | **KEEP** | Mutation pattern: server-action delegates to capability tool OR RPC. Both require gate_action + workspace/department scope validation. Core Structure mutations use either path; must validate scope. |
| ADR-0420 | Publish Week — Irreversible Bulk Write Semantics | ACCEPTED | `schedule_shift` (bulk insert/update), `department_id`, `location_id` (per shift), publish gate | **KEEP** | Bulk schedule publish affects `(department_id, week_id)` rows. Shifts carry location_id per ADR-0367 (to be reformed). Reform: location derivation via shift_zone M:N after publish (pre-publish schema: location_id still on shift row). |
| ADR-0428 | Employment Form — Volunteer Explicit Enum Value | ACCEPTED | `employment_contract.form` enum, `department_id` (employment scoped to department + role) | **KEEP** | Employment type explicit enum; not inferred from location/department. Department is contract-binding unit. Reform: type stays department-scoped. |
| ADR-0426 | Event Entity — D5 Parameterization | ACCEPTED | `department`, workspace, event scheduling, zone (event-zone fixture) | **KEEP** (D5 event context) | Events parameterize demand per department. Zone implied as event-space (event floor). Reform: zone remains unmodelled in V1; fixture-level only. |

### Historical/superseded ADRs touching Core Structure

| ADR | Title | Status | Entities touched | Verdict | Notes |
|---|---|---|---|---|---|
| ADR-0057 | Payroll Schema Separation | ACCEPTED | `schedule_shift`, `employment_contract`, `department_id` (payroll-scoped to dept, not location) | **KEEP** (payroll foundational) | Payroll scoped to `(workspace, department, date_range)`, not location. Reform: location changes are D1 refactor; payroll stays department-scoped. |
| ADR-0066 | Temporal Shift Lock Architecture | ACCEPTED | `schedule_shift`, `department_id`, `location_id` (implicit time-lock context) | **KEEP** (audit trail) | Shifts lock post-publish per department-date. Location context implicit via shift_zone post-ADR-0367. |
| ADR-0076 | Contract Composition as Cascade Derivation | ACCEPTED | `employment_contract`, `department_id`, compliance rules per department | **KEEP** (contract authority) | Contracts derived from Framework + Department rules. Reform: department stays contract anchor; location does not affect contract terms. |
| ADR-0108 | Use Shift Lifecycle Platform-Neutral | ACCEPTED | `schedule_shift`, `shift_session` (ADR-0367 introduces), clock-in/out, `location_id` | **KEEP** (lifecycle foundational) | 5-state shift machine (ADR-0095 + 0108). Reform: clock-in context = `shift_session` + location_id pair per ADR-0367 tri-layer. |

---

## §2. Domain Spine Inventory

### core-structure domain (`docs/domains/core-structure/`)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **_DASHBOARD.md** | `department`, `location`, `zone`, `asset`, `position`, `department_location` | assumed verified | **KEEP** | Index to 8-spine per ADR-0392. Canonical source of truth per ADR-0392. |
| **DATA-MODEL.md** | All D1 tables (department, location, zone, asset, position, department_location, department_operating_hours, department_hours_override, workspace_operating_hours, planning_cycle) | verified 2026-05-23 | **KEEP** | Explicitly documents `department_location` (NEW per ADR-0367), `location` semantics as "area" in V1, zone/asset as unmodelled in V1. Code-wins; mirrors migration dates. Mirror section updated post-ADR-0367. |
| **ARCHITECTURE.md** | D1 entity relationships, workspace boundary, RLS scoping | (assume verified) | **KEEP** | RLS scoping per ADR-0151 + ADR-0392. Department = RLS root for D2+ (profile, team, position, etc.). |
| **OVERVIEW.md** | D1 layer description, HVEM axis (department), HVOR axis (location/zone/asset) | (assume verified) | **KEEP** | Semantic clarity: HVEM = who (department, position, team), HVOR = where (location/zone/asset). |
| **ROADMAP.md** | Property layer (deferred per ADR-0367 v1.1), zone/asset surfacing (deferred) | aspirational | **UPDATE-pending-reform** | Property = multi-site chain layer (deferred to V2). Zone/asset UI not in V1 scope. Reform may reactivate if hierarchy clarified. |
| **GAPS-AND-DEBT.md** | department.manager_id, location.manager_id, zone surfacing, asset surfacing, position UI | mixed | **UPDATE-pending-reform** | Lists unfinished work. Reform should revisit: position UI, zone/asset hierarchy. department.manager_id implemented (ADR-0336 implicit). |
| **USER-FLOWS.md** | Admin workflows: add/edit department, add/edit location, manage department↔location pairings (ADR-0367 new) | (assume verified) | **KEEP** | Updated post-ADR-0367 to document department_location authoring (TidslinjeTab → day_line → audience.shift_ids loop). |
| **E2E-COVERAGE.md** | E2E tests for department CRUD, location CRUD, department_location fixtures | mixed | **UPDATE-pending-reform** | Should verify: new department_location M:N junction, location UNIQUE constraints, zone isolation test coverage. |

### day-session domain (`docs/domains/day-session/`)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **_DASHBOARD.md** | Links to D6 tables: `day_line`, `shift_session` (ADR-0367 new), `session_hook` (updated per ADR-0367 Rule 2) | assumed verified | **KEEP** | Tri-layer D6 per ADR-0367. Must reference department_location for day_line audience derivation. |
| **DATA-MODEL.md** | `day_line` (NEW per ADR-0367), `shift_session` (NEW), `session_hook` (unchanged anchor), `session_task` (updated per ADR-0367: `scheduled_at` column), `schedule_day_booking`, `deviation`, `department_session` | verified 2026-05-25 | **KEEP** | Updated post-ADR-0367. Tri-layer clearly documented: department_session (aggregate) → day_line (program) → shift_session (runtime). `session_task.scheduled_at` added per ADR-0367 scope expansion. |
| **ARCHITECTURE.md** | D6 tri-layer, RLS boundaries per day_line, shift_session scope | (assume verified) | **KEEP** | RLS per ADR-0367: day_line reads check `is_admin_or_manager_in_department()` + `department_location` pairing verification. |
| **USER-FLOWS.md** | Day open/close workflows (via day_line), shift check-in/out (shift_session), task assignment (session_task), bookings (schedule_day_booking) | (assume verified) | **KEEP** | Updated to reflect day_line audience = all employees with shifts on that (department, location, date). |
| **E2E-COVERAGE.md** | Tests for day_line create/read/list, shift_session check-in, task routing per day_line, booking confirmations | mixed | **UPDATE-pending-reform** | Should add: day_line ↔ shift_session M:N junction coverage (shift covering multiple areas). |
| **OVERVIEW.md** | D6 model & tri-layer semantics | (assume verified) | **KEEP** | Clarity on what each layer owns: aggregate (payroll), program (communication), runtime (witness). |
| **ROADMAP.md** | post-ADR-0367 gaps (shift_zone M:N UI, area-handoff notifications, per-zone reconciliation) | aspirational | **UPDATE-pending-reform** | Reform will likely implement shift_zone M:N; post-reform roadmap should recalibrate. |
| **GAPS-AND-DEBT.md** | Known ADR-0367 debt: derived status helper unimplemented per Rule 1 (status = read-time derive), pre-day notifications missing per-area granularity | mixed | **KEEP** | Clearly lists what's deferred. Reform should verify these gaps resolved before dropping location_id from shift. |

### scheduling domain (`docs/domains/scheduling/`)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **_DASHBOARD.md** | Schedule (publish-week), `schedule_shift` (D2 planning), `schedule_day_booking`, `season_budget` (D4 demand) | assumed verified | **KEEP** | Links to Core Structure scope (department-day planning). |
| **DATA-MODEL.md** | `schedule_shift` (carries `location_id`, `department_id`, `zone` text column), `season_budget` (D4), `planning_event` (D1 trigger) | verified 2026-05-?? | **UPDATE-pending-reform** | **CRITICAL:** Documents current `schedule_shift.location_id` + `department_id` + `zone` text column. Reform will drop location_id (moved to shift_zone M:N junction), keep department_id (D2 planning scope), drop zone text (replaced by shift_zone FK). |
| **ARCHITECTURE.md** | Publish-week atomicity, schedule_shift planning scope (department-based), location assignments | (assume verified) | **UPDATE-pending-reform** | Must clarify: location derivation post-reform (via shift_zone M:N, not shift row). Publish-week validation logic must account for new M:N location binding. |
| **E2E-COVERAGE.md** | Tests for publish-week, add-shift, update-shift, shift visibility per department | mixed | **UPDATE-pending-reform** | E2E for location assignment will change: pre-reform assign location_id on shift row; post-reform insert shift_zone junction rows. |
| **USER-FLOWS.md** | Manager schedules shifts per department + location (currently location_id picker), publishes week | (assume verified) | **UPDATE-pending-reform** | Post-reform: shift created (no location), then admin assigns zones via shift_zone UI (TidslinjeTab or new schedule-detail side panel). |

### payroll domain (`docs/modules/payroll/`, `docs/domains/payroll/` if exists)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **DATA-MODEL.md** | `employment_contract` (department-scoped), payroll calculations (schedule_shift.department_id as scope), `department_id` in all payroll queries | (assume mixed) | **KEEP** (payroll scope, not location-scoped) | Payroll is scoped to `(workspace, department, date_range)`. Location changes DO NOT affect payroll calculations. Reform: payroll stays department-anchored; location drop is orthogonal. |
| **ARCHITECTURE.md** | Payroll pipeline: contract-driven → timebank → settlement → export | (assume verified) | **KEEP** | Department anchor unchanged post-reform. |
| **MODULE_PAYROLL.md** | Phase 0–3 roadmap, payroll calculation rules, tariff integration | aspirational | **KEEP** | Payroll scope locked (department-based). Reform does not affect payroll module. |

### procedure-engine domain (`docs/domains/procedure-engine/`, `docs/modules/procedure-engine/`)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **DATA-MODEL.md** | `engine_process` (orchestration), `engine_state` (instance), `engine_state_step` (step), `session_task` (D6 producer), `procedure` (I1 compliance), `routine` (I1 template) | (assume mixed) | **KEEP** (location not directly scoped) | Procedure scope = department + role (ADR-0387). Location implicit via day_line audience. Reform: day_line ↔ shift_session clarifies routing. |
| **MODULE_PROCEDURE_ENGINE.md** | I1 role-compliance procedures, routine authoring (web-only per ADR-0133) | aspirational | **KEEP** | Department-scoped procedures. Location context for audience derivation (shift_session → day_line → audience). |
| **ARCHITECTURE.md** | Event-driven workflow dispatch, action types (assign_task, send_notification, etc.), channel restriction (ADR-0078) | (assume verified) | **KEEP** | Reform does not change dispatch layer; location context resolved at read time (day_line anchor). |

### onboarding-wizard domain (`docs/domains/onboarding-wizard/`)

| File | Entities | Mirror | Verdict | Notes |
|---|---|---|---|---|
| **DATA-MODEL.md** | Onboarding mission (I1 introduction), steps (policy + protocol reading), profile → department enrollment | (assume verified) | **KEEP** | Onboarding scoped to department + role. Location context deferred until day-assignment (ADR-0357 thin-shell page polish). |
| **USER-FLOWS.md** | New employee → reads policies per department → department manager confirms competence (C4) → goes live | (assume verified) | **KEEP** | Department scope unchanged. |

---

## §3. Module Docs Inventory

### core-structure modules (`docs/modules/core-structure/`)

| File | Entities | Verdict | Notes |
|---|---|---|---|
| **MODULE_CORE_STRUCTURE.md** | Department, location (area), zone, asset, position, department_location | **KEEP** | High-level overview. Post-reform, should clarify: D1 = namespace (workspace+department+location immutable once wired), not entity collection. |
| **DEPARTMENTS.md** | Department CRUD, manager assignment, operating hours, team membership | **KEEP** | Operational guide. Post-reform, add: department_group enum (foh/boh/mgmt/events) if implemented. |
| **LOCATIONS-AND-AREAS.md** | Location CRUD, zones under location, asset fixtures | **UPDATE-pending-reform** | Will need revision once property-layer is deferred and zone/asset surfacing is clarified. Current doc lists zone/asset as "not surfaced in V1" — post-reform, confirm they remain unmodelled. |

### notifications module

| File | Entities | Verdict | Notes |
|---|---|---|---|
| **DATA-MODEL.md** | `expo_push_token` (links to profile, scoped to workspace), `notification` (routed by department_id + location_id per day_line) | **UPDATE-pending-reform** | Notifications routed per day_line audience (all shifts on (department, location, date)). Post-reform, shift_zone M:N means a shift can target multiple location_ids → fan-out notifications per location. |
| **ARCHITECTURE.md** | Push notification routing: engine_event → emit() → PostHog + notifications channel | **KEEP** (routing layer unchanged) | Payload includes department_id + day_line_id (when applicable). Location routing changes: pre-reform use shift.location_id; post-reform expand per shift_zone rows. |

### day-timeline (daytimeline) module

| File | Entities | Verdict | Notes |
|---|---|---|---|
| **MODULE_DAYTIMELINE.md** | Day surface: tasks, bookings, notes, hooks anchored on day_line (ADR-0367 new) | **KEEP** | Orchestrates day-line entity visibility. Audience = shift_session rows matching (department, location, date). |
| **DATA-MODEL.md** | session_task (scheduled_at added per ADR-0367), schedule_day_booking (location-scoped via day_line), deviation (location context via day_line), notes (anchored on day_line or shift_session) | **KEEP** | Post-ADR-0367 documentation. Clear. |

---

## §4. Migration Inventory

### Core Structure table creation

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| `00002_structure_tables.sql` | Creates department, location, zone, asset, position | **KEEP** (foundational) | Original schema. `location` still carries no parent (V1 flat). Zone/asset created but not surfaced. Position type for role typing (not used in V1). |
| `20260421100200_cascade_a1_domain_tables.sql` | Creates department_operating_hours (CANONICAL), department_hours_override, planning_cycle (D1 envelope), workspace_operating_hours | **KEEP** | Hours tables unchanged by reform. |
| `20260620120500_department_location_junction.sql` | **NEW** junction `department_location(workspace_id, department_id, location_id)` per ADR-0367 | **KEEP** | ADR-0367 introduces explicit M:N binding. RLS policies for admin-only write. Used for day_line audience derivation. |

### schedule_shift columns (D6 Production)

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| (implicit in `00002` or `20260228150000`?) | Creates schedule_shift with `location_id FK → location`, `department_id FK → department`, `zone TEXT` | **DEPRECATE columns** (but keep table) | Reform will DROP `location_id`, DROP `zone` text column. Keep `department_id` (planning scope, not location-bound). |
| `20260620110000_day_line_shift_session.sql` (implied) | ADR-0367 Phase A: creates `day_line`, `shift_session` | **KEEP** (new tables) | New D6 tri-layer tables. Related migration adds `shift_zone(shift_id, zone_id)` M:N junction (post-reform). |

### Day-line & shift-session wiring

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| (post-audit spec) | `day_line(workspace_id, department_session_id, location_id)`, `shift_session(workspace_id, schedule_shift_id, department_session_id)` | **KEEP** | ADR-0367 Phase A tables. No schema change post-reform (location_id stays on day_line, not shift). |
| (post-audit spec) | `shift_zone(shift_id, location_id)` M:N junction — FUTURE | **PLAN** (post-reform phase 2) | NEW table to replace `schedule_shift.location_id` + `zone` text. One shift → many zones/areas. |
| `20260620120700_day_line_backfill.sql` | Backfill day_line rows from department_location pairings per ADR-0367 Phase A | **KEEP** | Ensures every (department, location, date) pair that appears in schedules has a day_line row. |
| `20260620120800_day_line_capability_authority_seed.sql` | Authority seed: add admin capability to update day_line audience (manage department_location) per ADR-0367 | **KEEP** | Capability registry entry. Post-reform, may rename tool or expand scope (shift_zone management). |

### session_hook & related

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| `20260412100300_session_infrastructure.sql` | Creates session_hook (template per workspace + department + hook_type, no instance binding) | **KEEP** | Per ADR-0367 Rule 2: hook is template, fires daily. No location binding. `day_line_id = NULL` per Rule 2. |
| (post-ADR-0367 Phase A) | Adds UNIQUE constraint `(workspace_id, department_id, hook_type)` on session_hook per ADR-0367 Rule 1b | **KEEP** (schema enforcement) | Schema migration; no data change. Requires pre-dedup backfill if duplicates exist. |

### profile.location_id (deprecated)

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| (if exists, pre-ADR-0367) | `profile.location_id FK → location` | **DEPRECATE** (drop in reform phase 2) | Not currently used in code. ADR-0056 mentioned as "nullable, deprecated." Profile has no location binding (location is session-context, not profile-context). Reform: DROP column. |

### Migrations touching schedule_shift.location_id or .zone

| Migration | What | Reform impact | Notes |
|---|---|---|---|
| `20260404000000_schedule_shift_source_v3_bulk_import.sql` (inferred) | Bulk import workflow for shifts + locations | **UPDATE-pending-reform** | Import must change: post-reform, insert shifts without location_id, then populate shift_zone M:N. |
| Any e2e migration (implicit) | E2E fixtures seed schedule_shift with location_id | **UPDATE-pending-reform** | Fixture generation must split: create shift, populate shift_zone junction. |

---

## §5. Code References

### Direct column references (`schedule_shift.location_id`, `department_id`, `zone`)

| File | Line | Reference | Reform action |
|---|---|---|---|
| `apps/web/src/components/day/tabs/RosterTab.tsx` | ~38 | Comment: "`schedule_shift.department_id` is NULL (Cascade D1 denorm not applied)" — **BUG COMMENT** | UPDATE-CODE: addresses L-0064 trap (nullable department_id). Reform clarifies: department_id MUST be NOT NULL (planning scope). Add migration to backfill + NOT NULL constraint. |
| `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | ~45 | Comment: "`schedule_shift.location_id` carries one; `schedule_day_booking → day_line`" | KEEP (commentary on tri-layer wiring per ADR-0367) |
| `apps/web/src/app/dashboard/_hooks/use-roster.ts` | ~52 | Comment: "`schedule_shift.department_id` is nullable" + filter logic | UPDATE-CODE: add NOT NULL constraint + backfill before reform. |
| `apps/web/src/app/dashboard/_hooks/use-shift-day-stats.ts` | ~61 | Comment: "Bypasses L-0064 trap... by NOT filtering" on `schedule_shift.department_id` | KEEP (documents trap); UPDATE-after-reform (no bypass needed). |
| `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeTab.tsx` | ~108 | Comment: "`schedule_shift.location_id` via FK" | KEEP-comment (documents where location comes from); UPDATE-code (post-reform, join shift_zone instead). |
| `apps/web/src/app/dashboard/_actions/add-shift-action.ts` | ~204 | Comment: "`schedule_shift.department_id` [not set per day]" — **NOTE ON BUG** | UPDATE-CODE: backfill missing department_ids; add server-side resolution per ADR-0151. |
| `apps/web/src/app/dashboard/_actions/add-shift-action.ts` | ~211 | "Stored as `schedule_shift.location_id`" | KEEP-code (still works today); DEPRECATE-post-reform. |
| `apps/web/src/app/dashboard/_actions/helpers/resolve-audience-dept-ids.ts` | ~33 | JOIN `schedule_shift.department_id` for audience | KEEP-code (unchanged); works pre/post-reform. |
| `apps/e2e/procedure-engine/journey-4-shift-location.spec.ts` | ~5 | E2E test: "schedule_shift.location_id is set in DB" | UPDATE-test (post-reform, shift_zone M:N replaces location_id on shift row). |
| `packages/ai/src/capabilities/timeline-template/tools.ts` | ~281 | Comment: "For shift scope: read `schedule_shift.department_id`" | KEEP-comment; code OK. |
| `packages/supabase/dist/server.d.ts` | ~3821 | Type: `foreignKeyName: "schedule_shift_department_id_fkey"` | REGENERATE-types (post-reform, after migrations). |
| `packages/supabase/dist/client.d.ts` | ~similar | Type exports | REGENERATE-types (post-reform). |

### Supabase Edge Functions reading Core Structure

| File | Lines | Reference | Reform action |
|---|---|---|---|
| `supabase/functions/session-hook-executor/index.ts` | ~45–60 | Reads `session_hook` per `(workspace, department)` and filters `schedule_shift` by `department_id` | KEEP (unchanged by reform) |
| `supabase/functions/ops-monitor/index.ts` | ~110–125 | Reads `department_session.department_id` for telemetry | KEEP (unchanged) |
| `supabase/functions/session-lifecycle/index.ts` | ~80–95 | Emits department_id in telemetry | KEEP (unchanged) |
| `supabase/functions/session-task-overdue-cron/index.ts` | ~42 | Reads `session.department_id` for task scoping | KEEP (unchanged) |

### Capabilities reading Core Structure

| File | Lines | Count | Reference | Reform action |
|---|---|---|---|---|
| `packages/ai/src/capabilities/` (110 hits) | Various | 110 | References to `.department_id`, `.location_id`, `.zone`, `.position_id` across timeline-template, routine, shift-authoring, task tools | AUDIT-POST-REFORM: Verify each reference post-migration (M:N shift_zone handling, location derivation). |

---

## §6. Summary Table

| Document | Type | Entities touched | Reform action | Priority |
|---|---|---|---|---|
| **ADR-0367** | ADR (foundational) | day_line, shift_session, department_location (NEW), schedule_shift.location_id (via tri-layer routing), location as "area" | **KEEP** (v1.1 accepted) | CRITICAL |
| **ADR-0056** | ADR (cascade model) | D1 envelope, department, location, schedule_shift, department_operating_hours | **KEEP** (unchanged) | HIGH |
| **ADR-0392** | ADR (governance) | domain-spine architecture for Core Structure | **KEEP** (enforcement gate) | HIGH |
| **ADR-0151** | ADR (security) | workspace_id, department_id, location_id (all server-resolved) | **KEEP** (unchanged) | CRITICAL |
| **ADR-0204, 0287** | ADR (mutation gate) | gatedMutation + gate_action on all D1–D6 writes | **KEEP** (unchanged) | HIGH |
| **ADR-0240** | ADR (frozen-4 boundaries) | department definitions freeze after dependent work | **KEEP** (unchanged) | MEDIUM |
| **docs/domains/core-structure/** | Domain spine | department, location, zone, asset, position, department_location | **KEEP** (update mirror after reform) | HIGH |
| **docs/domains/day-session/** | Domain spine | day_line, shift_session, session_hook, session_task | **KEEP** (ADR-0367 implemented) | HIGH |
| **docs/domains/scheduling/** | Domain spine | schedule_shift.location_id, .department_id, .zone (text) | **UPDATE-pending-reform** (location_id→shift_zone M:N, zone text→FK) | HIGH |
| **docs/modules/payroll/** | Module doc | employment_contract, department (scope, not location-scoped) | **KEEP** (payroll orthogonal to location reform) | MEDIUM |
| **docs/modules/procedure-engine/** | Module doc | engine_process, department-scoped procedures, day_line audience | **KEEP** (location context resolved at read time) | MEDIUM |
| **`00002_structure_tables.sql`** | Migration | department, location, zone, asset, position | **KEEP** (foundational) | CRITICAL |
| **`20260421100200_cascade_a1_domain_tables.sql`** | Migration | department_operating_hours (CANONICAL), planning_cycle | **KEEP** (unchanged) | HIGH |
| **`20260620120500_department_location_junction.sql`** | Migration | department_location M:N (NEW per ADR-0367) | **KEEP** (ADR-0367 Phase A) | CRITICAL |
| **`20260620120700_day_line_backfill.sql`** | Migration | day_line backfill (ADR-0367 Phase A) | **KEEP** | CRITICAL |
| **schedule_shift.location_id column** | Schema | schedule_shift (D6 table) | **DEPRECATE** (move to shift_zone M:N in phase 2) | HIGH |
| **schedule_shift.zone text column** | Schema | schedule_shift (D6 table) | **DEPRECATE** (move to shift_zone FK in phase 2) | MEDIUM |
| **profile.location_id column (if exists)** | Schema | profile (D2 resource) | **DEPRECATE** (drop in phase 2; not location-scoped) | LOW |
| **RosterTab.tsx + 5 sibling comments** | Code | schedule_shift.department_id nullable (L-0064 trap) | **UPDATE-CODE** (add NOT NULL + backfill after ADR-0367 gate passes) | HIGH |
| **session-hook-executor + 4 sibling EFs** | Edge Function | department_id reads (unchanged by reform) | **KEEP** | MEDIUM |
| **110 capability tool refs** | Code | .department_id, .location_id, .zone (across 110 call sites) | **AUDIT-POST-REFORM** (shift_zone M:N handling verification) | HIGH |

---

## Audit Notes

1. **ADR-0367 v1.1** is the load-bearing reform anchor. All schema changes derive from it. Council-verified 2026-05-18 (all 5 reviewers APPROVE). Phase A (day_line + shift_session tables) merged to development 2026-05-18. Phase B (shift_session_day_line M:N for shifts covering multiple areas) deferred to post-Phase-1 payroll sortie.

2. **Breaking changes on the horizon:**
   - `schedule_shift.location_id` → migrate to `shift_zone(shift_id, zone_id)` M:N junction (Phase 2, post-payroll Phase 1).
   - `schedule_shift.zone` (text) → drop; use `shift_zone.zone_id FK` instead.
   - `schedule_shift.department_id` → add NOT NULL constraint + backfill (pre-reform gate: L-0064 trap must be closed).
   - `profile.location_id` → drop (not location-scoped; confirmed by ADR-0056 + ADR-0367).
   - Optional: Introduce `department.department_group enum {foh, boh, mgmt, events}` for hospitality-canonical naming (deferred to V2).

3. **Code audit finding:** L-0064 trap (nullable `schedule_shift.department_id`) is documented in 5+ code comments but not yet enforced in schema. Migration backfill + NOT NULL constraint must precede `shift_zone` phase.

4. **Domain spine governance (ADR-0392):** Core Structure spine at `docs/domains/core-structure/DATA-MODEL.md` is VERIFIED (mirror: verified, last_verified: 2026-05-23). Post-reform, must refresh mirror metadata for schedule_shift + location_id deprecation.

5. **Payroll is orthogonal:** Payroll module stays department-scoped, not location-scoped. Location reform does not block payroll Phase 1. Both can run in parallel.

6. **RLS & security:** ADR-0151 + ADR-0204 gate all writes. Department-location M:N junction (`department_location`) uses RLS to enforce admin-only writes. Shift_zone M:N (post-reform) will use same pattern.

---

## Next Steps (Post-Audit)

This INDEX is read-only. A follow-up sortie will:

1. Create a formal ADR-0NNN (Core Structure Reform Phase 2) proposing:
   - `schedule_shift.location_id` → `shift_zone` M:N + FKs
   - `schedule_shift.zone` text → drop
   - `schedule_shift.department_id` NOT NULL gate + backfill
   - `profile.location_id` drop (if exists)
   - Optional: `department.department_group` enum (hospitality-canonical)

2. Council review (Phase 1 foundation vs Phase 2 polish).

3. Migration + E2E test writing (new shift_zone journal, location routing in notifications).

4. Code audit (110 capability tool refs → shift_zone M:N handling).

5. Domain spine refresh (update all files marked `UPDATE-pending-reform`).

---

Generated: 2026-05-27 | Audit scope: ADRs (117 scanned, 41 relevant) | Migrations (45+ scanned, 12 relevant) | Code refs (110+ scanned)
