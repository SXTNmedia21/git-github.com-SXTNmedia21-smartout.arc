---
title: "Daily Close Engine"
status: done
updated: 2026-04-10
created: 2026-03-04
module: meta
tags: []
---

# DailyCloseEngine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the DailyCloseEngine — a state-machine-driven daily reconciliation system with image-based settlement, OCR validation, gatekeeper locks, and manager approval.

**Architecture:** Two layers — (1) a generic State Machine Engine (from `SMARTOUT_STATEMACHINE_BLUEPRINT.md`) providing event-driven process orchestration with pg_cron, and (2) domain tables for daily reconciliation (from Module 10 spec). The DailyClose is the first process definition running on the engine. The engine lives as Edge Functions + pg_cron, not as a separate service.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions, Storage, pg_cron), Zod validation, Google Vision API (OCR), Next.js App Router (UI), shadcn/ui, TanStack Query.

**Source Documents:**

- `docs/architecture/SMARTOUT_STATEMACHINE_BLUEPRINT.md` — Engine schema + design decisions
- `docs/modules/SMARTOUT_MODULE_10_REPORTS.md` — Full reconciliation spec
- `docs/architecture/PRD-03_Avstemmingssystem.md` — Business requirements
- User PD (DailyCloseEngine) — Product document with OCR + gatekeeper focus
- `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md` — Department Session spec

**Existing Infrastructure:**

- `schedule_shift` table EXISTS with shift lifecycle, RLS, workspace scoping
- `engine_missions/stages/sessions/inbox/memory/authority_config` tables EXIST (Stage Engine — separate concern, AI conversations)
- State Machine tables (`engine_process`, `engine_trigger`, etc.) DO NOT EXIST yet
- `department_session` table DOES NOT EXIST yet
- `daily_reconciliation` and related tables DO NOT EXIST yet

**Key Decision — Schema Naming:**
Existing engine tables use `public.engine_*` prefix (not a separate schema). This plan follows that convention: `engine_process`, `engine_trigger`, `engine_event`, `engine_step`, `engine_state`, `engine_delayed_trigger`.

---

## Phase 1: State Machine Engine — Database Layer

> Creates the 6 core tables for the domain process engine. These are SEPARATE from the existing Stage Engine tables (which handle AI conversations). This engine handles operational process automation.

### Task 1: Create engine process tables migration

**Files:**

- Create: `supabase/migrations/20260304100000_engine_process_tables.sql`

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260304100000_engine_process_tables.sql
-- Creates the 6 core tables for the Domain Process Engine:
--   engine_process  — reusable process definitions
--   engine_step     — ordered steps within processes
--   engine_trigger  — event → process matching rules
--   engine_event    — event log with idempotency
--   engine_state    — running process instances
--   engine_delayed_trigger — timer queue for delayed trigger firing
-- Source: SMARTOUT_STATEMACHINE_BLUEPRINT.md (revised schema §4)
-- ============================================

