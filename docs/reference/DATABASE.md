---
title: "Database Reference"
id: REF_DATABASE
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-03-22
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [database, schema, rls, enums, tables, migrations, seed, cascade]
tables:
  [
    user_identity,
    company,
    company_member,
    workspace,
    profile,
    department,
    location,
    team,
    policy,
    protocol,
    season,
    contract_template,
    contract,
    contract_event,
    contract_reminder,
    message_template,
    clause_library,
    landing_config,
    landing_config_version,
    platform_audit_log,
    platform_impersonation_log,
    platform_metrics_daily,
    activity_trail,
    asset,
    communication_log,
    confirmation,
    control_list,
    employment_contract,
    invitation,
    knowledge_test,
    notification_outbox,
    notification_preference,
    onboarding_session,
    platform_communication_log,
    platform_communication_recipient,
    platform_email_suppression,
    position,
    procedure,
    procedure_step,
    protocol_assignment,
    reserved_slug,
    routine,
    runbook,
    runbook_step,
    schedule_shift,
    team_member,
    zone,
    engine_memory,
    engine_authority_config,
    season_budget,
    day_factor,
    hour_factor,
  ]
changelog:
  - date: 2026-03-06
    change: "Added season_budget, day_factor, hour_factor tables (Module 15 MVP)"
  - date: 2026-03-02
    change: "Added engine_memory and engine_authority_config tables (ADR-0042)"
  - date: 2026-02-28
    change: "Initial version -- consolidated from CLAUDE.md + CORE_ARCH_V2 + FOUNDATION_DATA_MODEL + database.types.ts"
---

# Database Reference

Single source of truth for all database tables, enums, RLS patterns, naming conventions, and migration rules. Consolidated from CLAUDE.md, architecture docs, and the generated `database.types.ts`.

---

## Naming Conventions

| Element      | Convention                 | Example                          |
| ------------ | -------------------------- | -------------------------------- |
| Table names  | `snake_case`, singular     | `department_session`             |
| Column names | `snake_case`               | `created_at`                     |
| Primary keys | `{table}_id`               | `department_id`, `profile_id`    |
| Foreign keys | `{referenced_table}_id`    | `workspace_id`                   |
| Timestamps   | Always present             | `created_at`, `updated_at`       |
| Booleans     | `is_` prefix               | `is_active`, `is_required`       |
| JSONB        | Document shape in comments | `data jsonb`                     |
| IDs          | UUIDs for all PKs          | `uuid DEFAULT gen_random_uuid()` |

**Critical:** The user table is `user_identity`, NOT `user` (ADR-0011).

---

## All Tables (66 entities)

### Identity Layer (Global -- no workspace_id)

| Table            | PK                  | Purpose                                                                                       |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `user_identity`  | `user_id`           | One per human. Login identity. Created by `handle_new_user()` trigger on `auth.users` INSERT. |
| `company`        | `company_id`        | Legal entity. Org number. Has subscription data (plan, status, trial_ends_at).                |
| `company_member` | `company_member_id` | Thin bridge: User <-> Company. Role: owner, admin, member.                                    |

### Identity Layer (workspace_id scoped)

