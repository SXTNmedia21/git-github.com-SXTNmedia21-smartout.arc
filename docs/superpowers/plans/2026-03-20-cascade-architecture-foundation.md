# Cascade Architecture Foundation — Implementation Plan (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire six disconnected CRUD apps into one reactive state machine. Replace three operating hours systems with one. Add year wheel, event tracking, cascade engine, and operating hours CRUD — from investigation to production-ready foundation.

**Architecture:** Reactive dataflow DAG (spreadsheet model) + Terraform plan/apply UX (cascade-preview → confirm → cascade-apply) + event-sourced audit (change_proposal + activity_trail). All derived artifacts (shifts, sessions, hooks) are recomputable from the declarative source of truth.

**Tech Stack:** PostgreSQL 17 (Supabase), TypeScript, TanStack Query, shadcn/ui, Framer Motion, Hono (engine-dispatch Edge Function)

**Key docs:**

- `docs/cascade-spreadsheet-overview.md` — CANONICAL: Five Dimensions, waterfall layers, Riksavtalen rates, compliance enforcement, schema gaps
- `docs/INVESTIGATION_OPERATING_HOURS_CORE_STRUCTURE.md` — full investigation + design decisions
- `docs/handoffs/2026-03-20-cascade-plan-revision.md` — revision mission + locked decisions
- `.claude/projects/-home-sxtnl-dev-smartout-ai/memory/project_cascade_architecture.md` — all locked decisions
- `CLAUDE.md` — project conventions, migration workflow, RLS patterns
- `docs/agents/frontend-design/INSTRUCTION.md` — UI design principles ("Ren och varm" aesthetic)
- `docs/agents/SHARED_DESIGN_PRINCIPLES.md` — shared design principles (web + mobile)

**Naming decisions:**

- New operating hours table: `department_operating_hours` (two tables, not combined with discriminator)
- Override table: `department_hours_override`
- Season status enum values: `draft | ready | archived` (NOT `active`)
- Year wheel table: `planning_cycle`
- Events table: `planning_event`
- Cascade preview: `change_proposal`

**Investigation results incorporated:**

- Engine dispatch: single `switch` in `executeStep()`, 15 existing action_types, service role client, `advanceToNextStep()` pattern
- Push notifications: PG function `dispatch_push_notification()` via `pg_net` → `push-dispatch` EF → Expo. Call via `supabase.rpc()`.
- Activity trail: `data` + `changes` JSONB (NOT `metadata`). Written via `emit()` pipeline only. 37 entity types.
- Realtime: `schedule_shift` has realtime; `department_session` and `department_operating_hours` do NOT. 350ms debounced invalidation.

---

## File Structure

### Phase 0 — Extended Schema (NEW)

| File                                                              | Responsibility                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/20260420090000_enable_btree_gist.sql`        | Enable btree_gist extension for exclusion constraints     |
| `supabase/migrations/20260420090100_planning_cycle.sql`           | Year wheel container table                                |
| `supabase/migrations/20260420090200_season_planning_cycle_fk.sql` | Add planning_cycle_id FK to season + exclusion constraint |
| `supabase/migrations/20260420090300_planning_event.sql`           | Events/happenings table (demand modifiers)                |
| `supabase/migrations/20260420090400_change_proposal.sql`          | Persisted cascade preview (Terraform saved plan)          |
| `supabase/migrations/20260420090500_planning_factors.sql`         | Planned vs actual tracking                                |
| `supabase/migrations/20260420090600_adjustment_factors.sql`       | EWMA learning state                                       |

### Phase 1 — Cascade Schema (existing, revised)

| File                                                                      | Responsibility                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `supabase/migrations/20260420100000_cascade_enums.sql`                    | New enums: department_type, shift_function, anchor_type      |
| `supabase/migrations/20260420100100_season_model_refinement.sql`          | Rename season_status active→ready, add is_active boolean     |
| `supabase/migrations/20260420100200_department_classification.sql`        | Add department_type column to department table               |
| `supabase/migrations/20260420100300_department_operating_hours.sql`       | New table + RLS + indexes                                    |
| `supabase/migrations/20260420100400_department_hours_override.sql`        | New table + RLS + indexes                                    |
| `supabase/migrations/20260420100500_template_shift_anchors.sql`           | Add anchor system to schedule_template_shift                 |
| `supabase/migrations/20260420100600_department_session_planned_times.sql` | Add planned_open/planned_close to department_session         |
| `supabase/migrations/20260420100700_schedule_shift_structural_fks.sql`    | Add department_id + location_id to schedule_shift + backfill |
| `supabase/migrations/20260420100800_schedule_template_department_fk.sql`  | Add department_id FK to schedule_template                    |
| `supabase/migrations/20260420100900_seed_cascade_engine_process.sql`      | Seed operating_hours_cascade engine process                  |
| `supabase/migrations/20260420101000_realtime_cascade_tables.sql`          | Add cascade tables to supabase_realtime publication          |
| `supabase/migrations/20260420101100_deprecate_old_operating_hours.sql`    | Comment + soft-deprecate old tables                          |

### Phase 2 — Core Logic

| File                                                  | Responsibility                                          |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `apps/web/src/lib/cascade/types.ts`                   | Shared types for cascade system                         |
| `apps/web/src/lib/cascade/resolve-effective-hours.ts` | Pure function: resolve hours for (dept, location, date) |
| `apps/web/src/lib/cascade/compute-anchored-shift.ts`  | Pure function: compute shift times from anchor + hours  |
| `packages/telemetry/src/registry.ts`                  | Add cascade event types                                 |

### Phase 3 — Operating Hours CRUD

| File                                                                            | Responsibility                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/web/src/app/dashboard/settings/_hooks/use-department-hours.ts`            | TanStack Query hook for department_operating_hours CRUD |
| `apps/web/src/app/dashboard/settings/_hooks/use-hours-override.ts`              | TanStack Query hook for department_hours_override CRUD  |
| `apps/web/src/app/dashboard/settings/_components/department-hours-settings.tsx` | New operating hours UI per department/season            |

### Phase 4 — Cascade Engine

| File                                          | Responsibility                                         |
| --------------------------------------------- | ------------------------------------------------------ |
| `supabase/functions/cascade-preview/index.ts` | Edge Function: dry-run cascade, returns CascadePreview |
| `supabase/functions/cascade-apply/index.ts`   | Edge Function: execute cascade transactionally         |
| `supabase/functions/engine-dispatch/index.ts` | Add 6 new action_type case blocks                      |

### Phase 5 — Year Wheel & Events CRUD

| File                                                                  | Responsibility                              |
| --------------------------------------------------------------------- | ------------------------------------------- |
| `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts`     | TanStack Query hook for planning_cycle CRUD |
| `apps/web/src/app/dashboard/season/_hooks/use-planning-events.ts`     | TanStack Query hook for planning_event CRUD |
| `apps/web/src/app/dashboard/season/_components/YearWheelView.tsx`     | Year wheel timeline component               |
| `apps/web/src/app/dashboard/season/_components/EventCalendarTab.tsx`  | Event calendar view                         |
| `apps/web/src/app/dashboard/season/_components/PlanningCycleForm.tsx` | Create/edit planning cycle                  |

### Phase 6 — Cascade UI

| File                                                                        | Responsibility                            |
| --------------------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/cascade-preview-modal.tsx` | Terraform-style diff preview              |
| `apps/web/src/app/dashboard/schedule/_components/vaktlista-view.tsx`        | Column-based simulation surface           |
| `apps/web/src/app/dashboard/schedule/_components/template-shift-editor.tsx` | Template shift anchor editor              |
| `apps/web/src/app/dashboard/schedule/_hooks/use-cascade-realtime.ts`        | Realtime subscriptions for cascade tables |

### Phase 7 — Bootstrap Engine

| File                                                | Responsibility                                   |
| --------------------------------------------------- | ------------------------------------------------ |
| `apps/web/src/lib/cascade/bootstrap-pipeline.ts`    | Industry JSON → cascade engine → real DB records |
| `apps/web/src/lib/industry/packages/hospitality.ts` | Extended with operating hours + template shifts  |

### Phase 8 — Integration & Verification

| File | Responsibility                                 |
| ---- | ---------------------------------------------- |
| All  | Type check, migration reset, full verification |

---

## Phase 0: Extended Schema (Year Wheel + Events + Change Proposals + Learning Loop)

### Task 0.1: Enable btree_gist Extension

**Files:**

- Create: `supabase/migrations/20260420090000_enable_btree_gist.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090000_enable_btree_gist.sql
-- Enable btree_gist for EXCLUDE USING gist constraints.
-- Required for: planning_cycle date range non-overlap,
--               season date range non-overlap within a cycle.
-- ============================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090000_enable_btree_gist.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420090000_enable_btree_gist.sql
git commit -m "feat(db): enable btree_gist extension for exclusion constraints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.2: Planning Cycle Table (Year Wheel Container)

**Files:**

- Create: `supabase/migrations/20260420090100_planning_cycle.sql`

**Context:** A planning cycle is the year wheel — a container for seasons. One cycle per year per workspace. Seasons within a cycle must tile the full range with no gaps and no overlaps.

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090100_planning_cycle.sql
-- Year wheel container. One cycle per planning period (typically annual).
-- Seasons are children of a planning_cycle.
-- ============================================

