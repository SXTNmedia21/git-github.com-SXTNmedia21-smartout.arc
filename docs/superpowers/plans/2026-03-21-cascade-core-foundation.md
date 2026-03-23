# Cascade Core Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Cascade Core Foundation schema (A1 domain + A2 framework core) on local Supabase, build 4 Phase B core pure primitives with full test coverage, and establish cleanup safety rails so legacy tables remain compatibility-only rather than runtime truth. This plan covers 4 of the 6 Phase B pure functions — `derive_impacts()` and `compute_cascade_preview()` are deferred to a follow-up plan because they depend on session/hook/notification/cost types that require integrated T1+T2 schema plus additional domain modeling.

**Architecture:** Three parallel tracks that merge sequentially: T1 creates the 11 domain model tables + enums + field additions on existing tables; T2 creates the 6 framework model tables + enums; T3 builds 4 Phase B core pure primitives (resolve_hours, compute_anchored_shift, evaluate_framework_rules skeleton, validate_proposal_freshness) with vitest tests. Each track runs in its own worktree.

**Scope boundary:** This plan covers A1 (domain) + A2 (framework core) only. The 3 integration-spine tables (`external_system_connection`, `external_sync_mapping`, `external_sync_event`) are explicitly deferred to an A3 migration when integration work begins (Phase D). This matches the approved spec's A1/A2/A3 tier split.

**Cleanup boundary:** This plan does not drop deprecated legacy tables/columns. It establishes the new runtime truth model, marks legacy structures as non-authoritative, inventories remaining usage, and defines drop criteria for a later cleanup migration. This track documents and audits legacy truth usage; it does not by itself enforce read-path cutover in application code. CI/static checks and app-level read-routing are follow-up tasks.

**Tech Stack:** PostgreSQL 17, Supabase migrations, TypeScript (strict), Vitest, pnpm workspaces

**Spec:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` — read Sections 2-4 before starting any task.

**Key codebase facts (verified):**

- Latest migration timestamp: `20260418120000`
- Postgres 17 — `UNIQUE NULLS NOT DISTINCT` supported and already used
- `btree_gist` extension NOT yet enabled — must be added
- Enum creation pattern: `DO $$ BEGIN IF NOT EXISTS ... END $$;;`
- RLS mandatory: JWT + API key + service_role policies per workspace-scoped table
- Updated-at trigger: uses existing `public.set_updated_at()` function
- Test runner: Vitest in `apps/web/` with `__tests__/` directories
- Pure functions live alongside their consumers (e.g., `apps/web/src/lib/season-calculations.ts`)
- All 16 new enums verified: zero naming conflicts with existing 72 enums
- All new fields on existing tables verified: none already exist

**Design decisions (not in spec, decided during planning):**

- `season.is_active` BOOLEAN from spec is **dropped**. Season already has `status` enum (draft/active/archived) — adding a boolean creates dual-truth. Use `status = 'active'` instead.
- `schedule_template_shift` is missing `workspace_id`, `created_at`, `updated_at` — these are added as part of T1 to align with codebase conventions before adding cascade fields. Existing rows may remain with null `workspace_id` until a dedicated backfill migration; all new writes must populate `workspace_id`.
- `schedule_template.department` is currently plain TEXT. T1 adds `department_id` UUID FK alongside it. The TEXT column is NOT dropped (existing data uses it). Backfill migration is out of scope.
- Phase B functions live in `apps/web/src/lib/cascade/` (not a new package). Same pattern as `season-calculations.ts`: pure functions co-located with the web app, testable with vitest.

---

## File Structure

### Track 1 — A1 Domain Migration

| File                                                               | Responsibility                                   |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| `supabase/migrations/20260421100000_cascade_a1_extensions.sql`     | Enable `btree_gist` extension                    |
| `supabase/migrations/20260421100100_cascade_a1_enums.sql`          | 10 domain enums                                  |
| `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql`  | 11 new domain tables with RLS, indexes, triggers |
| `supabase/migrations/20260421100300_cascade_a1_alter_existing.sql` | New fields on 7 existing tables                  |
| `packages/supabase/src/database.types.ts`                          | Regenerated after migrations                     |

### Track 2 — A2 Framework Migration

| File                                                                 | Responsibility                                 |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `supabase/migrations/20260421200000_cascade_a2_enums.sql`            | 6 framework + integration enums                |
| `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql` | 6 framework tables with RLS, indexes, triggers |
| `packages/supabase/src/database.types.ts`                            | Regenerated after T1+T2 merged                 |

### Track 3 — Phase B Pure Functions

| File                                                                     | Responsibility                              |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| `apps/web/src/lib/cascade/types.ts`                                      | All Cascade type definitions                |
| `apps/web/src/lib/cascade/resolve-hours.ts`                              | `resolveEffectiveHours()` pure function     |
| `apps/web/src/lib/cascade/compute-anchored-shift.ts`                     | `computeAnchoredTime()` pure function       |
| `apps/web/src/lib/cascade/evaluate-framework-rules.ts`                   | `evaluateFrameworkRules()` minimal skeleton |
| `apps/web/src/lib/cascade/validate-proposal-freshness.ts`                | `validateProposalFreshness()` pure function |
| `apps/web/src/lib/cascade/index.ts`                                      | Barrel export                               |
| `apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts`               | Tests for resolve_hours                     |
| `apps/web/src/lib/cascade/__tests__/compute-anchored-shift.test.ts`      | Tests for compute_anchored_shift            |
| `apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts`    | Tests for evaluate_framework_rules          |
| `apps/web/src/lib/cascade/__tests__/validate-proposal-freshness.test.ts` | Tests for validate_proposal_freshness       |

### Track 4 — Legacy Truth Cutover & Cleanup Safety Rails

| File                                                             | Responsibility                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase/migrations/20260421210000_cascade_cleanup_markers.sql` | COMMENT annotations marking legacy structures as non-authoritative |
| `docs/cascade-runtime-cutover-checklist.md`                      | Runtime truth rules + verification checklist                       |
| `docs/cascade-legacy-usage-inventory.md`                         | Inventory of all remaining legacy usages with classification       |
| `docs/cascade-backfill-plan.md`                                  | Backfill strategy for `schedule_template.department_id`            |

---

## Track 1: A1 Domain Migration

### Task 1.1: Enable btree_gist Extension

**Files:**

- Create: `supabase/migrations/20260421100000_cascade_a1_extensions.sql`

- [ ] **Step 1: Create the extension migration**

```sql
-- ============================================
-- 20260421100000_cascade_a1_extensions.sql
-- Enable btree_gist for EXCLUDE USING gist constraints
-- Required by: planning_cycle, tariff_rate_table, employee_payroll_profile
-- ============================================

CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA extensions;

COMMENT ON EXTENSION btree_gist IS 'Cascade: enables EXCLUDE USING gist for overlap prevention on planning_cycle, tariff_rate_table, employee_payroll_profile';
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421100000_cascade_a1_extensions.sql`
Expected: No errors. Extension created.

- [ ] **Step 3: Verify extension is available**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"`
Expected: One row with `btree_gist`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421100000_cascade_a1_extensions.sql
git commit -m "feat(cascade): enable btree_gist extension for overlap constraints

Required by planning_cycle, tariff_rate_table, employee_payroll_profile
EXCLUDE USING gist constraints.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Create A1 Domain Enums

**Files:**

- Create: `supabase/migrations/20260421100100_cascade_a1_enums.sql`

- [ ] **Step 1: Create the enum migration**

```sql
-- ============================================
-- 20260421100100_cascade_a1_enums.sql
-- Cascade A1: 10 domain model enums
-- Spec: Section 3 Phase A, "New Enums"
-- ============================================

-- Department classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_type') THEN
    CREATE TYPE public.department_type AS ENUM ('operational', 'administrative', 'hybrid');
  END IF;
END $$;;

-- Template shift purpose
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_function') THEN
    CREATE TYPE public.shift_function AS ENUM ('opening', 'closing', 'supporting', 'rush_hour', 'sub_supply');
  END IF;
END $$;;

-- Shift time anchoring
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anchor_type') THEN
    CREATE TYPE public.anchor_type AS ENUM ('fixed', 'open', 'close');
  END IF;
END $$;;

-- Proposal lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'change_proposal_status') THEN
    CREATE TYPE public.change_proposal_status AS ENUM ('pending', 'approved', 'applied', 'rejected', 'expired');
  END IF;
END $$;;

-- Event classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_event_category') THEN
    CREATE TYPE public.planning_event_category AS ENUM ('external_scraped', 'cultural_commercial', 'internal', 'weather', 'recurring');
  END IF;
END $$;;

-- Event origin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_event_source') THEN
    CREATE TYPE public.planning_event_source AS ENUM ('manual', 'scraped_municipality', 'scraped_cultural', 'weather_api', 'booking_integration', 'historical_import');
  END IF;
END $$;;

-- Year wheel lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_cycle_status') THEN
    CREATE TYPE public.planning_cycle_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;;

-- Proposal origin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cascade_initiator') THEN
    CREATE TYPE public.cascade_initiator AS ENUM ('cascade_engine', 'admin_manual', 'c1_calibration', 'bootstrap');
  END IF;
END $$;;

-- Rate provenance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tariff_source') THEN
    CREATE TYPE public.tariff_source AS ENUM ('riksavtalen', 'allmenngjoring', 'internal');
  END IF;
END $$;;

-- Framework evaluation result
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_outcome') THEN
    CREATE TYPE public.evaluation_outcome AS ENUM ('allowed', 'allowed_with_exception', 'review_required', 'blocked');
  END IF;
END $$;;

COMMENT ON TYPE public.department_type IS 'Cascade D1: operational/administrative/hybrid department classification';
COMMENT ON TYPE public.shift_function IS 'Cascade D1: template shift purpose — opening/closing/supporting/rush_hour/sub_supply';
COMMENT ON TYPE public.anchor_type IS 'Cascade D1: shift time anchoring — fixed/open/close relative to operating hours';
COMMENT ON TYPE public.change_proposal_status IS 'Cascade C4: proposal lifecycle — pending/approved/applied/rejected/expired';
COMMENT ON TYPE public.planning_event_category IS 'Cascade D4: planning event classification';
COMMENT ON TYPE public.planning_event_source IS 'Cascade D4: planning event origin';
COMMENT ON TYPE public.planning_cycle_status IS 'Cascade D1: year wheel lifecycle — draft/active/archived';
COMMENT ON TYPE public.cascade_initiator IS 'Cascade C4: who originated the proposal';
COMMENT ON TYPE public.tariff_source IS 'Cascade K1a: rate provenance — riksavtalen/allmenngjoring/internal';
COMMENT ON TYPE public.evaluation_outcome IS 'Cascade C4: framework evaluation result — allowed/allowed_with_exception/review_required/blocked';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421100100_cascade_a1_enums.sql`
Expected: No errors. 10 enums created.

- [ ] **Step 3: Verify enums exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT typname FROM pg_type WHERE typname IN ('department_type','shift_function','anchor_type','change_proposal_status','planning_event_category','planning_event_source','planning_cycle_status','cascade_initiator','tariff_source','evaluation_outcome') ORDER BY typname;"`
Expected: 10 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421100100_cascade_a1_enums.sql
git commit -m "feat(cascade): add 10 A1 domain enums

department_type, shift_function, anchor_type, change_proposal_status,
planning_event_category, planning_event_source, planning_cycle_status,
cascade_initiator, tariff_source, evaluation_outcome.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Create A1 Domain Tables

**Files:**

- Create: `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql`

**Important:** This is the largest single migration. Read spec Section 4.1 for all DDL. The SQL below is the complete migration — copy it exactly.

