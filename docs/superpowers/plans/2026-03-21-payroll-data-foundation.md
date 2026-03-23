# Payroll Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete payroll configuration, calculation, absence/leave, and timebank schema — 23 new tables, 16 new enums, ALTER 2 existing tables, seed Norwegian holidays 2026-2027 — so that Sprint 2 (calculation engine) and Sprint 3 (settings UI) can build on a verified data model.

**Architecture:** Six sequential tracks: T1 creates 16 payroll enums; T2 creates 11 configuration tables (employee groups, shift types, salary codes, supplement rules, break rules, holiday calendars, meal rules, working time rules, workspace settings); T3 creates 7 period/calculation/export tables; T4 ALTERs `schedule_shift` and `profile` with payroll fields; T5 seeds Norwegian holidays and regenerates TypeScript types; T6 creates 5 absence/leave/timebank tables (absence types, quotas, absence ledger, sick leave periods, timebank entries).

**Scope boundary:** This plan covers database schema only (Sprint 1, data model). No UI, no calculation engine, no export logic. Settings UI is a separate plan. The calculation engine (Sprint 2) is a separate plan.

**Cascade overlap (verified):** Cascade A1 already created `tariff_rate_table`, `employee_payroll_profile`, `shift_cost_snapshot`, `public_holiday`. These are Cascade-layer concepts. The payroll tables in this plan are the operational Planday-modeled layer that works independently. Cascade enhances payroll; payroll does not depend on Cascade. See spec Section 8 for integration points.

**Tech Stack:** PostgreSQL 17, Supabase migrations, TypeScript (strict)

**Spec:** The payroll feature spec provided by user (Sections 1-9). Read before starting any task.

**Key codebase facts (verified):**

- Latest migration timestamp: `20260421210000` (Cascade cleanup markers)
- `btree_gist` extension already enabled (Cascade A1)
- Enum creation pattern: `DO $$ BEGIN IF NOT EXISTS ... END $$;;`
- RLS mandatory: JWT (all CRUD) + API key (read) + service_role (all) per workspace-scoped table
- Updated-at trigger: uses existing `public.set_updated_at()` function
- `schedule_shift` already has: `department_id`, `location_id` (from Cascade A1 ALTER)
- `profile` already has: `seniority_start_date`, `has_fagbrev` (from Cascade A1 ALTER)
- `employment_contract` already has: `agreed_weekly_hours` (from Cascade A1 ALTER)
- `public_holiday` exists (platform-level, no workspace_id) — payroll holiday calendars are workspace-scoped and complementary
- All 12 new enum names verified: zero conflicts with existing 82+ enums

**Design decisions (not in spec, decided during planning):**

- Many-to-many relationships on config tables (supplement → groups, supplement → shift_types, etc.) use `UUID[]` arrays instead of junction tables. This keeps the schema at 18 tables instead of 25+. The admin UI validates on write; FK integrity is soft.
- `payroll_workspace_settings` added as a 1:1 workspace config table for general payroll settings (default salary codes, period type, etc.). Not explicitly in spec but implied by Section 6.1.
- `payroll_deviation_severity` uses `error | warning | info` (per spec Section 5). This is deliberately different from existing `deviation_severity` enum (`low | medium | high | critical`) which is for operational deviations. Payroll deviations have different semantics.
- `profile.contracted_weekly_hours` is added per spec. Note: `employment_contract.agreed_weekly_hours` already exists from Cascade — these serve different purposes (profile = current operational value used by schedule; contract = legal agreement value). They may differ during contract transitions.
- `payroll_supplement_rule` is a single wide table with nullable type-specific columns. All 6 supplement types share one table, distinguished by `supplement_type` enum. Nullable columns are NULL when irrelevant to the type. This matches Planday's architecture.
- Holiday seed covers 2026-2027 Norwegian public holidays in the platform-level `public_holiday` table (already created by Cascade A1). Workspace-scoped `payroll_holiday_calendar` + `payroll_holiday_entry` are admin-managed — no seed data needed.

---

## Remaining Plans (not covered here)

| Plan                                     | Sprint        | What                                                                         |
| ---------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| **Plan 2: Payroll Settings UI**          | Sprint 1 (UI) | Settings screens for all config tables — `2026-03-21-payroll-settings-ui.md` |
| **Plan 3: Payroll Calculation Engine**   | Sprint 2      | `calculateShiftPayroll()` pure function + all control checks                 |
| **Plan 4: Schedule Payroll Integration** | Sprint 3      | Cost overlay on schedule, period management, deviation dashboard             |
| **Plan 5: Tripletex Export**             | Sprint 4      | API adapter, mapping UI, export pipeline                                     |

---

## File Structure

### Track 1 — Payroll Enums

| File                                                   | Responsibility            |
| ------------------------------------------------------ | ------------------------- |
| `supabase/migrations/20260422100000_payroll_enums.sql` | 12 payroll-specific enums |

### Track 2 — Payroll Configuration Tables

| File                                                           | Responsibility                               |
| -------------------------------------------------------------- | -------------------------------------------- |
| `supabase/migrations/20260422100100_payroll_config_tables.sql` | 11 config tables with RLS, indexes, triggers |

### Track 3 — Payroll Period & Calculation Tables

| File                                                                | Responsibility                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `supabase/migrations/20260422100200_payroll_calculation_tables.sql` | 7 period/calculation/export tables with RLS, indexes, triggers |

### Track 4 — ALTER Existing Tables

| File                                                            | Responsibility                                |
| --------------------------------------------------------------- | --------------------------------------------- |
| `supabase/migrations/20260422100300_payroll_alter_existing.sql` | New columns on `schedule_shift` and `profile` |

### Track 5 — Seed Data & Type Regeneration

| File                                                           | Responsibility                                            |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/20260422100400_payroll_seed_holidays.sql` | Norwegian public holidays 2026-2027 into `public_holiday` |

### Track 6 — Absence, Leave & Timebank

| File                                                            | Responsibility                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `supabase/migrations/20260422100500_payroll_absence_enums.sql`  | 4 absence/timebank enums                                    |
| `supabase/migrations/20260422100600_payroll_absence_tables.sql` | 5 absence/leave/timebank tables with RLS, indexes, triggers |

### Track 7 — Type Regeneration (after all migrations)

| File                                      | Responsibility                             |
| ----------------------------------------- | ------------------------------------------ |
| `packages/supabase/src/database.types.ts` | Regenerated after all 7 migrations applied |

---

## Track 1: Payroll Enums

### Task 1.1: Create Payroll Enums

**Files:**

- Create: `supabase/migrations/20260422100000_payroll_enums.sql`

- [ ] **Step 1: Create the enum migration**

```sql
-- ============================================
-- 20260422100000_payroll_enums.sql
-- Payroll: 12 payroll-specific enums
-- Spec: Sections 1.1-1.7, 4.4, 5.1-5.3
-- ============================================

-- 1. Wage type for employee group membership
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_wage_type') THEN
    CREATE TYPE public.payroll_wage_type AS ENUM ('hourly', 'per_shift', 'monthly');
  END IF;
END $$;;

-- 2. Rate adjustment method for shift types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_rate_adjustment_type') THEN
    CREATE TYPE public.payroll_rate_adjustment_type AS ENUM ('none', 'replace', 'add', 'percentage');
  END IF;
END $$;;

-- 3. Salary code classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_salary_code_category') THEN
    CREATE TYPE public.payroll_salary_code_category AS ENUM (
      'worked_hours', 'supplement', 'overtime', 'absence', 'deduction', 'monthly_salary'
    );
  END IF;
END $$;;

-- 4. Supplement rule type (6 types per spec Section 1.4)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_type') THEN
    CREATE TYPE public.payroll_supplement_type AS ENUM (
      'normal', 'week_based', 'day_based', 'manual', 'holiday', 'contract_rule'
    );
  END IF;
END $$;;

-- 5. How supplement rate is calculated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_rate_type') THEN
    CREATE TYPE public.payroll_supplement_rate_type AS ENUM ('fixed_per_hour', 'percentage', 'fixed_per_shift');
  END IF;
END $$;;

-- 6. When a normal supplement triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_start_type') THEN
    CREATE TYPE public.payroll_supplement_start_type AS ENUM ('time_of_day', 'after_shift_start');
  END IF;
END $$;;

-- 7. What triggers a break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_break_trigger_type') THEN
    CREATE TYPE public.payroll_break_trigger_type AS ENUM ('after_duration', 'time_of_day');
  END IF;
END $$;;

-- 8. Meal rule direction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_meal_rule_type') THEN
    CREATE TYPE public.payroll_meal_rule_type AS ENUM ('deduction', 'contribution');
  END IF;
END $$;;

-- 9. Payroll period lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_period_status') THEN
    CREATE TYPE public.payroll_period_status AS ENUM ('open', 'locked', 'approved', 'exported');
  END IF;