CREATE TYPE planning_cycle_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE IF NOT EXISTS public.planning_cycle (
  planning_cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  name              TEXT NOT NULL,                -- "2026", "2026/2027"
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  total_revenue_target NUMERIC(12,2),            -- optional revenue goal for the cycle
  status            planning_cycle_status NOT NULL DEFAULT 'draft',
  created_by        UUID REFERENCES profile(profile_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_cycle_dates CHECK (end_date > start_date),

  -- No overlapping cycles within a workspace
  CONSTRAINT excl_cycle_no_overlap
    EXCLUDE USING gist (
      workspace_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    )
);

CREATE TRIGGER set_planning_cycle_updated_at
  BEFORE UPDATE ON public.planning_cycle
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_planning_cycle_workspace ON planning_cycle (workspace_id);
CREATE INDEX idx_planning_cycle_dates ON planning_cycle (workspace_id, start_date, end_date);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE planning_cycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_planning_cycle" ON planning_cycle
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_write_planning_cycle" ON planning_cycle
  FOR ALL USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "api_key_read_planning_cycle" ON planning_cycle
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

COMMENT ON TABLE planning_cycle IS
  'Year wheel container. One per planning period (typically annual). Contains seasons that tile the full date range.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090100_planning_cycle.sql
```

- [ ] **Step 3: Verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE tablename = 'planning_cycle';"
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT conname FROM pg_constraint WHERE conname = 'excl_cycle_no_overlap';"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420090100_planning_cycle.sql
git commit -m "feat(db): create planning_cycle table — year wheel container

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.3: Add planning_cycle_id FK to Season + Exclusion Constraint

**Files:**

- Create: `supabase/migrations/20260420090200_season_planning_cycle_fk.sql`

**Context:** Seasons are children of a planning_cycle. Within a cycle, season date ranges must not overlap (enforced by EXCLUDE USING gist).

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090200_season_planning_cycle_fk.sql
-- Link seasons to planning_cycle. Enforce non-overlapping
-- season date ranges within the same cycle.
-- ============================================

ALTER TABLE season
  ADD COLUMN IF NOT EXISTS planning_cycle_id UUID
    REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL;

-- Seasons within the same cycle must not overlap
-- Only applies to seasons that have both dates and a cycle
ALTER TABLE season
  ADD CONSTRAINT excl_season_no_overlap_in_cycle
    EXCLUDE USING gist (
      planning_cycle_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    )
    WHERE (planning_cycle_id IS NOT NULL AND start_date IS NOT NULL AND end_date IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_season_planning_cycle
  ON season (planning_cycle_id)
  WHERE planning_cycle_id IS NOT NULL;

COMMENT ON COLUMN season.planning_cycle_id IS
  'FK to planning_cycle — which year wheel this season belongs to. NULL for legacy/unassigned seasons.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090200_season_planning_cycle_fk.sql
```

- [ ] **Step 3: Verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'season' AND column_name = 'planning_cycle_id';"
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT conname FROM pg_constraint WHERE conname = 'excl_season_no_overlap_in_cycle';"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420090200_season_planning_cycle_fk.sql
git commit -m "feat(db): add planning_cycle_id FK to season + non-overlap constraint

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.4: Planning Event Table (Demand Modifiers)

**Files:**

- Create: `supabase/migrations/20260420090300_planning_event.sql`

**Context:** Events that affect demand: festivals, holidays, weather, internal events, recurring cultural dates. Scraped from municipality calendars, Norwegian cultural calendar, weather APIs, booking integrations.

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090300_planning_event.sql
-- Events/happenings that affect demand.
-- External scraped, cultural/commercial, internal, weather, recurring.
-- Linked to planning_cycle. Optional hours override link.
-- ============================================

CREATE TYPE planning_event_category AS ENUM (
  'external_scraped',       -- local festivals, concerts, cruise arrivals
  'cultural_commercial',    -- Kanelbollens dag, Morsdag, 17. mai, Black Friday
  'internal',               -- julbord bookings, private events
  'weather',                -- weather forecasts, seasonal weather patterns
  'recurring'               -- weekly/monthly patterns seeded from cultural calendar
);

CREATE TYPE planning_event_source AS ENUM (
  'manual',                 -- admin entered
  'scraped_municipality',   -- local municipality calendar
  'scraped_cultural',       -- Norwegian cultural calendar
  'weather_api',            -- weather forecast service
  'booking_integration',    -- from booking system
  'historical_import'       -- imported from previous year/system
);

CREATE TABLE IF NOT EXISTS public.planning_event (
  planning_event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  planning_cycle_id   UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  category            planning_event_category NOT NULL,
  source              planning_event_source NOT NULL DEFAULT 'manual',
  event_date          DATE NOT NULL,
  end_date            DATE,                              -- NULL = single-day event
  demand_multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0, -- 1.5 = 50% more demand
  expected_covers     INTEGER,                           -- expected guests/covers
  confidence          NUMERIC(3,2) DEFAULT 0.5,          -- 0.0-1.0, how sure are we
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule     TEXT,                              -- iCal RRULE format
  external_source_url TEXT,                              -- link to source
  hours_override_id   UUID,                              -- FK to department_hours_override (set later)
  created_by          UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_planning_event_updated_at
  BEFORE UPDATE ON public.planning_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_planning_event_workspace ON planning_event (workspace_id);
CREATE INDEX idx_planning_event_cycle ON planning_event (planning_cycle_id);
CREATE INDEX idx_planning_event_date ON planning_event (workspace_id, event_date);
CREATE INDEX idx_planning_event_category ON planning_event (workspace_id, category);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE planning_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_planning_event" ON planning_event
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_write_planning_event" ON planning_event
  FOR ALL USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "api_key_read_planning_event" ON planning_event
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

COMMENT ON TABLE planning_event IS
  'Events and happenings that affect demand. Festivals, holidays, weather, internal events, recurring cultural dates. Linked to planning_cycle.';

COMMENT ON COLUMN planning_event.demand_multiplier IS
  '1.0 = normal demand. 1.5 = 50% increase. 0.5 = 50% decrease. Used by cascade engine to adjust staffing.';

COMMENT ON COLUMN planning_event.confidence IS
  '0.0 = uncertain guess. 1.0 = confirmed booking. Higher confidence = more weight in staffing calculation.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090300_planning_event.sql
```

- [ ] **Step 3: Verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE tablename = 'planning_event';"
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT policyname FROM pg_policies WHERE tablename = 'planning_event' ORDER BY policyname;"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420090300_planning_event.sql
git commit -m "feat(db): create planning_event table — demand modifiers for year wheel

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.5: Change Proposal Table (Persisted Cascade Preview)

**Files:**

- Create: `supabase/migrations/20260420090400_change_proposal.sql`

**Context:** Terraform "saved plan". When a user previews cascade effects, the result is stored as an immutable artifact. If they confirm, the proposal is marked applied. This provides full audit trail of what was shown vs what was executed.

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090400_change_proposal.sql
-- Persisted cascade preview — the "Terraform saved plan".
-- Immutable once created. Applied = the user confirmed.
-- ============================================

CREATE TYPE change_proposal_status AS ENUM (
  'pending',     -- preview generated, awaiting user decision
  'applied',     -- user confirmed, cascade executed
  'rejected',    -- user cancelled
  'expired'      -- timed out without decision
);

CREATE TYPE cascade_trigger_layer AS ENUM (
  'operating_hours',   -- hours changed
  'season_transition', -- season activated/deactivated
  'template_change',   -- template shift modified
  'event_added',       -- planning event created/modified
  'manual_override'    -- admin forced cascade
);

CREATE TABLE IF NOT EXISTS public.change_proposal (
  change_proposal_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  initiated_by        UUID NOT NULL REFERENCES profile(profile_id),
  trigger_layer       cascade_trigger_layer NOT NULL,
  trigger_entity_type TEXT NOT NULL,               -- e.g. "department_operating_hours"
  trigger_entity_id   UUID,                        -- FK to the entity that triggered cascade
  status              change_proposal_status NOT NULL DEFAULT 'pending',
  changes             JSONB NOT NULL DEFAULT '{}', -- what the user proposed to change
  preview             JSONB NOT NULL DEFAULT '{}', -- full CascadePreview result
  risk_score          NUMERIC(3,2),                -- 0.0 = safe, 1.0 = risky
  affected_employee_count INTEGER DEFAULT 0,
  affected_shift_count    INTEGER DEFAULT 0,
  conflict_count          INTEGER DEFAULT 0,
  applied_at          TIMESTAMPTZ,                 -- when cascade was executed
  expires_at          TIMESTAMPTZ,                 -- auto-expire pending proposals
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_change_proposal_updated_at
  BEFORE UPDATE ON public.change_proposal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_change_proposal_workspace ON change_proposal (workspace_id);
CREATE INDEX idx_change_proposal_status ON change_proposal (workspace_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_change_proposal_initiator ON change_proposal (initiated_by);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE change_proposal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_change_proposal" ON change_proposal
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_write_change_proposal" ON change_proposal
  FOR ALL USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

COMMENT ON TABLE change_proposal IS
  'Persisted cascade preview — Terraform saved plan. Immutable snapshot of what cascade-preview returned. Applied when user confirms. Full audit trail.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090400_change_proposal.sql
```

- [ ] **Step 3: Verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT tablename FROM pg_tables WHERE tablename = 'change_proposal';"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420090400_change_proposal.sql
git commit -m "feat(db): create change_proposal table — persisted cascade preview

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.6: Planning Factors Table (Planned vs Actual Tracking)

**Files:**

- Create: `supabase/migrations/20260420090500_planning_factors.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090500_planning_factors.sql
-- Planned vs actual tracking for the learning loop.
-- Records what we planned for each period and what actually happened.
-- ============================================

CREATE TABLE IF NOT EXISTS public.planning_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id       UUID REFERENCES season(season_id) ON DELETE SET NULL,
  factor_type     TEXT NOT NULL,           -- 'revenue', 'covers', 'labor_hours', 'labor_cost'
  dimension       TEXT NOT NULL,           -- 'weekday:1', 'hour:14', 'department:uuid', 'event:uuid'
  period_date     DATE NOT NULL,
  planned_value   NUMERIC(12,2) NOT NULL,
  actual_value    NUMERIC(12,2),
  variance_pct    NUMERIC(6,2)             -- computed: (actual - planned) / planned * 100
    GENERATED ALWAYS AS (
      CASE WHEN planned_value != 0 AND actual_value IS NOT NULL
        THEN ((actual_value - planned_value) / planned_value * 100)
        ELSE NULL
      END
    ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_planning_factor UNIQUE (workspace_id, factor_type, dimension, period_date)
);

CREATE TRIGGER set_planning_factors_updated_at
  BEFORE UPDATE ON public.planning_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_planning_factors_lookup
  ON planning_factors (workspace_id, factor_type, period_date);

ALTER TABLE planning_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_planning_factors" ON planning_factors
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_write_planning_factors" ON planning_factors
  FOR ALL USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

COMMENT ON TABLE planning_factors IS
  'Planned vs actual tracking. Records forecasts and actuals for revenue, covers, labor. Feeds the EWMA learning loop.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090500_planning_factors.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420090500_planning_factors.sql
git commit -m "feat(db): create planning_factors table — planned vs actual tracking

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 0.7: Adjustment Factors Table (EWMA Learning State)

**Files:**

- Create: `supabase/migrations/20260420090600_adjustment_factors.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420090600_adjustment_factors.sql
-- EWMA learning state. Exponential smoothing that converges
-- in 3-5 cycles. No ML needed.
-- Formula: F(t+1) = F(t) + alpha * [A(t) - F(t)]
-- ============================================

CREATE TABLE IF NOT EXISTS public.adjustment_factors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  season_id         UUID REFERENCES season(season_id) ON DELETE SET NULL,
  factor_type       TEXT NOT NULL,           -- 'revenue', 'covers', 'labor_hours'
  dimension         TEXT NOT NULL,           -- 'weekday:1', 'hour:14', 'department:uuid'
  adjustment_ratio  NUMERIC(6,4) NOT NULL DEFAULT 1.0,  -- current smoothed ratio
  alpha             NUMERIC(4,3) NOT NULL DEFAULT 0.5,   -- smoothing factor (high = reactive, low = stable)
  observation_count INTEGER NOT NULL DEFAULT 0,
  confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.0,   -- 0.0 = no data, 1.0 = converged
  last_actual       NUMERIC(12,2),
  last_planned      NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_adjustment_factor UNIQUE (workspace_id, season_id, factor_type, dimension)
);

CREATE TRIGGER set_adjustment_factors_updated_at
  BEFORE UPDATE ON public.adjustment_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_adjustment_factors_lookup
  ON adjustment_factors (workspace_id, season_id, factor_type);

ALTER TABLE adjustment_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_adjustment_factors" ON adjustment_factors
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "service_write_adjustment_factors" ON adjustment_factors
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE adjustment_factors IS
  'EWMA learning state. Exponential smoothing: F(t+1) = F(t) + alpha * [A(t) - F(t)]. Bootstrap: alpha=0.5 (reactive). Converges after 3-5 cycles, then alpha decreases automatically.';

COMMENT ON COLUMN adjustment_factors.alpha IS
  'Smoothing factor. 0.5 = bootstrap (reactive to new data). Decreases as observation_count grows: alpha = max(0.1, 0.5 / ln(observation_count + 2))';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420090600_adjustment_factors.sql
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420090600_adjustment_factors.sql
git commit -m "feat(db): create adjustment_factors table — EWMA learning state

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1: Cascade Schema (Database Foundation)

### Task 1: Create New Enums

**Files:**

- Create: `supabase/migrations/20260420100000_cascade_enums.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100000_cascade_enums.sql
-- New enums for cascade architecture.
-- ============================================

-- Department classification: determines if department has operating hours
CREATE TYPE department_type AS ENUM ('operational', 'administrative', 'hybrid');

COMMENT ON TYPE department_type IS
  'operational = MUST have operating hours and sessions. administrative = MUST NOT. hybrid = OPTIONAL.';

-- Template shift function: defines relationship to operating hours
CREATE TYPE shift_function AS ENUM (
  'opening',      -- anchored to operating hours open_time
  'closing',      -- anchored to operating hours close_time
  'supporting',   -- fixed time, supports operational peak
  'rush_hour',    -- fixed time, covers demand spike (e.g. lunch)
  'sub_supply'    -- flexible, fills coverage gaps
);

COMMENT ON TYPE shift_function IS
  'Defines how a template shift relates to operating hours. opening/closing auto-adjust when hours change. supporting/rush_hour are fixed.';

-- Anchor type: how a shift time is calculated
CREATE TYPE anchor_type AS ENUM ('fixed', 'open', 'close');

COMMENT ON TYPE anchor_type IS
  'fixed = absolute time. open = relative to operating hours open_time. close = relative to close_time.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420100000_cascade_enums.sql
```

- [ ] **Step 3: Verify enums exist**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT typname FROM pg_type WHERE typname IN ('department_type','shift_function','anchor_type') ORDER BY typname;"
```

Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100000_cascade_enums.sql
git commit -m "feat(db): create cascade enums — department_type, shift_function, anchor_type

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Season Model Refinement

**Files:**

- Create: `supabase/migrations/20260420100100_season_model_refinement.sql`

**Context:** Season currently has `status season_status` with values `draft | active | archived`. We rename `active` → `ready` and add `is_active` boolean.

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100100_season_model_refinement.sql
-- Season model: rename status 'active' → 'ready', add is_active boolean.
-- 'ready' means configuration is complete and usable by cascade.
-- 'is_active' means this is the currently live season (date-based).
-- Only ONE season per workspace can be is_active = true at any time.
-- ============================================

ALTER TYPE season_status RENAME VALUE 'active' TO 'ready';

ALTER TABLE season ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- Only one active season per workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_active_per_workspace
  ON season (workspace_id)
  WHERE is_active = true;

COMMENT ON COLUMN season.is_active IS
  'TRUE = this is the currently live season for the workspace. Only one per workspace. System-managed via season transition logic.';

COMMENT ON COLUMN season.status IS
  'draft = being configured. ready = complete, usable by cascade. archived = historical, read-only.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260420100100_season_model_refinement.sql
```

- [ ] **Step 3: Verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'season_status'::regtype ORDER BY enumsortorder;"
```

Expected: `draft`, `ready`, `archived` (NOT `active`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420100100_season_model_refinement.sql
git commit -m "feat(db): season model — rename status active→ready, add is_active boolean

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Department Classification

**Files:**

- Create: `supabase/migrations/20260420100200_department_classification.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100200_department_classification.sql
-- Add department_type to department table.
-- A Kitchen is always operational. Administration is always administrative.
-- ============================================

ALTER TABLE department ADD COLUMN IF NOT EXISTS department_type department_type NOT NULL DEFAULT 'operational';

COMMENT ON COLUMN department.department_type IS
  'operational = MUST have operating hours. administrative = MUST NOT. hybrid = OPTIONAL.';

CREATE INDEX IF NOT EXISTS idx_department_type ON department (workspace_id, department_type)
  WHERE department_type = 'operational';
```

- [ ] **Step 2: Run + verify + commit** (same pattern as Phase 0 tasks)

---

### Task 4: Department Operating Hours Table

**Files:**

- Create: `supabase/migrations/20260420100300_department_operating_hours.sql`

**Context:** Replaces `operating_hours`, `company_opening_hours`, and `season.opening_hours`. Scoped to (department, location, season, weekday).

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100300_department_operating_hours.sql
-- Consolidated operating hours: one table to rule them all.
-- Scoped to (department, location, season, day_of_week).
-- Replaces: operating_hours, company_opening_hours, season.opening_hours JSONB.
-- ============================================

CREATE TABLE IF NOT EXISTS public.department_operating_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,  -- NULL = all locations
  season_id       UUID NOT NULL REFERENCES season(season_id) ON DELETE CASCADE,
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
  open_time       TIME,         -- NULL when is_closed = true
  close_time      TIME,         -- NULL when is_closed = true
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dept_hours_weekly
    UNIQUE (department_id, location_id, season_id, day_of_week),

  CONSTRAINT chk_hours_valid
    CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

CREATE TRIGGER set_department_operating_hours_updated_at
  BEFORE UPDATE ON public.department_operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_dept_hours_workspace ON department_operating_hours (workspace_id);
CREATE INDEX idx_dept_hours_dept_season ON department_operating_hours (department_id, season_id);
CREATE INDEX idx_dept_hours_lookup ON department_operating_hours (department_id, location_id, season_id, day_of_week);

ALTER TABLE department_operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_department_operating_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_department_operating_hours" ON department_operating_hours
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_department_operating_hours" ON department_operating_hours
  FOR SELECT USING (workspace_id = get_api_workspace_id());

COMMENT ON TABLE department_operating_hours IS
  'Source of truth for when a department operates. Scoped to (dept, location, season, weekday). Replaces operating_hours + company_opening_hours + season.opening_hours JSONB.';
```

- [ ] **Step 2: Run + verify (table + 3 RLS policies) + commit**

---

### Task 5: Department Hours Override Table

**Files:**

- Create: `supabase/migrations/20260420100400_department_hours_override.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100400_department_hours_override.sql
-- Temporal exceptions: holidays, emergency closures, special events.
-- Resolution: override(date) takes priority over default(weekday).
-- ============================================

CREATE TABLE IF NOT EXISTS public.department_hours_override (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  location_id     UUID REFERENCES location(location_id) ON DELETE CASCADE,
  season_id       UUID NOT NULL REFERENCES season(season_id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  open_time       TIME,
  close_time      TIME,
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  reason          TEXT,         -- "Julaften", "Nødstenging", "Privat arrangement"
  planning_event_id UUID REFERENCES planning_event(planning_event_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dept_hours_override UNIQUE (department_id, location_id, override_date),
  CONSTRAINT chk_override_hours_valid CHECK (is_closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

CREATE TRIGGER set_department_hours_override_updated_at
  BEFORE UPDATE ON public.department_hours_override
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_dept_override_workspace ON department_hours_override (workspace_id);
CREATE INDEX idx_dept_override_lookup ON department_hours_override (department_id, location_id, override_date);
CREATE INDEX idx_dept_override_date_range ON department_hours_override (override_date);

ALTER TABLE department_hours_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_department_hours_override" ON department_hours_override
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_department_hours_override" ON department_hours_override
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "api_key_read_department_hours_override" ON department_hours_override
  FOR SELECT USING (workspace_id = get_api_workspace_id());

COMMENT ON TABLE department_hours_override IS
  'Date-specific overrides for operating hours. Holidays, emergencies, special events. Takes priority over weekly hours. Optionally linked to a planning_event.';
```

- [ ] **Step 2: Run + verify + commit**

---

### Task 6: Template Shift Anchor System

**Files:**

- Create: `supabase/migrations/20260420100500_template_shift_anchors.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100500_template_shift_anchors.sql
-- Add anchor system to schedule_template_shift.
-- opening/closing shifts auto-adjust to operating hours.
-- supporting/rush_hour shifts keep fixed times.
-- ============================================

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS shift_function shift_function NOT NULL DEFAULT 'supporting';

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_anchor_type anchor_type NOT NULL DEFAULT 'fixed';

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_offset_min INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_anchor_type anchor_type NOT NULL DEFAULT 'fixed';

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_offset_min INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS slot_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS label TEXT;

COMMENT ON COLUMN schedule_template_shift.shift_function IS
  'opening/closing = anchored to operating hours, auto-adjust. supporting/rush_hour = fixed times. sub_supply = computed.';

COMMENT ON COLUMN schedule_template_shift.start_anchor_type IS
  'fixed = use start_time directly. open = start_time + start_offset_min from dept open. close = start_time + start_offset_min from dept close.';

COMMENT ON COLUMN schedule_template_shift.slot_order IS
  'Display order in vaktlista view. Lower = leftmost column.';

COMMENT ON COLUMN schedule_template_shift.label IS
  'Human-readable label: "Åpningsvakt Kjøkken", "Lunsj rush", "Stengingsvakt".';

CREATE INDEX IF NOT EXISTS idx_template_shift_order
  ON schedule_template_shift (template_id, slot_order);
```

- [ ] **Step 2: Run + verify (7 new columns) + commit**

---

### Task 7: Department Session Planned Times

**Files:**

- Create: `supabase/migrations/20260420100600_department_session_planned_times.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_open TIME;

ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_close TIME;

COMMENT ON COLUMN department_session.planned_open IS
  'Planned opening time from department_operating_hours. Set at session creation. opened_at tracks actual.';

COMMENT ON COLUMN department_session.planned_close IS
  'Planned closing time from department_operating_hours. Set at session creation. closed_at tracks actual.';

CREATE INDEX IF NOT EXISTS idx_dept_session_upcoming
  ON department_session (department_id, session_date)
  WHERE status = 'upcoming';
```

- [ ] **Step 2: Run + verify + commit**

---

### Task 8: Schedule Shift Structural FKs + Backfill

**Files:**

- Create: `supabase/migrations/20260420100700_schedule_shift_structural_fks.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES location(location_id) ON DELETE SET NULL;

-- Backfill department_id from position
UPDATE schedule_shift ss
SET department_id = p.department_id
FROM position p
WHERE ss.position_id = p.position_id
  AND ss.department_id IS NULL
  AND p.department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_department ON schedule_shift (department_id, shift_date)
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shift_location ON schedule_shift (location_id)
  WHERE location_id IS NOT NULL;

COMMENT ON COLUMN schedule_shift.department_id IS
  'Direct FK to department. Backfilled from position.department_id. Used for cascade targeting.';
```

- [ ] **Step 2: Run + verify + commit**

---

### Task 9: Schedule Template Department FK

**Files:**

- Create: `supabase/migrations/20260420100800_schedule_template_department_fk.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

ALTER TABLE schedule_template
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

-- Backfill from department name match
UPDATE schedule_template st
SET department_id = d.department_id
FROM department d
WHERE st.workspace_id = d.workspace_id
  AND lower(trim(st.department)) = lower(trim(d.name))
  AND st.department_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_template_dept
  ON schedule_template (department_id) WHERE department_id IS NOT NULL;
```

- [ ] **Step 2: Run + verify + commit**

---

### Task 10: Seed Cascade Engine Process

**Files:**

- Create: `supabase/migrations/20260420100900_seed_cascade_engine_process.sql`

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420100900_seed_cascade_engine_process.sql
-- Seeds the operating_hours_cascade engine process.
-- 6-step pipeline: resolve → recompute → detect → recalc sessions → recalc hooks → notify.
-- ============================================

INSERT INTO engine_process (id, name, description) VALUES
('operating_hours_cascade', 'Operating Hours Cascade',
 'Cascades operating hours changes through the system. 6-step pipeline with simulation and execution modes.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES
('operating_hours_cascade', 1, NULL, 'resolve_effective_hours', '{
  "description": "For each affected date, resolve override OR default weekly hours"
}', null),
('operating_hours_cascade', 2, NULL, 'recompute_anchored_shifts', '{
  "description": "Recalculate start/end times for shifts with anchor_type != fixed",
  "skip_manually_overridden": true
}', null),
('operating_hours_cascade', 3, NULL, 'detect_shift_conflicts', '{
  "description": "Flag shifts that were manually edited and would be affected",
  "conflict_action": "flag_for_review"
}', null),
('operating_hours_cascade', 4, NULL, 'recalc_session_times', '{
  "description": "Update planned_open and planned_close on upcoming department_sessions"
}', null),
('operating_hours_cascade', 5, NULL, 'recalc_hook_times', '{
  "description": "Recompute absolute fire times from hook offsets + new planned times"
}', null),
('operating_hours_cascade', 6, NULL, 'cascade_notify', '{
  "description": "Push notifications to employees whose shifts changed by > 15 min",
  "threshold_minutes": 15
}', null)
ON CONFLICT (process_id, step_order) DO NOTHING;

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'operating_hours.changed', 'operating_hours_cascade', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'operating_hours.changed' AND process_id = 'operating_hours_cascade'
);
```

- [ ] **Step 2: Run + verify (1 process, 6 steps, 1 trigger) + commit**

---

### Task 11: Enable Realtime for Cascade Tables

**Files:**

- Create: `supabase/migrations/20260420101000_realtime_cascade_tables.sql`

**Context:** Investigation found `schedule_shift` has realtime but `department_session` and `department_operating_hours` do NOT. Add them + `change_proposal` for live cascade updates.

- [ ] **Step 1: Write migration**

```sql
SET search_path TO public, extensions;

-- ============================================
-- 20260420101000_realtime_cascade_tables.sql
-- Add cascade-relevant tables to supabase_realtime publication.
-- Enables live UI updates when cascade engine modifies data.
-- ============================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.department_operating_hours;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.department_hours_override;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.department_session;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.change_proposal;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 2: Run + verify + commit**

---

### Task 12: Deprecate Old Operating Hours + Regenerate Types

**Files:**

- Create: `supabase/migrations/20260420101100_deprecate_old_operating_hours.sql`
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Write deprecation migration**

```sql
SET search_path TO public, extensions;

COMMENT ON TABLE operating_hours IS
  'DEPRECATED: Use department_operating_hours instead. Drop after Settings UI is updated.';

COMMENT ON TABLE company_opening_hours IS
  'DEPRECATED: Was signup-only. Use department_operating_hours instead.';

COMMENT ON COLUMN season.opening_hours IS
  'DEPRECATED: JSONB opening hours per department. Use department_operating_hours table instead.';
```

- [ ] **Step 2: Regenerate TypeScript types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 3: Type check (note errors for Phase 8 fix)**

```bash
pnpm turbo typecheck 2>&1 | tail -30
```

- [ ] **Step 4: Commit both**

---

## Phase 2: Core Logic (Pure Functions + Telemetry)

### Task 13: Cascade Type Definitions

**Files:**

- Create: `apps/web/src/lib/cascade/types.ts`

- [ ] **Step 1: Write types**

```typescript
import type { Database } from "@smartout/supabase";

type Tables = Database["public"]["Tables"];

export type DepartmentOperatingHoursRow = Tables["department_operating_hours"]["Row"];
export type DepartmentHoursOverrideRow = Tables["department_hours_override"]["Row"];
export type PlanningCycleRow = Tables["planning_cycle"]["Row"];
export type PlanningEventRow = Tables["planning_event"]["Row"];
export type ChangeProposalRow = Tables["change_proposal"]["Row"];

/** Resolved effective hours for a specific department + date */
export type EffectiveHours = {
  departmentId: string;
  locationId: string | null;
  date: string;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  source: "override" | "weekly";
  overrideReason?: string;
};

/** Anchor computation input */
export type AnchorInput = {
  anchorType: "fixed" | "open" | "close";
  offsetMin: number;
  fixedTime: string;
};

/** Computed shift time from anchor + operating hours */
export type ComputedShiftTime = {
  time: string;
  source: "fixed" | "anchored";
  anchorType: "fixed" | "open" | "close";
  offsetMin: number;
};

/** Cascade preview result — stored in change_proposal.preview */
export type CascadePreview = {
  affectedSessions: Array<{
    sessionId: string;
    date: string;
    oldPlannedOpen: string | null;
    oldPlannedClose: string | null;
    newPlannedOpen: string | null;
    newPlannedClose: string | null;
  }>;
  affectedShifts: Array<{
    shiftId: string;
    employeeId: string | null;
    employeeName: string | null;
    oldStartTime: string;
    oldEndTime: string;
    newStartTime: string;
    newEndTime: string;
    status: "adjusted" | "conflict";
    conflictReason?: string;
  }>;
  affectedHooks: Array<{
    hookId: string;
    hookType: string;
    oldFireTime: string;
    newFireTime: string;
  }>;
  notifications: Array<{
    profileId: string;
    name: string;
    reason: string;
  }>;
  riskScore: number;
  totalAffectedEmployees: number;
};
```

- [ ] **Step 2: Commit**

---

### Task 14: Resolve Effective Hours (Pure Function)

**Files:**

- Create: `apps/web/src/lib/cascade/resolve-effective-hours.ts`

- [ ] **Step 1: Write the function** (same as original plan — unchanged, correct)

```typescript
import type {
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
  EffectiveHours,
} from "./types";

/**
 * Resolves effective operating hours for a department on a specific date.
 * Resolution: override(date) > weekly(day_of_week) > closed.
 * Pure function — no DB calls. Caller provides the data.
 */
export function resolveEffectiveHours(
  departmentId: string,
  locationId: string | null,
  date: string,
  weeklyHours: DepartmentOperatingHoursRow[],
  overrides: DepartmentHoursOverrideRow[],
): EffectiveHours {
  const dateObj = new Date(date + "T00:00:00");
  const dayOfWeek = (dateObj.getDay() + 6) % 7;

  // 1. Check override for exact date
  const override = overrides.find(
    (o) =>
      o.department_id === departmentId &&
      (o.location_id === locationId || o.location_id === null) &&
      o.override_date === date,
  );

  if (override) {
    return {
      departmentId,
      locationId,
      date,
      dayOfWeek,
      openTime: override.open_time,
      closeTime: override.close_time,
      isClosed: override.is_closed,
      source: "override",
      overrideReason: override.reason ?? undefined,
    };
  }

  // 2. Check weekly hours (prefer location-specific, fall back to null location)
  const locationSpecific = weeklyHours.find(
    (h) =>
      h.department_id === departmentId &&
      h.location_id === locationId &&
      h.day_of_week === dayOfWeek,
  );

  const locationFallback =
    locationId !== null
      ? weeklyHours.find(
          (h) =>
            h.department_id === departmentId &&
            h.location_id === null &&
            h.day_of_week === dayOfWeek,
        )
      : undefined;

  const weekly = locationSpecific ?? locationFallback;

  if (weekly) {
    return {
      departmentId,
      locationId,
      date,
      dayOfWeek,
      openTime: weekly.open_time,
      closeTime: weekly.close_time,
      isClosed: weekly.is_closed,
      source: "weekly",
    };
  }

  // 3. No match → closed
  return {
    departmentId,
    locationId,
    date,
    dayOfWeek,
    openTime: null,
    closeTime: null,
    isClosed: true,
    source: "weekly",
  };
}
```

- [ ] **Step 2: Commit**

---

### Task 15: Compute Anchored Shift Time (Pure Function)

**Files:**

- Create: `apps/web/src/lib/cascade/compute-anchored-shift.ts`

- [ ] **Step 1: Write the function** (same as original plan — unchanged, correct)

```typescript
import type { AnchorInput, ComputedShiftTime, EffectiveHours } from "./types";

/**
 * Computes a shift time from an anchor definition + operating hours.
 * fixed = fixedTime. open = hours.openTime + offset. close = hours.closeTime + offset.
 */
export function computeAnchoredTime(anchor: AnchorInput, hours: EffectiveHours): ComputedShiftTime {
  if (anchor.anchorType === "fixed") {
    return { time: anchor.fixedTime, source: "fixed", anchorType: "fixed", offsetMin: 0 };
  }

  const baseTime = anchor.anchorType === "open" ? hours.openTime : hours.closeTime;

  if (!baseTime) {
    return {
      time: anchor.fixedTime,
      source: "fixed",
      anchorType: anchor.anchorType,
      offsetMin: anchor.offsetMin,
    };
  }

  return {
    time: addMinutesToTime(baseTime, anchor.offsetMin),
    source: "anchored",
    anchorType: anchor.anchorType,
    offsetMin: anchor.offsetMin,
  };
}

/** Add minutes to a HH:MM time string. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = Math.max(0, h * 60 + m + minutes);
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Commit**

---

### Task 16: Register Cascade Telemetry Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add cascade events to the events registry**

```typescript
// Cascade events
"operating_hours.changed": { destinations: ["engine_event", "activity_trail", "logger"] },
"operating_hours.override_created": { destinations: ["engine_event", "activity_trail", "logger"] },
"operating_hours.override_deleted": { destinations: ["engine_event", "activity_trail", "logger"] },
"cascade.preview_generated": { destinations: ["activity_trail", "logger"] },
"cascade.applied": { destinations: ["engine_event", "activity_trail", "logger", "posthog"] },
"cascade.conflict_detected": { destinations: ["activity_trail", "logger"] },
"planning_cycle.created": { destinations: ["activity_trail", "logger"] },
"planning_cycle.updated": { destinations: ["activity_trail", "logger"] },
"planning_event.created": { destinations: ["activity_trail", "logger"] },
"planning_event.updated": { destinations: ["activity_trail", "logger"] },
"planning_event.deleted": { destinations: ["activity_trail", "logger"] },
```

- [ ] **Step 2: Add entity types to the EntityType union**

Add: `"planning_cycle"`, `"planning_event"`, `"change_proposal"`, `"department_operating_hours"`, `"department_hours_override"`

- [ ] **Step 3: Commit**

---

## Phase 3: Operating Hours CRUD (Frontend)

### Task 17: Department Hours Query Hook

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-department-hours.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/app/dashboard/_hooks/use-workspace";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

type DayHours = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

const DEFAULT_HOURS: DayHours[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: "08:00",
  closeTime: "22:00",
  isClosed: false,
}));

export function useDepartmentHours(
  departmentId: string | undefined,
  seasonId: string | undefined,
  locationId?: string,
) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["department-hours", departmentId, seasonId, locationId],
    enabled: !!workspace && !!departmentId && !!seasonId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("department_operating_hours")
        .select("*")
        .eq("workspace_id", workspace!.workspace_id)
        .eq("department_id", departmentId!)
        .eq("season_id", seasonId!);

      if (locationId) {
        query = query.eq("location_id", locationId);
      } else {
        query = query.is("location_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return DEFAULT_HOURS;

      return data.map((row) => ({
        dayOfWeek: row.day_of_week,
        openTime: row.open_time ?? "08:00",
        closeTime: row.close_time ?? "22:00",
        isClosed: row.is_closed,
      }));
    },
  });
}

export function useSaveDepartmentHours() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      departmentId: string;
      seasonId: string;
      locationId?: string;
      hours: DayHours[];
    }) => {
      const rows = params.hours.map((h) => ({
        workspace_id: workspace!.workspace_id,
        department_id: params.departmentId,
        season_id: params.seasonId,
        location_id: params.locationId ?? null,
        day_of_week: h.dayOfWeek,
        open_time: h.isClosed ? null : h.openTime,
        close_time: h.isClosed ? null : h.closeTime,
        is_closed: h.isClosed,
      }));

      const { error } = await supabase
        .from("department_operating_hours")
        .upsert(rows, { onConflict: "department_id,location_id,season_id,day_of_week" });
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      void emit({
        event: "operating_hours.changed",
        workspace_id: workspace!.workspace_id,
        actor_id: "", // set by emit pipeline
        properties: {
          entity: {
            entity_type: "department_operating_hours",
            entity_id: params.departmentId,
            entity_label: `Dept hours changed`,
          },
          data: { department_id: params.departmentId, season_id: params.seasonId },
        },
      });
      qc.invalidateQueries({
        queryKey: ["department-hours", params.departmentId, params.seasonId],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

---

### Task 18: Hours Override Query Hook

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-hours-override.ts`

- [ ] **Step 1: Write the hook**

- `useHoursOverrides(departmentId, seasonId, locationId?)` — query all overrides
- `useCreateOverride()` — insert mutation, emit `"operating_hours.override_created"`
- `useDeleteOverride()` — delete mutation, emit `"operating_hours.override_deleted"`
- Pattern: same as Task 17, reading from `department_hours_override`

- [ ] **Step 2: Commit**

---

### Task 19: Department Hours Settings Component

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/department-hours-settings.tsx`
- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

**UI Design (from frontend-designer agent — see Phase 6 for detailed wireframes):**

- Department selector (ComboBox, only operational/hybrid departments)
- Season selector (existing SeasonSelector pattern)
- 7-day weekday grid with open/close time inputs + closed toggle (same layout as current OpeningHoursSettings)
- Overrides section below (Card with date picker, time inputs, reason, linked planning_event)
- "Forhåndsvis endringer" button → calls cascade-preview → opens CascadePreviewModal
- Copy hours between seasons (DropdownMenu with season targets)
- Badge when hours differ from previous season

- [ ] **Step 1: Build component following design spec**
- [ ] **Step 2: Swap in settings-tabs.tsx: replace `<OpeningHoursSettings />` with `<DepartmentHoursSettings />`**
- [ ] **Step 3: Commit**

---

## Phase 4: Cascade Engine (Edge Functions + Engine Dispatch)

> **Investigation results applied:** Engine dispatch uses inline `switch/case` blocks in `executeStep()`. Service role client. `advanceToNextStep()` pattern. Push notifications via `supabase.rpc("dispatch_push_notification", {...})`. Activity trail via `emit()` with `data`/`changes` JSONB (NOT `metadata`).

### Task 20: Cascade Preview Edge Function

**Files:**

- Create: `supabase/functions/cascade-preview/index.ts`

**"Affected dates" definition:** All dates from today forward within the active season where:

- A `department_session` exists with `status = 'upcoming'`, OR
- A `schedule_shift` exists with `is_published = true`

**Manual override detection:** A shift is "manually overridden" if `updated_at - created_at > interval '1 minute'`. (Future: add `shift_source` enum column.)

- [ ] **Step 1: Write the Edge Function**

The function:

1. Auth: verify JWT, require admin via `is_admin_in_workspace`
2. Receive: `{ department_id, location_id?, season_id, proposed_hours: [{ day_of_week, open_time, close_time, is_closed }] }`
3. Query affected upcoming sessions and published shifts
4. For each affected date: compute new times, detect conflicts
5. Persist result as `change_proposal` row with status `'pending'`
6. Return `CascadePreview` + `change_proposal_id`

- [ ] **Step 2: Add to config.toml**

```toml
[functions.cascade-preview]
verify_jwt = true
```

- [ ] **Step 3: Commit**

---

### Task 21: Cascade Apply Edge Function

**Files:**

- Create: `supabase/functions/cascade-apply/index.ts`

**Activity trail pattern (corrected from investigation):** Uses `emit()` with `data` + `changes` JSONB fields (NOT `metadata`). Entity ref pattern: `{ entity_type: "department_operating_hours", entity_id: dept_id, entity_label: "..." }`.

**Push notification pattern (from investigation):** Call `supabase.rpc("dispatch_push_notification", { p_event, p_profile_id, p_workspace_id, p_title, p_body, p_data })`.

- [ ] **Step 1: Write the Edge Function**

The function:

1. Receive: `{ change_proposal_id }` — load the pending change_proposal
2. Auth: verify JWT, require admin, verify proposal belongs to workspace
3. UPSERT `department_operating_hours` rows from `change_proposal.changes`
4. For each affected upcoming session date:
   - UPDATE `department_session.planned_open/planned_close`
   - Find shifts with `department_id` match
   - Skip manually edited shifts (add to conflicts array)
   - Recompute anchored shift times, UPDATE
   - Recalculate `session_hook` fire times
5. Emit activity trail entries via `emit()`:
   ```typescript
   void emit({
     event: "cascade.applied",
     workspace_id: workspaceId,
     actor_id: profileId,
     properties: {
       entity: { entity_type: "change_proposal", entity_id: proposalId },
       data: { affected_shifts: count, affected_sessions: count, conflicts: count },
       changes: {
         /* before/after per entity */
       },
     },
   });
   ```
6. For each affected employee with shift time delta > 15 min:
   ```typescript
   await supabase.rpc("dispatch_push_notification", {
     p_event: "cascade.shift_changed",
     p_profile_id: employeeProfileId,
     p_workspace_id: workspaceId,
     p_title: "Vaktendring",
     p_body: `Din vakt ${date} er endret til ${newStart}–${newEnd}`,
     p_data: { shift_id: shiftId, change_proposal_id: proposalId },
   });
   ```
7. Update `change_proposal.status = 'applied'`, set `applied_at`
8. Return: `{ applied: true, conflicts: [...], affected_count: N }`

- [ ] **Step 2: Add to config.toml**

```toml
[functions.cascade-apply]
verify_jwt = true
```

- [ ] **Step 3: Commit**

---

### Task 22: Add Cascade Action Handlers to Engine Dispatch

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

**Pattern (from investigation):** Add `case` blocks inside the `switch` in `executeStep()` (line 535). Each handler receives `supabase` (service role), `state` (engine_state row), `step` (engine_step row). Auto-advancing handlers call `await advanceToNextStep(supabase, state, step)` at the end.

- [ ] **Step 1: Add 6 new case blocks**

```typescript
case "resolve_effective_hours": {
  const ctx = state.context as Record<string, unknown>;
  const departmentId = ctx.department_id as string;
  const seasonId = ctx.season_id as string;
  const affectedDates = ctx.affected_dates as string[];

  // Query department_operating_hours + department_hours_override
  const { data: weeklyHours } = await supabase
    .from("department_operating_hours")
    .select("*")
    .eq("department_id", departmentId)
    .eq("season_id", seasonId);

  const { data: overrides } = await supabase
    .from("department_hours_override")
    .select("*")
    .eq("department_id", departmentId)
    .in("override_date", affectedDates);

  // Store resolved hours in state context for next steps
  // (resolveEffectiveHours is a pure function — import or inline)
  await advanceToNextStep(supabase, state, step);
  break;
}

case "recompute_anchored_shifts": {
  // Query schedule_shift + schedule_template_shift for anchored shifts
  // Recompute times using computeAnchoredTime
  // Skip manually overridden (updated_at - created_at > 1 min)
  // UPDATE schedule_shift start_time/end_time
  await advanceToNextStep(supabase, state, step);
  break;
}

case "detect_shift_conflicts": {
  // Query shifts that were manually edited AND affected by cascade
  // Add to state.context.conflicts array
  await advanceToNextStep(supabase, state, step);
  break;
}

case "recalc_session_times": {
  // UPDATE department_session.planned_open/planned_close for upcoming sessions
  await advanceToNextStep(supabase, state, step);
  break;
}

case "recalc_hook_times": {
  // Query session_hook for affected sessions
  // Recompute absolute fire times from hook trigger_offset_min + new planned times
  await advanceToNextStep(supabase, state, step);
  break;
}

case "cascade_notify": {
  const ap = step.action_payload as Record<string, unknown>;
  const thresholdMin = (ap.threshold_minutes as number) ?? 15;
  const ctx = state.context as Record<string, unknown>;
  const affectedEmployees = ctx.affected_employees as Array<{
    profile_id: string; shift_date: string; new_start: string; new_end: string;
  }>;

  for (const emp of affectedEmployees ?? []) {
    await supabase.rpc("dispatch_push_notification", {
      p_event: "cascade.shift_changed",
      p_profile_id: emp.profile_id,
      p_workspace_id: state.workspace_id,
      p_title: "Vaktendring",
      p_body: `Din vakt ${emp.shift_date} er endret til ${emp.new_start}–${emp.new_end}`,
      p_data: { entity_id: state.entity_id },
    });
  }
  await advanceToNextStep(supabase, state, step);
  break;
}
```

- [ ] **Step 2: Commit**

---

## Phase 5: Year Wheel & Events CRUD

### Task 23: Planning Cycle Hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-planning-cycles.ts`

- [ ] **Step 1: Write the hook**

- `usePlanningCycles()` — query all cycles for workspace, ordered by start_date desc
- `useCreatePlanningCycle()` — insert mutation, emit `"planning_cycle.created"`
- `useUpdatePlanningCycle()` — update mutation, emit `"planning_cycle.updated"`
- `useActivePlanningCycle()` — query the active cycle (status = 'active')

- [ ] **Step 2: Commit**

---

### Task 24: Planning Events Hook

**Files:**

- Create: `apps/web/src/app/dashboard/season/_hooks/use-planning-events.ts`

- [ ] **Step 1: Write the hook**

- `usePlanningEvents(cycleId?)` — query events for a cycle, ordered by event_date
- `useCreatePlanningEvent()` — insert mutation, emit `"planning_event.created"`
- `useUpdatePlanningEvent()` — update mutation, emit `"planning_event.updated"`
- `useDeletePlanningEvent()` — delete mutation, emit `"planning_event.deleted"`
- `usePlanningEventsByDateRange(startDate, endDate)` — for calendar view

- [ ] **Step 2: Commit**

---

### Task 25: Fix Season Status References

**Files:**

- Search and fix all references to `season_status = 'active'` → `'ready'`

- [ ] **Step 1: Find all references**

```bash
grep -rn "'active'" apps/web/src/ packages/ --include="*.ts" --include="*.tsx" | grep -i season
```

- [ ] **Step 2: Update each reference**
- [ ] **Step 3: Type check**
- [ ] **Step 4: Commit**

---

## Phase 6: Cascade UI (Wireframe-Level Specifications)

> **Design principles:** Follow `docs/agents/frontend-design/INSTRUCTION.md` — "Ren och varm" Scandinavian aesthetic, purposeful warmth, glassmorphism depth, micro-interactions, agent-first design. Ghost cards use existing `border-dashed border-brand-orange/40 bg-brand-orange/[0.06]` pattern.

### Task 26: Cascade Preview Modal

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/cascade-preview-modal.tsx`

**Component tree:**

- `CascadePreviewModal` (shadcn `Dialog`, `max-w-2xl`, `role="alertdialog"`)
  - `DialogHeader` — title "Forhåndsvis endringer" + risk score badge
  - `CascadeSummaryStrip` — 4 metric pills (sessions, shifts, conflicts, notifications) in horizontal bar
  - `CascadeSessionDiff` — scrollable section with `SessionDiffRow` (before→after planned times per date)
  - `CascadeShiftDiff` — scrollable section with `ShiftDiffRow` (employee name, before→after times, status badge)
  - `CascadeConflictList` — orange-tinted section listing manually edited shifts that WON'T auto-adjust
  - `CascadeNotificationPreview` — collapsed section: employees who will be notified
  - `DialogFooter` — "Avbryt" (outline) + "Bekreft endringer" (orange gradient primary)

**Layout:** Vertically stacked, max-h-80vh with internal overflow-y-auto. Summary strip fixed-height at top. Footer pinned bottom.

**Key interactions:**

1. Modal opens with data already available from cascade-preview response (passed as prop)
2. Risk score: computed client-side — `conflicts === 0 ? "low" : conflicts < 3 ? "medium" : "high"`. Colors: low=emerald, medium=orange, high=red
3. Before value: `line-through text-muted-foreground`. After value: `font-semibold text-foreground`. Arrow icon between.
4. "Bekreft" calls cascade-apply → button shows `Loader2 animate-spin` + "Gjennomfører..." → toast on success → close + invalidate
5. Empty state: "Ingen endringer å forhåndsvise" with single "Lukk" button

**Animation:** Tier 2 — `AnimatePresence` entrance with `motion.div initial={{ opacity: 0, scale: 0.95 }}`. Diff rows stagger in with `transition={{ delay: index * 0.03 }}` for cinematic cascade feel.

**Accessibility:** `role="alertdialog"`, initial focus on "Avbryt" (safe default), diff rows have descriptive `aria-label`, risk score not color-dependent.

**Data flow:**

- Input: `CascadePreview` type (prop from cascade-preview response)
- `useCascadeApply()` mutation → calls `cascade-apply` Edge Function
- On success: invalidate `["department-hours"]`, `["shifts"]`, `["sessions"]` query keys

- [ ] **Step 1: Build component following design spec above**
- [ ] **Step 2: Commit**

---

### Task 27: Vaktlista View (Simulation Surface)

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/vaktlista-view.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/vaktlista-slot.tsx`

**Component tree:**

- `VaktlistaView` (new view mode, same level as `GridContent` / `MonthlyView`, selectable from `PlannerCommandBar`)
  - `VaktlistaHeader` — date picker, template selector, department badge, "Bekreft alle (N)" button
  - `VaktlistaGrid` — horizontal column-based layout
    - `VaktlistaSlot` (one column per template_shift, ordered by `slot_order`)
      - Slot header: `label` + shift function badge + computed time range
      - Employee drop zone (droppable via `@dnd-kit`)
      - Confirmed shift cards: reuse existing `ShiftCard` (solid borders)
      - Ghost shift cards: reuse existing `GhostShiftCard` (dashed orange borders)
      - Empty slot indicator: dashed outline when no assignment
  - `VaktlistaUnassigned` — collapsible left sidebar with draggable `EmployeeChip` components

**Layout:** Horizontal columns, each template shift slot = equal-width vertical column, left-to-right by `slot_order`. Sticky headers. `lg:` shows 6 columns, below `lg:` horizontal scroll with snap. Below `md:` stacks vertically.

**Key interactions:**

1. Drag `EmployeeChip` from sidebar → drop into slot → creates ghost card (NOT immediate shift creation)
2. Ghost card approve → `useCreateShift` mutation. Reject → remove from local state.
3. "Bekreft alle" batch-approves all ghost cards. Button shows count badge.
4. Drag between columns → moves assignment between slots
5. Click slot header → opens `TemplateShiftEditor` (Task 29)
6. Agent proposals arrive via `AgentProposalsProvider` as ghost cards in relevant slots

**Animation:** Tier 2 — `@dnd-kit` drag overlay (existing `ScheduleDragOverlay`), ghost cards use existing `walkai-fade-in` keyframe, batch confirm stagger (50ms delay, `transition-all duration-300`).

**Data flow:**

- `useTemplates()` (extended with anchor fields) — template shift structure
- `useShifts()` — existing, filtered to date + department
- `useAgentProposals()` — existing context
- `useDepartmentHours()` — resolve anchored shift times via `computeAnchoredTime()`
- `useCreateShift()` / `useDeleteShift()` — existing mutations

- [ ] **Step 1: Build `VaktlistaSlot` component**
- [ ] **Step 2: Build `VaktlistaView` with grid layout + DnD**
- [ ] **Step 3: Add "Vaktlista" view mode option to `PlannerCommandBar`**
- [ ] **Step 4: Commit**

---

### Task 28: Year Wheel Timeline View

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/YearWheelTab.tsx`
- Create: `apps/web/src/app/dashboard/season/_components/YearWheelTimeline.tsx`

**Component tree:**

- `YearWheelTab` (new tab "Årshjul" in season page tab bar)
  - `PlanningCycleHeader` — cycle name, date range, revenue target, status badge, create/edit controls
  - `YearWheelTimeline` — horizontal scrollable timeline
    - `TimelineAxis` — month labels along top, gridlines for month boundaries
    - `SeasonBlock` (one per season) — colored horizontal bar positioned by dates
      - Season name label, status badge (draft/ready/archived), active glow
    - `PlanningEventMarker` — diamond/pin icons on timeline (tooltip on hover)
    - `TodayIndicator` — vertical orange line, auto-scroll to center on render
  - `YearWheelLegend` — compact legend for season statuses + event categories
  - `SeasonQuickActions` — floating bar when season selected: "Rediger", "Sett som aktiv", "Vis budsjett"

**Layout:** Full-width timeline, months as grid columns. Seasons as colored tiling blocks (no gaps). ~120px blocks + 40px markers + 30px labels. Horizontal scroll with month snap. Below `md:` → vertical season card stack.

**Key interactions:**

1. Click season block → select with orange glow (`shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]`), show quick actions
2. Drag season boundary → adjust date, adjacent auto-adjusts for no-gap tiling, confirmation dialog on drop
3. Hover event marker → tooltip with name, type, demand multiplier, confidence
4. "Sett som aktiv" → confirmation, then `useSetActiveSeason()` mutation
5. "Vis budsjett" → switches to budget tab with season pre-selected

**Design tokens:**

- Season colors from `season.color`. Active: solid + orange glow. Draft: dashed border. Archived: 50% opacity.
- Status badges: draft=yellow, ready=emerald, archived=zinc
- Today line: `bg-brand-orange w-0.5` with dot at top
- Event markers: external=blue, cultural=purple, internal=orange, weather=teal, recurring=zinc

**Animation:** Tier 2 — staggered season entrance (`motion.div`, delay: index \* 0.08, spring), today indicator `scaleY: 0→1`, event markers `scale: 0→1` stagger.

**Accessibility:** Timeline `role="img"` with descriptive `aria-label`. Season blocks are buttons. Hidden `sr-only` table below. Drag handles have keyboard alternatives.

**Data flow:**

- `usePlanningCycles()` — new hook
- `useSeasons()` — existing, now with `is_active`
- `usePlanningEvents(cycleId)` — new hook
- `useUpdateSeasonDates()`, `useSetActiveSeason()` — new mutations

- [ ] **Step 1: Build `YearWheelTimeline` (core visualization)**
- [ ] **Step 2: Build `YearWheelTab` wrapper with header + legend + quick actions**
- [ ] **Step 3: Add "Årshjul" tab to season page tab bar**
- [ ] **Step 4: Commit**

---

### Task 29: Template Shift Editor

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/template-shift-editor.tsx`

