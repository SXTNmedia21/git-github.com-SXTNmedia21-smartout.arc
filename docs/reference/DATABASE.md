---
title: "Database Reference"
id: REF_DATABASE
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on: []
tags: [database, schema, rls, enums, tables, migrations, seed]
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
    team_member,
    zone,
  ]
changelog:
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

## All Tables (47 entities)

### Identity Layer (Global -- no workspace_id)

| Table            | PK                  | Purpose                                                                                       |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `user_identity`  | `user_id`           | One per human. Login identity. Created by `handle_new_user()` trigger on `auth.users` INSERT. |
| `company`        | `company_id`        | Legal entity. Org number. Has subscription data (plan, status, trial_ends_at).                |
| `company_member` | `company_member_id` | Thin bridge: User <-> Company. Role: owner, admin, member.                                    |

### Identity Layer (workspace_id scoped)

| Table       | PK             | Purpose                                                                                                                                                          |
| ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace` | `workspace_id` | Physical workplace. Operational unit. Has `company_id`. Also has contract columns: `contract_status`, `trial_started_at`, `trial_ends_at`, `active_contract_id`. |
| `profile`   | `profile_id`   | Rich bridge: User <-> Workspace. Role, status (enum), department, display_name.                                                                                  |

### Structure Layer (workspace_id scoped)

| Table         | PK               | Purpose                                                                           |
| ------------- | ---------------- | --------------------------------------------------------------------------------- |
| `department`  | `department_id`  | What (Kitchen, Floor, Bar). Permanent. Never seasonal.                            |
| `location`    | `location_id`    | Where (Main building, Terrace). Physical places.                                  |
| `team`        | `team_id`        | Access grouping. Can be seasonal. Has `leader_profile_id`.                        |
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

### Time Layer (workspace_id scoped)

| Table    | PK          | Purpose                                          |
| -------- | ----------- | ------------------------------------------------ |
| `season` | `season_id` | Operational time period. Gamification container. |

### Operations (workspace_id scoped)

| Table                 | PK                       | Purpose                                                               |
| --------------------- | ------------------------ | --------------------------------------------------------------------- |
| `activity_trail`      | `id` (serial)            | Action audit trail per workspace.                                     |
| `onboarding_session`  | `onboarding_session_id`  | AI onboarding session state and context.                              |
| `invitation`          | `invitation_id`          | Workspace invitations. Status: pending, accepted, expired, cancelled. |
| `employment_contract` | `employment_contract_id` | Employment contracts (uses `contract_status` enum).                   |

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
- `user_identity.is_super_admin` (boolean, default false) gates platform-admin access

---

## Auth Trigger

`handle_new_user()` trigger on `auth.users` INSERT automatically creates a `user_identity` row.

---

## All Enums (30 in database.types.ts)

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

### Operations & Time

| Enum            | Values                                  |
| --------------- | --------------------------------------- |
| `season_type`   | default, calendar, focus, cycle, custom |
| `season_status` | draft, active, archived                 |
| `invite_status` | pending, accepted, expired, cancelled   |

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
- `DayCategory`: morning, midday, afternoon, evening, night, weekend
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