| Table       | PK             | Cascade     | Purpose                                                                                                                                                          |
| ----------- | -------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace` | `workspace_id` |             | Physical workplace. Operational unit. Has `company_id`. Also has contract columns: `contract_status`, `trial_started_at`, `trial_ends_at`, `active_contract_id`. |
| `profile`   | `profile_id`   | D2 Resource | Rich bridge: User <-> Workspace. Role, status (enum), department, display_name.                                                                                  |

### Structure Layer (workspace_id scoped)

| Table         | PK               | Cascade                                                                           | Purpose                                                    |
| ------------- | ---------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `department`  | `department_id`  | D1 Ops Env                                                                        | What (Kitchen, Floor, Bar). Permanent. Never seasonal.     |
| `location`    | `location_id`    | D1 Ops Env                                                                        | Where (Main building, Terrace). Physical places.           |
| `team`        | `team_id`        | D2 Resource                                                                       | Access grouping. Can be seasonal. Has `leader_profile_id`. |
| `team_member` | `team_member_id` | Bridge: Profile <-> Team.                                                         |
| `zone`        | `zone_id`        | Extends Location. Service sections. Season-aware.                                 |
| `asset`       | `asset_id`       | Extends Location. Equipment. CCP flag for HACCP.                                  |
| `position`    | `position_id`    | Extends Department. Job types. Assigned per shift, NOT per profile. Season-aware. |

### Governance Layer (workspace_id scoped)

| Table                 | PK                       | Purpose                                                                   |
| --------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `policy`              | `policy_id`              | The rule. Types: operational, haccp, hr, safety, access, payroll, custom. |
| `protocol`            | `protocol_id`            | Enforcement container. 1:1 with Policy.                                   |
| `protocol_assignment` | `protocol_assignment_id` | Links protocol to profile. Status: pending, completed, expired.           |
| `procedure`           | `procedure_id`           | Learn: ordered steps within a protocol.                                   |
| `procedure_step`      | `procedure_step_id`      | Individual step within a procedure.                                       |
| `routine`             | `routine_id`             | Do: recurring operational task within a protocol.                         |
| `runbook`             | `runbook_id`             | Do: multi-step operational process.                                       |
| `runbook_step`        | `runbook_step_id`        | Individual step within a runbook.                                         |
| `control_list`        | `control_list_id`        | Verify: checklist after routines/runbooks.                                |
| `knowledge_test`      | `knowledge_test_id`      | Prove: quiz within a protocol.                                            |
| `confirmation`        | `confirmation_id`        | Acknowledge: sign-off within a protocol.                                  |

### Completion Tracking (workspace_id scoped, Module Zero)

| Table                       | PK                             | Purpose                                                      |
| --------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `knowledge_test_attempt`    | `knowledge_test_attempt_id`    | Quiz score, answers (JSONB), pass/fail per employee per test |
| `confirmation_signature`    | `confirmation_signature_id`    | Sign-off record with signature_data (JSONB), timestamp, IP   |
| `procedure_step_completion` | `procedure_step_completion_id` | Per-step progress per employee per protocol_assignment       |

**RLS:** All three use workspace_id scoping with JWT policies. Service role has full access.

**Key FKs:** All three reference `profile_id` and `protocol_assignment_id`. `knowledge_test_attempt` → `knowledge_test_id`. `confirmation_signature` → `confirmation_id`. `procedure_step_completion` → `procedure_step_id`.

### Time Layer (workspace_id scoped)

| Table    | PK          | Purpose                                          |
| -------- | ----------- | ------------------------------------------------ |
| `season` | `season_id` | Operational time period. Gamification container. |

### Season Planning (workspace_id scoped, Module 15)

| Table           | PK                 | Cascade   | Purpose                                                                 |
| --------------- | ------------------ | --------- | ----------------------------------------------------------------------- |
| `season_budget` | `season_budget_id` | D4 Demand | Strategic revenue target per season. 1:1 with season. Status lifecycle. |
| `day_factor`    | `day_factor_id`    | D4 Demand | Weekday weight (0=Mon...6=Sun). UNIQUE(season_budget_id, weekday).      |
| `hour_factor`   | `hour_factor_id`   | D4 Demand | Hour weight (0-23). UNIQUE(season_budget_id, hour).                     |

**season_budget key columns:** `season_id` (FK, UNIQUE), `total_target_revenue` (NUMERIC), `base_price_per_guest` (NUMERIC, nullable), `season_price_factor` (NUMERIC, default 1.0), `target_labor_percentage` (NUMERIC, default 0.30), `avg_hourly_wage` (NUMERIC, nullable), `status` (budget_status enum).

**day_factor key columns:** `season_budget_id` (FK CASCADE), `weekday` (SMALLINT 0-6), `factor` (NUMERIC, default 1.0).

**hour_factor key columns:** `season_budget_id` (FK CASCADE), `hour` (SMALLINT 0-23), `factor` (NUMERIC, default 1.0).

**New SQL enum:** `budget_status` (draft, active, locked).

**RLS (dual-auth):** JWT read/write (admin via `is_admin_in_workspace`) + API key read (via `get_api_workspace_id()`). All three tables.

**Indexes:** `season_budget(workspace_id)`, `season_budget(season_id)` UNIQUE, `day_factor(season_budget_id)`, `hour_factor(season_budget_id)`.

**Calculation engine:** `apps/web/src/lib/season-calculations.ts` — pure functions, no DB deps:

- `calculateDayTargets()` — distributes total target across days using weekday factors (normalized)
- `calculateHourTargets()` — distributes day target across open hours using hour factors
- `calculateStaffingNeed()` — derives staff count from hour target, labor %, avg wage

**IMPORTANT:** `season_budget` is DIFFERENT from `workspace_budget`. Season budget = strategic per-season planning. Workspace budget = operational per-date targets.

### Operations (workspace_id scoped)

| Table                 | PK                       | Cascade     | Purpose                                                               |
| --------------------- | ------------------------ | ----------- | --------------------------------------------------------------------- |
| `activity_trail`      | `id` (serial)            |             | Action audit trail per workspace.                                     |
| `onboarding_session`  | `onboarding_session_id`  |             | AI onboarding session state and context.                              |
| `invitation`          | `invitation_id`          |             | Workspace invitations. Status: pending, accepted, expired, cancelled. |
| `employment_contract` | `employment_contract_id` | D2 Resource | Employment contracts (uses `contract_status` enum).                   |

### Session Infrastructure (workspace_id scoped, Module Zero)

| Table                  | PK                        | Cascade        | Purpose                                                                                      |
| ---------------------- | ------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `department_session`   | `department_session_id`   | D6 Production  | Daily container per dept. Status: upcoming/active/pending_signoff/closed/missed              |
| `session_hook`         | `session_hook_id`         | D6 Production  | Hook definitions: hook_type (enum), trigger_time, linked procedure/routine                   |
| `session_task`         | `session_task_id`         | D6 Production  | Hook-triggered operational tasks. Status enum lifecycle. Compliance tracking                 |
| `session_note`         | `session_note_id`         |                | Handoff/closing notes per session. note_type: handoff/closing/general                        |
| `daily_reconciliation` | `daily_reconciliation_id` | C1 Calibration | End-of-day settlement. Status: open/submitted/awaiting_approval/approved/locked/unreconciled |
| `deviation`            | `deviation_id`            | D6 Production  | Incident reports. Domain: safety/customer/procedure/system/material                          |
| `shift_approval`       | `shift_approval_id`       |                | Post-shift hour verification. Status: pending/approved/edited/disputed                       |

**New SQL enums:** `session_hook_type` (pre_open/open/scheduled/pre_close/close), `session_task_status` (pending/available/in_progress/completed/skipped/overdue/escalated), `session_note_type` (handoff/closing/general).

### Schedule (workspace_id scoped, ADR-0036)

| Table            | PK                  | Cascade       | Purpose                                                                                  |
| ---------------- | ------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `schedule_shift` | `schedule_shift_id` | D6 Production | Individual work shifts. FK to profile (employee), position, team. Has RLS JWT + API key. |

**Key columns:** `shift_date` (DATE), `start_time`/`end_time` (TIME), `work_hours` (NUMERIC(4,2) computed), `breaks` (INTEGER minutes), `status` (shift_status enum), `day_category` (day_category enum), `is_published` (BOOLEAN), `employee_id` (nullable → unassigned shift), `zone`, `indicator` (default 'blue'), `notes`.

**FKs:** `workspace_id` → workspace (CASCADE), `employee_id` → profile (SET NULL), `position_id` → position (SET NULL), `team_id` → team (SET NULL).

**RLS (8 policies, dual-auth):**

- JWT: `jwt_read_schedule_shift` (SELECT, workspace member), `jwt_insert/update/delete_schedule_shift` (admin via `is_admin_in_workspace`)
- API key: `api_key_read/insert/update/delete_schedule_shift` (via `get_api_workspace_id()`)

**Indexes:** `(workspace_id, shift_date)`, `(employee_id, shift_date)`, `(workspace_id, status)`

**New SQL enums:** `shift_status` (created, assigned, published, active, completed, unpublished), `day_category` (morning, midday, afternoon, evening, night, weekend).

**Planned future tables:** `absence`, `shift_template`, `shift_history`, `shift_task`, `day_info`.

### AI / Agent (workspace_id scoped, ADR-0042)

| Table                     | PK                           | Cascade       | Purpose                                                                                                       |
| ------------------------- | ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `engine_memory`           | `engine_memory_id`           | K1b Workspace | Persistent agent memories with pgvector embeddings. Semantic retrieval for context. RLS: workspace isolation. |
| `engine_authority_config` | `engine_authority_config_id` | C4 Governance | Per-workspace, per-capability authority levels. UNIQUE(workspace_id, capability).                             |

**engine_sessions changes (ADR-0042):** Added `mode` column — 'mission' (structured stages) or 'agent' (free-form conversation). Agent sessions have NULL `mission_id`. The `mission_id` FK is now nullable.

**engine_memory key columns:** `workspace_id`, `profile_id`, `category` (preference, fact, context, feedback), `content` (TEXT), `embedding` (vector(1536) via pgvector), `importance` (0-10 scale), `last_accessed_at`.

**engine_authority_config key columns:** `workspace_id`, `capability` (TEXT — e.g. profile, schedule, training), `authority_level` (ai_authority_level enum: autonomous, notify_suggest, notify, escalate, never), `config` (JSONB for capability-specific settings).

**RLS:** Both tables use dual-auth (JWT + API key) workspace isolation pattern.

### Engine Process Tables (workspace_id scoped, Module Zero)

| Table                    | PK          | Purpose                                                                   |
| ------------------------ | ----------- | ------------------------------------------------------------------------- |
| `engine_process`         | `id` (TEXT) | Workflow templates (e.g. daily_close). TEXT PK                            |
| `engine_step`            | `id`        | Steps within a process. action_type + action_payload + assignee_rule      |
| `engine_trigger`         | `id`        | Event-to-process matching rules with optional delay                       |
| `engine_event`           | `id`        | Immutable event log. Idempotency support                                  |
| `engine_state`           | `id`        | Running process instances. entity_type/entity_id, current_step, status    |
| `engine_state_step`      | `id`        | Per-step completion tracking on instances. Cascading RLS via engine_state |
| `engine_delayed_trigger` | `id`        | Timer queue for delayed triggers. Polled by fire-delayed-triggers EF      |

**engine_state_step key columns:** `state_id` (FK CASCADE), `step_order`, `status` (pending/active/completed/skipped/failed), `action_type`, `action_payload` (JSONB), `completed_by` (FK profile), `completed_at`, `result` (JSONB). UNIQUE(state_id, step_order).

**engine_state_step RLS:** Uses cascading subquery — `state_id IN (SELECT id FROM engine_state)` — PostgreSQL applies engine_state's workspace RLS to the subquery.

### Context & Search (workspace_id scoped)

| Table                 | PK         | Cascade       | Purpose                                                                                                       |
| --------------------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `workspace_doc_chunk` | `chunk_id` | K1b Workspace | Workspace-scoped semantic chunks for handbook/policy/protocol/procedure. pgvector embeddings. RLS: dual-auth. |

**workspace_doc_chunk key columns:** `workspace_id`, `source_type` (handbook_chapter, policy, protocol, procedure, routine, runbook, other), `source_id`, `source_path`, `source_hash`, `content_hash`, `chunk_index`, `title`, `content`, `token_count`, `metadata` (JSONB), `embedding` (vector(1536)). UNIQUE(workspace_id, source_path, chunk_index).

**RPCs:** `search_instance(p_workspace_id, p_query, p_limit)` — fast ilike search across profiles. `match_workspace_docs(p_workspace_id, query_embedding, match_count, match_threshold)` — vector similarity search. `search_dependency_graph(p_workspace_id, p_query, p_limit)` — policy→protocol→procedure graph traversal.

### Communication (workspace_id scoped)

| Table                     | PK                           | Purpose                            |
| ------------------------- | ---------------------------- | ---------------------------------- |
| `communication_log`       | `communication_log_id`       | Workspace communication history.   |
| `notification_outbox`     | `notification_outbox_id`     | Pending/sent notification queue.   |
| `notification_preference` | `notification_preference_id` | Per-profile notification settings. |

### Contract System (ADR-0024)

| Table               | PK                     | Scope                  | Purpose                                      |
| ------------------- | ---------------------- | ---------------------- | -------------------------------------------- |
| `contract_template` | `contract_template_id` | workspace_id scoped    | Reusable contract templates with HTML + CSS. |
| `contract`          | `contract_id`          | workspace_id scoped    | Sent contract instances with signing state.  |
| `contract_event`    | `contract_event_id`    | via contract.workspace | Immutable audit trail per contract.          |
| `contract_reminder` | `contract_reminder_id` | workspace_id scoped    | Scheduled email/SMS reminders.               |
| `message_template`  | `message_template_id`  | System (no RLS)        | Email/SMS template content (NO + EN).        |
| `clause_library`    | `clause_library_id`    | Global (authenticated) | Reusable legal clause snippets.              |

### Platform Admin (no RLS, service role only)

| Table                              | PK                                    | Purpose                                     |
| ---------------------------------- | ------------------------------------- | ------------------------------------------- |
| `landing_config`                   | `landing_config_id`                   | Landing page CMS configs (JSON, versioned). |
| `landing_config_version`           | `landing_config_version_id`           | Version snapshots of published configs.     |
| `platform_audit_log`               | `platform_audit_log_id`               | Super-admin action audit trail.             |
| `platform_impersonation_log`       | `platform_impersonation_log_id`       | Workspace impersonation session tracking.   |
| `platform_metrics_daily`           | `platform_metrics_daily_id`           | Daily aggregated KPI metrics.               |
| `platform_communication_log`       | `platform_communication_log_id`       | Platform-level broadcast/notification logs. |
| `platform_communication_recipient` | `platform_communication_recipient_id` | Recipients of platform communications.      |
| `platform_email_suppression`       | `platform_email_suppression_id`       | Email suppression list entries.             |

### System

| Table           | PK                 | Purpose                                        |
| --------------- | ------------------ | ---------------------------------------------- |
| `reserved_slug` | `reserved_slug_id` | Reserved workspace slugs (e.g., "app", "api"). |

---

## Subscription Data

Subscription data lives on the `company` table. There is NO `stripe_subscription` table.

```sql
-- CORRECT
company.subscription_plan    -- text
company.subscription_status  -- text
company.trial_ends_at        -- timestamptz
```

---

## RLS Patterns

All workspace-scoped tables use RLS with TWO auth paths: JWT (for user sessions) and API key (for external integrations). Platform-admin tables are exceptions (no RLS, service role only).

### Pattern 1: JWT Auth (user sessions)

```sql
-- SELECT: user can read data in workspaces they belong to
CREATE POLICY "Read {table}" ON public.{table}
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- WRITE: admin/owner can modify data in their workspace
CREATE POLICY "Write {table}" ON public.{table}
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
```

### Pattern 2: API Key Auth (external integrations)

```sql
-- SELECT: API key can read data in the workspace it belongs to
CREATE POLICY "api_key_read_{table}" ON public.{table}
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- WRITE (if needed): API key can write to its workspace
CREATE POLICY "api_key_write_{table}" ON public.{table}
  FOR INSERT WITH CHECK (workspace_id = get_api_workspace_id());
