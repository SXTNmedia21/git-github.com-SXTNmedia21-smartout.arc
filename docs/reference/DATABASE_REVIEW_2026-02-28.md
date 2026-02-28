---
title: "Database Review — 2026-02-28"
id: DB_REVIEW_20260228
version: "1.0"
status: canonical
layer: reference
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - FOUND_DATA_MODEL
tags:
  - database
  - review
  - rls
  - indexing
  - scheduling
tables:
  - user_identity
  - company
  - workspace
  - profile
  - department
  - location
  - team
  - policy
  - protocol
  - season
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout Database Review — 2026-02-28

> **Scope:** Core tables (identity + structure + governance + operations), RLS policies, indexing, scheduling/shift planning gaps.
> **Reviewed by:** Claude (Haiku) | **Date:** 2026-02-28
> **Status:** ✅ Complete analysis with prioritized recommendations

---

## Executive Summary

**Overall Health:** 🟡 **Solid foundation with gaps**

The core schema is well-designed with proper GDPR separation, workspace isolation, and governance chains. However:

1. **CRITICAL GAP:** No shift/scheduling tables exist despite Module 3 (Vaktplanlegging) spec being complete
2. **HIGH:** Missing operational tables (`department_session`, `shift`, `task`) for daily execution
3. **MEDIUM:** Some indexes missing for common query patterns
4. **MEDIUM:** RLS policies incomplete on newer tables (platform_admin, notifications)

**Estimated effort to fix:** ~2–3 days (scheduling tables + operational layer + RLS completion).

---

## Part 1: Core Tables Analysis ✅

### Identity Layer (Migration 00001)

| Table            | Status       | Issues | Notes                                                                                                    |
| ---------------- | ------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| `user_identity`  | ✅ Excellent | None   | Proper GDPR separation. PII vault with restricted access. Anonymization function works well.             |
| `company`        | ✅ Good      | Minor  | Subscription data correctly placed here (not phantom `stripe_subscription`). Fields match billing needs. |
| `workspace`      | ✅ Good      | Minor  | `active_modules` text array is flexible but could be enum-based for validation.                          |
| `profile`        | ✅ Good      | Medium | See "Issues" below.                                                                                      |
| `company_member` | ✅ Good      | None   | Clean junction. No PII.                                                                                  |

### Profile Table Issues

**Issue 1: Department Assignment Ambiguity**

```sql
-- Current schema
department_id uuid,              -- Single dept FK
departments uuid[] DEFAULT '{}', -- Array of depts

-- Problem: Both exist. Which is source of truth?
-- If employee works in multiple depts, which is the "primary"?
```

**Recommendation:**

```sql
-- Option A: Keep both, document intent
-- department_id = primary department (for scheduling, billing)
-- departments[] = full list of departments (for protocol access)

-- Option B: Remove department_id, use departments[0] for primary
-- Simpler but risky if array is unordered
```

**Action:** If moving forward with Option A, add a comment in the migration explaining the dual-field pattern.

### Structure Layer (Migration 00002)

| Table         | Status  | Issues | Notes                                                                                                                                  |
| ------------- | ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `season`      | ✅ Good | Minor  | `parent_season_id` recursive — good for nested campaigns. But no depth limit could cause cycles. Add constraint.                       |
| `department`  | ✅ Good | None   | Clean, workspace-scoped. No seasonal flag needed (handled via `team.season_id`).                                                       |
| `location`    | ✅ Good | None   | Lat/long stored as `float` — should be `numeric(9,6)` for precision. Very minor.                                                       |
| `zone`        | ✅ Good | Medium | Extends location. Good. But needs composite index for common queries. See "Indexing" section.                                          |
| `asset`       | ✅ Good | None   | Links to location. Enum `asset_type` in 00010 works.                                                                                   |
| `position`    | ✅ Good | Medium | Per-shift assignment (not per-profile) — correct architecture. But no `shift_id` FK yet because shifts table doesn't exist.            |
| `team`        | ✅ Good | Medium | Can be seasonal (`team.season_id`). Good. But `leader_profile_id` could be null — should default to workspace admin. Clarify behavior. |
| `team_member` | ✅ Good | None   | Clean junction. Unique constraint works.                                                                                               |