END $$;;

-- 10. Payroll deviation severity (different from deviation_severity which is low/medium/high/critical)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_deviation_severity') THEN
    CREATE TYPE public.payroll_deviation_severity AS ENUM ('error', 'warning', 'info');
  END IF;
END $$;;

-- 11. Working time rule enforcement level
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_rule_severity') THEN
    CREATE TYPE public.payroll_rule_severity AS ENUM ('block', 'warn');
  END IF;
END $$;;

-- 12. Custom rate type on shift override
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_custom_rate_type') THEN
    CREATE TYPE public.payroll_custom_rate_type AS ENUM ('per_hour', 'per_shift');
  END IF;
END $$;;

-- Comments
COMMENT ON TYPE public.payroll_wage_type IS 'Payroll: employee compensation basis — hourly/per_shift/monthly';
COMMENT ON TYPE public.payroll_rate_adjustment_type IS 'Payroll: how shift type adjusts base rate — none/replace/add/percentage';
COMMENT ON TYPE public.payroll_salary_code_category IS 'Payroll: salary code classification for reporting and export';
COMMENT ON TYPE public.payroll_supplement_type IS 'Payroll: 6 supplement rule types — normal/week_based/day_based/manual/holiday/contract_rule';
COMMENT ON TYPE public.payroll_supplement_rate_type IS 'Payroll: how supplement amount is calculated — fixed_per_hour/percentage/fixed_per_shift';
COMMENT ON TYPE public.payroll_supplement_start_type IS 'Payroll: when normal supplement triggers — time_of_day/after_shift_start';
COMMENT ON TYPE public.payroll_break_trigger_type IS 'Payroll: what triggers automatic break — after_duration/time_of_day';
COMMENT ON TYPE public.payroll_meal_rule_type IS 'Payroll: meal rule direction — deduction/contribution';
COMMENT ON TYPE public.payroll_period_status IS 'Payroll: period lifecycle — open/locked/approved/exported';
COMMENT ON TYPE public.payroll_deviation_severity IS 'Payroll: deviation severity — error (blocks approval)/warning/info';
COMMENT ON TYPE public.payroll_rule_severity IS 'Payroll: working time rule enforcement — block (prevents save)/warn (allows with flag)';
COMMENT ON TYPE public.payroll_custom_rate_type IS 'Payroll: custom rate override type on shift — per_hour/per_shift';
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100000_payroll_enums.sql`
Expected: No errors. 12 enums created.

- [ ] **Step 3: Verify enums exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT typname FROM pg_type WHERE typname LIKE 'payroll_%' ORDER BY typname;"`
Expected: 12 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422100000_payroll_enums.sql
git commit -m "$(cat <<'EOF'
feat(payroll): add 12 payroll enums

payroll_wage_type, payroll_rate_adjustment_type,
payroll_salary_code_category, payroll_supplement_type,
payroll_supplement_rate_type, payroll_supplement_start_type,
payroll_break_trigger_type, payroll_meal_rule_type,
payroll_period_status, payroll_deviation_severity,
payroll_rule_severity, payroll_custom_rate_type.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 2: Payroll Configuration Tables

### Task 2.1: Create Configuration Tables

**Files:**

- Create: `supabase/migrations/20260422100100_payroll_config_tables.sql`

**Important:** This is the largest migration. 11 tables with full RLS, indexes, triggers, and comments. The SQL below is the complete migration — copy it exactly.

- [ ] **Step 1: Create the configuration tables migration**