```

### Helper Functions

- `get_workspace_ids_for_user(user_uuid)` -- returns all workspace_ids the user has a profile in (JWT path)
- `is_admin_in_workspace(user_uuid, workspace_uuid)` -- checks admin+ role (JWT path)
- `get_api_workspace_id()` -- returns `current_setting('app.workspace_id', true)::uuid` (API key path)

### **MANDATORY: Every workspace-scoped table needs BOTH patterns**

When creating a new workspace-scoped table:

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. Add JWT SELECT policy (Pattern 1)
3. Add JWT WRITE policy (Pattern 1)
4. Add API key SELECT policy (Pattern 2)
5. Add API key WRITE policy (Pattern 2) -- only if the table will be writable via public API

Tables WITHOUT workspace_id (user_identity, company, platform-admin) are exempt from API key policies.

### Rules

- User-facing operations: RLS client (anon key)
- Admin/trigger operations: service role client
- Platform-admin tables: no RLS, service role only
- `user_identity.is_godmode` (boolean, default false) gates platform-admin access

---

## Auth Trigger

`handle_new_user()` trigger on `auth.users` INSERT automatically creates a `user_identity` row.

---

## All Enums (34+ in database.types.ts)

Enums from `packages/supabase/src/database.types.ts` (auto-generated, never edit manually):

### Identity & Localization

| Enum                  | Values                                        |
| --------------------- | --------------------------------------------- |
| `auth_provider`       | supabase, google, microsoft                   |
| `company_member_role` | owner, admin, member                          |
| `preferred_language`  | no, sv, en, da, fi                            |
| `country`             | NO, SE, DK, FI                                |
| `currency`            | NOK, SEK, DKK, EUR                            |
| `industry`            | restaurant, hotel, cafe, bar, catering, other |
| `profile_role`        | employee, manager, admin, owner               |
| `profile_status`      | trainee, active, inactive, offboarding        |

### Structure

| Enum            | Values                                                  |
| --------------- | ------------------------------------------------------- |
| `location_type` | main, outdoor, kitchen, event, storage, other           |
| `team_type`     | operational, access, cross_department, seasonal, custom |
| `asset_type`    | equipment, safety, storage, station, other              |

### Governance

| Enum                            | Values                                                  |
| ------------------------------- | ------------------------------------------------------- |
| `policy_type`                   | operational, haccp, hr, safety, access, payroll, custom |
| `policy_scope`                  | workspace, department, team, location                   |
| `enforcement_status`            | aspirational, enforced                                  |
| `protocol_status`               | draft, active, deprecated                               |
| `protocol_assignment_status`    | pending, completed, expired                             |
| `procedure_type`                | standard, onboarding, safety, maintenance, custom       |
| `control_frequency`             | every_time, every_nth, never                            |
| `control_list_assigned_to_type` | team_leader, manager, admin, custom                     |
| `routine_assigned_to_type`      | team, role, profile                                     |
| `trigger_type`                  | scheduled, event                                        |

### Schedule

| Enum           | Values                                                       |
| -------------- | ------------------------------------------------------------ |
| `shift_status` | created, assigned, published, active, completed, unpublished |
| `day_category` | morning, midday, afternoon, evening, night, weekend          |

### Operations & Time

| Enum                  | Values                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| `season_type`         | default, calendar, focus, cycle, custom                                 |
| `season_status`       | draft, active, archived                                                 |
| `budget_status`       | draft, active, locked                                                   |
| `invite_status`       | pending, accepted, expired, cancelled                                   |
| `session_hook_type`   | pre_open, open, scheduled, pre_close, close                             |
| `session_task_status` | pending, available, in_progress, completed, skipped, overdue, escalated |
| `session_note_type`   | handoff, closing, general                                               |

### Contract System

| Enum              | Values                                           |
| ----------------- | ------------------------------------------------ |
| `contract_status` | draft, sent, viewed, signed, expired, terminated |

**Known conflict:** `contract_status` is used by `employment_contract` (migration 00012) and the contract system. Do NOT create a new enum with this name.

### Communication

| Enum                    | Values                                             |
| ----------------------- | -------------------------------------------------- |
| `communication_channel` | email, sms, push, in_app                           |
| `communication_status`  | pending, sent, delivered, failed, opened, clicked  |
| `notification_channel`  | push, sms, email, voice                            |
| `notification_mode`     | training, work, community                          |
| `notification_status`   | pending, processing, delivered, failed, suppressed |

---

## Additional Enums (from packages/types, not yet in DB)

These enums are defined in `packages/types/src/enums.ts` as Zod schemas but may not yet be database enums:

- `SessionStatus`: upcoming, active, pending_signoff, closed, missed
- `TaskStatus`: pending, available, in_progress, completed, skipped, overdue, escalated
- `HookType`: pre_open, open, scheduled, pre_close, close, custom
- ~~`DayCategory`~~: now `day_category` DB enum (migration 20260301300000)
- `EmploymentCategory`: full_time, part_time, temporary, flexible, apprentice
- `ContractType`: permanent, temporary, freelance, apprentice, substitute
- `RateType`: fixed, hourly, multiplier, percentage, calculated
- `SalaryCategory`: base_pay, overtime, supplement, absence, deductions
- `SalaryType`: hourly, monthly
- `AbsenceType`: sick_leave, parental_leave, vacation, unpaid_leave, military, training, welfare
- `RequestType`: available, not_available, vacation, sick_day, flextime, shift_swap, other
- `NotificationChannel` (extended): push, sms, email, voice, in_app
- `SubscriptionStatus`: trial, active, paused, past_due, cancelled, unpaid
- `CertificationType`: food_safety, first_aid, alcohol_service, hygiene, fire_safety, allergen, custom
- `CertificationStatus`: valid, expiring_soon, expired, revoked
- `AIAuthorityLevel`: autonomous, notify_suggest, notify, escalate, never

---

## Governance Chain

```
Policy (the rule)
  |-- Protocol (the enforcement, 1:1 with Policy)
        |-- Procedure (learn: ordered steps)
        |     |-- ProcedureStep
        |-- Routine (do: recurring operational task)
        |-- Runbook (do: multi-step operational process)
        |     |-- RunbookStep
        |-- ControlList (verify: checklist after routines/runbooks)
        |-- KnowledgeTest (prove: quiz)
        |-- Confirmation (acknowledge: sign-off)