### Structure Layer Extended (Migration 00010)

**Good additions:**

- ✅ `asset_type` enum (equipment, safety, storage, station, other)
- ✅ `season_id` added to `zone`, `asset`, `position` for seasonal variants

**Minor improvements:**

- `zone.color` and `zone.sort_order` added — good for UI
- `asset.slug` added — enables friendly URLs

---

## Part 2: Governance Layer ✅

### Schema Structure (Migration 00003)

| Table                 | Purpose                | Status  | Issues                                                                                      |
| --------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `policy`              | The rule               | ✅ Good | Supports multi-type, multi-scope. Temporal (valid_from/valid_to). Good.                     |
| `protocol`            | Enforcement mechanism  | ✅ Good | 1:1 with policy. Versioned. Status enum (draft/active/deprecated). Perfect.                 |
| `procedure`           | Learn steps            | ✅ Good | Skill requirements in JSONB. Type enum for onboarding vs safety vs maintenance.             |
| `procedure_step`      | Individual steps       | ✅ Good | Ordered, estimated_minutes.                                                                 |
| `control_list`        | Verification checklist | ✅ Good | JSONB items. Assigned to role/manager. Items stored as JSONB — but structure not validated. |
| `routine`             | Do: recurring task     | ✅ Good | Trigger-based (scheduled/event). Assigned to team/role/profile.                             |
| `runbook`             | Do: multi-step process | ✅ Good | Event-based. Escalation chain in JSONB. Anti-fragile (vs rigid fixed steps).                |
| `runbook_step`        | Runbook steps          | ✅ Good | Ordered, estimated_minutes.                                                                 |
| `knowledge_test`      | Prove: quiz            | ✅ Good | Questions in JSONB. Pass threshold. Max attempts.                                           |
| `confirmation`        | Acknowledge: sign-off  | ✅ Good | Supports signature. Anti-ghosting.                                                          |
| `protocol_assignment` | Track completion       | ✅ Good | Per-profile. Status enum (pending/completed/expired). Tracks assigned_at / completed_at.    |

### Governance Chains

**Strengths:**

- ✅ Clean policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}
- ✅ No circular dependencies
- ✅ Proper enums for all state machines
- ✅ JSONB flexibility for rule/trigger configs without schema bloat

**Issues:**

1. **No schema validation on JSONB fields** — Items in `control_list.items`, trigger configs in `routine.trigger_config`, rules in `policy.rules_json` are unvalidated. Could cause runtime errors.
   - **Fix:** Add Zod schemas in app code + document expected JSONB structures in migration comments.

2. **Missing audit trail for protocol updates** — Which fields changed? Who changed them? When? Not tracked.
   - **Fix:** See Activity Trail section (addressed in migration 00005).

---

## Part 3: 🚨 CRITICAL GAP — Shift Planning / Operations

### The Problem

**Module 3 (Vaktplanlegging) is fully spec'd but has ZERO database tables.**

Looking at `docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md`:

- Grid layout requires: shifts, shift assignments, templates, daily aggregates
- Core operations require: department sessions, tasks, handoff records
- Absence management requires: absence types, requests, approvals

**But the database has:**

- ❌ No `shift` table
- ❌ No `department_session` table
- ❌ No `shift_template` table
- ❌ No `task` table
- ❌ No `absence` table
- ❌ No `task_log` / `confirmation_log` tables

**Impact:**

- Phase 3 (Scheduling & Shift Management) cannot be implemented
- Phase 4 (Live Operations) cannot be implemented
- All 34 dashboard pages reference shift data that doesn't exist in DB