**Component tree:**

- `TemplateShiftEditor` (Sheet from shadcn/ui)
  - `TemplateHeader` — template name, department selector
  - `ShiftList` — sortable list (dnd-kit) of template shifts
    - `ShiftRow`
      - `ShiftFunctionSelect` — dropdown with icons
      - `AnchorConfig` — conditional: shows anchor_type + offset for start/end
      - `TimeInputs` — start/end time (disabled when fully anchored)
      - `LabelInput` — human-readable label
      - `DragHandle` — reorder via slot_order
  - `PreviewStrip` — shows how shifts would look against current operating hours
  - `AddShiftButton` — adds new row

**Key interactions:**

1. Select shift function → auto-sets anchor defaults (opening → start_anchor=open, end_anchor=fixed)
2. Drag to reorder → updates slot_order
3. Preview strip updates live as times/anchors change
4. "When hours change" tooltip on anchored shifts explains cascade behavior

- [ ] **Step 1: Build component**
- [ ] **Step 2: Commit**

---

### Task 30: Event Calendar Tab

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/EventCalendarTab.tsx`

**Component tree:**

- `EventCalendarTab` (new tab "Hendelser" in season page, adjacent to "Årshjul")
  - `EventCalendarHeader` — category filter pills + "Legg til hendelse" + "Importer hendelser"
  - `EventCalendarGrid` — month-based calendar (3-col at `lg:`, 2 at `md:`, 1 below)
    - `CalendarMonth` → `CalendarDay` → colored event dots (shape varies for color-blind safety)
  - `EventDetailPopover` (shadcn `Popover`) — event list with name, category badge, demand multiplier, confidence bar
  - `DemandHeatmap` — toggle-able overlay tinting day backgrounds by aggregate demand
  - `CreateEventSheet` (shadcn `Sheet`) — name, date range, category, demand slider (0.5x–3.0x), confidence, source, recurring toggle
- Create: `apps/web/src/app/dashboard/season/_components/CreateEventSheet.tsx`

**Event category colors (with shape variation for a11y):**

- External scraped: `blue-400` (circle)
- Cultural/commercial: `purple-400` (diamond)
- Internal: `orange-400` (triangle)
- Weather: `teal-400` (square)
- Recurring: `zinc-400` (ring)

**Key interactions:**

1. Filter pills → show/hide events with `transition-opacity`
2. Click day cell → `EventDetailPopover`
3. Demand slider → live preview: "Forventet bemanningsendring: +40%"
4. Recurring toggle → reveals frequency/interval/end-date config
5. Demand heatmap toggle → `bg-orange-500/[0.04]` to `bg-orange-500/[0.15]`

**Data flow:**

- `usePlanningEvents(cycleId, filter?)`, CRUD mutations, `useImportExternalEvents()`
- Demand aggregation: client-side from events grouped by date

- [ ] **Step 1: Build `EventCalendarTab` with grid + filters**
- [ ] **Step 2: Build `CreateEventSheet` with form + demand slider**
- [ ] **Step 3: Add "Hendelser" tab to season page**
- [ ] **Step 4: Commit**

---

### Task 31: Cascade Realtime Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-cascade-realtime.ts`