-- ── engine_process ─────────────────────────────────────────
-- Reusable process templates. E.g. "daily_close", "onboarding_14d"
CREATE TABLE public.engine_process (
  id            TEXT PRIMARY KEY,               -- human-readable: "daily_close"
  name          TEXT NOT NULL,
  description   TEXT,
  workspace_id  UUID REFERENCES workspace(workspace_id),  -- NULL = global
  is_active     BOOLEAN NOT NULL DEFAULT true,
  max_steps     INTEGER NOT NULL DEFAULT 50,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_process ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_process" ON engine_process
FOR SELECT USING (
  workspace_id IS NULL
  OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "manage_engine_process" ON engine_process
FOR ALL USING (auth.role() = 'service_role');

-- ── engine_step ────────────────────────────────────────────
-- Steps within a process. step_group enables parallel execution.
CREATE TABLE public.engine_step (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id      TEXT NOT NULL REFERENCES engine_process(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  step_group      INTEGER,                       -- same group = parallel
  action_type     TEXT NOT NULL,                  -- assign_task, send_notification, wait_for_event, etc.
  action_payload  JSONB NOT NULL DEFAULT '{}',
  condition       JSONB,                         -- standardized condition format
  assignee_rule   TEXT,                          -- self, manager, department_head, role:<x>
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_process_step_order UNIQUE (process_id, step_order)
);

ALTER TABLE engine_step ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_step" ON engine_step
FOR SELECT USING (
  process_id IN (SELECT id FROM engine_process)
);
CREATE POLICY "manage_engine_step" ON engine_step
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_engine_step_process ON engine_step (process_id, step_order);

-- ── engine_trigger ─────────────────────────────────────────
-- Maps event types to process starts.
CREATE TABLE public.engine_trigger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,                    -- "session.closing_started", "shift.completed"
  process_id    TEXT NOT NULL REFERENCES engine_process(id) ON DELETE CASCADE,
  condition     JSONB,                           -- filter: {"match": {"department": "kitchen"}}
  delay_seconds INTEGER DEFAULT 0,               -- delay before process starts
  is_active     BOOLEAN NOT NULL DEFAULT true,
  workspace_id  UUID REFERENCES workspace(workspace_id),  -- NULL = global
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_trigger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_trigger" ON engine_trigger
FOR SELECT USING (
  workspace_id IS NULL
  OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "manage_engine_trigger" ON engine_trigger
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_engine_trigger_event ON engine_trigger (event_type)
  WHERE is_active = true;

-- ── engine_event ───────────────────────────────────────────
-- Event log. All events that enter the system.
CREATE TABLE public.engine_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),
  idempotency_key TEXT,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_event" ON engine_event
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "manage_engine_event" ON engine_event
FOR ALL USING (auth.role() = 'service_role');

CREATE UNIQUE INDEX idx_engine_event_idempotency
  ON engine_event (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_engine_event_type ON engine_event (event_type, fired_at DESC);
CREATE INDEX idx_engine_event_workspace ON engine_event (workspace_id, fired_at DESC);

-- ── engine_state ───────────────────────────────────────────
-- Running process instances. One row per active process run.
CREATE TABLE public.engine_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id      UUID REFERENCES engine_trigger(id),
  process_id      TEXT NOT NULL REFERENCES engine_process(id),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id),

  -- Current position
  current_step    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated')),

  -- Entity reference (denormalized for fast lookup + RLS)
  entity_type     TEXT,                          -- 'department_session', 'shift', 'employee'
  entity_id       UUID,

  -- Assignee
  assignee_id     UUID,

  -- Data
  context         JSONB NOT NULL DEFAULT '{}',
  steps_snapshot  JSONB,                         -- frozen copy of process steps at start
  result          JSONB,                         -- accumulated step results

  -- Nesting protection
  depth           INTEGER NOT NULL DEFAULT 0,
  parent_state_id UUID REFERENCES engine_state(id),

  -- Error handling
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,

  -- Timestamps
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE engine_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_state" ON engine_state
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "manage_engine_state" ON engine_state
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_engine_state_entity ON engine_state (entity_type, entity_id);
CREATE INDEX idx_engine_state_workspace_status ON engine_state (workspace_id, status)
  WHERE status IN ('pending', 'active', 'waiting');
CREATE INDEX idx_engine_state_process ON engine_state (process_id, status);

-- Prevent duplicate active processes per entity
CREATE UNIQUE INDEX idx_engine_state_unique_active
  ON engine_state (entity_type, entity_id, process_id)
  WHERE status IN ('pending', 'active', 'waiting');

-- ── engine_delayed_trigger ─────────────────────────────────
-- Timer queue for delayed trigger firing. pg_cron polls this.
CREATE TABLE public.engine_delayed_trigger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id    UUID NOT NULL REFERENCES engine_trigger(id),
  event_id      UUID NOT NULL REFERENCES engine_event(id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  fire_at       TIMESTAMPTZ NOT NULL,
  fired         BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE engine_delayed_trigger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_engine_delayed_trigger" ON engine_delayed_trigger
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "manage_engine_delayed_trigger" ON engine_delayed_trigger
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_engine_delayed_trigger_fire
  ON engine_delayed_trigger (fire_at) WHERE fired = false;

-- ── Comments ───────────────────────────────────────────────
COMMENT ON TABLE engine_process IS 'Domain process definitions. NOT the same as engine_missions (AI conversations).';
COMMENT ON TABLE engine_step IS 'Steps within a process. step_group enables parallel execution.';
COMMENT ON TABLE engine_trigger IS 'Event → process matching. Delay optional.';
COMMENT ON TABLE engine_event IS 'Immutable event log. Idempotency key prevents duplicates.';
COMMENT ON TABLE engine_state IS 'Running process instances with entity tracking and snapshot.';
COMMENT ON TABLE engine_delayed_trigger IS 'Timer queue polled by pg_cron every minute.';
```

**Step 2: Apply the migration**

Run: `npx supabase db reset` or `npx supabase migration up` (local dev)

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Verify tables exist**

Run: `npx supabase db lint` — no errors expected.

**Step 5: Commit**

```bash
git add supabase/migrations/20260304100000_engine_process_tables.sql packages/supabase/src/database.types.ts
git commit -m "feat(engine): add 6 domain process engine tables

State machine foundation: engine_process, engine_step, engine_trigger,
engine_event, engine_state, engine_delayed_trigger. Blueprint §4.
Separate from Stage Engine (AI conversations)."
```

---

### Task 2: Add engine types to packages/types

**Files:**

- Create: `packages/types/src/engine.ts`
- Modify: `packages/types/src/index.ts` — add export

**Step 1: Write Zod schemas**

```typescript
// packages/types/src/engine.ts
import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────

export const EngineStateStatus = z.enum([
  "pending",
  "active",
  "waiting",
  "complete",
  "failed",
  "escalated",
]);
export type EngineStateStatus = z.infer<typeof EngineStateStatus>;

export const EngineActionType = z.enum([
  "assign_task",
  "send_notification",
  "wait_for_event",
  "schedule_control",
  "start_process",
  "update_entity",
  "create_deviation",
  "validate_settlement",
  "lock_checkout",
]);
export type EngineActionType = z.infer<typeof EngineActionType>;

export const TimeoutAction = z.enum(["fail", "escalate", "skip", "retry"]);
export type TimeoutAction = z.infer<typeof TimeoutAction>;

// ── Condition Language (Blueprint §1.9) ────────────────────

export const ConditionMatch = z.object({
  match: z.record(z.unknown()),
});

export const ConditionStepStatus = z.object({
  step_status: z.object({
    step: z.number(),
    is: z.string(),
  }),
});

export const ConditionAll = z.object({
  all: z.array(z.lazy(() => EngineCondition)),
});

export const ConditionAny = z.object({
  any: z.array(z.lazy(() => EngineCondition)),
});

export const EngineCondition: z.ZodType<unknown> = z.union([
  ConditionMatch,
  ConditionStepStatus,
  ConditionAll,
  ConditionAny,
]);

// ── Core Schemas ───────────────────────────────────────────

export const EngineProcessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  workspace_id: z.string().uuid().nullish(),
  is_active: z.boolean().default(true),
  max_steps: z.number().int().default(50),
});
export type EngineProcess = z.infer<typeof EngineProcessSchema>;

export const EngineStepSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().min(1),
  step_order: z.number().int(),
  step_group: z.number().int().nullish(),
  action_type: EngineActionType,
  action_payload: z.record(z.unknown()).default({}),
  condition: EngineCondition.nullish(),
  assignee_rule: z.string().nullish(),
});
export type EngineStep = z.infer<typeof EngineStepSchema>;