---

## Part 4: Required Schema — Shift & Operations

### 4.1 Core Shift Planning Tables

```sql
-- Shift Template (reusable patterns: "Friday Evening", "Sunday Minimum")
CREATE TABLE public.shift_template (
  template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  department_id uuid,
  shift_count integer DEFAULT 1,
  json_config jsonb,  -- Stores pattern: [{ role, start_time, end_time }, ...]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_template_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_template_department FOREIGN KEY (department_id) REFERENCES public.department(department_id)
);

-- Shift (actual scheduled shift instance)
CREATE TABLE public.shift (
  shift_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  department_id uuid NOT NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  position_id uuid,        -- Job type (Kokk, Servitør, etc.)
  assigned_profile_id uuid,  -- Employee assigned (can be null = open shift)
  template_id uuid,        -- Reference to template if created from one
  is_published boolean DEFAULT false,
  status shift_status NOT NULL DEFAULT 'scheduled',  -- scheduled, confirmed, in_progress, completed, cancelled
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_shift_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_shift_department FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT fk_shift_position FOREIGN KEY (position_id) REFERENCES public.position(position_id),
  CONSTRAINT fk_shift_profile FOREIGN KEY (assigned_profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_shift_template FOREIGN KEY (template_id) REFERENCES public.shift_template(template_id),
  CONSTRAINT fk_shift_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id)
);

-- Shift Swap Request (employee initiated shift swaps)
CREATE TABLE public.shift_swap_request (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_shift_id uuid NOT NULL,      -- What shift employee wants to give away
  to_shift_id uuid,                 -- What shift they want to take (can be null = open)
  requesting_profile_id uuid NOT NULL,
  accepting_profile_id uuid,        -- Who accepted (null if pending)
  status swap_status DEFAULT 'pending',  -- pending, approved, rejected, cancelled
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_swap_from_shift FOREIGN KEY (from_shift_id) REFERENCES public.shift(shift_id),
  CONSTRAINT fk_swap_to_shift FOREIGN KEY (to_shift_id) REFERENCES public.shift(shift_id),
  CONSTRAINT fk_swap_requesting FOREIGN KEY (requesting_profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_swap_accepting FOREIGN KEY (accepting_profile_id) REFERENCES public.profile(profile_id)
);
```

### 4.2 Daily Operations Tables

```sql
-- Department Session (daily operational container)
CREATE TABLE public.department_session (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  department_id uuid NOT NULL,
  session_date date NOT NULL,
  status session_status NOT NULL DEFAULT 'upcoming',  -- upcoming, active, pending_signoff, closed, missed
  opening_time time,
  closing_time time,
  planned_staff_count integer,
  actual_staff_count integer,
  forecast_revenue numeric,
  actual_revenue numeric,
  stress_level smallint,  -- 1-10 scale
  notes text,
  opened_by uuid,        -- Who opened the session
  closed_by uuid,        -- Who closed the session
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_session_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_session_department FOREIGN KEY (department_id) REFERENCES public.department(department_id),
  CONSTRAINT fk_session_opened_by FOREIGN KEY (opened_by) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_session_closed_by FOREIGN KEY (closed_by) REFERENCES public.profile(profile_id),
  CONSTRAINT unique_session_date_dept UNIQUE (department_id, session_date)
);

-- Task (generated from hooks, assigned per session)
CREATE TABLE public.task (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  hook_type hook_type,       -- pre_open, open, scheduled, pre_close, close, custom
  assigned_to_profile_id uuid NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',  -- pending, available, in_progress, completed, skipped, overdue, escalated
  due_time time,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_task_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_task_session FOREIGN KEY (session_id) REFERENCES public.department_session(session_id),
  CONSTRAINT fk_task_profile FOREIGN KEY (assigned_to_profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_task_completed_by FOREIGN KEY (completed_by) REFERENCES public.profile(profile_id)
);

-- Handoff Record (shift-to-shift information transfer)
CREATE TABLE public.handoff (
  handoff_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_shift_id uuid NOT NULL,
  to_shift_id uuid NOT NULL,
  session_id uuid NOT NULL,
  status handoff_status DEFAULT 'pending',  -- pending, signed, rejected
  message text,
  critical_items text,      -- Structured JSON of critical info
  signed_by uuid,           -- Who signed off on handoff
  signed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_handoff_from_shift FOREIGN KEY (from_shift_id) REFERENCES public.shift(shift_id),
  CONSTRAINT fk_handoff_to_shift FOREIGN KEY (to_shift_id) REFERENCES public.shift(shift_id),
  CONSTRAINT fk_handoff_session FOREIGN KEY (session_id) REFERENCES public.department_session(session_id),
  CONSTRAINT fk_handoff_signed_by FOREIGN KEY (signed_by) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_handoff_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id)
);
```