- [ ] **Step 1: Create the domain tables migration**

```sql
-- ============================================
-- 20260421100200_cascade_a1_domain_tables.sql
-- Cascade A1: 11 domain model tables
-- Spec: Section 4.1 (all table schemas)
-- Depends on: 20260421100000 (btree_gist), 20260421100100 (enums)
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. planning_cycle (Year wheel container)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_cycle (
  planning_cycle_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  total_revenue_target NUMERIC(12,2),
  status              planning_cycle_status NOT NULL DEFAULT 'draft',
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cycle_dates CHECK (end_date > start_date),
  CONSTRAINT excl_cycle_no_overlap EXCLUDE USING gist (
    workspace_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
);

ALTER TABLE planning_cycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_select_planning_cycle" ON planning_cycle
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_insert_planning_cycle" ON planning_cycle
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_update_planning_cycle" ON planning_cycle
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_planning_cycle" ON planning_cycle;
CREATE POLICY "jwt_delete_planning_cycle" ON planning_cycle
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_planning_cycle" ON planning_cycle;
CREATE POLICY "api_key_read_planning_cycle" ON planning_cycle
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_planning_cycle" ON planning_cycle;
CREATE POLICY "service_role_planning_cycle" ON planning_cycle
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_cycle_updated_at
  BEFORE UPDATE ON public.planning_cycle
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_cycle_workspace
  ON planning_cycle (workspace_id);

COMMENT ON TABLE planning_cycle IS 'Cascade D1: Year wheel container. One per planning period per workspace.';

-- --------------------------------------------------------
-- 2. department_operating_hours (Consolidated weekly hours)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_operating_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  provenance      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

ALTER TABLE department_operating_hours
  ADD CONSTRAINT uq_dept_hours_weekly
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, season_id, day_of_week);

ALTER TABLE department_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_select_dept_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_insert_dept_hours" ON department_operating_hours
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_update_dept_hours" ON department_operating_hours
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_dept_hours" ON department_operating_hours;
CREATE POLICY "jwt_delete_dept_hours" ON department_operating_hours
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_dept_hours" ON department_operating_hours;
CREATE POLICY "api_key_read_dept_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_dept_hours" ON department_operating_hours;
CREATE POLICY "service_role_dept_hours" ON department_operating_hours
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_dept_hours_updated_at
  BEFORE UPDATE ON public.department_operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dept_hours_workspace
  ON department_operating_hours (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dept_hours_dept_day
  ON department_operating_hours (department_id, day_of_week);

COMMENT ON TABLE department_operating_hours IS 'Cascade D1: Consolidated weekly operating hours per department/location/season/weekday. NULL season_id = workspace default. Replaces company_opening_hours for runtime.';

-- --------------------------------------------------------
-- 3. planning_event (Demand signal events)
-- Owner: Runtime (D4)
-- NOTE: Must be created BEFORE department_hours_override (FK reference)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_event (
  planning_event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  planning_cycle_id   UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  category            planning_event_category NOT NULL,
  source              planning_event_source NOT NULL DEFAULT 'manual',
  event_date          DATE NOT NULL,
  end_date            DATE,
  demand_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  expected_covers     INTEGER,
  confidence          NUMERIC(3,2) DEFAULT 0.5,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule     TEXT,
  external_source_url TEXT,
  hours_override_id   UUID,
  created_by          UUID REFERENCES profile(profile_id),
  provenance          JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planning_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_event" ON planning_event;
CREATE POLICY "jwt_select_planning_event" ON planning_event
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_planning_event" ON planning_event;
CREATE POLICY "jwt_insert_planning_event" ON planning_event
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_planning_event" ON planning_event;
CREATE POLICY "jwt_update_planning_event" ON planning_event
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_planning_event" ON planning_event;
CREATE POLICY "jwt_delete_planning_event" ON planning_event
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_planning_event" ON planning_event;
CREATE POLICY "api_key_read_planning_event" ON planning_event
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_planning_event" ON planning_event;
CREATE POLICY "service_role_planning_event" ON planning_event
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_event_updated_at
  BEFORE UPDATE ON public.planning_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_event_workspace
  ON planning_event (workspace_id);
CREATE INDEX IF NOT EXISTS idx_planning_event_date
  ON planning_event (workspace_id, event_date);

COMMENT ON TABLE planning_event IS 'Cascade D4: External/internal demand events with multipliers. Linked to planning cycles.';

-- --------------------------------------------------------
-- 4. department_hours_override (Date-specific exceptions)
-- Owner: Runtime (D1)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_hours_override (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,
  planning_event_id UUID REFERENCES planning_event(planning_event_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_override_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

ALTER TABLE department_hours_override
  ADD CONSTRAINT uq_dept_hours_override
  UNIQUE NULLS NOT DISTINCT (department_id, location_id, override_date);

ALTER TABLE department_hours_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_dept_override" ON department_hours_override;
CREATE POLICY "jwt_select_dept_override" ON department_hours_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_dept_override" ON department_hours_override;
CREATE POLICY "jwt_insert_dept_override" ON department_hours_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_dept_override" ON department_hours_override;
CREATE POLICY "jwt_update_dept_override" ON department_hours_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_dept_override" ON department_hours_override;
CREATE POLICY "jwt_delete_dept_override" ON department_hours_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_dept_override" ON department_hours_override;
CREATE POLICY "api_key_read_dept_override" ON department_hours_override
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_dept_override" ON department_hours_override;
CREATE POLICY "service_role_dept_override" ON department_hours_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_dept_override_updated_at
  BEFORE UPDATE ON public.department_hours_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_dept_override_workspace
  ON department_hours_override (workspace_id);
CREATE INDEX IF NOT EXISTS idx_dept_override_date
  ON department_hours_override (department_id, override_date);

COMMENT ON TABLE department_hours_override IS 'Cascade D1: Date-specific exceptions to operating hours (holidays, events, closures).';

-- --------------------------------------------------------
-- 5. tariff_rate_table (Versioned rates)
-- Owner: K1a (platform baseline) / K1b (workspace override)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_rate_table (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,
  rate_type       TEXT NOT NULL,
  source          tariff_source NOT NULL DEFAULT 'riksavtalen',
  effective_from  DATE NOT NULL,
  effective_until DATE,
  seniority_years INT,
  amount          NUMERIC(10,2) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kr/t',
  metadata        JSONB DEFAULT '{}',
  provenance      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (
    rate_type WITH =,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    daterange(effective_from, COALESCE(effective_until, '9999-12-31'::date), '[]') WITH &&
  )
);

-- tariff_rate_table has nullable workspace_id (NULL = platform-wide K1a)
-- RLS: workspace-scoped rows use standard pattern; platform rows visible to all authenticated
ALTER TABLE tariff_rate_table ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_tariff" ON tariff_rate_table;
CREATE POLICY "jwt_select_tariff" ON tariff_rate_table
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "api_key_read_tariff" ON tariff_rate_table;
CREATE POLICY "api_key_read_tariff" ON tariff_rate_table
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id = get_api_workspace_id()
  );

DROP POLICY IF EXISTS "service_role_tariff" ON tariff_rate_table;
CREATE POLICY "service_role_tariff" ON tariff_rate_table
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_tariff_updated_at
  BEFORE UPDATE ON public.tariff_rate_table
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tariff_rate_type
  ON tariff_rate_table (rate_type, effective_from);
CREATE INDEX IF NOT EXISTS idx_tariff_workspace
  ON tariff_rate_table (workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON TABLE tariff_rate_table IS 'Cascade K1a/K1b: Versioned framework-defined rates. NULL workspace_id = platform baseline. Workspace rows override platform rows.';

-- --------------------------------------------------------
-- 6. employee_payroll_profile
-- Owner: Runtime (D2/D3)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payroll_profile (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  profile_id              UUID NOT NULL REFERENCES profile(profile_id) ON DELETE CASCADE,
  employment_contract_id  UUID REFERENCES employment_contract(contract_id),
  salary_type             TEXT NOT NULL CHECK (salary_type IN ('hourly', 'monthly')),
  agreed_weekly_hours     NUMERIC(4,2) NOT NULL,
  tariff_category         TEXT NOT NULL,
  seniority_start_date    DATE NOT NULL,
  sector_experience_years INTEGER NOT NULL DEFAULT 0,
  has_fagbrev             BOOLEAN NOT NULL DEFAULT false,
  tariff_override_id      UUID REFERENCES tariff_rate_table(id),
  valid_from              DATE NOT NULL,
  valid_until             DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_profile UNIQUE (profile_id, valid_from),
  CONSTRAINT excl_payroll_no_overlap EXCLUDE USING gist (
    profile_id WITH =,
    daterange(valid_from, COALESCE(valid_until, '9999-12-31'::date), '[]') WITH &&
  )
);

-- Note: employment_contract FK references contract_id (the actual PK name), not employment_contract_id

ALTER TABLE employee_payroll_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_select_payroll_profile" ON employee_payroll_profile
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_insert_payroll_profile" ON employee_payroll_profile
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "jwt_update_payroll_profile" ON employee_payroll_profile
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "api_key_read_payroll_profile" ON employee_payroll_profile
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_payroll_profile" ON employee_payroll_profile;
CREATE POLICY "service_role_payroll_profile" ON employee_payroll_profile
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_payroll_profile_updated_at
  BEFORE UPDATE ON public.employee_payroll_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payroll_profile_workspace
  ON employee_payroll_profile (workspace_id);
CREATE INDEX IF NOT EXISTS idx_payroll_profile_employee
  ON employee_payroll_profile (profile_id, valid_from);

COMMENT ON TABLE employee_payroll_profile IS 'Cascade D2/D3: Links contract to payroll calculation via tariff categories. Base rate resolved at query time from tariff_rate_table.';

-- --------------------------------------------------------
-- 7. shift_cost_snapshot (Append-only cost audit)
-- Owner: Control (C3)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_cost_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id   UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id          UUID REFERENCES profile(profile_id),
  base_hours          NUMERIC(5,2) NOT NULL,
  base_rate           NUMERIC(8,2) NOT NULL,
  base_cost           NUMERIC(10,2) NOT NULL,
  supplements         JSONB NOT NULL DEFAULT '[]',
  overtime_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost          NUMERIC(10,2) NOT NULL,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  calculation_version INT NOT NULL DEFAULT 1
);
-- Append-only: new calculation = new row. Never UPDATE.

ALTER TABLE shift_cost_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "jwt_select_cost_snapshot" ON shift_cost_snapshot
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "api_key_read_cost_snapshot" ON shift_cost_snapshot
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_cost_snapshot" ON shift_cost_snapshot;
CREATE POLICY "service_role_cost_snapshot" ON shift_cost_snapshot
  FOR ALL USING (auth.role() = 'service_role');

-- No updated_at trigger — append-only table
CREATE INDEX IF NOT EXISTS idx_cost_snapshot_shift
  ON shift_cost_snapshot (schedule_shift_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_snapshot_workspace
  ON shift_cost_snapshot (workspace_id);

COMMENT ON TABLE shift_cost_snapshot IS 'Cascade C3: Append-only per-shift cost audit trail. Never UPDATE — new calc = new row.';

-- --------------------------------------------------------
-- 8. change_proposal (Terraform-style saved plan)
-- Owner: Control (C4)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.change_proposal (
  change_proposal_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  initiated_by        UUID NOT NULL REFERENCES profile(profile_id),
  trigger_type        TEXT NOT NULL,               -- TEXT in A1; cannot use framework_trigger_type enum yet (defined in A2)
  trigger_entity_type TEXT NOT NULL,
  trigger_entity_id   UUID,
  created_by_plane    cascade_initiator NOT NULL DEFAULT 'admin_manual',
  status              change_proposal_status NOT NULL DEFAULT 'pending',
  changes             JSONB NOT NULL DEFAULT '{}',
  preview             JSONB NOT NULL DEFAULT '{}',
  input_state_hash    TEXT,
  risk_score          NUMERIC(3,2),
  policy_decision     evaluation_outcome,
  policy_rule_ids     TEXT[],
  approval_required   BOOLEAN NOT NULL DEFAULT false,
  approved_by         UUID REFERENCES profile(profile_id),
  approved_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  affected_employee_count INTEGER DEFAULT 0,
  affected_shift_count    INTEGER DEFAULT 0,
  conflict_count          INTEGER DEFAULT 0,
  applied_at          TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: framework_trigger_id FK omitted here — it references A2 framework tables.
-- Will be added via ALTER TABLE in the A2 migration.

ALTER TABLE change_proposal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_change_proposal" ON change_proposal;
CREATE POLICY "jwt_select_change_proposal" ON change_proposal
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_change_proposal" ON change_proposal;
CREATE POLICY "jwt_insert_change_proposal" ON change_proposal
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_change_proposal" ON change_proposal;
CREATE POLICY "jwt_update_change_proposal" ON change_proposal
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_change_proposal" ON change_proposal;
CREATE POLICY "api_key_read_change_proposal" ON change_proposal
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_change_proposal" ON change_proposal;
CREATE POLICY "service_role_change_proposal" ON change_proposal
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_change_proposal_updated_at
  BEFORE UPDATE ON public.change_proposal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_change_proposal_workspace
  ON change_proposal (workspace_id);
CREATE INDEX IF NOT EXISTS idx_change_proposal_status
  ON change_proposal (workspace_id, status) WHERE status = 'pending';

COMMENT ON TABLE change_proposal IS 'Cascade C4: Persisted cascade preview (Terraform saved plan). changes/preview/input_state_hash are immutable after creation.';

-- --------------------------------------------------------
-- 9. public_holiday (Framework-defined calendar days)
-- Owner: K1a (platform)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_holiday (
  country_code    CHAR(2) NOT NULL DEFAULT 'NO',
  holiday_date    DATE NOT NULL,
  name            TEXT NOT NULL,
  name_no         TEXT NOT NULL,
  is_full_day     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (country_code, holiday_date)
);

-- Platform-managed, no workspace_id — visible to all authenticated users
ALTER TABLE public_holiday ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_public_holiday" ON public_holiday;
CREATE POLICY "authenticated_select_public_holiday" ON public_holiday
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_public_holiday" ON public_holiday;
CREATE POLICY "service_role_public_holiday" ON public_holiday
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_public_holiday_date
  ON public_holiday (holiday_date);

COMMENT ON TABLE public_holiday IS 'Cascade K1a: Framework-defined calendar days for supplement calculation. Norway-only for now. Composite PK (country_code, holiday_date).';

-- --------------------------------------------------------
-- 10. planning_factors (Planned vs actual tracking)
-- Owner: Control (C1/K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id),
  factor_type     TEXT NOT NULL,
  dimension       TEXT NOT NULL,
  period_date     DATE NOT NULL,
  planned_value   NUMERIC(12,2) NOT NULL,
  actual_value    NUMERIC(12,2),
  variance_pct    NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN planned_value != 0 AND actual_value IS NOT NULL
      THEN ((actual_value - planned_value) / planned_value * 100)
      ELSE NULL
    END
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_planning_factor UNIQUE (workspace_id, factor_type, dimension, period_date)
);

ALTER TABLE planning_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_planning_factors" ON planning_factors;
CREATE POLICY "jwt_select_planning_factors" ON planning_factors
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_planning_factors" ON planning_factors;
CREATE POLICY "service_role_planning_factors" ON planning_factors
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_planning_factors_updated_at
  BEFORE UPDATE ON public.planning_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_planning_factors_workspace
  ON planning_factors (workspace_id, factor_type, period_date);

COMMENT ON TABLE planning_factors IS 'Cascade C1/K1b: Planned vs actual tracking for the learning loop. variance_pct is auto-calculated.';

-- --------------------------------------------------------
-- 11. adjustment_factors (EWMA learning state)
-- Owner: Control (C1/K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.adjustment_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id         UUID REFERENCES season(season_id),
  factor_type       TEXT NOT NULL,
  dimension         TEXT NOT NULL,
  adjustment_ratio  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  alpha             NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  observation_count INTEGER NOT NULL DEFAULT 0,
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.0,
  last_actual       NUMERIC(12,2),
  last_planned      NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_adjustment_factor UNIQUE (workspace_id, season_id, factor_type, dimension)
);

ALTER TABLE adjustment_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_adjustment_factors" ON adjustment_factors;
CREATE POLICY "service_role_adjustment_factors" ON adjustment_factors
  FOR ALL USING (auth.role() = 'service_role');

-- C1 EWMA engine writes only — no direct user access
-- Read access for admins via service role or explicit JWT policy if needed later

CREATE TRIGGER set_adjustment_factors_updated_at
  BEFORE UPDATE ON public.adjustment_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_adjustment_factors_workspace
  ON adjustment_factors (workspace_id, factor_type);

COMMENT ON TABLE adjustment_factors IS 'Cascade C1/K1b: EWMA learning state. Service-role only — written by calibration engine.';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421100200_cascade_a1_domain_tables.sql`
Expected: No errors. 11 tables created with RLS, indexes, and triggers.