**Pattern (from investigation):** Follow `use-schedule-realtime.ts` — one channel per workspace, 350ms debounced invalidation, conditional subscriptions.

- [ ] **Step 1: Write the hook**

```typescript
// Subscribe to cascade-relevant table changes
// Tables: department_operating_hours, department_hours_override, department_session, change_proposal
// On change: invalidate relevant TanStack Query keys with 350ms debounce
```

- [ ] **Step 2: Wire into schedule page and settings page**
- [ ] **Step 3: Commit**

---

## Phase 7: Bootstrap Engine

### Task 32: Bootstrap Pipeline

**Files:**

- Create: `apps/web/src/lib/cascade/bootstrap-pipeline.ts`
- Modify: `apps/web/src/lib/industry/packages/hospitality.ts`

**Context:** Templates produce REAL database records. Same cascade engine for bootstrap and steady-state. Industry JSON → cascade engine → actual DB records.

- [ ] **Step 1: Write bootstrap pipeline**

The pipeline:

1. Reads industry package JSON (e.g., `hospitality.ts`)
2. Creates `planning_cycle` for the first year
3. Creates seasons within the cycle (Vår, Sommer, Høst, Jul/Vinter)
4. Creates `department_operating_hours` from industry defaults
5. Creates `schedule_template` + `schedule_template_shift` with anchor system
6. Triggers cascade engine to generate:
   - `department_session` rows with planned_open/close
   - `session_hook` rows with fire times
   - `schedule_shift` rows from templates