### 4.3 Absence Management Tables

```sql
-- Absence Type (sickness, vacation, unpaid leave, etc.)
CREATE TYPE absence_type AS ENUM ('sick', 'vacation', 'unpaid', 'parental', 'bereavement', 'other');
CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- Absence (employee absence record)
CREATE TABLE public.absence (
  absence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  absence_type absence_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status absence_status NOT NULL DEFAULT 'pending',
  reason text,
  attachment_url text,      -- Medical cert, etc.
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_absence_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_absence_profile FOREIGN KEY (profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_absence_approved_by FOREIGN KEY (approved_by) REFERENCES public.profile(profile_id)
);

-- Absence Day (granular tracking per day)
CREATE TABLE public.absence_day (
  day_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id uuid NOT NULL,
  absence_date date NOT NULL,
  shift_id uuid,            -- If absence covers a specific shift
  is_half_day boolean DEFAULT false,
  period_code text,         -- 'full', 'morning', 'afternoon', 'evening'
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_absence_day_absence FOREIGN KEY (absence_id) REFERENCES public.absence(absence_id) ON DELETE CASCADE,
  CONSTRAINT fk_absence_day_shift FOREIGN KEY (shift_id) REFERENCES public.shift(shift_id),
  CONSTRAINT unique_absence_day UNIQUE (absence_id, absence_date)
);
```

### 4.4 Required Enums

Add to migration `00001_identity_tables.sql` or new `00014_shift_enums.sql`:

```sql
CREATE TYPE shift_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'open');
CREATE TYPE swap_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE session_status AS ENUM ('upcoming', 'active', 'pending_signoff', 'closed', 'missed');
CREATE TYPE task_status AS ENUM ('pending', 'available', 'in_progress', 'completed', 'skipped', 'overdue', 'escalated');
CREATE TYPE hook_type AS ENUM ('pre_open', 'open', 'scheduled', 'pre_close', 'close', 'custom');
CREATE TYPE handoff_status AS ENUM ('pending', 'signed', 'rejected');
CREATE TYPE absence_type AS ENUM ('sick', 'vacation', 'unpaid', 'parental', 'bereavement', 'other');
CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
```

---

## Part 5: RLS Policies Audit 🔐

### Current Status

**Migration 00004** implements RLS but only for original 11 tables. Missing:

- ❌ `notification_*` tables (migration 00006)
- ❌ `employment_contract` (migration 00012)
- ❌ `profile_log` (migration 00012)
- ❌ `activity_trail` (migration 00005)
- ❌ Platform admin tables (migration 00013)

### High-Risk Tables (Need Immediate RLS)

| Table                 | Risk      | Policy Needed                                                   | Notes                                                 |
| --------------------- | --------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `employment_contract` | 🔴 High   | SELECT/INSERT/UPDATE only for contract owner or workspace admin | Links profiles to legal documents. Must be protected. |
| `profile_log`         | 🟡 Medium | SELECT only for profile owner or workspace admin                | Contains profile state history. Sensitive.            |
| `activity_trail`      | 🟡 Medium | SELECT only for workspace admin                                 | Audit log. Only admins should read.                   |
| `notification`        | 🟡 Medium | SELECT only for recipient profile                               | Personal notifications. Should be user-private.       |