```sql
-- ============================================
-- 20260422100100_payroll_config_tables.sql
-- Payroll: 11 configuration tables
-- Spec: Sections 1.1-1.7, 6.1-6.3
-- Depends on: 20260422100000 (payroll enums)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_workspace_settings (1:1 with workspace)
-- General payroll configuration per workspace
-- Spec: Section 6.1 General
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_workspace_settings (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  default_worked_hours_salary_code TEXT,
  default_monthly_salary_code      TEXT,
  period_type                     TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'biweekly', 'weekly')),
  period_start_day                INT NOT NULL DEFAULT 1 CHECK (period_start_day BETWEEN 1 AND 28),
  shift_grouping                  TEXT NOT NULL DEFAULT 'department' CHECK (shift_grouping IN ('department', 'wage', 'wage_type')),
  employer_social_security_pct    NUMERIC(5,2) NOT NULL DEFAULT 14.1,
  vacation_pay_pct                NUMERIC(5,2) NOT NULL DEFAULT 12.0,
  pension_pct                     NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_settings_workspace UNIQUE (workspace_id)
);

ALTER TABLE payroll_workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_select_payroll_settings" ON payroll_workspace_settings
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_insert_payroll_settings" ON payroll_workspace_settings
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "jwt_update_payroll_settings" ON payroll_workspace_settings
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "api_key_read_payroll_settings" ON payroll_workspace_settings
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_settings" ON payroll_workspace_settings;
CREATE POLICY "service_role_payroll_settings" ON payroll_workspace_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Note: No JWT DELETE policy — intentional. Settings row is 1:1 with workspace and should not be deleted from UI. Reset by updating to defaults.
COMMENT ON TABLE payroll_workspace_settings IS 'Payroll: workspace-level general settings (period type, default codes, employer cost percentages). 1:1 with workspace.';

-- --------------------------------------------------------
-- 2. payroll_employee_group (Employee groups with default rates)
-- Spec: Section 1.1
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_employee_group (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  default_hourly_rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  salary_code         TEXT,
  department_id       UUID REFERENCES department(department_id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_employee_group ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_select_payroll_employee_group" ON payroll_employee_group
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_insert_payroll_employee_group" ON payroll_employee_group
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_update_payroll_employee_group" ON payroll_employee_group
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "jwt_delete_payroll_employee_group" ON payroll_employee_group
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "api_key_read_payroll_employee_group" ON payroll_employee_group
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_employee_group" ON payroll_employee_group;
CREATE POLICY "service_role_payroll_employee_group" ON payroll_employee_group
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_employee_group_updated_at
  BEFORE UPDATE ON public.payroll_employee_group
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_employee_group_workspace
  ON payroll_employee_group (workspace_id);

COMMENT ON TABLE payroll_employee_group IS 'Payroll: employee groups (e.g., Kokk, Servitoer) with default hourly rate and salary code mapping.';

-- --------------------------------------------------------
-- 3. payroll_employee_group_member (Employee <-> group with individual rates)
-- Spec: Section 1.1 "Per-member rates"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_employee_group_member (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employee_group_id   UUID NOT NULL REFERENCES payroll_employee_group(id) ON DELETE CASCADE,
  hourly_rate         NUMERIC(8,2),
  valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,
  wage_type           payroll_wage_type NOT NULL DEFAULT 'hourly',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_member_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_employee_group_member ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_select_payroll_group_member" ON payroll_employee_group_member
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_insert_payroll_group_member" ON payroll_employee_group_member
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_update_payroll_group_member" ON payroll_employee_group_member
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "jwt_delete_payroll_group_member" ON payroll_employee_group_member
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "api_key_read_payroll_group_member" ON payroll_employee_group_member
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_group_member" ON payroll_employee_group_member;
CREATE POLICY "service_role_payroll_group_member" ON payroll_employee_group_member
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_group_member_updated_at
  BEFORE UPDATE ON public.payroll_employee_group_member
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_group_member_workspace
  ON payroll_employee_group_member (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_group_member_profile
  ON payroll_employee_group_member (profile_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_payroll_group_member_group
  ON payroll_employee_group_member (employee_group_id);

COMMENT ON TABLE payroll_employee_group_member IS 'Payroll: employee-group membership with individual rate override and rate history. NULL hourly_rate = use group default.';

-- --------------------------------------------------------
-- 4. payroll_shift_type (Shift type definitions with rate adjustments)
-- Spec: Section 1.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_shift_type (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  color                       TEXT DEFAULT '#6B7280',
  salary_code                 TEXT,
  rate_adjustment_type        payroll_rate_adjustment_type NOT NULL DEFAULT 'none',
  rate_adjustment_value       NUMERIC(8,2) DEFAULT 0,
  count_in_payroll            BOOLEAN NOT NULL DEFAULT true,
  allow_supplements           BOOLEAN NOT NULL DEFAULT true,
  allow_breaks                BOOLEAN NOT NULL DEFAULT true,
  allow_meal_deduction        BOOLEAN NOT NULL DEFAULT true,
  affects_salaried            BOOLEAN NOT NULL DEFAULT false,
  allow_conflicting_shifts    BOOLEAN NOT NULL DEFAULT false,
  include_in_schedule_print   BOOLEAN NOT NULL DEFAULT true,
  overwrite_on_template       BOOLEAN NOT NULL DEFAULT false,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  sort_order                  INT NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_shift_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_select_payroll_shift_type" ON payroll_shift_type
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_insert_payroll_shift_type" ON payroll_shift_type
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_update_payroll_shift_type" ON payroll_shift_type
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "jwt_delete_payroll_shift_type" ON payroll_shift_type
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "api_key_read_payroll_shift_type" ON payroll_shift_type
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_shift_type" ON payroll_shift_type;
CREATE POLICY "service_role_payroll_shift_type" ON payroll_shift_type
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_shift_type_updated_at
  BEFORE UPDATE ON public.payroll_shift_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_shift_type_workspace
  ON payroll_shift_type (workspace_id);

COMMENT ON TABLE payroll_shift_type IS 'Payroll: shift type definitions (Normal, Opplaering, Sykdom, Moete) with rate adjustments and payroll feature flags.';

-- --------------------------------------------------------
-- 5. payroll_salary_code (Salary code registry / loennsarter)
-- Spec: Section 1.3
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_salary_code (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  external_code   TEXT,
  category        payroll_salary_code_category NOT NULL,
  a_melding_code  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_salary_code_per_workspace UNIQUE (workspace_id, code)
);

ALTER TABLE payroll_salary_code ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_select_payroll_salary_code" ON payroll_salary_code
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_insert_payroll_salary_code" ON payroll_salary_code
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_update_payroll_salary_code" ON payroll_salary_code
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "jwt_delete_payroll_salary_code" ON payroll_salary_code
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "api_key_read_payroll_salary_code" ON payroll_salary_code
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_salary_code" ON payroll_salary_code;
CREATE POLICY "service_role_payroll_salary_code" ON payroll_salary_code
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_salary_code_updated_at
  BEFORE UPDATE ON public.payroll_salary_code
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_salary_code_workspace
  ON payroll_salary_code (workspace_id);

COMMENT ON TABLE payroll_salary_code IS 'Payroll: salary code registry (loennsarter). Maps internal codes to Tripletex external codes and a-melding reporting codes.';

-- --------------------------------------------------------
-- 6. payroll_supplement_rule (All 6 supplement types in one wide table)
-- Spec: Section 1.4 (Types 1-6)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_supplement_rule (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  supplement_type         payroll_supplement_type NOT NULL,
  salary_code             TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  sort_order              INT NOT NULL DEFAULT 0,

  -- Rate calculation (all types)
  rate_type               payroll_supplement_rate_type NOT NULL DEFAULT 'fixed_per_hour',
  rate_value              NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Eligibility filters (UUID[] — empty = applies to all)
  employee_group_ids      UUID[] NOT NULL DEFAULT '{}',
  employee_types          TEXT[] NOT NULL DEFAULT '{}',
  shift_type_ids          UUID[] NOT NULL DEFAULT '{}',

  -- Shared flags
  affected_by_breaks      BOOLEAN NOT NULL DEFAULT true,
  affects_salaried        BOOLEAN NOT NULL DEFAULT false,
  enforced_payment        BOOLEAN NOT NULL DEFAULT false,
  consider_midnight       BOOLEAN NOT NULL DEFAULT true,
  valid_from              DATE,
  valid_until             DATE,

  -- Type 1: Normal supplement (time-window based)
  start_type              payroll_supplement_start_type,
  time_window_start       TIME,
  time_window_end         TIME,
  after_minutes           INT,
  weekdays                INT[] NOT NULL DEFAULT '{}',
  holiday_calendar_id     UUID REFERENCES payroll_holiday_calendar(id) ON DELETE SET NULL,

  -- Type 2: Week-based supplement
  weekly_threshold_hours  NUMERIC(5,2),
  weekly_max_hours        NUMERIC(5,2),

  -- Type 3: Day-based supplement
  daily_threshold_hours   NUMERIC(5,2),
  daily_max_hours         NUMERIC(5,2),

  -- Type 4: Manual supplement
  default_rate            NUMERIC(8,2),
  allow_rate_override     BOOLEAN NOT NULL DEFAULT true,

  -- Type 5: Holiday supplement
  -- Uses holiday_calendar_id (shared with Type 1)

  -- Type 6: Contract rule supplement
  contract_rule_id        UUID,
  evaluation_field        TEXT,
  threshold_value         NUMERIC(8,2),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplement_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_supplement_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_select_payroll_supplement_rule" ON payroll_supplement_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_insert_payroll_supplement_rule" ON payroll_supplement_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_update_payroll_supplement_rule" ON payroll_supplement_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "jwt_delete_payroll_supplement_rule" ON payroll_supplement_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "api_key_read_payroll_supplement_rule" ON payroll_supplement_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_supplement_rule" ON payroll_supplement_rule;
CREATE POLICY "service_role_payroll_supplement_rule" ON payroll_supplement_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_supplement_rule_updated_at
  BEFORE UPDATE ON public.payroll_supplement_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_supplement_rule_workspace
  ON payroll_supplement_rule (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_supplement_rule_type
  ON payroll_supplement_rule (workspace_id, supplement_type) WHERE is_active = true;

COMMENT ON TABLE payroll_supplement_rule IS 'Payroll: supplement rule definitions for all 6 types (normal, week_based, day_based, manual, holiday, contract_rule). Wide table — type-specific columns are NULL when irrelevant.';

-- --------------------------------------------------------
-- 7. payroll_break_rule (Automatic break assignment)
-- Spec: Section 1.5
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_break_rule (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  trigger_type                payroll_break_trigger_type NOT NULL,
  trigger_minutes             INT,
  trigger_time                TIME,
  duration_minutes            INT NOT NULL,
  min_shift_duration_minutes  INT NOT NULL DEFAULT 0,
  is_paid                     BOOLEAN NOT NULL DEFAULT false,
  department_ids              UUID[] NOT NULL DEFAULT '{}',
  employee_group_ids          UUID[] NOT NULL DEFAULT '{}',
  weekdays                    INT[] NOT NULL DEFAULT '{}',
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  valid_from                  DATE,
  valid_until                 DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_break_trigger CHECK (
    (trigger_type = 'after_duration' AND trigger_minutes IS NOT NULL)
    OR (trigger_type = 'time_of_day' AND trigger_time IS NOT NULL)
  ),
  CONSTRAINT chk_break_valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

ALTER TABLE payroll_break_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_select_payroll_break_rule" ON payroll_break_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_insert_payroll_break_rule" ON payroll_break_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_update_payroll_break_rule" ON payroll_break_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "jwt_delete_payroll_break_rule" ON payroll_break_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "api_key_read_payroll_break_rule" ON payroll_break_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_break_rule" ON payroll_break_rule;
CREATE POLICY "service_role_payroll_break_rule" ON payroll_break_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_break_rule_updated_at
  BEFORE UPDATE ON public.payroll_break_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_break_rule_workspace
  ON payroll_break_rule (workspace_id);

COMMENT ON TABLE payroll_break_rule IS 'Payroll: automatic break assignment rules. Triggers after duration or at fixed time. Break is paid or unpaid.';

-- --------------------------------------------------------
-- 8. payroll_holiday_calendar (Workspace-scoped holiday calendar headers)
-- Spec: Section 1.6
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_holiday_calendar (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_holiday_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_select_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_insert_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_update_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "jwt_delete_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "api_key_read_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_holiday_calendar" ON payroll_holiday_calendar;
CREATE POLICY "service_role_payroll_holiday_calendar" ON payroll_holiday_calendar
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_holiday_calendar_updated_at
  BEFORE UPDATE ON public.payroll_holiday_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_holiday_calendar_workspace
  ON payroll_holiday_calendar (workspace_id);

COMMENT ON TABLE payroll_holiday_calendar IS 'Payroll: workspace-scoped holiday calendar headers. Complementary to platform-level public_holiday table. Admin manages which holidays apply to their workspace.';

-- --------------------------------------------------------
-- 9. payroll_holiday_entry (Holiday dates per calendar)
-- Spec: Section 1.6 "Holiday entries"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_holiday_entry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  calendar_id     UUID NOT NULL REFERENCES payroll_holiday_calendar(id) ON DELETE CASCADE,
  holiday_date    DATE NOT NULL,
  name            TEXT NOT NULL,
  name_no         TEXT,
  hours           NUMERIC(4,1) NOT NULL DEFAULT 8,
  is_full_day     BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_holiday_entry_per_calendar UNIQUE (calendar_id, holiday_date)
);

ALTER TABLE payroll_holiday_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_select_payroll_holiday_entry" ON payroll_holiday_entry
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_insert_payroll_holiday_entry" ON payroll_holiday_entry
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_update_payroll_holiday_entry" ON payroll_holiday_entry
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "jwt_delete_payroll_holiday_entry" ON payroll_holiday_entry
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "api_key_read_payroll_holiday_entry" ON payroll_holiday_entry
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_holiday_entry" ON payroll_holiday_entry;
CREATE POLICY "service_role_payroll_holiday_entry" ON payroll_holiday_entry
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_holiday_entry_updated_at
  BEFORE UPDATE ON public.payroll_holiday_entry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_holiday_entry_calendar
  ON payroll_holiday_entry (calendar_id);
CREATE INDEX IF NOT EXISTS idx_payroll_holiday_entry_date
  ON payroll_holiday_entry (holiday_date);

COMMENT ON TABLE payroll_holiday_entry IS 'Payroll: individual holiday dates per workspace calendar. Admins can import from platform-level public_holiday or add custom entries.';

-- --------------------------------------------------------
-- 10. payroll_meal_rule (Meal deductions and contributions)
-- Spec: Section 1.7
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_meal_rule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  meal_type           payroll_meal_rule_type NOT NULL,
  salary_code         TEXT,
  amount              NUMERIC(8,2) NOT NULL,
  min_shift_hours     NUMERIC(4,1) NOT NULL DEFAULT 0,
  department_ids      UUID[] NOT NULL DEFAULT '{}',
  employee_group_ids  UUID[] NOT NULL DEFAULT '{}',
  shift_type_ids      UUID[] NOT NULL DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_meal_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_select_payroll_meal_rule" ON payroll_meal_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_insert_payroll_meal_rule" ON payroll_meal_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_update_payroll_meal_rule" ON payroll_meal_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "jwt_delete_payroll_meal_rule" ON payroll_meal_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "api_key_read_payroll_meal_rule" ON payroll_meal_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_meal_rule" ON payroll_meal_rule;
CREATE POLICY "service_role_payroll_meal_rule" ON payroll_meal_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_meal_rule_updated_at
  BEFORE UPDATE ON public.payroll_meal_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_meal_rule_workspace
  ON payroll_meal_rule (workspace_id);

COMMENT ON TABLE payroll_meal_rule IS 'Payroll: meal deduction/contribution rules. Deductions reduce pay for provided meals, contributions add employer meal support.';

-- --------------------------------------------------------
-- 11. payroll_working_time_rule (AML compliance rules)
-- Spec: Section 2.5 and Section 5.3
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_working_time_rule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  severity            payroll_rule_severity NOT NULL DEFAULT 'warn',
  threshold_value     NUMERIC(6,2) NOT NULL,
  scope_type          TEXT NOT NULL DEFAULT 'workspace' CHECK (scope_type IN ('workspace', 'department', 'employee_group')),
  scope_id            UUID,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_working_time_rule UNIQUE NULLS NOT DISTINCT (workspace_id, code, scope_type, scope_id)
);

ALTER TABLE payroll_working_time_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_select_payroll_working_time_rule" ON payroll_working_time_rule
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_insert_payroll_working_time_rule" ON payroll_working_time_rule
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_update_payroll_working_time_rule" ON payroll_working_time_rule
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "jwt_delete_payroll_working_time_rule" ON payroll_working_time_rule
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "api_key_read_payroll_working_time_rule" ON payroll_working_time_rule
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_working_time_rule" ON payroll_working_time_rule;
CREATE POLICY "service_role_payroll_working_time_rule" ON payroll_working_time_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_working_time_rule_updated_at
  BEFORE UPDATE ON public.payroll_working_time_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_working_time_rule_workspace
  ON payroll_working_time_rule (workspace_id);

COMMENT ON TABLE payroll_working_time_rule IS 'Payroll: workspace-configurable AML working time rules. Codes: W01-W06. Admin sets thresholds and block/warn severity per scope. Complementary to Cascade framework_rule (governance layer).';
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100100_payroll_config_tables.sql`
Expected: No errors. 11 tables created.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' ORDER BY tablename;"`
Expected: 11 rows (payroll_break_rule, payroll_employee_group, payroll_employee_group_member, payroll_holiday_calendar, payroll_holiday_entry, payroll_meal_rule, payroll_salary_code, payroll_shift_type, payroll_supplement_rule, payroll_working_time_rule, payroll_workspace_settings).