```

---

## Migration Naming

- Sequential: `00001_description.sql` through `00013_description.sql`
- Timestamped: `YYYYMMDDHHMMSS_description.sql` (newer migrations)
- Current count: 23 migrations (00001-00013 + timestamped)
- Regenerate types after migration: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

---

## Seed Data

Dev seed creates a default workspace setup:

| Entity                | Known UUID Prefix | Value                              |
| --------------------- | ----------------- | ---------------------------------- |
| Company (Smartout AS) | `a0000000-...`    | Smartout AS                        |
| Workspace (HQ)        | `b0000000-...`    | HQ                                 |
| User (admin)          | `e0000000-...`    | admin@smartout.local / password123 |

Chain: Company -> Workspace -> Location -> Department -> User -> CompanyMember -> Profile

---

## Planned Tables & Fields (Cascade Architecture, 2026-03-21)

These are identified as required by the cascade architecture and AI Council review. Not yet in migrations. Full context: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (Phase A schema).

### Planned new tables

| Table                        | Purpose                                                                 | Layer  |
| ---------------------------- | ----------------------------------------------------------------------- | ------ |
| `department_operating_hours` | Consolidated weekly hours per dept/location/season (replaces 3 systems) | L3     |
| `department_hours_override`  | Date-specific exceptions (holidays, events, closures)                   | L3     |
| `planning_cycle`             | Year wheel container — ordered, gap-free seasons                        | L1     |
| `planning_event`             | External/internal demand events affecting staffing                      | L1     |
| `tariff_rate_table`          | Versioned Riksavtalen rates with effective_from/until                   | D3     |
| `employee_payroll_profile`   | Links contract to payroll calculation (base rate, seniority step)       | D2     |
| `shift_cost_snapshot`        | Append-only per-shift cost audit                                        | L5     |
| `change_proposal`            | Persisted cascade preview (Terraform saved plan model)                  | Engine |

### Planned fields on existing tables

| Table                 | Field                     | Type    | Purpose                                      |
| --------------------- | ------------------------- | ------- | -------------------------------------------- |
| `employment_contract` | `agreed_weekly_hours`     | NUMERIC | Critical for overtime detection              |
| `profile`             | `seniority_start_date`    | DATE    | Ansiennitet wage step lookup                 |
| `profile`             | `has_fagbrev`             | BOOLEAN | Fagbrev/non-fagbrev rate distinction         |
| `procedure`           | `required_certifications` | TEXT[]  | Which certs needed to perform                |
| `routine`             | `required_certifications` | TEXT[]  | Which certs needed to perform                |
| `session_hook`        | `required_certifications` | TEXT[]  | Which certs needed for hook                  |
| `department_session`  | `planned_open`            | TIME    | Set from operating hours at session creation |
| `department_session`  | `planned_close`           | TIME    | Set from operating hours at session creation |
| `schedule_shift`      | `department_id`           | UUID FK | Direct FK (currently only via position)      |
| `schedule_shift`      | `location_id`             | UUID FK | Direct FK for location scoping               |
| `department`          | `department_type`         | ENUM    | operational / administrative / hybrid        |

### Planned new enums

| Enum              | Values                                              | Purpose                       |
| ----------------- | --------------------------------------------------- | ----------------------------- |
| `department_type` | operational, administrative, hybrid                 | Department classification     |
| `shift_function`  | opening, closing, supporting, rush_hour, sub_supply | Template shift purpose        |
| `anchor_type`     | fixed, open, close                                  | Template shift time anchoring |
| `proposal_status` | pending, approved, applied, rejected                | Change proposal lifecycle     |

### Tables to deprecate

| Table                                                                | Replacement                  | Reason                              |
| -------------------------------------------------------------------- | ---------------------------- | ----------------------------------- |
| `company_opening_hours`                                              | `department_operating_hours` | Signup-only, unused                 |
| `operating_hours` `[LEGACY — migrate to department_operating_hours]` | `department_operating_hours` | No department dimension, no cascade |
| `season.opening_hours` (JSONB column)                                | `department_operating_hours` | String-keyed, un-queryable          |

> **Triple Operating Hours Warning:** Three tables store operating hours data:
>
> - `company_opening_hours` — wizard intake (keep, reclassify)
> - `operating_hours` — LEGACY (migrate away, do not use in new code)
> - `department_operating_hours` — CASCADE runtime truth (use this)

---

## Cascade Foundation Tables

Tables grouped by cascade dimension. Only tables that exist in the database are listed. Planned tables are marked.

### D1 Operational Envelope

| Table                        | Status  | Purpose                                               |
| ---------------------------- | ------- | ----------------------------------------------------- |
| `department`                 | Live    | Permanent organizational unit                         |
| `location`                   | Live    | Physical places                                       |
| `department_operating_hours` | Planned | Consolidated weekly hours per dept/location/season    |
| `department_hours_override`  | Planned | Date-specific exceptions (holidays, events, closures) |
| `planning_cycle`             | Planned | Year wheel container — ordered, gap-free seasons      |

### D2 Resource Availability

| Table                      | Status  | Purpose                                |
| -------------------------- | ------- | -------------------------------------- |
| `profile`                  | Live    | Employee identity within workspace     |
| `employment_contract`      | Live    | Employment contracts                   |
| `team`                     | Live    | Access grouping, can be seasonal       |
| `employee_payroll_profile` | Planned | Links contract to payroll calculation  |
| `schedule_absence`         | Planned | Absence records (sick, vacation, etc.) |

### D3 Rules & Constraints

| Table                  | Status  | Purpose                                        |
| ---------------------- | ------- | ---------------------------------------------- |
| `regulatory_framework` | Planned | Named regulation sets (e.g. Riksavtalen)       |
| `framework_rule`       | Planned | Individual rules within a framework            |
| `framework_trigger`    | Planned | Conditions that activate rules                 |
| `tariff_rate_table`    | Planned | Versioned wage rates with effective_from/until |
| `public_holiday`       | Planned | Official holidays affecting scheduling         |

### D4 Demand Signal

| Table              | Status  | Purpose                                            |
| ------------------ | ------- | -------------------------------------------------- |
| `season_budget`    | Live    | Strategic revenue target per season                |
| `day_factor`       | Live    | Weekday weight distribution                        |
| `hour_factor`      | Live    | Hour weight distribution                           |
| `workspace_budget` | Planned | Operational per-date targets                       |
| `planning_event`   | Planned | External/internal demand events affecting staffing |

### D5 Service Concept

No dedicated tables. D5 parameterizes via workspace config and policy settings.

### D6 Production & Product

| Table                | Status | Purpose                                  |
| -------------------- | ------ | ---------------------------------------- |
| `department_session` | Live   | Daily container per department           |
| `session_hook`       | Live   | Time triggers firing procedures/routines |
| `session_task`       | Live   | Hook-triggered operational tasks         |
| `schedule_shift`     | Live   | Individual work shifts                   |
| `deviation`          | Live   | Incident reports                         |

### C1 Calibration

| Table                  | Status  | Purpose                       |
| ---------------------- | ------- | ----------------------------- |
| `daily_reconciliation` | Live    | End-of-day settlement         |
| `workspace_kpi_target` | Planned | KPI targets per workspace     |
| `planning_factors`     | Planned | Calibration parameters        |
| `adjustment_factors`   | Planned | Runtime adjustment parameters |

### C3 Commercial

| Table                 | Status  | Purpose                          |
| --------------------- | ------- | -------------------------------- |
| `shift_cost_snapshot` | Planned | Append-only per-shift cost audit |

### C4 Governance

| Table                     | Status  | Purpose                                          |
| ------------------------- | ------- | ------------------------------------------------ |
| `engine_authority_config` | Live    | Per-workspace, per-capability authority levels   |
| `change_proposal`         | Planned | Persisted cascade preview (Terraform saved plan) |

### K1a Industry Knowledge

| Table                  | Status  | Purpose                                            |
| ---------------------- | ------- | -------------------------------------------------- |
| `regulatory_framework` | Planned | Platform-level regulation sets (NULL workspace_id) |
| `tariff_rate_table`    | Planned | Platform-level wage rates (NULL workspace_id)      |
| `public_holiday`       | Planned | Official holidays (platform-level)                 |

### K1b Workspace Knowledge

| Table                 | Status | Purpose                                      |
| --------------------- | ------ | -------------------------------------------- |
| `workspace_doc_chunk` | Live   | Semantic chunks for handbook/policy/protocol |
| `engine_memory`       | Live   | Persistent agent memories with pgvector      |

---

## Key Rules

- ALL tables (except `user_identity`, `company`, `company_member`) have `workspace_id`
- Platform-admin tables are the exception -- no `workspace_id`, no RLS, service role only
- Profile has NO direct season connection. Season filters DATA, not the person.
- Department is permanent. Team can be seasonal.
- Position is per-shift, not per-person.
- Profile status is an ENUM (`trainee | active | inactive | offboarding`), not a boolean.
- Never reference `public.user` -- the table is `public.user_identity`.
- Never create a new enum without checking `database.types.ts` for name conflicts.
- Never edit `packages/supabase/src/database.types.ts` manually -- always regenerate.