- [ ] **Step 3: Verify all tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('planning_cycle','department_operating_hours','department_hours_override','planning_event','tariff_rate_table','employee_payroll_profile','shift_cost_snapshot','change_proposal','public_holiday','planning_factors','adjustment_factors') ORDER BY tablename;"`
Expected: 11 rows.

- [ ] **Step 4: Verify RLS is enabled on all tables**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('planning_cycle','department_operating_hours','department_hours_override','planning_event','tariff_rate_table','employee_payroll_profile','shift_cost_snapshot','change_proposal','public_holiday','planning_factors','adjustment_factors') ORDER BY tablename;"`
Expected: All 11 rows show `rowsecurity = t`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260421100200_cascade_a1_domain_tables.sql
git commit -m "feat(cascade): create 11 A1 domain tables with RLS

planning_cycle, department_operating_hours, department_hours_override,
planning_event, tariff_rate_table, employee_payroll_profile,
shift_cost_snapshot, change_proposal, public_holiday,
planning_factors, adjustment_factors.

All with RLS (JWT + API key + service_role), indexes, updated_at
triggers, and EXCLUDE USING gist overlap prevention.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: Alter Existing Tables

**Files:**

- Create: `supabase/migrations/20260421100300_cascade_a1_alter_existing.sql`

**Verified columns that DO NOT yet exist on target tables:**

- `department.department_type` — not present
- `season.planning_cycle_id` — not present
- `employment_contract.agreed_weekly_hours` — not present
- `profile.seniority_start_date`, `profile.has_fagbrev` — not present
- `department_session.planned_open`, `department_session.planned_close` — not present
- `schedule_shift.department_id`, `schedule_shift.location_id` — not present
- `schedule_template.department_id` — not present (existing `department` is plain TEXT)
- `schedule_template_shift` — missing `workspace_id`, `created_at`, `updated_at` (codebase norm) + cascade fields

**Note:** `season.is_active` from spec is intentionally DROPPED — season already has `status` enum.

- [ ] **Step 1: Create the alter-existing migration**

```sql
-- ============================================
-- 20260421100300_cascade_a1_alter_existing.sql
-- Cascade A1: New fields on existing tables
-- Spec: Section 3 Phase A, "New Fields on Existing Tables"
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. department — add department_type classification
-- --------------------------------------------------------
ALTER TABLE department
  ADD COLUMN IF NOT EXISTS department_type department_type;

COMMENT ON COLUMN department.department_type IS 'Cascade D1: operational/administrative/hybrid classification. NULL = unclassified (legacy).';

-- --------------------------------------------------------
-- 2. season — link to year wheel
-- --------------------------------------------------------
ALTER TABLE season
  ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL;

COMMENT ON COLUMN season.planning_cycle_id IS 'Cascade D1: Links season to year wheel (planning_cycle).';

CREATE INDEX IF NOT EXISTS idx_season_planning_cycle
  ON season (planning_cycle_id) WHERE planning_cycle_id IS NOT NULL;

-- Note: season.is_active boolean from spec is INTENTIONALLY OMITTED.
-- Season already has status enum (draft/active/archived) — use status = active instead.

-- --------------------------------------------------------
-- 3. employment_contract — add agreed weekly hours
-- --------------------------------------------------------
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS agreed_weekly_hours NUMERIC(4,2);

COMMENT ON COLUMN employment_contract.agreed_weekly_hours IS 'Cascade D3: Contractual weekly hours. Critical for overtime calculation.';

-- --------------------------------------------------------
-- 4. profile — add seniority and trade cert
-- --------------------------------------------------------
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS seniority_start_date DATE;

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS has_fagbrev BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profile.seniority_start_date IS 'Cascade D2: Ansiennitet start date for wage step lookup.';
COMMENT ON COLUMN profile.has_fagbrev IS 'Cascade D2: Fagbrev/non-fagbrev rate distinction.';

-- --------------------------------------------------------
-- 5. department_session — planned operating hours
-- --------------------------------------------------------
ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_open TIME;

ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_close TIME;

COMMENT ON COLUMN department_session.planned_open IS 'Cascade D1: Set from resolve_hours() at session creation.';
COMMENT ON COLUMN department_session.planned_close IS 'Cascade D1: Set from resolve_hours() at session creation.';

-- --------------------------------------------------------
-- 6. schedule_shift — direct dept/location FK
-- --------------------------------------------------------
ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES location(location_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_shift.department_id IS 'Cascade D1: Direct department FK (backfill from position). Enables direct department-level queries.';
COMMENT ON COLUMN schedule_shift.location_id IS 'Cascade D1: Direct location FK for location scoping.';

CREATE INDEX IF NOT EXISTS idx_schedule_shift_department
  ON schedule_shift (department_id) WHERE department_id IS NOT NULL;

-- --------------------------------------------------------
-- 7. schedule_template — add department FK
-- --------------------------------------------------------
ALTER TABLE schedule_template
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_template.department_id IS 'Cascade D1: Department FK (replaces plain TEXT department column). Legacy TEXT column preserved for backwards compat.';

-- --------------------------------------------------------
-- 8. schedule_template_shift — add cascade fields + missing codebase norms
-- --------------------------------------------------------

-- First: add missing codebase-standard columns
ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspace(workspace_id) ON DELETE CASCADE;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Then: add cascade-specific fields
ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS shift_function shift_function;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_anchor_type anchor_type;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_offset_min INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_anchor_type anchor_type;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_offset_min INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS slot_order INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Add updated_at trigger (idempotent)
DROP TRIGGER IF EXISTS set_template_shift_updated_at ON public.schedule_template_shift;
CREATE TRIGGER set_template_shift_updated_at
  BEFORE UPDATE ON public.schedule_template_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add provenance to tables that need it (spec Section 4.4)
ALTER TABLE schedule_template
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN schedule_template_shift.shift_function IS 'Cascade D1: opening/closing/supporting/rush_hour/sub_supply.';
COMMENT ON COLUMN schedule_template_shift.start_anchor_type IS 'Cascade D1: How start time is calculated — fixed/open/close.';
COMMENT ON COLUMN schedule_template_shift.end_anchor_type IS 'Cascade D1: How end time is calculated — fixed/open/close.';
COMMENT ON COLUMN schedule_template_shift.slot_order IS 'Cascade D1: Display order in vaktlista.';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421100300_cascade_a1_alter_existing.sql`
Expected: No errors.