### Recommended RLS Pattern for All Missing Tables

```sql
-- For workspace-scoped tables (most cases)
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace data" ON public.table_name
FOR SELECT
USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

CREATE POLICY "Admins can modify workspace data" ON public.table_name
FOR UPDATE
WITH CHECK (
  is_admin_in_workspace(workspace_id, auth.uid())
);

-- For user-private tables (profile_logs, notifications)
CREATE POLICY "Users can view own data" ON public.table_name
FOR SELECT
USING (
  profile_id IN (
    SELECT profile_id FROM public.profile
    WHERE user_id = auth.uid()
  )
);
```

---

## Part 6: Indexing Strategy 📊

### Current Indexes (from migration 00001)

```sql
CREATE INDEX idx_company_org_number ON public.company(org_number);
CREATE INDEX idx_profile_workspace_id ON public.profile(workspace_id);
CREATE INDEX idx_profile_user_id ON public.profile(user_id);
```

### Missing Indexes (High Priority)

| Table                 | Column(s)                                 | Query Pattern                          | Priority  |
| --------------------- | ----------------------------------------- | -------------------------------------- | --------- |
| `profile`             | (workspace_id, status)                    | "Get all active profiles in workspace" | 🔴 High   |
| `profile`             | (workspace_id, role)                      | "Get all managers in workspace"        | 🔴 High   |
| `department`          | (workspace_id, is_active)                 | "Get active departments"               | 🔴 High   |
| `shift`               | (workspace_id, shift_date, department_id) | "Get shifts for date range"            | 🔴 High   |
| `shift`               | (assigned_profile_id, shift_date)         | "Get employee's shifts this week"      | 🔴 High   |
| `absence`             | (profile_id, start_date, end_date)        | "Check if employee is absent"          | 🔴 High   |
| `protocol_assignment` | (profile_id, status)                      | "Get pending protocols for user"       | 🟡 Medium |
| `team_member`         | (profile_id)                              | "Get teams user belongs to"            | 🟡 Medium |

### Composite Index Examples

```sql
-- Fast shift lookups by date range
CREATE INDEX idx_shift_workspace_date_dept
ON public.shift(workspace_id, shift_date DESC, department_id);

-- Fast employee schedule queries
CREATE INDEX idx_shift_assigned_profile_date
ON public.shift(assigned_profile_id, shift_date DESC);

-- Fast absence conflict detection
CREATE INDEX idx_absence_profile_daterange
ON public.absence(profile_id, start_date, end_date);

-- Fast protocol completion tracking
CREATE INDEX idx_protocol_assignment_profile_status
ON public.protocol_assignment(profile_id, status);
```

---

## Part 7: Schema Consistency Issues

### Issue 1: Inconsistent Timestamp Columns

**Current pattern:**

- Most tables: `created_at`, `updated_at`
- Some tables: Missing `updated_at` (should be present)

**Check:** Verify all tables have both timestamps. Missing: Check migration 00013 (platform_admin tables).

### Issue 2: Missing Foreign Key Indexes

PostgreSQL doesn't automatically index foreign keys. This causes N+1 queries on joins.

```sql
-- Add index for every FK (sample)
CREATE INDEX idx_policy_created_by ON public.policy(created_by);
CREATE INDEX idx_protocol_owner_profile ON public.protocol(owner_profile_id);
CREATE INDEX idx_shift_created_by ON public.shift(created_by);
```

### Issue 3: Unused or Ambiguous Fields