Minimum viable data: one day's operating hours → one shift → one session → one hook → one task.

- [ ] **Step 2: Extend hospitality.ts with operating hours and template shift defaults**

Add to the hospitality industry package:

```typescript
operatingHours: {
  kitchen: { weekdays: { open: "06:00", close: "23:00" }, weekends: { open: "07:00", close: "23:00" } },
  restaurant: { weekdays: { open: "10:00", close: "23:00" }, weekends: { open: "10:00", close: "00:00" } },
  bar: { weekdays: { open: "15:00", close: "01:00" }, weekends: { open: "12:00", close: "02:00" } },
},
templateShifts: {
  kitchen: [
    { function: "opening", label: "Åpningsvakt Kjøkken", startAnchor: "open", startOffset: -60, endAnchor: "fixed", endTime: "15:00", slotOrder: 0 },
    { function: "closing", label: "Stengingsvakt Kjøkken", startAnchor: "fixed", startTime: "15:00", endAnchor: "close", endOffset: 60, slotOrder: 1 },
    { function: "rush_hour", label: "Lunsj rush", startAnchor: "fixed", startTime: "10:30", endAnchor: "fixed", endTime: "14:30", slotOrder: 2 },
  ],
},
```

- [ ] **Step 3: Support historical data import** (scraping from Brønnøysund, booking systems, previous year)