- [ ] **Step 4: Verify RLS is enabled on all tables**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' ORDER BY tablename;"`
Expected: All 11 rows show `rowsecurity = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422100100_payroll_config_tables.sql
git commit -m "$(cat <<'EOF'
feat(payroll): create 11 configuration tables with RLS

payroll_workspace_settings, payroll_employee_group,
payroll_employee_group_member, payroll_shift_type,
payroll_salary_code, payroll_supplement_rule,
payroll_break_rule, payroll_holiday_calendar,
payroll_holiday_entry, payroll_meal_rule,
payroll_working_time_rule.

All tables: workspace-scoped, RLS (JWT + API key + service_role),
updated_at triggers, workspace index.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 3: Payroll Period & Calculation Tables

### Task 3.1: Create Period, Calculation, and Export Tables

**Files:**

- Create: `supabase/migrations/20260422100200_payroll_calculation_tables.sql`

- [ ] **Step 1: Create the calculation tables migration**

```sql
-- ============================================
-- 20260422100200_payroll_calculation_tables.sql
-- Payroll: 7 period, calculation, and export tables
-- Spec: Sections 4.4, 5.4, 7.2
-- Depends on: 20260422100100 (config tables)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_period (Payroll period lifecycle)
-- Spec: Section 4.4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_period (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          payroll_period_status NOT NULL DEFAULT 'open',
  locked_by       UUID REFERENCES profile(profile_id),
  locked_at       TIMESTAMPTZ,
  approved_by     UUID REFERENCES profile(profile_id),
  approved_at     TIMESTAMPTZ,
  exported_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_period_dates CHECK (end_date > start_date),
  CONSTRAINT uq_payroll_period UNIQUE (workspace_id, start_date, end_date)
);