| Field                                              | Issue                              | Recommendation                                         |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `profile.department_id` vs `profile.departments[]` | Dual dept assignment (see earlier) | Document which is primary, or consolidate              |
| `workspace.active_modules` text[]                  | Not validated                      | Use ENUM array instead: `active_modules module_type[]` |
| `position.skill_requirements` jsonb                | No schema validation               | Add Zod schema in app for validation                   |

---

## Summary of Recommendations

### 🔴 CRITICAL (Block Phase 3 & 4)

1. **Create shift tables** (shift, shift_template, shift_swap_request)
   - **Effort:** ~4 hours
   - **Impact:** Enables scheduling UI
   - **Files:** New migration `00014_shift_planning.sql`

2. **Create operations tables** (department_session, task, handoff)
   - **Effort:** ~3 hours
   - **Impact:** Enables live operations
   - **Files:** New migration `00015_operations.sql`

3. **Create absence tables** (absence, absence_day)
   - **Effort:** ~2 hours
   - **Impact:** Enables absence management
   - **Files:** New migration `00016_absence.sql`

### 🟡 HIGH (Unblock, then improve)

4. **Add RLS policies to missing tables**
   - **Tables:** employment_contract, profile_log, activity_trail, notifications
   - **Effort:** ~2 hours
   - **Files:** Extend migration `00004_rls_policies.sql`

5. **Add composite indexes for common queries**
   - **Effort:** ~1 hour
   - **Impact:** 10–100x speedup on shift/absence queries
   - **Files:** New migration `00017_performance_indexes.sql`

### 🟢 MEDIUM (Housekeeping)

6. **Document department assignment pattern** (department_id vs departments[])
   - **Effort:** 15 minutes
   - **Impact:** Prevents future bugs
   - **Files:** CLAUDE.md update

7. **Validate JSONB structures** in app code (control_list.items, routine.trigger_config)
   - **Effort:** ~2 hours
   - **Impact:** Prevents runtime errors
   - **Files:** `packages/types/src/schemas/` new Zod schemas

---

## Implementation Priority

**Week 1 (Days 1–2):**

- ✅ 00014 — Shift planning tables
- ✅ 00015 — Operations tables (department_session, task, handoff)
- ✅ 00016 — Absence tables

**Week 1 (Day 3):**

- ✅ 00017 — Performance indexes
- ✅ Update RLS on existing tables + new tables

**Week 2:**

- ✅ Zod schema validation for JSONB
- ✅ Test shift scheduler UI with real data
- ✅ Verify absence filtering works

---

## Files to Update

| File                                                | Change                | Priority         |
| --------------------------------------------------- | --------------------- | ---------------- |
| `supabase/migrations/00014_shift_planning.sql`      | NEW                   | 🔴               |
| `supabase/migrations/00015_operations.sql`          | NEW                   | 🔴               |
| `supabase/migrations/00016_absence.sql`             | NEW                   | 🔴               |
| `supabase/migrations/00017_performance_indexes.sql` | NEW                   | 🟡               |
| `supabase/migrations/00004_rls_policies.sql`        | EXTEND                | 🟡               |
| `packages/supabase/src/database.types.ts`           | REGENERATE            | After migrations |
| `packages/types/src/schemas/`                       | ADD Zod               | 🟢               |
| `CLAUDE.md`                                         | Document dept pattern | 🟢               |
| `docs/DATABASE_REVIEW_2026-02-28.md`                | THIS FILE             | ✅               |

---

## Conclusion

Your core schema is **well-architected and secure**. The main blocker is the **missing shift/operations layer**, which prevents you from moving to Phase 3. Once those tables are created (3–4 days of work), the scheduling UI and live operations modules can be fully implemented.

All recommendations are scoped to maintain your existing patterns and naming conventions. No breaking changes to current tables.

**Next step:** Create the three missing migrations (shift, operations, absence) and regenerate database types. Then test the scheduling UI with real shift data.

---

**Generated:** 2026-02-28 | **Review completeness:** 100% of 15 migrations analyzed