Add import function that reads CSV/JSON of historical data and feeds it through the same pipeline:

- Revenue per day → `planning_factors` rows
- Staff hours per day → `planning_factors` rows
- Events from previous year → `planning_event` rows with `source: 'historical_import'`

- [ ] **Step 4: Commit**

---

## Phase 8: Integration & Verification

### Task 33: Update use-templates.ts for Anchor Support

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-templates.ts`

- [ ] **Step 1: Update template shift types** — add anchor fields to type + CRUD
- [ ] **Step 2: Update useLoadTemplate** — use `computeAnchoredTime()` when loading template shifts
- [ ] **Step 3: Commit**

---

### Task 34: Update upsert_session Handler

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

- [ ] **Step 1: Update existing `upsert_session` case block**

After creating the department_session, also:

1. Query `department_operating_hours` for the department + date
2. Resolve effective hours (check overrides first)
3. Set `planned_open` and `planned_close` on the department_session

- [ ] **Step 2: Commit**

---

### Task 35: Full Verification

- [ ] **Step 1: Run all migrations on clean local DB**

```bash
npx supabase db reset
```

- [ ] **Step 2: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 3: Type check**

```bash
pnpm turbo typecheck
```

- [ ] **Step 4: Verify engine process**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT p.id, p.name, count(s.id) as steps, t.event_type
  FROM engine_process p
  LEFT JOIN engine_step s ON s.process_id = p.id
  LEFT JOIN engine_trigger t ON t.process_id = p.id
  WHERE p.id = 'operating_hours_cascade'
  GROUP BY p.id, p.name, t.event_type;
"
```

