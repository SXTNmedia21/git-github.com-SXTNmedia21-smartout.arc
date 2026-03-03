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