export const EngineEventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  workspace_id: z.string().uuid(),
  idempotency_key: z.string().nullish(),
  fired_at: z.string(),
});
export type EngineEvent = z.infer<typeof EngineEventSchema>;

export const EngineStateSchema = z.object({
  id: z.string().uuid(),
  trigger_id: z.string().uuid().nullish(),
  process_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  current_step: z.number().int().default(0),
  status: EngineStateStatus.default("pending"),
  entity_type: z.string().nullish(),
  entity_id: z.string().uuid().nullish(),
  assignee_id: z.string().uuid().nullish(),
  context: z.record(z.unknown()).default({}),
  steps_snapshot: z.array(EngineStepSchema).nullish(),
  result: z.record(z.unknown()).nullish(),
  depth: z.number().int().default(0),
  retry_count: z.number().int().default(0),
  last_error: z.string().nullish(),
});
export type EngineState = z.infer<typeof EngineStateSchema>;
```

**Step 2: Add export to index.ts**

Add `export * from "./engine";` to `packages/types/src/index.ts`.

**Step 3: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/types`
Expected: 0 errors

**Step 4: Commit**

```bash
git add packages/types/src/engine.ts packages/types/src/index.ts
git commit -m "feat(types): add Zod schemas for domain process engine"
```

---

### Task 3: Build the Condition Evaluator

**Files:**

- Create: `packages/ai/src/engine/condition-evaluator.ts`
- Create: `packages/ai/src/engine/__tests__/condition-evaluator.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/ai/src/engine/__tests__/condition-evaluator.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../condition-evaluator";

describe("evaluateCondition", () => {
  it("returns true for null/undefined condition", () => {
    expect(evaluateCondition(null, {})).toBe(true);
    expect(evaluateCondition(undefined, {})).toBe(true);
  });

  it("matches simple field equality", () => {
    const condition = { match: { role: "server" } };
    expect(evaluateCondition(condition, { role: "server" })).toBe(true);
    expect(evaluateCondition(condition, { role: "chef" })).toBe(false);
  });

  it("matches multiple fields (all must match)", () => {
    const condition = { match: { role: "server", department: "kitchen" } };
    expect(evaluateCondition(condition, { role: "server", department: "kitchen" })).toBe(true);
    expect(evaluateCondition(condition, { role: "server", department: "bar" })).toBe(false);
  });

  it("checks step_status", () => {
    const condition = { step_status: { step: 4, is: "complete" } };
    const context = { step_results: { 4: { status: "complete" } } };
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it("handles ALL combinator", () => {
    const condition = {
      all: [{ match: { role: "server" } }, { step_status: { step: 1, is: "complete" } }],
    };
    const context = { role: "server", step_results: { 1: { status: "complete" } } };
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it("handles ANY combinator", () => {
    const condition = {
      any: [{ match: { department: "kitchen" } }, { match: { department: "bar" } }],
    };
    expect(evaluateCondition(condition, { department: "bar" })).toBe(true);
    expect(evaluateCondition(condition, { department: "admin" })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @smartout/ai test -- --run condition-evaluator`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// packages/ai/src/engine/condition-evaluator.ts

type Context = Record<string, unknown>;

export function evaluateCondition(condition: unknown, context: Context): boolean {
  if (condition === null || condition === undefined) return true;

  const cond = condition as Record<string, unknown>;

  if ("match" in cond) {
    const match = cond.match as Record<string, unknown>;
    return Object.entries(match).every(([key, value]) => context[key] === value);
  }

  if ("step_status" in cond) {
    const { step, is } = cond.step_status as { step: number; is: string };
    const results = context.step_results as Record<string, { status: string }> | undefined;
    return results?.[step]?.status === is;
  }

  if ("all" in cond) {
    const conditions = cond.all as unknown[];
    return conditions.every((c) => evaluateCondition(c, context));
  }

  if ("any" in cond) {
    const conditions = cond.any as unknown[];
    return conditions.some((c) => evaluateCondition(c, context));
  }

  return false;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @smartout/ai test -- --run condition-evaluator`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add packages/ai/src/engine/condition-evaluator.ts packages/ai/src/engine/__tests__/condition-evaluator.test.ts
git commit -m "feat(engine): add condition evaluator with match/step_status/all/any"
```

---

## Phase 2: Domain Data Layer

> Creates the operational tables that the DailyClose process operates on. Follows Module 10 spec exactly.

### Task 4: Create department_session table

**Files:**

- Create: `supabase/migrations/20260304200000_department_session.sql`

**Docs to check before writing:**

- `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md` §2-4 — full department_session spec
- `supabase/migrations/00002_structure_tables.sql` — department table reference

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260304200000_department_session.sql
-- Creates department_session: the daily operational container.
-- One row per department per day within the active season.
-- Source: MODULE_4_OPERATIONS.md §3
-- ============================================

CREATE TYPE department_session_status AS ENUM (
  'upcoming',     -- created but not yet started (day hasn't come)
  'active',       -- currently running
  'pending_signoff', -- all shifts done, awaiting sign-off
  'closed',       -- signed off by closing employee
  'missed'        -- no punch-in happened, auto-closed
);

CREATE TABLE public.department_session (
  department_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id         UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  season_id             UUID REFERENCES season(season_id),
  session_date          DATE NOT NULL,

  -- Lifecycle
  status                department_session_status NOT NULL DEFAULT 'upcoming',
  opened_at             TIMESTAMPTZ,
  opened_by             UUID REFERENCES profile(profile_id),
  closed_at             TIMESTAMPTZ,
  closed_by             UUID REFERENCES profile(profile_id),

  -- Sign-off data
  signoff_notes         TEXT,
  handoff_notes         TEXT,

  -- Metrics (populated during/after session)
  planned_shifts        INTEGER DEFAULT 0,
  actual_shifts         INTEGER DEFAULT 0,
  tasks_total           INTEGER DEFAULT 0,
  tasks_completed       INTEGER DEFAULT 0,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One session per department per day
  CONSTRAINT uq_dept_session_date UNIQUE (workspace_id, department_id, session_date)
);

ALTER TABLE department_session ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
CREATE POLICY "jwt_read_department_session" ON department_session
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- JWT: admins can manage
CREATE POLICY "jwt_manage_department_session" ON department_session
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = department_session.workspace_id
    AND role IN ('admin', 'owner')
  )
);