- [ ] **Step 3: Verify new columns exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'department_operating_hours' ORDER BY ordinal_position;" && docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'schedule_template_shift' AND column_name IN ('shift_function','start_anchor_type','end_anchor_type','slot_order','label','workspace_id','created_at','updated_at','provenance');"`
Expected: All columns present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421100300_cascade_a1_alter_existing.sql
git commit -m "feat(cascade): add cascade fields to 7 existing tables

department (department_type), season (planning_cycle_id),
employment_contract (agreed_weekly_hours), profile (seniority_start_date,
has_fagbrev), department_session (planned_open/close),
schedule_shift (department_id, location_id),
schedule_template (department_id, provenance),
schedule_template_shift (7 cascade fields + workspace_id + timestamps).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Regenerate Types and Full Reset Validation

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (regenerated)

- [ ] **Step 1: Reset Supabase to run all migrations cleanly**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase db reset`
Expected: All migrations apply cleanly including the 4 new cascade migrations. No errors.

- [ ] **Step 2: Regenerate TypeScript types**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File regenerated with all new tables and enums.

- [ ] **Step 3: Verify new types exist in generated file**

Run: Search `database.types.ts` for `planning_cycle`, `department_operating_hours`, `tariff_rate_table`, `change_proposal`, `department_type`, `evaluation_outcome`.
Expected: All present as table types and enum types.

- [ ] **Step 4: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck`
Expected: 0 errors. New types don't break existing code (all new fields are nullable or have defaults).

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(cascade): regenerate database types after A1 migration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Track 2: A2 Framework Migration

### Task 2.1: Create A2 Framework Enums

**Files:**

- Create: `supabase/migrations/20260421200000_cascade_a2_enums.sql`

- [ ] **Step 1: Create the framework enum migration**

```sql
-- ============================================
-- 20260421200000_cascade_a2_enums.sql
-- Cascade A2: 6 framework model enums
-- Spec: Section 3 Phase A, "New Enums" (framework subset)
-- ============================================

-- What triggered the evaluation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_trigger_type') THEN
    CREATE TYPE public.framework_trigger_type AS ENUM ('operating_hours', 'season_transition', 'template_change', 'event_added', 'manual_override', 'framework_rule_change', 'external_sync');
  END IF;
END $$;;

-- Rule classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_rule_type') THEN
    CREATE TYPE public.framework_rule_type AS ENUM ('gate', 'constraint', 'advisory', 'commercial');
  END IF;
END $$;;

-- How a trigger fires
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_trigger_mode') THEN
    CREATE TYPE public.framework_trigger_mode AS ENUM ('state_change', 'time_based', 'threshold', 'external_event');
  END IF;
END $$;;

-- Integration enums: created ahead of A3 tables to stabilize enum ordering
-- and avoid later cross-phase enum migrations. Tables deferred to A3.

-- External system provider
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_provider') THEN
    CREATE TYPE public.external_provider AS ENUM ('tripletex', 'planday', 'visma');
  END IF;
END $$;;

-- Sync direction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_direction') THEN
    CREATE TYPE public.sync_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
  END IF;
END $$;;

-- Sync lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'conflict');
  END IF;
END $$;;