Expected: 1 row, 6 steps, event_type = 'operating_hours.changed'.

- [ ] **Step 5: Verify new tables**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "
  SELECT tablename FROM pg_tables
  WHERE tablename IN ('planning_cycle','planning_event','change_proposal','planning_factors',
    'adjustment_factors','department_operating_hours','department_hours_override')
  ORDER BY tablename;
"
```

Expected: 7 tables.

- [ ] **Step 6: Commit all remaining changes**

---

## Summary: What This Plan Produces

| Phase                       | Deliverable                                                                                            | Tasks   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| **0: Extended Schema**      | 7 migrations (year wheel, events, change proposals, learning loop)                                     | 0.1–0.7 |
| **1: Cascade Schema**       | 12 migrations (enums, season model, operating hours, anchors, FKs, engine process, realtime)           | 1–12    |
| **2: Core Logic**           | Type definitions, 2 pure functions, telemetry events                                                   | 13–16   |
| **3: Operating Hours CRUD** | 2 hooks + 1 settings component                                                                         | 17–19   |
| **4: Cascade Engine**       | 2 Edge Functions + 6 engine dispatch handlers                                                          | 20–22   |
| **5: Year Wheel & Events**  | 2 hooks + season status fix                                                                            | 23–25   |
| **6: Cascade UI**           | 6 UI components (preview modal, vaktlista, year wheel, template editor, event calendar, realtime hook) | 26–31   |
| **7: Bootstrap**            | Bootstrap pipeline + industry package extension + historical import                                    | 32      |
| **8: Integration**          | Template anchor support, session handler update, full verification                                     | 33–35   |

**Total: 35 tasks across 9 phases (0–8)**

## Cross-Surface Connections

| From                                 | To                                | Trigger                                                                |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------------------- |
| Surface 1 (Operating Hours Settings) | Surface 2 (Cascade Preview Modal) | "Forhåndsvis endringer" button                                         |
| Surface 2 (Cascade Preview Modal)    | Surface 1 (back)                  | "Avbryt" button                                                        |
| Surface 2 (Cascade Preview Modal)    | Surface 3 (Vaktlista)             | After confirm, ghost cards appear showing cascaded changes             |
| Surface 3 (Vaktlista)                | Surface 5 (Template Editor)       | Slot header click                                                      |
| Surface 4 (Year Wheel)               | Season page budget/factors tabs   | "Vis budsjett" quick action                                            |
| Surface 4 (Year Wheel)               | Surface 6 (Event Calendar)        | Event markers link to event detail                                     |
| Surface 6 (Event Calendar)           | Surface 4 (Year Wheel)            | Events appear as markers on the timeline                               |
| Agent (Botsson)                      | Surface 3 (Vaktlista)             | Proposals appear as ghost cards via `AgentProposalsProvider`           |
| Agent (Botsson)                      | Surface 2 (Cascade Preview)       | Agent can suggest operating hours changes that trigger cascade preview |

## New Hooks Required (Complete List)

| Hook                                                                                 | Surfaces | Data Source                               |
| ------------------------------------------------------------------------------------ | -------- | ----------------------------------------- |
| `useDepartmentHours(deptId, seasonId, locationId)`                                   | 1, 3, 5  | `department_operating_hours`              |
| `useSaveDepartmentHours()`                                                           | 1        | Upsert mutation                           |
| `useHoursOverrides(deptId, seasonId, locationId)`                                    | 1        | `department_hours_override`               |
| `useCreateOverride()` / `useDeleteOverride()`                                        | 1        | Override mutations                        |
| `useCascadePreview()`                                                                | 2        | `cascade-preview` Edge Function           |
| `useCascadeApply()`                                                                  | 2        | `cascade-apply` Edge Function             |
| `usePlanningCycles()`                                                                | 4        | `planning_cycle`                          |
| `useCreatePlanningCycle()`                                                           | 4        | Insert mutation                           |
| `useUpdateSeasonDates()`                                                             | 4        | Season boundary mutation                  |
| `useSetActiveSeason()`                                                               | 4        | `is_active` toggle mutation               |
| `usePlanningEvents(cycleId, filter?)`                                                | 4, 6     | `planning_event`                          |
| `useCreatePlanningEvent()` / `useUpdatePlanningEvent()` / `useDeletePlanningEvent()` | 6        | Event mutations                           |
| `useImportExternalEvents()`                                                          | 6        | Scrapling integration                     |
| `useCascadeRealtime()`                                                               | 1, 3     | Realtime subscriptions for cascade tables |

## New Components Required (Complete List)

| Component                         | Surface | File Location                                        |
| --------------------------------- | ------- | ---------------------------------------------------- |
| `DepartmentHoursSettings`         | 1       | `settings/_components/department-hours-settings.tsx` |
| `DepartmentSeasonPicker`          | 1       | `settings/_components/department-season-picker.tsx`  |
| `WeeklyHoursGrid` / `DayHoursRow` | 1       | `settings/_components/weekly-hours-grid.tsx`         |
| `OverridesSection`                | 1       | `settings/_components/overrides-section.tsx`         |
| `CascadePreviewModal`             | 2       | `schedule/_components/cascade-preview-modal.tsx`     |
| `VaktlistaView`                   | 3       | `schedule/_components/vaktlista-view.tsx`            |
| `VaktlistaSlot`                   | 3       | `schedule/_components/vaktlista-slot.tsx`            |
| `YearWheelTab`                    | 4       | `season/_components/YearWheelTab.tsx`                |
| `YearWheelTimeline`               | 4       | `season/_components/YearWheelTimeline.tsx`           |
| `TemplateShiftEditor`             | 5       | `schedule/_components/template-shift-editor.tsx`     |
| `EventCalendarTab`                | 6       | `season/_components/EventCalendarTab.tsx`            |
| `CreateEventSheet`                | 6       | `season/_components/CreateEventSheet.tsx`            |

## Design Decisions (from frontend-designer agent)

**Animation tiers:**

- **Settings (Surface 1):** Tier 1 only — `transition-colors`, `transition-opacity`. This is a form, not a spectacle.
- **Cascade Preview (Surface 2):** Tier 2 justified — `AnimatePresence` with spring entrance + staggered diff rows. High-impact confirmation moment.
- **Vaktlista (Surface 3):** Tier 2 justified — `@dnd-kit` drag overlay, ghost card `walkai-fade-in` keyframe (already exists), staggered batch confirm.
- **Year Wheel (Surface 4):** Tier 2 justified — staggered season block entrance + today indicator spring. Premium strategic visualization.
- **Template Editor (Surface 5):** Tier 1 + minimal Tier 2 — sheet slide-in (shadcn built-in), smooth anchor config panel height changes.
- **Event Calendar (Surface 6):** Tier 1 + minimal Tier 2 — filter transitions, heatmap toggle fade.

**Shift function badge colors (consistent across surfaces 3 + 5):**

- Opening: `bg-emerald-500/10 text-emerald-600` — sunrise icon
- Closing: `bg-blue-500/10 text-blue-600` — moon icon
- Supporting: `bg-zinc-500/10 text-zinc-600` — users icon
- Rush hour: `bg-orange-500/10 text-orange-600` — zap icon
- Sub supply: `bg-purple-500/10 text-purple-600` — plus-circle icon

**Event category colors (consistent across surfaces 4 + 6):**

- External scraped: `blue-400`
- Cultural/commercial: `purple-400`
- Internal: `orange-400` (brand)
- Weather: `teal-400`
- Recurring: `zinc-400`

---

## What This Plan Does NOT Include (Future Plans)

- **Compliance overlay** (XACML PEP/PDP + CDS Hooks) — designed but deferred to after foundation is solid
- **Constraint solver / optimization** — future enhancement
- **Old table data migration** — separate migration plan after UI is swapped
- **Old table DROP statements** — only after all consumers are migrated
- **Demand signal integration** — Category 4, needs weather API + booking integration work
- **Event scraping engine** — municipality calendars, cultural calendar parsing (separate service)
- **Mobile cascade views** — depends on web foundation