-- API key: read
CREATE POLICY "api_key_read_department_session" ON department_session
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

-- Service role: full access
CREATE POLICY "service_role_department_session" ON department_session
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_dept_session_date ON department_session (workspace_id, session_date DESC);
CREATE INDEX idx_dept_session_status ON department_session (workspace_id, status)
  WHERE status IN ('active', 'pending_signoff');

COMMENT ON TABLE department_session IS 'Daily operational container per department. One per dept per day.';
```

**Step 2: Apply + regen types + verify**

Run: `npx supabase migration up && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 3: Commit**

```bash
git add supabase/migrations/20260304200000_department_session.sql packages/supabase/src/database.types.ts
git commit -m "feat(operations): add department_session table — daily operational container"
```

---

### Task 5: Create daily reconciliation + settlement tables

**Files:**

- Create: `supabase/migrations/20260304200100_daily_reconciliation.sql`

**Docs to check:**

- `docs/modules/SMARTOUT_MODULE_10_REPORTS.md` §5.1-5.3 — full schema

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260304200100_daily_reconciliation.sql
-- Daily reconciliation, settlement images, and settlement validation.
-- Source: MODULE_10 §5.1-5.3
-- ============================================

CREATE TYPE reconciliation_status AS ENUM (
  'open',                -- day started, accumulating data
  'submitted',           -- closing employee submitted settlement
  'awaiting_approval',   -- OCR done, ready for admin
  'approved',            -- admin approved — DAY CLOSED
  'locked',              -- immutable after policy period
  'unreconciled'         -- timed out without approval
);

CREATE TYPE revenue_source AS ENUM ('ocr', 'manual');

CREATE TYPE settlement_source_type AS ENUM (
  'pos', 'terminal', 'z_report', 'cash_count', 'other'
);

-- ── daily_reconciliation ───────────────────────────────────
CREATE TABLE public.daily_reconciliation (
  reconciliation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id      UUID NOT NULL REFERENCES department(department_id),
  session_id         UUID REFERENCES department_session(department_session_id),
  reconciliation_date DATE NOT NULL,

  -- Status lifecycle
  status             reconciliation_status NOT NULL DEFAULT 'open',

  -- Phase 1: Settlement (by closing employee)
  settled_by         UUID REFERENCES profile(profile_id),
  settled_at         TIMESTAMPTZ,

  -- Phase 2: Approval (by admin)
  approved_by        UUID REFERENCES profile(profile_id),
  approved_at        TIMESTAMPTZ,
  approval_notes     TEXT,

  -- Revenue (from OCR or manual entry)
  revenue_total      NUMERIC(12,2),
  revenue_card       NUMERIC(12,2),
  revenue_cash       NUMERIC(12,2),
  revenue_vat        NUMERIC(12,2),
  revenue_transactions INTEGER,
  revenue_source     revenue_source,

  -- Labor (aggregated from shift approvals)
  total_planned_hours  NUMERIC(6,2),
  total_actual_hours   NUMERIC(6,2),
  total_labor_cost     NUMERIC(10,2),

  -- KPIs (calculated on approval)
  revenue_per_worked_hour NUMERIC(10,2),
  labor_percentage        NUMERIC(5,2),

  -- Locking
  locked_at          TIMESTAMPTZ,
  locked_by          UUID REFERENCES profile(profile_id),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_recon_date UNIQUE (workspace_id, department_id, reconciliation_date)
);

ALTER TABLE daily_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_daily_reconciliation" ON daily_reconciliation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_daily_reconciliation" ON daily_reconciliation
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = daily_reconciliation.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);
CREATE POLICY "api_key_read_daily_reconciliation" ON daily_reconciliation
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "service_role_daily_reconciliation" ON daily_reconciliation
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_recon_status ON daily_reconciliation (workspace_id, status)
  WHERE status NOT IN ('locked');
CREATE INDEX idx_recon_date ON daily_reconciliation (workspace_id, reconciliation_date DESC);