ALTER TABLE payroll_period ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_period" ON payroll_period;
CREATE POLICY "jwt_select_payroll_period" ON payroll_period
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_period" ON payroll_period;
CREATE POLICY "jwt_insert_payroll_period" ON payroll_period
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_period" ON payroll_period;
CREATE POLICY "jwt_update_payroll_period" ON payroll_period
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_period" ON payroll_period;
CREATE POLICY "api_key_read_payroll_period" ON payroll_period
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_period" ON payroll_period;
CREATE POLICY "service_role_payroll_period" ON payroll_period
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_period_updated_at
  BEFORE UPDATE ON public.payroll_period
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_period_workspace
  ON payroll_period (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period_dates
  ON payroll_period (workspace_id, start_date, end_date);

-- Note: No JWT DELETE policy — intentional. Periods are never deleted; re-open (unlock) is the recovery path.
COMMENT ON TABLE payroll_period IS 'Payroll: period lifecycle (open -> locked -> approved -> exported). Cannot approve with unacknowledged error-severity deviations.';

-- --------------------------------------------------------
-- 2. payroll_calculation (Per-shift calculation result, append-only)
-- Spec: Section 4.1 step 9
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_calculation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  period_id           UUID NOT NULL REFERENCES payroll_period(id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employee_group_id   UUID REFERENCES payroll_employee_group(id),
  shift_type_id       UUID REFERENCES payroll_shift_type(id),
  shift_date          DATE NOT NULL,
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  actual_start        TIMESTAMPTZ,
  actual_end          TIMESTAMPTZ,
  gross_minutes       INT NOT NULL,
  break_minutes_paid  INT NOT NULL DEFAULT 0,
  break_minutes_unpaid INT NOT NULL DEFAULT 0,
  net_working_minutes INT NOT NULL,
  base_rate           NUMERIC(8,2) NOT NULL,
  base_pay            NUMERIC(10,2) NOT NULL,
  total_supplements   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_pay           NUMERIC(10,2) NOT NULL,
  calculation_version INT NOT NULL DEFAULT 1,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: new calculation = new row. Never UPDATE.

ALTER TABLE payroll_calculation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_calculation" ON payroll_calculation;
CREATE POLICY "jwt_select_payroll_calculation" ON payroll_calculation
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_calculation" ON payroll_calculation;
CREATE POLICY "jwt_insert_payroll_calculation" ON payroll_calculation
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_calculation" ON payroll_calculation;
CREATE POLICY "api_key_read_payroll_calculation" ON payroll_calculation
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_calculation" ON payroll_calculation;
CREATE POLICY "service_role_payroll_calculation" ON payroll_calculation
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only table
CREATE INDEX IF NOT EXISTS idx_payroll_calc_workspace
  ON payroll_calculation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_period
  ON payroll_calculation (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_shift
  ON payroll_calculation (schedule_shift_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_calc_profile
  ON payroll_calculation (profile_id, shift_date);

COMMENT ON TABLE payroll_calculation IS 'Payroll: per-shift calculation result. Append-only — never UPDATE, insert new version. Latest = MAX(calculated_at) per shift.';

-- --------------------------------------------------------
-- 3. payroll_calculation_line (Per-item line in calculation)
-- Spec: Section 4.1 step 7
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_calculation_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  calculation_id  UUID NOT NULL REFERENCES payroll_calculation(id) ON DELETE CASCADE,
  salary_code     TEXT NOT NULL,
  line_type       TEXT NOT NULL CHECK (line_type IN ('base', 'supplement', 'deduction', 'overtime', 'meal')),
  description     TEXT NOT NULL,
  hours           NUMERIC(6,2),
  rate            NUMERIC(8,2),
  amount          NUMERIC(10,2) NOT NULL,
  supplement_rule_id UUID REFERENCES payroll_supplement_rule(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only: lives and dies with parent payroll_calculation row

ALTER TABLE payroll_calculation_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "jwt_select_payroll_calc_line" ON payroll_calculation_line
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "jwt_insert_payroll_calc_line" ON payroll_calculation_line
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "api_key_read_payroll_calc_line" ON payroll_calculation_line
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_calc_line" ON payroll_calculation_line;
CREATE POLICY "service_role_payroll_calc_line" ON payroll_calculation_line
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_calc_line_calc
  ON payroll_calculation_line (calculation_id);

COMMENT ON TABLE payroll_calculation_line IS 'Payroll: individual line items in a shift calculation. Each line = one salary code entry (base, supplement, deduction, overtime, meal).';

-- --------------------------------------------------------
-- 4. payroll_deviation (Error/warning/info flags)
-- Spec: Section 5.4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_deviation (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  check_id          TEXT NOT NULL,
  severity          payroll_deviation_severity NOT NULL,
  calculation_id    UUID REFERENCES payroll_calculation(id) ON DELETE SET NULL,
  schedule_shift_id UUID REFERENCES schedule_shift(schedule_shift_id) ON DELETE SET NULL,
  profile_id        UUID REFERENCES profile(profile_id) ON DELETE SET NULL,
  period_id         UUID REFERENCES payroll_period(id) ON DELETE CASCADE,
  message           TEXT NOT NULL,
  details           JSONB DEFAULT '{}',
  acknowledged_by   UUID REFERENCES profile(profile_id),
  acknowledged_at   TIMESTAMPTZ,
  resolution        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_deviation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_select_payroll_deviation" ON payroll_deviation
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_insert_payroll_deviation" ON payroll_deviation
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_deviation" ON payroll_deviation;
CREATE POLICY "jwt_update_payroll_deviation" ON payroll_deviation
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_deviation" ON payroll_deviation;
CREATE POLICY "api_key_read_payroll_deviation" ON payroll_deviation
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_deviation" ON payroll_deviation;
CREATE POLICY "service_role_payroll_deviation" ON payroll_deviation
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_deviation_workspace
  ON payroll_deviation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_period
  ON payroll_deviation (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_severity
  ON payroll_deviation (workspace_id, severity) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_deviation_check
  ON payroll_deviation (check_id);

CREATE TRIGGER set_payroll_deviation_updated_at
  BEFORE UPDATE ON public.payroll_deviation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_deviation IS 'Payroll: control check flags. Error-severity deviations block period approval until acknowledged. Check IDs: P01-P10 (pre-calc), C01-C10 (post-calc), W01-W06 (working time).';

-- --------------------------------------------------------
-- 5. payroll_manual_supplement (Admin-added per-shift supplements)
-- Spec: Section 1.4 Type 4
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_manual_supplement (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  supplement_rule_id  UUID REFERENCES payroll_supplement_rule(id),
  salary_code         TEXT,
  description         TEXT NOT NULL,
  amount              NUMERIC(8,2) NOT NULL,
  added_by            UUID NOT NULL REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_manual_supplement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_select_payroll_manual_supp" ON payroll_manual_supplement
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_insert_payroll_manual_supp" ON payroll_manual_supplement
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_update_payroll_manual_supp" ON payroll_manual_supplement
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "jwt_delete_payroll_manual_supp" ON payroll_manual_supplement
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "api_key_read_payroll_manual_supp" ON payroll_manual_supplement
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_manual_supp" ON payroll_manual_supplement;
CREATE POLICY "service_role_payroll_manual_supp" ON payroll_manual_supplement
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_manual_supp_updated_at
  BEFORE UPDATE ON public.payroll_manual_supplement
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_manual_supp_shift
  ON payroll_manual_supplement (schedule_shift_id);
CREATE INDEX IF NOT EXISTS idx_payroll_manual_supp_workspace
  ON payroll_manual_supplement (workspace_id);

COMMENT ON TABLE payroll_manual_supplement IS 'Payroll: admin-added one-off supplements per shift. Tips, bonuses, special event pay.';

-- --------------------------------------------------------
-- 6. payroll_export_event (Export history)
-- Spec: Section 7.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  period_id       UUID NOT NULL REFERENCES payroll_period(id) ON DELETE CASCADE,
  export_format   TEXT NOT NULL CHECK (export_format IN ('tripletex_api', 'csv', 'pdf', 'excel')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  exported_by     UUID NOT NULL REFERENCES profile(profile_id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_export_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_select_payroll_export_event" ON payroll_export_event
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_insert_payroll_export_event" ON payroll_export_event
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_export_event" ON payroll_export_event;
CREATE POLICY "jwt_update_payroll_export_event" ON payroll_export_event
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_export_event" ON payroll_export_event;
CREATE POLICY "api_key_read_payroll_export_event" ON payroll_export_event
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_export_event" ON payroll_export_event;
CREATE POLICY "service_role_payroll_export_event" ON payroll_export_event
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_export_event_period
  ON payroll_export_event (period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_event_workspace
  ON payroll_export_event (workspace_id);

CREATE TRIGGER set_payroll_export_event_updated_at
  BEFORE UPDATE ON public.payroll_export_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_export_event IS 'Payroll: export history tracking. One row per export attempt. Supports Tripletex API, CSV, PDF, Excel.';

-- --------------------------------------------------------
-- 7. payroll_export_line (Per-item in export)
-- Spec: Section 7.2
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_export_line (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  export_event_id     UUID NOT NULL REFERENCES payroll_export_event(id) ON DELETE CASCADE,
  calculation_line_id UUID REFERENCES payroll_calculation_line(id),
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  salary_code         TEXT NOT NULL,
  external_code       TEXT,
  hours               NUMERIC(6,2),
  rate                NUMERIC(8,2),
  amount              NUMERIC(10,2) NOT NULL,
  external_id         TEXT,
  sync_status         TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payroll_export_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_select_payroll_export_line" ON payroll_export_line
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_insert_payroll_export_line" ON payroll_export_line
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_export_line" ON payroll_export_line;
CREATE POLICY "jwt_update_payroll_export_line" ON payroll_export_line
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_export_line" ON payroll_export_line;
CREATE POLICY "api_key_read_payroll_export_line" ON payroll_export_line
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_export_line" ON payroll_export_line;
CREATE POLICY "service_role_payroll_export_line" ON payroll_export_line
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payroll_export_line_event
  ON payroll_export_line (export_event_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_line_profile
  ON payroll_export_line (profile_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_line_workspace
  ON payroll_export_line (workspace_id);

CREATE TRIGGER set_payroll_export_line_updated_at
  BEFORE UPDATE ON public.payroll_export_line
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE payroll_export_line IS 'Payroll: individual line items per export event. Tracks sync status per line for reconciliation with Tripletex.';
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100200_payroll_calculation_tables.sql`
Expected: No errors. 7 tables created.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' ORDER BY tablename;"`
Expected: 18 rows total (11 from Track 2 + 7 from Track 3).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422100200_payroll_calculation_tables.sql
git commit -m "$(cat <<'EOF'
feat(payroll): create 7 period/calculation/export tables with RLS

payroll_period, payroll_calculation (append-only),
payroll_calculation_line, payroll_deviation,
payroll_manual_supplement, payroll_export_event,
payroll_export_line.

Calculation tables are append-only (no UPDATE trigger).
Deviation table indexes unacknowledged errors for approval gate.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 4: ALTER Existing Tables

### Task 4.1: Add Payroll Fields to Existing Tables

**Files:**

- Create: `supabase/migrations/20260422100300_payroll_alter_existing.sql`

**Note:** `schedule_shift` already has `department_id` and `location_id` from Cascade A1. `profile` already has `seniority_start_date` and `has_fagbrev` from Cascade A1. This migration adds only the NEW payroll-specific fields.

- [ ] **Step 1: Create the ALTER migration**

```sql
-- ============================================
-- 20260422100300_payroll_alter_existing.sql
-- Payroll: new fields on existing tables
-- Spec: Section 9 "Extended Existing Tables"
-- Depends on: 20260422100100 (payroll_shift_type exists)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. schedule_shift — add payroll fields
-- Already has: department_id, location_id (Cascade A1)
-- Adding: shift_type_id, custom_rate, custom_rate_type, approved_at, approved_by
-- --------------------------------------------------------
ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS shift_type_id UUID REFERENCES payroll_shift_type(id) ON DELETE SET NULL;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS custom_rate NUMERIC(8,2);

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS custom_rate_type payroll_custom_rate_type;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profile(profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_shift.shift_type_id IS 'Payroll: FK to payroll_shift_type. NULL = Normal (default type).';
COMMENT ON COLUMN schedule_shift.custom_rate IS 'Payroll: per-shift rate override. NULL = use employee group rate.';
COMMENT ON COLUMN schedule_shift.custom_rate_type IS 'Payroll: how custom_rate is interpreted — per_hour or per_shift.';
COMMENT ON COLUMN schedule_shift.approved_at IS 'Payroll: when this shift was approved for payroll.';
COMMENT ON COLUMN schedule_shift.approved_by IS 'Payroll: who approved this shift for payroll.';

CREATE INDEX IF NOT EXISTS idx_schedule_shift_type
  ON schedule_shift (shift_type_id) WHERE shift_type_id IS NOT NULL;

-- --------------------------------------------------------
-- 2. profile — add payroll fields
-- Already has: seniority_start_date, has_fagbrev (Cascade A1)
-- Adding: salary_identifier, contracted_weekly_hours
-- --------------------------------------------------------
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS salary_identifier TEXT;

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS contracted_weekly_hours NUMERIC(4,1);

COMMENT ON COLUMN profile.salary_identifier IS 'Payroll: employee identifier for Tripletex/external payroll system mapping.';
COMMENT ON COLUMN profile.contracted_weekly_hours IS 'Payroll: contracted weekly hours for schedule compliance display (green/yellow/red). Operational value — may differ from employment_contract.agreed_weekly_hours during transitions.';
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100300_payroll_alter_existing.sql`
Expected: No errors. 7 new columns added.

- [ ] **Step 3: Verify new columns exist on schedule_shift**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_shift' AND column_name IN ('shift_type_id', 'custom_rate', 'custom_rate_type', 'approved_at', 'approved_by') ORDER BY column_name;"`
Expected: 5 rows.

- [ ] **Step 4: Verify new columns exist on profile**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'profile' AND column_name IN ('salary_identifier', 'contracted_weekly_hours') ORDER BY column_name;"`
Expected: 2 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422100300_payroll_alter_existing.sql
git commit -m "$(cat <<'EOF'
feat(payroll): add payroll fields to schedule_shift and profile

schedule_shift: shift_type_id, custom_rate, custom_rate_type,
approved_at, approved_by.

profile: salary_identifier, contracted_weekly_hours.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 5: Seed Data & Type Regeneration

### Task 5.1: Seed Norwegian Public Holidays 2026-2027

**Files:**

- Create: `supabase/migrations/20260422100400_payroll_seed_holidays.sql`

**Note:** Seeds into the existing `public_holiday` table (created by Cascade A1). This is platform-level data — no workspace_id. Workspace admins import these into their `payroll_holiday_calendar` via the UI.

- [ ] **Step 1: Create the seed migration**

```sql
-- ============================================
-- 20260422100400_payroll_seed_holidays.sql
-- Payroll: Norwegian public holidays 2026-2027
-- Seeds into public_holiday (Cascade A1 table)
-- ============================================

-- Upsert pattern: ON CONFLICT DO NOTHING (idempotent)

-- 2026 Norwegian public holidays
INSERT INTO public.public_holiday (country_code, holiday_date, name, name_no, is_full_day) VALUES
  ('NO', '2026-01-01', 'New Year''s Day', 'Nyaarsdagen', true),
  ('NO', '2026-04-02', 'Maundy Thursday', 'Skjaertorsdag', true),
  ('NO', '2026-04-03', 'Good Friday', 'Langfredag', true),
  ('NO', '2026-04-05', 'Easter Sunday', 'Foerste paaskedag', true),
  ('NO', '2026-04-06', 'Easter Monday', 'Andre paaskedag', true),
  ('NO', '2026-05-01', 'Labour Day', 'Arbeidernes dag', true),
  ('NO', '2026-05-14', 'Ascension Day', 'Kristi himmelfartsdag', true),
  ('NO', '2026-05-17', 'Constitution Day', 'Grunnlovsdagen', true),
  ('NO', '2026-05-24', 'Whit Sunday', 'Foerste pinsedag', true),
  ('NO', '2026-05-25', 'Whit Monday', 'Andre pinsedag', true),
  ('NO', '2026-12-25', 'Christmas Day', 'Foerste juledag', true),
  ('NO', '2026-12-26', 'Boxing Day', 'Andre juledag', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- 2027 Norwegian public holidays
INSERT INTO public.public_holiday (country_code, holiday_date, name, name_no, is_full_day) VALUES
  ('NO', '2027-01-01', 'New Year''s Day', 'Nyaarsdagen', true),
  ('NO', '2027-03-25', 'Maundy Thursday', 'Skjaertorsdag', true),
  ('NO', '2027-03-26', 'Good Friday', 'Langfredag', true),
  ('NO', '2027-03-28', 'Easter Sunday', 'Foerste paaskedag', true),
  ('NO', '2027-03-29', 'Easter Monday', 'Andre paaskedag', true),
  ('NO', '2027-05-01', 'Labour Day', 'Arbeidernes dag', true),
  ('NO', '2027-05-06', 'Ascension Day', 'Kristi himmelfartsdag', true),
  ('NO', '2027-05-16', 'Whit Sunday', 'Foerste pinsedag', true),
  ('NO', '2027-05-17', 'Constitution Day / Whit Monday', 'Grunnlovsdagen / Andre pinsedag', true),
  ('NO', '2027-12-25', 'Christmas Day', 'Foerste juledag', true),
  ('NO', '2027-12-26', 'Boxing Day', 'Andre juledag', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- Common "almost-holidays" that many hospitality businesses treat as holidays
-- (Christmas Eve, New Year's Eve — not official public holidays but often paid as such)
-- These are NOT inserted as public_holiday — they go in workspace-scoped payroll_holiday_entry
-- when the admin configures their calendar. Just a comment for awareness.
```

- [ ] **Step 2: Run seed migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100400_payroll_seed_holidays.sql`
Expected: No errors. 23 rows inserted (12 for 2026, 11 for 2027 — Constitution Day and Whit Monday share May 17).

- [ ] **Step 3: Verify holidays are seeded**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT holiday_date, name_no FROM public_holiday WHERE country_code = 'NO' ORDER BY holiday_date;"`
Expected: 23 rows covering 2026-2027.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422100400_payroll_seed_holidays.sql
git commit -m "$(cat <<'EOF'
feat(payroll): seed Norwegian public holidays 2026-2027

12 holidays for 2026, 11 for 2027 (Whit Monday coincides with
Constitution Day on May 17, 2027 — single row). Seeds into platform-level public_holiday
table. Workspace admins import into their payroll_holiday_calendar.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

**Note:** Type regeneration moved to Task 7.1 (after Track 6) so all 23 tables and 16 enums are included.

---

## Track 6: Absence, Leave & Timebank

### Task 6.1: Create Absence & Timebank Enums

**Files:**

- Create: `supabase/migrations/20260422100500_payroll_absence_enums.sql`

**Context:** Module 7 (Absence) is a placeholder with no implementation. The existing `schedule_absence` table has a free-text `absence_type` and reuses `absence_status` enum (pending/approved/rejected). These new enums and tables add the payroll accounting layer: quotas, ledger entries, sick leave tracking, and timebank/TOIL. The existing `schedule_absence` continues to handle the scheduling side (which days are blocked); these tables handle the financial side (how much to pay, how many days remain).

- [ ] **Step 1: Create the absence enum migration**

```sql
-- ============================================
-- 20260422100500_payroll_absence_enums.sql
-- Payroll: 4 absence/leave/timebank enums
-- Covers: Module 7 (Absence) payroll integration + Module 8 (Timebank/TOIL)
-- ============================================

-- 1. Absence type categories (Norwegian labor law classification)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_absence_category') THEN
    CREATE TYPE public.payroll_absence_category AS ENUM (
      'vacation',           -- Ferie (Ferieloven, 25 days statutory)
      'sick_self',          -- Egenmelding (self-reported, max 3 days/instance)
      'sick_doctor',        -- Sykemelding (doctor's note, employer 16 days then NAV)
      'parental',           -- Foreldrepermisjon (NAV coverage)
      'care_of_child',      -- Omsorgsdager (sick child, 10 days/year)
      'military',           -- Militaertjeneste
      'training',           -- Utdanningspermisjon (AML 12-11)
      'welfare',            -- Velferdspermisjon (tariff-based)
      'toil',               -- Avspasering (time off in lieu of overtime pay)
      'unpaid',             -- Uloennet permisjon
      'other'               -- Annet
    );
  END IF;
END $$;;

-- 2. Absence ledger transaction types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_absence_ledger_type') THEN
    CREATE TYPE public.payroll_absence_ledger_type AS ENUM (
      'entitlement',    -- Annual quota grant (e.g., 25 vacation days on Jan 1)
      'carry_over',     -- Days carried from previous year
      'usage',          -- Days consumed (linked to schedule_absence)
      'adjustment',     -- Manual admin adjustment (+/-)
      'expiry',         -- Expired unused days
      'payout'          -- Vacation days paid out instead of taken
    );
  END IF;
END $$;;

-- 3. Timebank entry types (overtime account transactions)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_timebank_entry_type') THEN
    CREATE TYPE public.payroll_timebank_entry_type AS ENUM (
      'accrual',        -- Overtime hours banked (from payroll calculation)
      'withdrawal',     -- TOIL taken (linked to schedule_absence with type=toil)
      'adjustment',     -- Manual admin adjustment
      'expiry',         -- Hours expired (configurable expiry period)
      'carry_over',     -- Hours carried to next period
      'payout'          -- Hours paid out as overtime instead of TOIL
    );
  END IF;
END $$;;

-- 4. Sick leave grade (graded return to work)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_sick_leave_grade') THEN
    CREATE TYPE public.payroll_sick_leave_grade AS ENUM (
      'full',           -- 100% sick (fully absent)
      'graded_75',      -- 75% sick (works 25%)
      'graded_50',      -- 50% sick (works 50%)
      'graded_25',      -- 25% sick (works 75%)
      'graded_custom'   -- Custom percentage
    );
  END IF;
END $$;;

-- Comments
COMMENT ON TYPE public.payroll_absence_category IS 'Payroll: Norwegian labor law absence classification — vacation/sick/parental/toil/etc.';
COMMENT ON TYPE public.payroll_absence_ledger_type IS 'Payroll: absence ledger transaction type — entitlement/carry_over/usage/adjustment/expiry/payout';
COMMENT ON TYPE public.payroll_timebank_entry_type IS 'Payroll: overtime timebank transaction type — accrual/withdrawal/adjustment/expiry/carry_over/payout';
COMMENT ON TYPE public.payroll_sick_leave_grade IS 'Payroll: graded sick leave — full/graded_75/graded_50/graded_25/graded_custom';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100500_payroll_absence_enums.sql`
Expected: No errors. 4 enums created.

- [ ] **Step 3: Verify enums exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT typname FROM pg_type WHERE typname IN ('payroll_absence_category', 'payroll_absence_ledger_type', 'payroll_timebank_entry_type', 'payroll_sick_leave_grade') ORDER BY typname;"`
Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422100500_payroll_absence_enums.sql
git commit -m "$(cat <<'EOF'
feat(payroll): add 4 absence/timebank enums

payroll_absence_category (11 Norwegian absence types),
payroll_absence_ledger_type (entitlement/usage/carry_over/etc),
payroll_timebank_entry_type (accrual/withdrawal/payout/etc),
payroll_sick_leave_grade (full/graded).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.2: Create Absence, Leave & Timebank Tables

**Files:**

- Create: `supabase/migrations/20260422100600_payroll_absence_tables.sql`

**Important:** 5 tables. `payroll_absence_type` is workspace-level config (what absence types a workspace uses). `payroll_absence_quota` tracks per-employee-per-year entitlements. `payroll_absence_ledger` is the running account. `payroll_sick_leave_period` tracks employer vs NAV responsibility. `payroll_timebank_entry` is the overtime bank ledger.

- [ ] **Step 1: Create the absence tables migration**

```sql
-- ============================================
-- 20260422100600_payroll_absence_tables.sql
-- Payroll: 5 absence/leave/timebank tables
-- Covers: Module 7 (Absence payroll integration), Module 8 (Timebank/TOIL)
-- Depends on: 20260422100500 (absence enums)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. payroll_absence_type (Workspace-level absence type config)
-- Defines which absence types the workspace uses and their payroll rules
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_type (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  category                payroll_absence_category NOT NULL,
  name                    TEXT NOT NULL,
  name_no                 TEXT,
  salary_code             TEXT,
  is_paid                 BOOLEAN NOT NULL DEFAULT true,
  affects_payroll         BOOLEAN NOT NULL DEFAULT true,
  max_days_per_year       INT,
  max_days_per_instance   INT,
  max_instances_per_year  INT,
  requires_documentation  BOOLEAN NOT NULL DEFAULT false,
  documentation_after_days INT,
  count_weekends          BOOLEAN NOT NULL DEFAULT false,
  employer_pays_days      INT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  sort_order              INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_absence_type_per_workspace UNIQUE (workspace_id, category)
);

ALTER TABLE payroll_absence_type ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_select_payroll_absence_type" ON payroll_absence_type
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_insert_payroll_absence_type" ON payroll_absence_type
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_update_payroll_absence_type" ON payroll_absence_type
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "jwt_delete_payroll_absence_type" ON payroll_absence_type
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "api_key_read_payroll_absence_type" ON payroll_absence_type
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_type" ON payroll_absence_type;
CREATE POLICY "service_role_payroll_absence_type" ON payroll_absence_type
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_absence_type_updated_at
  BEFORE UPDATE ON public.payroll_absence_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_absence_type_workspace
  ON payroll_absence_type (workspace_id);

COMMENT ON TABLE payroll_absence_type IS 'Payroll: workspace-level absence type configuration. Defines payroll rules per Norwegian absence category (vacation, sick, parental, etc.). Norwegian defaults: vacation 25 days, egenmelding max 3 days/instance max 4 instances, employer sick pay 16 days.';

-- --------------------------------------------------------
-- 2. payroll_absence_quota (Per-employee, per-year entitlements)
-- Tracks how many days of each type an employee is entitled to
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_quota (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id     UUID NOT NULL REFERENCES payroll_absence_type(id) ON DELETE CASCADE,
  year                INT NOT NULL,
  entitled_days       NUMERIC(5,1) NOT NULL,
  carried_over_days   NUMERIC(5,1) NOT NULL DEFAULT 0,
  used_days           NUMERIC(5,1) NOT NULL DEFAULT 0,
  adjusted_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  expired_days        NUMERIC(5,1) NOT NULL DEFAULT 0,
  paid_out_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
  remaining_days      NUMERIC(5,1) GENERATED ALWAYS AS (
    entitled_days + carried_over_days + adjusted_days - used_days - expired_days - paid_out_days
  ) STORED,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_absence_quota UNIQUE (profile_id, absence_type_id, year),
  CONSTRAINT chk_quota_year CHECK (year BETWEEN 2020 AND 2099)
);

ALTER TABLE payroll_absence_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_select_payroll_absence_quota" ON payroll_absence_quota
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_insert_payroll_absence_quota" ON payroll_absence_quota
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "jwt_update_payroll_absence_quota" ON payroll_absence_quota
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "api_key_read_payroll_absence_quota" ON payroll_absence_quota
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_quota" ON payroll_absence_quota;
CREATE POLICY "service_role_payroll_absence_quota" ON payroll_absence_quota
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_absence_quota_updated_at
  BEFORE UPDATE ON public.payroll_absence_quota
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_absence_quota_workspace
  ON payroll_absence_quota (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_quota_profile_year
  ON payroll_absence_quota (profile_id, year);

-- Note: No JWT DELETE policy — intentional. Quotas are updated, not deleted. Admin adjusts via adjustment_days.
COMMENT ON TABLE payroll_absence_quota IS 'Payroll: per-employee per-year absence entitlements. remaining_days is computed (entitled + carried_over + adjusted - used - expired - paid_out). Norwegian vacation default: 25 days/year.';

-- --------------------------------------------------------
-- 3. payroll_absence_ledger (Individual absence transactions)
-- Every change to an absence balance is recorded here
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_absence_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id     UUID NOT NULL REFERENCES payroll_absence_type(id) ON DELETE CASCADE,
  quota_id            UUID NOT NULL REFERENCES payroll_absence_quota(id) ON DELETE CASCADE,
  entry_type          payroll_absence_ledger_type NOT NULL,
  days                NUMERIC(5,1) NOT NULL,
  effective_date      DATE NOT NULL,
  schedule_absence_id UUID, -- Soft ref to schedule_absence. No FK: absence may be re-approved/deleted independently; integrity enforced at app layer.
  description         TEXT,
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only ledger. Balance is derived from SUM of entries per quota.

ALTER TABLE payroll_absence_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "jwt_select_payroll_absence_ledger" ON payroll_absence_ledger
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "jwt_insert_payroll_absence_ledger" ON payroll_absence_ledger
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "api_key_read_payroll_absence_ledger" ON payroll_absence_ledger
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_absence_ledger" ON payroll_absence_ledger;
CREATE POLICY "service_role_payroll_absence_ledger" ON payroll_absence_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only ledger
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_workspace
  ON payroll_absence_ledger (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_quota
  ON payroll_absence_ledger (quota_id);
CREATE INDEX IF NOT EXISTS idx_payroll_absence_ledger_profile
  ON payroll_absence_ledger (profile_id, effective_date);

COMMENT ON TABLE payroll_absence_ledger IS 'Payroll: append-only absence transaction ledger. Every entitlement, usage, adjustment, carry-over, expiry, and payout is recorded. Balance on payroll_absence_quota is the materialized summary.';

-- --------------------------------------------------------
-- 4. payroll_sick_leave_period (Detailed sick leave tracking)
-- Tracks employer period (16 days) vs NAV, graded leave, follow-up milestones
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_sick_leave_period (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  absence_type_id         UUID NOT NULL REFERENCES payroll_absence_type(id),
  start_date              DATE NOT NULL,
  end_date                DATE,
  grade                   payroll_sick_leave_grade NOT NULL DEFAULT 'full',
  custom_grade_pct        INT,
  is_egenmelding          BOOLEAN NOT NULL DEFAULT false,
  egenmelding_instance    INT,
  employer_days           INT NOT NULL DEFAULT 16,
  employer_period_end     DATE,
  nav_takeover_date       DATE,
  nav_refund_amount       NUMERIC(10,2),
  followup_4w_date        DATE,
  followup_4w_completed   BOOLEAN NOT NULL DEFAULT false,
  followup_7w_date        DATE,
  followup_7w_completed   BOOLEAN NOT NULL DEFAULT false,
  doctor_note_received    BOOLEAN NOT NULL DEFAULT false,
  doctor_note_date        DATE,
  notes                   TEXT,
  schedule_absence_id     UUID, -- Soft ref to schedule_absence. No FK: sick leave is a legal record; absence scheduling is independent.
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sick_grade CHECK (
    grade != 'graded_custom' OR custom_grade_pct IS NOT NULL
  ),
  CONSTRAINT chk_custom_grade_range CHECK (
    custom_grade_pct IS NULL OR (custom_grade_pct BETWEEN 1 AND 99)
  )
);

ALTER TABLE payroll_sick_leave_period ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_select_payroll_sick_period" ON payroll_sick_leave_period
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_insert_payroll_sick_period" ON payroll_sick_leave_period
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "jwt_update_payroll_sick_period" ON payroll_sick_leave_period
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "api_key_read_payroll_sick_period" ON payroll_sick_leave_period
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_sick_period" ON payroll_sick_leave_period;
CREATE POLICY "service_role_payroll_sick_period" ON payroll_sick_leave_period
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_sick_period_updated_at
  BEFORE UPDATE ON public.payroll_sick_leave_period
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_sick_period_workspace
  ON payroll_sick_leave_period (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_sick_period_profile
  ON payroll_sick_leave_period (profile_id, start_date);

-- Note: No JWT DELETE policy — intentional. Sick leave periods are legal records and must not be deleted from UI.
COMMENT ON TABLE payroll_sick_leave_period IS 'Payroll: detailed sick leave tracking per instance. Norwegian law: employer pays first 16 calendar days, then NAV takes over. Tracks egenmelding instances (max 3 days/instance, max 4/year without IA), graded return, and mandatory follow-up at 4 and 7 weeks.';

-- --------------------------------------------------------
-- 5. payroll_timebank_entry (Overtime bank / TOIL ledger)
-- Every overtime accrual, TOIL withdrawal, and balance change
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_timebank_entry (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  entry_type              payroll_timebank_entry_type NOT NULL,
  hours                   NUMERIC(6,2) NOT NULL,
  effective_date          DATE NOT NULL,
  expiry_date             DATE,
  payroll_calculation_id  UUID REFERENCES payroll_calculation(id),
  schedule_absence_id     UUID, -- Soft ref to schedule_absence. No FK: TOIL scheduling is independent of timebank accounting.
  description             TEXT,
  created_by              UUID REFERENCES profile(profile_id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only ledger. Balance = SUM(hours) where entry_type IN (accrual, carry_over, adjustment) minus SUM(hours) where entry_type IN (withdrawal, expiry, payout).

ALTER TABLE payroll_timebank_entry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "jwt_select_payroll_timebank" ON payroll_timebank_entry
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "jwt_insert_payroll_timebank" ON payroll_timebank_entry
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "api_key_read_payroll_timebank" ON payroll_timebank_entry
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_timebank" ON payroll_timebank_entry;
CREATE POLICY "service_role_payroll_timebank" ON payroll_timebank_entry
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only ledger
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_workspace
  ON payroll_timebank_entry (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_profile
  ON payroll_timebank_entry (profile_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_payroll_timebank_expiry
  ON payroll_timebank_entry (expiry_date) WHERE expiry_date IS NOT NULL AND entry_type = 'accrual';

COMMENT ON TABLE payroll_timebank_entry IS 'Payroll: append-only overtime bank (TOIL / avspasering) ledger. Accruals from overtime worked, withdrawals when TOIL taken, payouts when overtime paid instead. Balance = SUM(credits) - SUM(debits). Expiry_date enables configurable timebank expiry per workspace.';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422100600_payroll_absence_tables.sql`
Expected: No errors. 5 tables created.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' ORDER BY tablename;"`
Expected: 23 rows total (11 config + 7 calc + 5 absence).

- [ ] **Step 4: Verify RLS enabled**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' AND NOT rowsecurity;"`
Expected: 0 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422100500_payroll_absence_enums.sql supabase/migrations/20260422100600_payroll_absence_tables.sql
git commit -m "$(cat <<'EOF'
feat(payroll): add absence/leave/timebank schema

4 enums: payroll_absence_category, payroll_absence_ledger_type,
payroll_timebank_entry_type, payroll_sick_leave_grade.

5 tables: payroll_absence_type (config), payroll_absence_quota
(per-employee per-year), payroll_absence_ledger (append-only),
payroll_sick_leave_period (employer/NAV split, graded leave),
payroll_timebank_entry (overtime bank / TOIL ledger).

Norwegian compliance: employer 16-day sick pay period,
egenmelding 3-day/4-instance rules, vacation 25 days,
graded sick leave, follow-up at 4 and 7 weeks.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 7: Type Regeneration

### Task 7.1: Regenerate TypeScript Types

**Files:**

- Modify: `packages/supabase/src/database.types.ts`

**Note:** This runs AFTER all migrations (Tracks 1-6) so all 23 tables and 16 enums are captured.

- [ ] **Step 1: Regenerate types from local Supabase**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated with all 23 new `payroll_*` tables and 16 new `payroll_*` enums.

- [ ] **Step 2: Verify new tables appear in types**

Run: `grep -c 'payroll_' packages/supabase/src/database.types.ts`
Expected: >100 (23 tables x ~6 references each + 16 enums).

- [ ] **Step 3: Verify absence enums appear in types**

Run: `grep 'payroll_absence_category\|payroll_timebank_entry_type\|payroll_sick_leave_grade' packages/supabase/src/database.types.ts | head -5`
Expected: Enum definitions visible.

- [ ] **Step 4: Run typecheck to verify no breakage**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck`
Expected: 0 errors. All new columns are nullable, so existing code should not break.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "$(cat <<'EOF'
chore(supabase): regenerate types after payroll schema

23 new payroll tables, 16 new enums, 7 new columns on
schedule_shift and profile.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Checklist

After all tasks are complete, run these final checks:

- [ ] **23 payroll tables exist:** `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%';"`
      Expected: `23`

- [ ] **16 payroll enums exist:** `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM pg_type WHERE typname LIKE 'payroll_%';"`
      Expected: `16`

- [ ] **All tables have RLS enabled:** `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'payroll_%' AND NOT rowsecurity;"`
      Expected: 0 rows (all have RLS).

- [ ] **Typecheck passes:** `pnpm turbo typecheck`
      Expected: 0 errors.

- [ ] **Holidays seeded:** `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM public_holiday WHERE country_code = 'NO';"`
      Expected: `23`

---

## Summary

| Track             | Migration        | Tables        | Enums      | Status |
| ----------------- | ---------------- | ------------- | ---------- | ------ |
| T1 Enums          | `20260422100000` | 0             | 12         |        |
| T2 Config         | `20260422100100` | 11            | 0          |        |
| T3 Calc           | `20260422100200` | 7             | 0          |        |
| T4 ALTER          | `20260422100300` | 0 (2 altered) | 0          |        |
| T5 Seed           | `20260422100400` | 0             | 0          |        |
| T5 Types          | —                | —             | —          |        |
| T6 Absence Enums  | `20260422100500` | 0             | 4          |        |
| T6 Absence Tables | `20260422100600` | 5             | 0          |        |
| **Total**         | **7 migrations** | **23 new**    | **16 new** |        |