COMMENT ON TYPE public.framework_trigger_type IS 'Cascade: what triggered a framework evaluation';
COMMENT ON TYPE public.framework_rule_type IS 'Cascade: rule classification — gate/constraint/advisory/commercial';
COMMENT ON TYPE public.framework_trigger_mode IS 'Cascade: how a trigger fires — state_change/time_based/threshold/external_event';
COMMENT ON TYPE public.external_provider IS 'Cascade: external system provider type';
COMMENT ON TYPE public.sync_direction IS 'Cascade: sync event direction';
COMMENT ON TYPE public.sync_status IS 'Cascade: sync event lifecycle';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421200000_cascade_a2_enums.sql`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421200000_cascade_a2_enums.sql
git commit -m "feat(cascade): add 6 A2 framework enums

framework_trigger_type, framework_rule_type, framework_trigger_mode,
external_provider, sync_direction, sync_status.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: Create A2 Framework Tables

**Files:**

- Create: `supabase/migrations/20260421200100_cascade_a2_framework_tables.sql`

- [ ] **Step 1: Create the framework tables migration**

```sql
-- ============================================
-- 20260421200100_cascade_a2_framework_tables.sql
-- Cascade A2: 6 framework model tables
-- Spec: Section 4.1 (framework table schemas)
-- Depends on: A1 tables (change_proposal), A2 enums
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. regulatory_framework (Versioned framework packages)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regulatory_framework (
  framework_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  jurisdiction        TEXT NOT NULL DEFAULT 'NO',
  industry            TEXT NOT NULL,
  version             TEXT NOT NULL DEFAULT '1.0.0',
  parent_framework_id UUID REFERENCES regulatory_framework(framework_id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform-managed, no workspace_id. Service role for writes, authenticated for reads.
ALTER TABLE regulatory_framework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework" ON regulatory_framework;
CREATE POLICY "authenticated_select_framework" ON regulatory_framework
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework" ON regulatory_framework;
CREATE POLICY "service_role_framework" ON regulatory_framework
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_updated_at
  BEFORE UPDATE ON public.regulatory_framework
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE regulatory_framework IS 'Cascade K1a: Versioned framework packages. E.g. hospitality.no.default.v1. Platform-managed.';

-- --------------------------------------------------------
-- 2. framework_rule (Individual evaluable rules)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_rule (
  rule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  rule_type           framework_rule_type NOT NULL,
  category            TEXT NOT NULL,
  description         TEXT NOT NULL,
  description_no      TEXT,
  default_outcome     evaluation_outcome NOT NULL DEFAULT 'blocked',
  severity            TEXT NOT NULL DEFAULT 'hard_block',
  outcome_overridable BOOLEAN NOT NULL DEFAULT false,
  config_tighten_allowed BOOLEAN NOT NULL DEFAULT true,
  config_loosen_allowed BOOLEAN NOT NULL DEFAULT false,
  override_min_level  TEXT,
  evaluation_config   JSONB NOT NULL DEFAULT '{}',
  source_reference    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_rule UNIQUE (framework_id, code)
);

ALTER TABLE framework_rule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework_rule" ON framework_rule;
CREATE POLICY "authenticated_select_framework_rule" ON framework_rule
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework_rule" ON framework_rule;
CREATE POLICY "service_role_framework_rule" ON framework_rule
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_rule_updated_at
  BEFORE UPDATE ON public.framework_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_framework_rule_framework
  ON framework_rule (framework_id);

COMMENT ON TABLE framework_rule IS 'Cascade K1a: Individual evaluable rules within a framework. Override capability grammar is a foundation invariant.';

-- --------------------------------------------------------
-- 3. framework_trigger (Conditions that initiate evaluation)
-- Owner: Platform (K1a)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.framework_trigger (
  trigger_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  description         TEXT NOT NULL,
  description_no      TEXT,
  trigger_mode        framework_trigger_mode NOT NULL,
  source_entity_type  TEXT,
  evaluation_config   JSONB NOT NULL DEFAULT '{}',
  linked_rule_ids     UUID[] DEFAULT '{}',
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  is_disableable      BOOLEAN NOT NULL DEFAULT false,
  threshold_tune_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_framework_trigger UNIQUE (framework_id, code)
);

ALTER TABLE framework_trigger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_framework_trigger" ON framework_trigger;
CREATE POLICY "authenticated_select_framework_trigger" ON framework_trigger
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "service_role_framework_trigger" ON framework_trigger;
CREATE POLICY "service_role_framework_trigger" ON framework_trigger
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_trigger_updated_at
  BEFORE UPDATE ON public.framework_trigger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_framework_trigger_framework
  ON framework_trigger (framework_id);

COMMENT ON TABLE framework_trigger IS 'Cascade K1a: Conditions that initiate framework evaluation. Override capability grammar for disabling/tuning.';

-- --------------------------------------------------------
-- 4. workspace_framework_binding (Links workspace to framework)
-- Owner: Runtime
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_framework_binding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  framework_id        UUID NOT NULL REFERENCES regulatory_framework(framework_id),
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at      TIMESTAMPTZ,
  activated_by        UUID REFERENCES profile(profile_id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_workspace_active_framework
  ON workspace_framework_binding (workspace_id)
  WHERE is_active = true;

ALTER TABLE workspace_framework_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_select_framework_binding" ON workspace_framework_binding
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_insert_framework_binding" ON workspace_framework_binding
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_framework_binding" ON workspace_framework_binding;
CREATE POLICY "jwt_update_framework_binding" ON workspace_framework_binding
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_framework_binding" ON workspace_framework_binding;
CREATE POLICY "api_key_read_framework_binding" ON workspace_framework_binding
  FOR SELECT USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_framework_binding" ON workspace_framework_binding;
CREATE POLICY "service_role_framework_binding" ON workspace_framework_binding
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_framework_binding_updated_at
  BEFORE UPDATE ON public.workspace_framework_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE workspace_framework_binding IS 'Cascade: Links workspace to active framework version. One active binding per workspace (partial unique index).';

-- --------------------------------------------------------
-- 5. workspace_rule_override (Workspace-level rule customization)
-- Owner: Runtime (K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_rule_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  rule_id             UUID NOT NULL REFERENCES framework_rule(rule_id) ON DELETE CASCADE,
  override_outcome    evaluation_outcome,
  override_config     JSONB DEFAULT '{}',
  reason              TEXT NOT NULL,
  approved_by         UUID REFERENCES profile(profile_id),
  valid_from          DATE,
  valid_until         DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_rule_override UNIQUE (workspace_id, rule_id)
);

ALTER TABLE workspace_rule_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_select_rule_override" ON workspace_rule_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_insert_rule_override" ON workspace_rule_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_update_rule_override" ON workspace_rule_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_rule_override" ON workspace_rule_override;
CREATE POLICY "jwt_delete_rule_override" ON workspace_rule_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_rule_override" ON workspace_rule_override;
CREATE POLICY "service_role_rule_override" ON workspace_rule_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_rule_override_updated_at
  BEFORE UPDATE ON public.workspace_rule_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rule_override_workspace
  ON workspace_rule_override (workspace_id);

COMMENT ON TABLE workspace_rule_override IS 'Cascade K1b: Workspace-level rule customization. Must respect framework_rule override capability grammar.';

-- --------------------------------------------------------
-- 6. workspace_trigger_override (Workspace-level trigger customization)
-- Owner: Runtime (K1b)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_trigger_override (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  trigger_id          UUID NOT NULL REFERENCES framework_trigger(trigger_id) ON DELETE CASCADE,
  override_config     JSONB DEFAULT '{}',
  is_disabled         BOOLEAN NOT NULL DEFAULT false,
  reason              TEXT NOT NULL,
  approved_by         UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_trigger_override UNIQUE (workspace_id, trigger_id)
);

ALTER TABLE workspace_trigger_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_select_trigger_override" ON workspace_trigger_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_insert_trigger_override" ON workspace_trigger_override
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_update_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_update_trigger_override" ON workspace_trigger_override
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_delete_trigger_override" ON workspace_trigger_override;
CREATE POLICY "jwt_delete_trigger_override" ON workspace_trigger_override
  FOR DELETE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_trigger_override" ON workspace_trigger_override;
CREATE POLICY "service_role_trigger_override" ON workspace_trigger_override
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_trigger_override_updated_at
  BEFORE UPDATE ON public.workspace_trigger_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_trigger_override_workspace
  ON workspace_trigger_override (workspace_id);

COMMENT ON TABLE workspace_trigger_override IS 'Cascade K1b: Workspace-level trigger customization. Must respect framework_trigger override capability grammar.';

-- --------------------------------------------------------
-- Add framework_trigger_id FK to change_proposal (deferred from A1)
-- --------------------------------------------------------
ALTER TABLE change_proposal
  ADD COLUMN IF NOT EXISTS framework_trigger_id UUID REFERENCES framework_trigger(trigger_id);

COMMENT ON COLUMN change_proposal.framework_trigger_id IS 'Cascade: Exact trigger definition that fired. Added in A2 after framework_trigger table exists.';

-- Upgrade trigger_type from TEXT to framework_trigger_type enum (deferred from A1)
ALTER TABLE change_proposal
  ALTER COLUMN trigger_type TYPE framework_trigger_type
  USING trigger_type::framework_trigger_type;
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421200100_cascade_a2_framework_tables.sql`
Expected: No errors.

- [ ] **Step 3: Verify all framework tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('regulatory_framework','framework_rule','framework_trigger','workspace_framework_binding','workspace_rule_override','workspace_trigger_override') ORDER BY tablename;"`
Expected: 6 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421200100_cascade_a2_framework_tables.sql
git commit -m "feat(cascade): create 6 A2 framework tables with RLS

regulatory_framework, framework_rule, framework_trigger,
workspace_framework_binding, workspace_rule_override,
workspace_trigger_override. Plus framework_trigger_id FK on
change_proposal (deferred from A1).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: Regenerate Types and Full Reset Validation

**Files:**

- Modify: `packages/supabase/src/database.types.ts` (regenerated)

- [ ] **Step 1: Reset Supabase**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase db reset`
Expected: All migrations (including A1 + A2) apply cleanly.

- [ ] **Step 2: Regenerate types**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 3: Verify framework types exist**

Search `database.types.ts` for `regulatory_framework`, `framework_rule`, `workspace_framework_binding`, `framework_rule_type`, `framework_trigger_mode`.
Expected: All present.

- [ ] **Step 4: Run typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(cascade): regenerate database types after A2 migration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Track 3: Phase B Pure Functions

### Task 3.1: Create Cascade Type Definitions

**Files:**

- Create: `apps/web/src/lib/cascade/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * Cascade Core Foundation — Type Definitions
 *
 * Pure types for the cascade computation engine.
 * No database imports — these mirror the spec's TypeScript signatures
 * and are used by all pure functions.
 *
 * Spec: Section 3 Phase B
 */

// --------------------------------------------------------
// Operating Hours Resolution (resolve_hours)
// --------------------------------------------------------

export type DepartmentOperatingHoursRow = {
  id: string;
  department_id: string;
  location_id: string | null;
  season_id: string | null;
  day_of_week: number; // 0-6
  open_time: string | null; // HH:MM or HH:MM:SS
  close_time: string | null;
  is_closed: boolean;
};

export type DepartmentHoursOverrideRow = {
  id: string;
  department_id: string;
  location_id: string | null;
  override_date: string; // YYYY-MM-DD
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  reason: string | null;
};

export type EffectiveHours = {
  date: string;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  crossesMidnight: boolean;
  effectiveCloseTimestamp: string | null;
  source: "override" | "season_weekly" | "default_weekly" | "closed";
};

// --------------------------------------------------------
// Shift Anchoring (compute_anchored_shift)
// --------------------------------------------------------

export type AnchorType = "fixed" | "open" | "close";

export type AnchorInput = {
  anchorType: AnchorType;
  fixedTime: string | null; // HH:MM
  offsetMin: number;
};

export type ComputedShiftTime = {
  resolvedTime: string; // HH:MM
  source: AnchorType;
  isNextDay: boolean;
};

// --------------------------------------------------------
// Framework Rule Evaluation (evaluate_framework_rules)
// --------------------------------------------------------

export type EvaluationOutcome =
  | "allowed"
  | "allowed_with_exception"
  | "review_required"
  | "blocked";

export type ConflictCategory = "constraint" | "advisory" | "commercial";

export type ConflictSeverity = "hard_block" | "hard_warn" | "soft_warn" | "info";

export type Conflict = {
  category: ConflictCategory;
  severity: ConflictSeverity;
  outcome: EvaluationOutcome;
  ruleId: string;
  entityType: string;
  entityId: string;
  description: string;
  exceptionPath?: string;
  resolution?: string;
};

export type FrameworkRule = {
  ruleId: string;
  code: string;
  ruleType: "gate" | "constraint" | "advisory" | "commercial";
  category: string;
  description: string;
  defaultOutcome: EvaluationOutcome;
  severity: ConflictSeverity;
  outcomeOverridable: boolean;
  configTightenAllowed: boolean;
  configLoosenAllowed: boolean;
  overrideMinLevel: string | null;
  evaluationConfig: Record<string, unknown>;
  sourceReference: string | null;
};

export type WorkspaceRuleOverride = {
  ruleId: string;
  overrideOutcome: EvaluationOutcome | null;
  overrideConfig: Record<string, unknown>;
  validFrom: string | null;
  validUntil: string | null;
};

export type ProposedChange = {
  entityType: string;
  entityId: string;
  changeType: "create" | "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

// --------------------------------------------------------
// Proposal Freshness
// --------------------------------------------------------

export type ChangeProposalRow = {
  changeProposalId: string;
  inputStateHash: string | null;
  status: "pending" | "approved" | "applied" | "rejected" | "expired";
  createdAt: string;
};

export type FreshnessResult = {
  fresh: boolean;
  staleFields: string[];
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/cascade/types.ts
git commit -m "feat(cascade): add Phase B type definitions

Pure types for cascade computation engine — EffectiveHours,
AnchorInput, Conflict, FrameworkRule, ProposedChange, etc.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.2: Implement resolve_hours with TDD

**Files:**

- Create: `apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts`
- Create: `apps/web/src/lib/cascade/resolve-hours.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { resolveEffectiveHours } from "../resolve-hours";
import type { DepartmentOperatingHoursRow, DepartmentHoursOverrideRow } from "../types";

const deptId = "dept-001";
const locId = "loc-001";
const seasonId = "season-summer";

// Helper to create a weekly hours row
function weeklyRow(
  overrides: Partial<DepartmentOperatingHoursRow> & { day_of_week: number },
): DepartmentOperatingHoursRow {
  return {
    id: `wh-${overrides.day_of_week}`,
    department_id: deptId,
    location_id: null,
    season_id: null,
    open_time: "10:00",
    close_time: "22:00",
    is_closed: false,
    ...overrides,
  };
}

describe("resolveEffectiveHours", () => {
  it("resolves default weekly hours for a normal weekday", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })]; // Tuesday
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, []);

    expect(result.isOpen).toBe(true);
    expect(result.openTime).toBe("10:00");
    expect(result.closeTime).toBe("22:00");
    expect(result.crossesMidnight).toBe(false);
    expect(result.source).toBe("default_weekly");
  });

  it("returns closed when no matching weekly hours exist", () => {
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", [], []);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("closed");
  });

  it("returns closed when is_closed is true", () => {
    const weekly = [
      weeklyRow({ day_of_week: 1, is_closed: true, open_time: null, close_time: null }),
    ];
    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, []);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("default_weekly");
  });

  it("override takes precedence over weekly hours", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })];
    const overrides: DepartmentHoursOverrideRow[] = [
      {
        id: "ov-1",
        department_id: deptId,
        location_id: null,
        override_date: "2026-04-07",
        open_time: "12:00",
        close_time: "20:00",
        is_closed: false,
        reason: "Holiday hours",
      },
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, overrides);

    expect(result.isOpen).toBe(true);
    expect(result.openTime).toBe("12:00");
    expect(result.closeTime).toBe("20:00");
    expect(result.source).toBe("override");
  });

  it("closed override takes precedence", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })];
    const overrides: DepartmentHoursOverrideRow[] = [
      {
        id: "ov-1",
        department_id: deptId,
        location_id: null,
        override_date: "2026-04-07",
        open_time: null,
        close_time: null,
        is_closed: true,
        reason: "Christmas Eve",
      },
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, overrides);

    expect(result.isOpen).toBe(false);
    expect(result.source).toBe("override");
  });

  it("season-specific hours override defaults", () => {
    const weekly = [
      weeklyRow({ day_of_week: 1 }), // default
      weeklyRow({
        day_of_week: 1,
        season_id: seasonId,
        open_time: "08:00",
        close_time: "23:00",
        id: "wh-1-summer",
      }),
    ];

    const result = resolveEffectiveHours(deptId, null, "2026-04-07", weekly, [], seasonId);

    expect(result.openTime).toBe("08:00");
    expect(result.closeTime).toBe("23:00");
    expect(result.source).toBe("season_weekly");
  });

  it("handles overnight spans (close < open)", () => {
    const weekly = [weeklyRow({ day_of_week: 5, open_time: "16:00", close_time: "02:00" })]; // Saturday bar
    const result = resolveEffectiveHours(deptId, null, "2026-04-11", weekly, []);

    expect(result.isOpen).toBe(true);
    expect(result.crossesMidnight).toBe(true);
    expect(result.openTime).toBe("16:00");
    expect(result.closeTime).toBe("02:00");
    expect(result.effectiveCloseTimestamp).toBe("2026-04-12T02:00");
  });

  it("location-specific hours override null-location defaults", () => {
    const weekly = [
      weeklyRow({ day_of_week: 1 }), // default (null location)
      weeklyRow({
        day_of_week: 1,
        location_id: locId,
        open_time: "11:00",
        close_time: "21:00",
        id: "wh-1-loc",
      }),
    ];

    const result = resolveEffectiveHours(deptId, locId, "2026-04-07", weekly, []);

    expect(result.openTime).toBe("11:00");
    expect(result.closeTime).toBe("21:00");
  });

  it("falls back to null-location when no location-specific row exists", () => {
    const weekly = [weeklyRow({ day_of_week: 1 })]; // null location
    const result = resolveEffectiveHours(deptId, locId, "2026-04-07", weekly, []);

    expect(result.openTime).toBe("10:00");
    expect(result.closeTime).toBe("22:00");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resolveEffectiveHours**

```typescript
/**
 * resolve_hours — Cascade Phase B Pure Function #1
 *
 * Resolves effective operating hours for a department on a specific date.
 * Resolution order: override(date) > season_weekly(day_of_week) > default_weekly > closed.
 *
 * Foundation invariant: when close_time < open_time, the service window
 * crosses midnight. effectiveCloseTimestamp returns the next-day close.
 *
 * Spec: Section 3 Phase B, Function #1
 */

import type {
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
  EffectiveHours,
} from "./types";

/**
 * Get the day-of-week (0=Mon...6=Sun) from an ISO date string.
 * JavaScript Date.getDay() returns 0=Sun, so we convert.
 */
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC avoids timezone edge cases
  const jsDay = d.getUTCDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon...6=Sun
}

export function resolveEffectiveHours(
  departmentId: string,
  locationId: string | null,
  date: string,
  weeklyHours: DepartmentOperatingHoursRow[],
  overrides: DepartmentHoursOverrideRow[],
  seasonId?: string,
): EffectiveHours {
  const closedResult: EffectiveHours = {
    date,
    isOpen: false,
    openTime: null,
    closeTime: null,
    crossesMidnight: false,
    effectiveCloseTimestamp: null,
    source: "closed",
  };

  // 1. Check for date-specific override
  const override = overrides.find(
    (o) =>
      o.department_id === departmentId &&
      o.override_date === date &&
      (o.location_id === locationId || (o.location_id === null && locationId !== null)),
  );

  // Prefer exact location match, then null-location fallback
  const exactLocOverride = overrides.find(
    (o) =>
      o.department_id === departmentId && o.override_date === date && o.location_id === locationId,
  );
  const fallbackOverride = overrides.find(
    (o) => o.department_id === departmentId && o.override_date === date && o.location_id === null,
  );
  const matchedOverride = exactLocOverride ?? fallbackOverride;

  if (matchedOverride) {
    if (matchedOverride.is_closed) {
      return { ...closedResult, source: "override" };
    }
    return buildResult(date, matchedOverride.open_time!, matchedOverride.close_time!, "override");
  }

  // 2. Find weekly hours — resolution: season+location > season+null > null+location > null+null
  const dayOfWeek = getDayOfWeek(date);
  const deptRows = weeklyHours.filter(
    (r) => r.department_id === departmentId && r.day_of_week === dayOfWeek,
  );

  const match = pickBestWeeklyRow(deptRows, locationId, seasonId ?? null);
  if (!match) {
    return closedResult;
  }

  if (match.row.is_closed) {
    return {
      ...closedResult,
      source: match.source,
    };
  }

  return buildResult(date, match.row.open_time!, match.row.close_time!, match.source);
}

type WeeklyMatch = {
  row: DepartmentOperatingHoursRow;
  source: "season_weekly" | "default_weekly";
};

function pickBestWeeklyRow(
  rows: DepartmentOperatingHoursRow[],
  locationId: string | null,
  seasonId: string | null,
): WeeklyMatch | null {
  // Priority: season+location > season+null > default+location > default+null
  if (seasonId) {
    const seasonLoc = rows.find(
      (r) => r.season_id === seasonId && r.location_id === locationId && locationId !== null,
    );
    if (seasonLoc) return { row: seasonLoc, source: "season_weekly" };

    const seasonNull = rows.find((r) => r.season_id === seasonId && r.location_id === null);
    if (seasonNull) return { row: seasonNull, source: "season_weekly" };
  }

  // Default (null season)
  const defaultLoc = rows.find(
    (r) => r.season_id === null && r.location_id === locationId && locationId !== null,
  );
  if (defaultLoc) return { row: defaultLoc, source: "default_weekly" };

  const defaultNull = rows.find((r) => r.season_id === null && r.location_id === null);
  if (defaultNull) return { row: defaultNull, source: "default_weekly" };

  return null;
}

function buildResult(
  date: string,
  openTime: string,
  closeTime: string,
  source: EffectiveHours["source"],
): EffectiveHours {
  // Normalize to HH:MM
  const open = openTime.substring(0, 5);
  const close = closeTime.substring(0, 5);
  const crossesMidnight = close < open;

  let effectiveCloseTimestamp: string | null = null;
  if (crossesMidnight) {
    // Close is on the next calendar day
    const nextDay = new Date(date + "T12:00:00Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDayStr = nextDay.toISOString().substring(0, 10);
    effectiveCloseTimestamp = `${nextDayStr}T${close}`;
  } else {
    effectiveCloseTimestamp = `${date}T${close}`;
  }

  return {
    date,
    isOpen: true,
    openTime: open,
    closeTime: close,
    crossesMidnight,
    effectiveCloseTimestamp,
    source,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/resolve-hours.ts apps/web/src/lib/cascade/__tests__/resolve-hours.test.ts
git commit -m "feat(cascade): implement resolveEffectiveHours with tests

Phase B function #1. Resolution: override > season_weekly >
default_weekly > closed. Handles overnight spans, location
fallback, season priority.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: Implement compute_anchored_shift with TDD

**Files:**

- Create: `apps/web/src/lib/cascade/__tests__/compute-anchored-shift.test.ts`
- Create: `apps/web/src/lib/cascade/compute-anchored-shift.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { computeAnchoredTime } from "../compute-anchored-shift";
import type { AnchorInput, EffectiveHours } from "../types";

const normalHours: EffectiveHours = {
  date: "2026-04-07",
  isOpen: true,
  openTime: "10:00",
  closeTime: "22:00",
  crossesMidnight: false,
  effectiveCloseTimestamp: "2026-04-07T22:00",
  source: "default_weekly",
};

const overnightHours: EffectiveHours = {
  date: "2026-04-11",
  isOpen: true,
  openTime: "16:00",
  closeTime: "02:00",
  crossesMidnight: true,
  effectiveCloseTimestamp: "2026-04-12T02:00",
  source: "default_weekly",
};

const closedHours: EffectiveHours = {
  date: "2026-04-07",
  isOpen: false,
  openTime: null,
  closeTime: null,
  crossesMidnight: false,
  effectiveCloseTimestamp: null,
  source: "closed",
};

describe("computeAnchoredTime", () => {
  it("fixed anchor returns the fixed time", () => {
    const anchor: AnchorInput = { anchorType: "fixed", fixedTime: "14:00", offsetMin: 0 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("14:00");
    expect(result.source).toBe("fixed");
    expect(result.isNextDay).toBe(false);
  });

  it("open anchor returns openTime + offset", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: null, offsetMin: -30 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("09:30");
    expect(result.source).toBe("open");
  });

  it("close anchor returns closeTime + offset", () => {
    const anchor: AnchorInput = { anchorType: "close", fixedTime: null, offsetMin: 30 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("22:30");
    expect(result.source).toBe("close");
  });

  it("close anchor with overnight hours", () => {
    const anchor: AnchorInput = { anchorType: "close", fixedTime: null, offsetMin: -60 };
    const result = computeAnchoredTime(anchor, overnightHours);

    expect(result.resolvedTime).toBe("01:00");
    expect(result.source).toBe("close");
    expect(result.isNextDay).toBe(true);
  });

  it("falls back to fixedTime when hours are closed", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: "10:00", offsetMin: 0 };
    const result = computeAnchoredTime(anchor, closedHours);

    expect(result.resolvedTime).toBe("10:00");
    expect(result.source).toBe("fixed");
  });

  it("open anchor with positive offset", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: null, offsetMin: 60 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("11:00");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/compute-anchored-shift.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement computeAnchoredTime**

```typescript
/**
 * compute_anchored_shift — Cascade Phase B Pure Function #2
 *
 * Resolves a shift's start or end time based on its anchor type:
 * - fixed: use the fixedTime directly
 * - open: openTime + offsetMin
 * - close: closeTime + offsetMin
 *
 * Falls back to fixedTime if hours are closed.
 *
 * Spec: Section 3 Phase B, Function #2
 */

import type { AnchorInput, ComputedShiftTime, EffectiveHours } from "./types";

function addMinutesToTime(time: string, minutes: number): { time: string; isNextDay: boolean } {
  const [h, m] = time.split(":").map(Number);
  let totalMinutes = h * 60 + m + minutes;

  let isNextDay = false;
  if (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60;
    isNextDay = true;
  } else if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    // Negative wrap means previous day — unusual but handle gracefully
  }

  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return {
    time: `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`,
    isNextDay,
  };
}

export function computeAnchoredTime(anchor: AnchorInput, hours: EffectiveHours): ComputedShiftTime {
  // Fallback to fixed when hours are closed or anchor references unavailable time
  if (!hours.isOpen || (anchor.anchorType !== "fixed" && !hours.openTime && !hours.closeTime)) {
    return {
      resolvedTime: anchor.fixedTime ?? "00:00",
      source: "fixed",
      isNextDay: false,
    };
  }

  switch (anchor.anchorType) {
    case "fixed": {
      return {
        resolvedTime: anchor.fixedTime ?? "00:00",
        source: "fixed",
        isNextDay: false,
      };
    }
    case "open": {
      if (!hours.openTime) {
        return { resolvedTime: anchor.fixedTime ?? "00:00", source: "fixed", isNextDay: false };
      }
      const result = addMinutesToTime(hours.openTime, anchor.offsetMin);
      return { resolvedTime: result.time, source: "open", isNextDay: result.isNextDay };
    }
    case "close": {
      if (!hours.closeTime) {
        return { resolvedTime: anchor.fixedTime ?? "00:00", source: "fixed", isNextDay: false };
      }
      const result = addMinutesToTime(hours.closeTime, anchor.offsetMin);
      // If hours already cross midnight, the close-anchored shift is inherently next-day
      const isNextDay = hours.crossesMidnight || result.isNextDay;
      return { resolvedTime: result.time, source: "close", isNextDay };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/compute-anchored-shift.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/compute-anchored-shift.ts apps/web/src/lib/cascade/__tests__/compute-anchored-shift.test.ts
git commit -m "feat(cascade): implement computeAnchoredTime with tests

Phase B function #2. Resolves shift times from anchor type
(fixed/open/close) + offset. Handles overnight, closed fallback.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.4: Implement evaluate_framework_rules skeleton with TDD

> **Scope note:** This is **policy-evaluation scaffolding**, not the complete Phase B evaluator. It implements the structural machinery: entity-type matching, one basic threshold check pattern, and the override capability grammar (outcome override + config tightening/loosening + temporal validity). It does NOT yet reflect the spec's broader evaluation shape: richer conflict generation, multi-entity context, employee contract context (hours, age, seniority), rule chaining, exception-path semantics beyond a basic tag, or framework-trigger-linked evaluation flow. Those require integrated schema, real framework seed data, and the FrameworkContext object.

**Files:**

- Create: `apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts`
- Create: `apps/web/src/lib/cascade/evaluate-framework-rules.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { evaluateFrameworkRules } from "../evaluate-framework-rules";
import type { FrameworkRule, WorkspaceRuleOverride, ProposedChange, Conflict } from "../types";

function makeRule(
  overrides: Partial<FrameworkRule> & { ruleId: string; code: string },
): FrameworkRule {
  return {
    ruleType: "constraint",
    category: "working_time",
    description: "Test rule",
    defaultOutcome: "blocked",
    severity: "hard_block",
    outcomeOverridable: false,
    configTightenAllowed: true,
    configLoosenAllowed: false,
    overrideMinLevel: null,
    evaluationConfig: {},
    sourceReference: null,
    ...overrides,
  };
}

describe("evaluateFrameworkRules", () => {
  it("returns empty conflicts when no rules match", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "department_operating_hours",
        entityId: "e1",
        changeType: "update",
        before: null,
        after: { open_time: "10:00" },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(0);
  });

  it("returns a conflict when rule matches entity type and threshold exceeded", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: {
          entityType: "schedule_shift",
          check: "max_hours",
          threshold: 10,
        },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("r1");
    expect(result[0].outcome).toBe("blocked");
    expect(result[0].category).toBe("constraint");
  });

  it("does NOT trigger when threshold is not exceeded", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 6 },
        after: { work_hours: 9 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(0);
  });

  it("workspace override changes the outcome when rule is overridable", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed_with_exception",
        overrideConfig: {},
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("allowed_with_exception");
    expect(result[0].exceptionPath).toBe("workspace_override");
  });

  it("non-overridable rule ignores workspace override outcome", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: false,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed",
        overrideConfig: {},
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("blocked"); // Override ignored
  });

  it("expired override is ignored", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        outcomeOverridable: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: "allowed_with_exception",
        overrideConfig: {},
        validFrom: "2026-01-01",
        validUntil: "2026-03-31", // Expired before evaluation date
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 12 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("blocked"); // Expired override ignored
  });

  it("config tightening override lowers threshold", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        configTightenAllowed: true,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: null,
        overrideConfig: { threshold: 8 }, // Tighter than framework default of 10
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 6 },
        after: { work_hours: 9 }, // Over tightened threshold of 8, under framework default of 10
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1); // Triggered by tightened threshold
  });

  it("config loosening override rejected when not allowed", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r1",
        code: "max_daily_hours",
        configLoosenAllowed: false,
        evaluationConfig: { entityType: "schedule_shift", check: "max_hours", threshold: 10 },
      }),
    ];

    const overrides: WorkspaceRuleOverride[] = [
      {
        ruleId: "r1",
        overrideOutcome: null,
        overrideConfig: { threshold: 12 }, // Looser than framework default — should be ignored
        validFrom: null,
        validUntil: null,
      },
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "update",
        before: { work_hours: 8 },
        after: { work_hours: 11 }, // Over framework threshold of 10, under loosened 12
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, overrides, "2026-04-07");
    expect(result).toHaveLength(1); // Loosening rejected, framework threshold of 10 applies
  });

  it("advisory rules produce soft_warn conflicts", () => {
    const rules: FrameworkRule[] = [
      makeRule({
        ruleId: "r2",
        code: "short_notice",
        ruleType: "advisory",
        severity: "soft_warn",
        defaultOutcome: "review_required",
        evaluationConfig: { entityType: "schedule_shift" },
      }),
    ];

    const changes: ProposedChange[] = [
      {
        entityType: "schedule_shift",
        entityId: "s1",
        changeType: "create",
        before: null,
        after: { work_hours: 6 },
      },
    ];

    const result = evaluateFrameworkRules(changes, rules, [], "2026-04-07");
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("soft_warn");
    expect(result[0].category).toBe("advisory");
    expect(result[0].outcome).toBe("review_required");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement evaluateFrameworkRules (minimal foundation skeleton)**

```typescript
/**
 * evaluate_framework_rules — Cascade Phase B, Minimal Foundation Skeleton
 *
 * Evaluates proposed changes against framework rules with override capability grammar.
 * This skeleton implements:
 * - Entity-type matching via evaluationConfig.entityType
 * - Basic threshold evaluation (max_hours check)
 * - Override capability grammar: outcome override, config tightening/loosening, temporal validity
 *
 * NOT yet implemented (requires integrated schema + real framework seed data):
 * - Full FrameworkContext object loading
 * - Multi-rule interaction (rule chaining, precedence between conflicting rules)
 * - Complex evaluation strategies beyond threshold checks
 * - Employee-specific context (contract hours, age, seniority)
 *
 * Spec: Section 3 Phase B, Function #3
 */

import type {
  Conflict,
  ConflictCategory,
  FrameworkRule,
  ProposedChange,
  WorkspaceRuleOverride,
  EvaluationOutcome,
} from "./types";

const RULE_TYPE_TO_CATEGORY: Record<string, ConflictCategory> = {
  gate: "constraint",
  constraint: "constraint",
  advisory: "advisory",
  commercial: "commercial",
};

function ruleApplies(rule: FrameworkRule, change: ProposedChange): boolean {
  const configEntityType = (rule.evaluationConfig as Record<string, unknown>).entityType;
  if (!configEntityType) return false;
  return configEntityType === change.entityType;
}

/**
 * Find the applicable override for a rule, respecting temporal validity.
 * Returns null if no valid override exists.
 */
function findValidOverride(
  ruleId: string,
  overrides: WorkspaceRuleOverride[],
  evaluationDate: string,
): WorkspaceRuleOverride | null {
  const override = overrides.find((o) => o.ruleId === ruleId);
  if (!override) return null;

  // Check temporal validity
  if (override.validFrom && evaluationDate < override.validFrom) return null;
  if (override.validUntil && evaluationDate > override.validUntil) return null;

  return override;
}

/**
 * Merge config overrides with framework defaults, respecting tighten/loosen capability.
 * Returns the effective evaluationConfig to use for evaluation.
 */
function mergeConfig(
  rule: FrameworkRule,
  override: WorkspaceRuleOverride | null,
): Record<string, unknown> {
  const baseConfig = rule.evaluationConfig as Record<string, unknown>;
  if (!override || !override.overrideConfig || Object.keys(override.overrideConfig).length === 0) {
    return baseConfig;
  }

  const merged = { ...baseConfig };
  const overrideConfig = override.overrideConfig as Record<string, unknown>;

  for (const [key, overrideValue] of Object.entries(overrideConfig)) {
    const baseValue = baseConfig[key];

    // Only merge numeric thresholds for now — the tighten/loosen grammar
    if (typeof baseValue === "number" && typeof overrideValue === "number") {
      const isTightening = overrideValue < baseValue; // Lower threshold = stricter
      const isLoosening = overrideValue > baseValue;

      if (isTightening && rule.configTightenAllowed) {
        merged[key] = overrideValue;
      } else if (isLoosening && rule.configLoosenAllowed) {
        merged[key] = overrideValue;
      }
      // Otherwise: keep base value (override rejected)
    }
  }

  return merged;
}

/**
 * Evaluate whether a rule is triggered by a proposed change.
 * Uses the effective (potentially overridden) config.
 */
function ruleTriggered(
  rule: FrameworkRule,
  change: ProposedChange,
  effectiveConfig: Record<string, unknown>,
): boolean {
  const check = effectiveConfig.check as string | undefined;

  if (!check) {
    // Rule matches entity type but has no specific check — always triggered
    return true;
  }

  if (check === "max_hours" && typeof effectiveConfig.threshold === "number") {
    const afterHours = (change.after as Record<string, unknown> | null)?.work_hours;
    if (typeof afterHours === "number" && afterHours > effectiveConfig.threshold) {
      return true;
    }
    return false;
  }

  // Unknown check type — trigger the rule (safe default for foundation skeleton)
  return true;
}

function resolveOutcome(
  rule: FrameworkRule,
  override: WorkspaceRuleOverride | null,
): EvaluationOutcome {
  if (override?.overrideOutcome && rule.outcomeOverridable) {
    return override.overrideOutcome;
  }
  return rule.defaultOutcome;
}

/**
 * @param evaluationDate - ISO date string (YYYY-MM-DD) for override temporal validity checks
 */
export function evaluateFrameworkRules(
  proposedChanges: ProposedChange[],
  rules: FrameworkRule[],
  workspaceOverrides: WorkspaceRuleOverride[],
  evaluationDate: string,
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const change of proposedChanges) {
    for (const rule of rules) {
      if (!ruleApplies(rule, change)) continue;

      const override = findValidOverride(rule.ruleId, workspaceOverrides, evaluationDate);
      const effectiveConfig = mergeConfig(rule, override);

      if (!ruleTriggered(rule, change, effectiveConfig)) continue;

      const outcome = resolveOutcome(rule, override);

      conflicts.push({
        category: RULE_TYPE_TO_CATEGORY[rule.ruleType] ?? "constraint",
        severity: rule.severity,
        outcome,
        ruleId: rule.ruleId,
        entityType: change.entityType,
        entityId: change.entityId,
        description: rule.description,
        exceptionPath: outcome === "allowed_with_exception" ? "workspace_override" : undefined,
      });
    }
  }

  return conflicts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/evaluate-framework-rules.ts apps/web/src/lib/cascade/__tests__/evaluate-framework-rules.test.ts
git commit -m "feat(cascade): implement evaluateFrameworkRules skeleton with tests

Minimal foundation skeleton for Phase B function #3. Implements:
entity-type matching, override capability grammar (outcome override,
config tighten/loosen, temporal validity), basic threshold evaluation.

NOT yet: full FrameworkContext, multi-rule interaction, complex
evaluation strategies, employee-specific context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.5: Implement validate_proposal_freshness with TDD

> **Scope note:** This implements **hash-based freshness validation** — a binary fresh/stale gate using SHA-256 state hashing. It does NOT implement full changed-field diff detection (i.e., identifying _which_ specific fields changed since the preview was generated). The `staleFields` array returns category markers (`state_changed_since_preview`), not actual field-level diffs. Full diff detection requires the `compute_cascade_preview()` function which is deferred.

**Files:**

- Create: `apps/web/src/lib/cascade/__tests__/validate-proposal-freshness.test.ts`
- Create: `apps/web/src/lib/cascade/validate-proposal-freshness.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { validateProposalFreshness, computeStateHash } from "../validate-proposal-freshness";
import type { ChangeProposalRow } from "../types";

describe("computeStateHash", () => {
  it("produces consistent SHA-256 hash for same input", async () => {
    const state = { hours: [{ id: "1", open: "10:00" }], shifts: [] };
    const hash1 = await computeStateHash(state);
    const hash2 = await computeStateHash(state);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("produces different hash for different input", async () => {
    const state1 = { hours: [{ id: "1", open: "10:00" }] };
    const state2 = { hours: [{ id: "1", open: "11:00" }] };
    const hash1 = await computeStateHash(state1);
    const hash2 = await computeStateHash(state2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("validateProposalFreshness", () => {
  it("returns fresh when hashes match", async () => {
    const state = { hours: [{ id: "1", open: "10:00" }] };
    const hash = await computeStateHash(state);
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: hash,
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(true);
    expect(result.staleFields).toHaveLength(0);
  });

  it("returns stale when hashes differ", async () => {
    const hash = await computeStateHash({ hours: [{ id: "1", open: "10:00" }] });
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(false);
    expect(result.staleFields.length).toBeGreaterThan(0);
  });

  it("returns stale when proposal has no hash", async () => {
    const hash = await computeStateHash({ any: "state" });
    const proposal: ChangeProposalRow = {
      changeProposalId: "p1",
      inputStateHash: null,
      status: "pending",
      createdAt: "2026-04-07T10:00:00Z",
    };

    const result = validateProposalFreshness(proposal, hash);
    expect(result.fresh).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/validate-proposal-freshness.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement validateProposalFreshness**

```typescript
/**
 * validate_proposal_freshness — Cascade Phase B Pure Function #4
 *
 * Compares a proposal's input_state_hash against the current state hash.
 * If stale, the proposal must be regenerated before apply.
 *
 * Spec: Section 3 Phase B, Function #6
 */

import type { ChangeProposalRow, FreshnessResult } from "./types";

/**
 * Deep-sort all object keys recursively for deterministic serialization.
 * Arrays preserve order (element order is semantically meaningful).
 * This ensures identical logical state always produces identical JSON
 * regardless of object construction order at any nesting depth.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Compute a deterministic SHA-256 hash of workspace state.
 * Deep-canonicalizes all nested keys before hashing.
 * This is the foundation contract — staleness detection
 * and audit trails depend on this hash being SHA-256.
 */
export async function computeStateHash(state: unknown): Promise<string> {
  const canonical = canonicalize(state);
  const json = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateProposalFreshness(
  proposal: ChangeProposalRow,
  currentStateHash: string,
): FreshnessResult {
  if (!proposal.inputStateHash) {
    return {
      fresh: false,
      staleFields: ["input_state_hash_missing"],
    };
  }

  if (proposal.inputStateHash !== currentStateHash) {
    return {
      fresh: false,
      staleFields: ["state_changed_since_preview"],
    };
  }

  return {
    fresh: true,
    staleFields: [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/__tests__/validate-proposal-freshness.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cascade/validate-proposal-freshness.ts apps/web/src/lib/cascade/__tests__/validate-proposal-freshness.test.ts
git commit -m "feat(cascade): implement validateProposalFreshness with tests

Phase B function #4. Staleness detection via state hash comparison.
Deterministic hash for workspace state snapshots.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.6: Create Barrel Export and Run Full Test Suite

**Files:**

- Create: `apps/web/src/lib/cascade/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
/**
 * Cascade Core Foundation — Pure Computation Engine
 *
 * Phase B pure functions for the cascade proposal pipeline.
 * No database dependencies — all functions take data in, return data out.
 *
 * Spec: docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md
 */

export { resolveEffectiveHours } from "./resolve-hours";
export { computeAnchoredTime } from "./compute-anchored-shift";
export { evaluateFrameworkRules } from "./evaluate-framework-rules";
export { validateProposalFreshness, computeStateHash } from "./validate-proposal-freshness";

export type {
  EffectiveHours,
  AnchorInput,
  AnchorType,
  ComputedShiftTime,
  Conflict,
  ConflictCategory,
  ConflictSeverity,
  EvaluationOutcome,
  FrameworkRule,
  WorkspaceRuleOverride,
  ProposedChange,
  ChangeProposalRow,
  FreshnessResult,
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
} from "./types";
```

- [ ] **Step 2: Run all cascade tests**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/`
Expected: All tests pass (8 + 6 + 9 + 5 = 28 tests).

- [ ] **Step 3: Run full project typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/cascade/index.ts
git commit -m "feat(cascade): add barrel export for Phase B functions

Exports: resolveEffectiveHours, computeAnchoredTime,
evaluateFrameworkRules, validateProposalFreshness, computeStateHash
+ all types.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Track 4: Legacy Truth Cutover & Cleanup Safety Rails

> **Runs after T1 and T2 are merged.** This track does not drop legacy tables. It classifies legacy structures, blocks new runtime reads/writes to deprecated truth sources, adds compatibility markers, and defines the later drop sequence.

### Legacy Structures Classification

| Legacy Structure                    | New Truth                         | Status After This Plan              |
| ----------------------------------- | --------------------------------- | ----------------------------------- |
| `company_opening_hours`             | `department_operating_hours`      | Intake-only (join wizard)           |
| `operating_hours`                   | `department_operating_hours`      | Deprecated — runtime-read forbidden |
| `season.opening_hours` JSONB        | `department_operating_hours`      | Deprecated — runtime-read forbidden |
| `schedule_template.department` TEXT | `schedule_template.department_id` | Legacy compatibility only           |

---

### Task 4.2: Add Legacy Classification and Migration Markers

**Files:**

- Create: `supabase/migrations/20260421210000_cascade_cleanup_markers.sql`

- [ ] **Step 1: Create cleanup marker migration**

```sql
-- ============================================
-- 20260421210000_cascade_cleanup_markers.sql
-- Cascade cleanup safety rails
-- Marks legacy structures as non-authoritative runtime sources
-- ============================================

SET search_path TO public, extensions;

-- company_opening_hours remains join-intake only
COMMENT ON TABLE company_opening_hours IS
  'LEGACY: onboarding intake only. Not a runtime source of truth after Cascade A1. Runtime hours must read department_operating_hours.';

-- operating_hours deprecated
COMMENT ON TABLE operating_hours IS
  'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.';

-- season.opening_hours deprecated
COMMENT ON COLUMN season.opening_hours IS
  'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.';

-- schedule_template.department TEXT is compatibility only
COMMENT ON COLUMN schedule_template.department IS
  'LEGACY: compatibility-only text field. New runtime code must use department_id.';
```

- [ ] **Step 2: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260421210000_cascade_cleanup_markers.sql`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421210000_cascade_cleanup_markers.sql
git commit -m "chore(cascade): mark legacy truth sources as deprecated

Annotates company_opening_hours, operating_hours, season.opening_hours,
and schedule_template.department as legacy/non-authoritative after A1.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.3: Runtime Read Cutover Checklist

**Files:**

- Create: `docs/cascade-runtime-cutover-checklist.md`

- [ ] **Step 1: Create the cutover checklist**

```markdown
---
title: "Cascade Runtime Truth Cutover Checklist"
status: in_progress
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, migration, legacy, cleanup]
---

# Cascade Runtime Truth Cutover Checklist

## Runtime Truth Rules After A1/A2

### All runtime operating-hours reads MUST use:

- `department_operating_hours`
- `department_hours_override`
- `resolveEffectiveHours()` — never interpret raw open_time/close_time directly

### No runtime code may read:

- `company_opening_hours` (table)
- `operating_hours` (table)
- `season.opening_hours` (JSONB column)

### `company_opening_hours` is allowed ONLY in:

- `/join` wizard (onboarding intake)
- Bootstrap transformation code (setup wizard reads it as input, writes to `department_operating_hours`)

### New schedule-template reads MUST use:

- `schedule_template.department_id` (UUID FK)

### `schedule_template.department` TEXT may only remain for:

- Legacy display fallback (existing templates without FK)
- One-time backfill tooling

## Verification Checklist

For each legacy structure, grep the codebase and classify every hit:

- [ ] `rg "company_opening_hours" --type ts --type tsx --type sql` — classify each as: allowed intake / must refactor / deferred
- [ ] `rg "(?<!department_)operating_hours" --type ts --type tsx --type sql -P` — uses negative lookbehind to exclude `department_operating_hours` hits
- [ ] `rg "season\.(opening_hours|openingHours)" --type ts --type tsx` — classify season-level hours references
- [ ] `rg "schedule_template\.department[^_]" --type ts --type tsx` — matches `.department` but not `.department_id`

### Classification key:

- **Allowed legacy intake** — onboarding/join wizard reads, no action needed
- **Must refactor now** — runtime read/write that should use new truth source
- **Deferred but runtime-safe** — admin/reporting read that doesn't affect scheduling truth
```

- [ ] **Step 2: Commit**

```bash
git add docs/cascade-runtime-cutover-checklist.md
git commit -m "docs(cascade): add runtime truth cutover checklist

Defines which legacy tables/columns are no longer valid runtime sources
after Cascade A1/A2. Includes grep-based verification procedure.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.4: Legacy Usage Inventory

**Files:**

- Create: `docs/cascade-legacy-usage-inventory.md`

- [ ] **Step 1: Run greps and create inventory**

Search the codebase for all 4 legacy structures and record each occurrence.

```markdown
---
title: "Cascade Legacy Usage Inventory"
status: in_progress
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, migration, legacy, inventory]
---

# Cascade Legacy Usage Inventory

> Generated by grepping codebase after A1/A2 migration. Each hit classified.

## company_opening_hours

| File                       | Line | Read/Write | Context | Classification |
| -------------------------- | ---- | ---------- | ------- | -------------- |
| _(fill from grep results)_ |      |            |         |                |

## operating_hours

| File                       | Line | Read/Write | Context | Classification |
| -------------------------- | ---- | ---------- | ------- | -------------- |
| _(fill from grep results)_ |      |            |         |                |

## season.opening_hours

| File                       | Line | Read/Write | Context | Classification |
| -------------------------- | ---- | ---------- | ------- | -------------- |
| _(fill from grep results)_ |      |            |         |                |

## schedule_template.department (TEXT)

| File                       | Line | Read/Write | Context | Classification |
| -------------------------- | ---- | ---------- | ------- | -------------- |
| _(fill from grep results)_ |      |            |         |                |

## Summary

| Structure                    | Total Hits | Must Refactor | Safe to Defer | Allowed Intake |
| ---------------------------- | ---------- | ------------- | ------------- | -------------- |
| company_opening_hours        |            |               |               |                |
| operating_hours              |            |               |               |                |
| season.opening_hours         |            |               |               |                |
| schedule_template.department |            |               |               |                |
```

The implementing agent must fill this table from actual grep results — not estimate.

- [ ] **Step 2: Commit**

```bash
git add docs/cascade-legacy-usage-inventory.md
git commit -m "docs(cascade): add legacy usage inventory

Inventories all codebase references to deprecated truth sources.
Each occurrence classified as must-refactor/safe-defer/allowed-intake.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.5: Backfill Strategy for schedule_template.department_id

**Files:**

- Create: `docs/cascade-backfill-plan.md`

- [ ] **Step 1: Create backfill plan**

````markdown
---
title: "Cascade Backfill Plan — schedule_template.department_id"
status: draft
updated: 2026-03-21
created: 2026-03-21
module: cascade
tags: [cascade, migration, backfill]
---

# Cascade Backfill Plan — schedule_template.department_id

## Context

A1 migration adds `schedule_template.department_id` UUID FK alongside the existing
`schedule_template.department` TEXT column. Existing rows have only the TEXT column populated.

## Backfill Rules

1. `schedule_template.department_id` is the future runtime field
2. Existing rows may have only `department` TEXT
3. No new code should depend on TEXT when FK exists
4. TEXT column is NOT dropped — preserved for fallback until backfill is complete

## Backfill Migration (future, not in this plan)

A later migration will:

1. Map text department names to `department.department_id` via `department.name` or `department.slug`
2. Populate `department_id` FK for all matched rows
3. Identify ambiguous/unmapped rows (text doesn't match any department) and flag for manual resolution
4. Only after 100% backfill: consider dropping TEXT column

## Backfill SQL (draft)

```sql
-- Draft: update matched rows
UPDATE schedule_template st
SET department_id = d.department_id
FROM department d
WHERE st.workspace_id = d.workspace_id
  AND lower(trim(st.department)) = lower(trim(d.name))
  AND st.department_id IS NULL;

-- Identify unmatched rows
SELECT st.schedule_template_id, st.department, st.workspace_id
FROM schedule_template st
WHERE st.department IS NOT NULL
  AND st.department_id IS NULL;
```
````

## Drop Criteria

The TEXT column may be dropped only when ALL are true:

- [ ] Backfill complete (zero rows with department TEXT but no department_id)
- [ ] Zero runtime reads of `schedule_template.department` TEXT remain
- [ ] One full `supabase db reset` + smoke test passes without TEXT column
- [ ] Production telemetry shows no TEXT-column access for one release window

````

- [ ] **Step 2: Commit**

```bash
git add docs/cascade-backfill-plan.md
git commit -m "docs(cascade): add backfill plan for schedule_template.department_id

Defines backfill strategy, draft SQL, and drop criteria for the
legacy TEXT department column.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
````

---

### Task 4.6: Add Legacy Drop Criteria to ADR

This is folded into Task 4.1 Step 7 (Write ADR). The ADR must include:

**Legacy drop criteria — a legacy table/column may be dropped only when ALL are true:**

1. Zero runtime reads remain
2. Zero runtime writes remain
3. Bootstrap/join compatibility no longer depends on it, or replacement is live
4. Backfill complete for successor fields
5. One full `supabase db reset` + smoke test passes without legacy dependency
6. Production telemetry shows no legacy access for one release window

---

## Track 5: Post-Merge Validation

### Task 5.1: Full System Validation

This task runs AFTER T1, T2, T3 are merged to development in sequence.

- [ ] **Step 1: Full Supabase reset**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase db reset`
Expected: All 150+ migrations apply cleanly, including the 7 new cascade migrations.

- [ ] **Step 2: Regenerate types (final)**

Run: `cd /home/sxtnl/dev/wt-2 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 3: Verify table count**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('planning_cycle','department_operating_hours','department_hours_override','planning_event','tariff_rate_table','employee_payroll_profile','shift_cost_snapshot','change_proposal','public_holiday','planning_factors','adjustment_factors','regulatory_framework','framework_rule','framework_trigger','workspace_framework_binding','workspace_rule_override','workspace_trigger_override');"`
Expected: 17 rows.

- [ ] **Step 4: Run full typecheck**

Run: `cd /home/sxtnl/dev/wt-2 && pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 5: Run all cascade tests**

Run: `cd /home/sxtnl/dev/wt-2 && npx vitest run apps/web/src/lib/cascade/`
Expected: 28 tests pass.

- [ ] **Step 6: Update STATE.md migration inventory**

Add the 7 new migrations to STATE.md Section 6 (Migration Inventory).

- [ ] **Step 7: Write ADR**

Create `docs/decisions/NNNN-cascade-core-foundation-schema.md` documenting:

- Decision to use A1/A2/A3 migration tiers
- Decision to drop `season.is_active` (use existing `status` enum)
- Decision to add `workspace_id`/timestamps to `schedule_template_shift`
- Decision to keep `schedule_template.department` TEXT alongside new FK
- Decision that cascade operates as independent layer emitting to event engine

Register in `docs/decisions/0000-decision-log.md`.