-- ── settlement_image ───────────────────────────────────────
CREATE TABLE public.settlement_image (
  image_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id   UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),

  source_type         settlement_source_type NOT NULL,
  storage_path        TEXT NOT NULL,             -- Supabase Storage path

  -- OCR results
  ocr_raw_text        TEXT,
  ocr_parsed          JSONB,                     -- structured extraction
  ocr_confidence      REAL,                      -- 0.0–1.0
  ocr_processed_at    TIMESTAMPTZ,

  uploaded_by         UUID NOT NULL REFERENCES profile(profile_id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settlement_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_settlement_image" ON settlement_image
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_settlement_image" ON settlement_image
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "service_role_settlement_image" ON settlement_image
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_settlement_image_recon ON settlement_image (reconciliation_id);

-- ── settlement_validation ──────────────────────────────────
CREATE TABLE public.settlement_validation (
  validation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id   UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),

  pos_total           NUMERIC(12,2) NOT NULL,
  terminal_total      NUMERIC(12,2) NOT NULL,
  difference          NUMERIC(12,2) NOT NULL,
  difference_percent  REAL NOT NULL,
  within_threshold    BOOLEAN NOT NULL,
  deviation_id        UUID,                      -- FK added after deviation table

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settlement_validation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_settlement_validation" ON settlement_validation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "service_role_settlement_validation" ON settlement_validation
FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE daily_reconciliation IS 'Admin approval of business day. Two-phase: settlement → approval.';
COMMENT ON TABLE settlement_image IS 'OCR source images for daily settlement.';
COMMENT ON TABLE settlement_validation IS 'Cross-check: POS total vs terminal total.';
```

**Step 2: Apply + regen types**

**Step 3: Commit**

```bash
git add supabase/migrations/20260304200100_daily_reconciliation.sql packages/supabase/src/database.types.ts
git commit -m "feat(reconciliation): add daily_reconciliation, settlement_image, settlement_validation tables"
```

---

### Task 6: Create deviation + shift_approval tables

**Files:**

- Create: `supabase/migrations/20260304200200_deviation_shift_approval.sql`

**Docs to check:**

- `docs/modules/SMARTOUT_MODULE_10_REPORTS.md` §4.2 (deviation) and §5.4 (shift_approval)

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260304200200_deviation_shift_approval.sql
-- Deviation tracking (5 domains) and per-shift hour approval.
-- Source: MODULE_10 §4.2 and §5.4
-- ============================================

CREATE TYPE deviation_domain AS ENUM (
  'safety', 'customer', 'procedure', 'system', 'material'
);

CREATE TYPE deviation_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE deviation_status AS ENUM (
  'open', 'acknowledged', 'resolved', 'escalated'
);

CREATE TYPE shift_approval_status AS ENUM (
  'pending', 'approved', 'edited', 'disputed'
);

-- ── deviation ──────────────────────────────────────────────
CREATE TABLE public.deviation (
  deviation_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id        UUID REFERENCES department(department_id),
  session_id           UUID REFERENCES department_session(department_session_id),
  reconciliation_id    UUID REFERENCES daily_reconciliation(reconciliation_id),

  -- Classification
  domain               deviation_domain NOT NULL,
  subcategory          TEXT,                      -- late_checkin, overtime, pest, glass_broken, etc.
  severity             deviation_severity NOT NULL DEFAULT 'low',

  -- Content
  title                TEXT NOT NULL,
  description          TEXT,
  cost_impact          NUMERIC(10,2),

  -- Links
  linked_shift_id      UUID REFERENCES schedule_shift(schedule_shift_id),

  -- Status
  status               deviation_status NOT NULL DEFAULT 'open',

  -- Resolution
  resolution_notes     TEXT,
  resolved_by          UUID REFERENCES profile(profile_id),
  resolved_at          TIMESTAMPTZ,

  -- Evidence
  attachments          JSONB,                     -- [{url, filename, type}]

  -- Policy impact (computed from severity + policy rules)
  blocks_day_approval  BOOLEAN NOT NULL DEFAULT false,
  requires_action      BOOLEAN NOT NULL DEFAULT false,
  payroll_impact       BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  reported_by          UUID REFERENCES profile(profile_id),  -- null = system-generated
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deviation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_deviation" ON deviation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_deviation" ON deviation
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "api_key_read_deviation" ON deviation
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "service_role_deviation" ON deviation
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_deviation_session ON deviation (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_deviation_recon ON deviation (reconciliation_id) WHERE reconciliation_id IS NOT NULL;
CREATE INDEX idx_deviation_status ON deviation (workspace_id, status)
  WHERE status IN ('open', 'acknowledged', 'escalated');

-- Add FK from settlement_validation to deviation
ALTER TABLE settlement_validation
  ADD CONSTRAINT fk_validation_deviation
  FOREIGN KEY (deviation_id) REFERENCES deviation(deviation_id);

-- ── shift_approval ─────────────────────────────────────────
CREATE TABLE public.shift_approval (
  approval_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id    UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  shift_id             UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id),
  workspace_id         UUID NOT NULL REFERENCES workspace(workspace_id),

  -- Time data
  punch_in             TIMESTAMPTZ,
  punch_out            TIMESTAMPTZ,
  planned_hours        NUMERIC(4,2) NOT NULL,
  calculated_hours     NUMERIC(4,2),
  approved_hours       NUMERIC(4,2),

  -- Status
  status               shift_approval_status NOT NULL DEFAULT 'pending',
  edit_justification   TEXT,
  handoff_requested    BOOLEAN NOT NULL DEFAULT false,
  handoff_completed    BOOLEAN NOT NULL DEFAULT false,

  -- System-detected deviations
  system_deviations    JSONB,                     -- [{type, details}]

  -- Admin approval
  approved_by          UUID REFERENCES profile(profile_id),
  approved_at          TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shift_approval ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_shift_approval" ON shift_approval
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_shift_approval" ON shift_approval
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = shift_approval.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);
CREATE POLICY "service_role_shift_approval" ON shift_approval
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_shift_approval_recon ON shift_approval (reconciliation_id);

COMMENT ON TABLE deviation IS '5-domain deviation tracking: safety, customer, procedure, system, material.';
COMMENT ON TABLE shift_approval IS 'Per-shift hour verification within daily reconciliation.';
```

**Step 2: Apply + regen types**

**Step 3: Commit**

```bash
git add supabase/migrations/20260304200200_deviation_shift_approval.sql packages/supabase/src/database.types.ts
git commit -m "feat(reconciliation): add deviation (5-domain) and shift_approval tables"
```

---

## Phase 3: DailyClose Process Definition

> Seeds the DailyClose as the first process in the state machine engine.

### Task 7: Seed the DailyClose process definition

**Files:**

- Create: `supabase/migrations/20260304300000_seed_daily_close_process.sql`

**Step 1: Write the seed migration**

This defines the DailyClose process with 10 steps organized in groups:

```sql
-- ============================================
-- 20260304300000_seed_daily_close_process.sql
-- Seeds the DailyClose process definition + triggers.
-- Maps PD state machine: OPEN → CLOSING → VALIDATION → APPROVAL → CLOSED
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('daily_close', 'Daily Close & Reconciliation',
 'Two-phase daily reconciliation: employee settlement → admin approval. Source: PD + Module 10.');

-- ── Steps ──────────────────────────────────────────────────
-- Groups: 1 = parallel close tasks, 2 = parallel validation, NULL = sequential

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES

-- Group 1: Closing employee performs these in parallel
('daily_close', 1, 1, 'assign_task', '{
  "task": "complete_closing_checklist",
  "description": "Complete all closing tasks (micka, lock cash, check fridge temp, security)"
}', 'self'),

('daily_close', 2, 1, 'assign_task', '{
  "task": "upload_settlement_images",
  "description": "Upload POS closing report + iSettle terminal settlement (minimum 2 images)",
  "min_images": 2,
  "required_types": ["pos", "terminal"]
}', 'self'),

-- Sequential: wait for images before running OCR
('daily_close', 3, NULL, 'validate_settlement', '{
  "description": "Run OCR on uploaded images, extract financial data, cross-validate POS vs terminal",
  "tolerance_type": "policy",
  "fallback": "manual_input"
}', null),

-- Sequential: check OCR result + create deviation if mismatch
('daily_close', 4, NULL, 'create_deviation', '{
  "condition": "settlement_mismatch",
  "domain": "system",
  "subcategory": "settlement_mismatch",
  "severity": "medium",
  "auto_create": true,
  "description": "Auto-created when POS vs terminal difference exceeds threshold"
}', null),

-- Gatekeeper: hard lock — employee cannot checkout until all conditions met
('daily_close', 5, NULL, 'lock_checkout', '{
  "description": "Block punch-out until all conditions are met",
  "conditions": [
    "closing_checklist_complete",
    "settlement_images_uploaded",
    "ocr_validated_or_manual",
    "critical_deviations_commented",
    "reconciliation_submitted"
  ]
}', null),

-- Employee submits → status = SUBMITTED
('daily_close', 6, NULL, 'update_entity', '{
  "entity": "daily_reconciliation",
  "set": {"status": "submitted"},
  "description": "Mark reconciliation as submitted by closing employee"
}', 'self'),

-- Wait for manager approval (next business day)
('daily_close', 7, NULL, 'wait_for_event', '{
  "event": "reconciliation.admin_action",
  "timeout": "72h",
  "on_timeout": "escalate",
  "description": "Wait for admin to approve, reject, or request clarification"
}', null),

-- If rejected → notify employee, loop back
('daily_close', 8, NULL, 'send_notification', '{
  "template": "reconciliation_feedback",
  "description": "Notify closing employee of admin decision (approval/rejection/clarification)",
  "channel": "push"
}', null),

-- Final: lock the day
('daily_close', 9, NULL, 'update_entity', '{
  "entity": "daily_reconciliation",
  "set": {"status": "approved"},
  "description": "DAY CLOSED — reconciliation approved and locked"
}', null),

-- Fire completion event for downstream (KPI calculation, season aggregation)
('daily_close', 10, NULL, 'send_notification', '{
  "template": "day_closed",
  "channel": "system",
  "description": "Fire day_closed event for KPI dashboard and season reconciliation"
}', null);

-- ── Triggers ───────────────────────────────────────────────

-- Trigger 1: Department session moves to pending_signoff → start close
INSERT INTO engine_trigger (event_type, process_id, condition, is_active) VALUES
('department_session.pending_signoff', 'daily_close', null, true);

-- Trigger 2: Last punch-out for department → start close (fallback)
INSERT INTO engine_trigger (event_type, process_id, condition, delay_seconds, is_active) VALUES
('shift.last_checkout', 'daily_close', null, 300, true);  -- 5min delay
```

**Step 2: Apply migration**

**Step 3: Verify seed data**

Run SQL: `SELECT p.id, COUNT(s.id) FROM engine_process p LEFT JOIN engine_step s ON s.process_id = p.id GROUP BY p.id;`
Expected: `daily_close | 10`

**Step 4: Commit**

```bash
git add supabase/migrations/20260304300000_seed_daily_close_process.sql
git commit -m "feat(engine): seed daily_close process — 10 steps, 2 triggers"
```

---

## Phase 4: OCR Pipeline

> Edge Function that accepts settlement images, runs OCR via Google Vision API, extracts financial data, and stores results.

### Task 8: Create OCR Edge Function

**Files:**

- Create: `supabase/functions/process-settlement-image/index.ts`
- Modify: `supabase/functions/config.toml` — add `verify_jwt = false` entry

**Docs to check:**

- `docs/modules/SMARTOUT_MODULE_10_REPORTS.md` §3.2 — OCR pipeline spec
- `supabase/functions/_shared/auth-middleware.ts` — dual-auth pattern

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/process-settlement-image/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OcrParsedData {
  total_sales: number | null;
  card_total: number | null;
  cash_total: number | null;
  vat_amount: number | null;
  transaction_count: number | null;
}

// Financial parser — regex patterns for Norwegian POS/terminal output
function parseFinancialData(rawText: string): OcrParsedData {
  const patterns = {
    total_sales: [
      /(?:TOTAL|TOTALT|SUM|OMSETNING)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i,
      /(?:Total\s+salg|Dagssalg)\s*:?\s*([\d\s]+[.,]\d{2})/i,
    ],
    card_total: [
      /(?:KORT|CARD|VISA|MASTERCARD|BANK)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i,
      /(?:Korttransaksjoner|Kortbetaling)\s*:?\s*([\d\s]+[.,]\d{2})/i,
    ],
    cash_total: [/(?:KONTANT|CASH|KONTANTER)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i],
    vat_amount: [/(?:MVA|VAT|MOMS)\s*:?\s*(?:NOK|kr)?\s*([\d\s]+[.,]\d{2})/i],
    transaction_count: [/(?:ANTALL|COUNT|TRANSAKSJONER|Trans)\s*:?\s*(\d+)/i],
  };

  function extractFirst(patternList: RegExp[]): number | null {
    for (const pattern of patternList) {
      const match = rawText.match(pattern);
      if (match?.[1]) {
        const cleaned = match[1].replace(/\s/g, "").replace(",", ".");
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
    }
    return null;
  }

  return {
    total_sales: extractFirst(patterns.total_sales),
    card_total: extractFirst(patterns.card_total),
    cash_total: extractFirst(patterns.cash_total),
    vat_amount: extractFirst(patterns.vat_amount),
    transaction_count: extractFirst(patterns.transaction_count),
  };
}

// Calculate confidence based on how many fields were extracted
function calculateConfidence(parsed: OcrParsedData): number {
  const fields = [
    parsed.total_sales,
    parsed.card_total,
    parsed.cash_total,
    parsed.vat_amount,
    parsed.transaction_count,
  ];
  const extracted = fields.filter((f) => f !== null).length;
  return extracted / fields.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_id } = await req.json();
    if (!image_id) {
      return new Response(JSON.stringify({ error: "image_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch image record
    const { data: image, error: fetchErr } = await supabase
      .from("settlement_image")
      .select("*")
      .eq("image_id", image_id)
      .single();

    if (fetchErr || !image) {
      return new Response(JSON.stringify({ error: "Image not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Download image from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("settlements")
      .download(image.storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Run OCR via Google Vision API
    const imageBytes = await fileData.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBytes)));

    const visionApiKey = Deno.env.get("GOOGLE_VISION_API_KEY");
    if (!visionApiKey) {
      return new Response(JSON.stringify({ error: "OCR not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      },
    );

    const visionResult = await visionResponse.json();
    const rawText = visionResult.responses?.[0]?.fullTextAnnotation?.text ?? "";

    // 4. Parse financial data
    const parsed = parseFinancialData(rawText);
    const confidence = calculateConfidence(parsed);

    // 5. Store results
    const { error: updateErr } = await supabase
      .from("settlement_image")
      .update({
        ocr_raw_text: rawText,
        ocr_parsed: parsed,
        ocr_confidence: confidence,
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("image_id", image_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to store OCR results" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        image_id,
        confidence,
        parsed,
        raw_text_length: rawText.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Add to config.toml**

Add `[functions.process-settlement-image]` with `verify_jwt = false` (will use service role internally).

**Step 3: Commit**

```bash
git add supabase/functions/process-settlement-image/index.ts supabase/functions/config.toml
git commit -m "feat(ocr): add process-settlement-image Edge Function with Google Vision + financial parser"
```

---

### Task 9: Create settlement validation Edge Function

**Files:**

- Create: `supabase/functions/validate-settlement/index.ts`

**Step 1: Write the validation function**

This function:

1. Reads all `settlement_image` OCR results for a reconciliation
2. Cross-validates POS total vs terminal total
3. Checks against workspace tolerance policy
4. Creates `settlement_validation` record
5. Auto-creates `deviation` if mismatch exceeds threshold
6. Updates `daily_reconciliation` status to `awaiting_approval`

Keep logic in the Edge Function, not repeated here for brevity. Follow the exact cross-match logic from Module 10 §3.2:

```
difference = abs(pos_total - terminal_total)
if difference > tolerance → createDeviation("settlement_mismatch")
```

**Step 2: Commit**

```bash
git add supabase/functions/validate-settlement/index.ts supabase/functions/config.toml
git commit -m "feat(settlement): add validate-settlement Edge Function — cross-match + deviation"
```

---

## Phase 5: Employee Close-Out UI

> The screen closing employees see when their shift ends. Progress-based, blocks checkout until complete.

### Task 10: Create the close-out page

**Files:**

- Create: `apps/web/src/app/dashboard/close/page.tsx` — server component
- Create: `apps/web/src/app/dashboard/close/_components/CloseOutFlow.tsx` — client flow
- Create: `apps/web/src/app/dashboard/close/_components/ImageUpload.tsx` — settlement image upload
- Create: `apps/web/src/app/dashboard/close/_components/ChecklistSection.tsx` — closing tasks
- Create: `apps/web/src/app/dashboard/close/_components/GatekeeperStatus.tsx` — lock/unlock status
- Create: `apps/web/src/app/dashboard/close/_hooks/useCloseOut.ts` — TanStack Query hooks

**Key UI requirements (from PD §11):**

- Progress-based stepper
- Green = OK, Red = blocked
- Immediate feedback on each step
- Mobile-friendly (closing employee uses phone)

**Step 1: Write the server page**

```typescript
// apps/web/src/app/dashboard/close/page.tsx
import { CloseOutFlow } from "./_components/CloseOutFlow";

export default function CloseOutPage() {
  return <CloseOutFlow />;
}
```

**Step 2: Write CloseOutFlow (stepper UI)**

4-step flow:

1. Closing checklist (critical tasks)
2. Settlement images (upload POS + terminal)
3. Review & comment deviations
4. Submit for approval

Use shadcn/ui Stepper pattern, disabled forward until conditions met.

**Step 3: Write ImageUpload**

Drag-and-drop or camera capture for settlement images. Upload to Supabase Storage at `{workspace_id}/settlements/{date}/`. Create `settlement_image` row. Trigger OCR Edge Function on upload complete.

**Step 4: Write GatekeeperStatus**

Shows 5 conditions with green/red indicators:

- Closing checklist complete
- Settlement images uploaded (min 2)
- OCR validated OR manual entry
- Critical deviations commented
- Reconciliation ready

**Step 5: Commit per component (4 commits)**

---

## Phase 6: Admin Approval Dashboard

> Where admin/manager reviews and approves the day.

### Task 11: Create the reconciliation approval page

**Files:**

- Create: `apps/web/src/app/dashboard/reconciliation/page.tsx`
- Create: `apps/web/src/app/dashboard/reconciliation/_components/DayList.tsx` — traffic light list
- Create: `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx` — approval view
- Create: `apps/web/src/app/dashboard/reconciliation/_components/RevenueSection.tsx`
- Create: `apps/web/src/app/dashboard/reconciliation/_components/ShiftApprovalSection.tsx`
- Create: `apps/web/src/app/dashboard/reconciliation/_components/DeviationSection.tsx`
- Create: `apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts`

**Key UI requirements (from Module 10 §3.3):**

- Day list with traffic lights: red (overdue), yellow (pending), green (approved)
- Approval view has 4 sections: Revenue, Labor/Shifts, Deviations, Tasks
- OCR images viewable (tap to enlarge)
- Manual correction with required justification
- Approve / Reject / Request Clarification buttons
- Preconditions: all shifts handled, revenue confirmed, HIGH/CRITICAL deviations addressed

**Step 1: Write DayList** — TanStack Query fetching `daily_reconciliation` ordered by date desc, grouped by status.

**Step 2: Write DayApproval** — Tab-based view with Revenue, Shifts, Deviations, Tasks sections.

**Step 3: Write approval logic** — Mutation that updates `daily_reconciliation.status` to `approved`, calculates KPIs, fires `reconciliation.approved` event.

**Step 4: Commit per component**

---

## Phase 7: Wire It Together

### Task 12: Create the engine event dispatcher

**Files:**

- Create: `supabase/functions/engine-dispatch/index.ts`

This is the core runtime loop:

1. Receive an event (via HTTP or pg_notify)
2. Match against `engine_trigger` table
3. For matches with delay: insert into `engine_delayed_trigger`
4. For immediate matches: create `engine_state`, snapshot steps, start execution
5. For each step: evaluate condition, resolve assignee, execute action
6. Handle `wait_for_event` by setting state to `waiting`

**Step 1: Write the dispatcher**

**Step 2: Add pg_cron job for delayed triggers and timeouts**

```sql
-- Check delayed triggers every minute
SELECT cron.schedule('engine-delayed-triggers', '* * * * *', $$
  SELECT engine_fire_delayed_triggers();
$$);

-- Check stuck/timed-out states every hour
SELECT cron.schedule('engine-stuck-states', '0 * * * *', $$
  SELECT engine_check_stuck_states();
$$);
```

**Step 3: Commit**

---

### Task 13: Add ADR for the decision

**Files:**

- Create: `docs/decisions/ADR-0043-daily-close-engine.md`

Document:

- Decision to use the state machine engine for DailyClose
- Decision to keep engine tables in `public` schema with `engine_` prefix
- Decision to use Google Vision API for OCR
- Decision to implement gatekeeper as engine step (not middleware)

Register in `docs/decisions/0000-decision-log.md`.

**Step 1: Write ADR using template**

**Step 2: Commit**

---

## Summary: Task Dependency Graph

```
Phase 1 (Engine Foundation)
  Task 1: Engine tables migration
  Task 2: Engine types (Zod)        ← Task 1
  Task 3: Condition evaluator       ← Task 2

Phase 2 (Domain Data)
  Task 4: department_session        ← Task 1
  Task 5: daily_reconciliation      ← Task 4
  Task 6: deviation + shift_approval ← Task 5

Phase 3 (Process Definition)
  Task 7: Seed daily_close process  ← Task 1

Phase 4 (OCR Pipeline)
  Task 8: OCR Edge Function         ← Task 5
  Task 9: Validation Edge Function  ← Task 6, Task 8

Phase 5 (Employee UI)
  Task 10: Close-out page           ← Task 5, Task 8

Phase 6 (Admin UI)
  Task 11: Approval dashboard       ← Task 6

Phase 7 (Integration)
  Task 12: Engine dispatcher        ← Task 3, Task 7
  Task 13: ADR                      ← all
```

**Critical path:** Task 1 → Task 4 → Task 5 → Task 6 → Task 9 → Task 11

**Parallelizable:** Tasks 2-3 (types + evaluator) can run alongside Tasks 4-6 (domain tables). Task 7 (seed) and Tasks 8-9 (OCR) can run in parallel after their deps.

---

## Scope Boundaries

**In scope (this plan):**

- State machine engine (6 tables + condition evaluator)
- DailyClose process definition (10 steps, 2 triggers)
- Department session table
- Daily reconciliation + settlement + deviation + shift approval tables
- OCR pipeline (Edge Function + Google Vision)
- Employee close-out UI
- Admin approval dashboard
- Engine event dispatcher (runtime)

**Out of scope (future work):**

- Handoff Motor (AI chat → phone escalation) — needs Module 9 + 12
- Role Reconciliation — Module 10 Phase 8
- Season Reconciliation — Module 10 Phase 9
- KPI Dashboard with live alerts — Module 10 Phase 4-5
- Fraud prevention layer (image hash, AI detection) — PD §10
- QR-based location routines — Module 10 Phase 7
- Self-learning factor adjustment — Module 15 Phase 9-10
