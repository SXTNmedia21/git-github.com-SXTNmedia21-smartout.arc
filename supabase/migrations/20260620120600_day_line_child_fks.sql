-- supabase/migrations/20260620120600_day_line_child_fks.sql
-- ADR-0367 §4.6 + Rule 1b. session_hook is template per (workspace, dept, hook_type)
-- — NOT receiving day_line_id. Add UNIQUE constraint to enforce template uniqueness
-- (closes L-0311 schema-invariant-prose-requires-enforcement).

-- 1. day_line_id additions (NOT on session_hook).
ALTER TABLE session_task         ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE schedule_day_booking ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);
ALTER TABLE deviation            ADD COLUMN day_line_id UUID REFERENCES day_line(day_line_id);

-- 2. session_task.scheduled_at — required for push-pipeline time-based items.
ALTER TABLE session_task ADD COLUMN scheduled_at TIMESTAMPTZ;

-- 3. Partial indexes — only index rows that are actually bound.
CREATE INDEX idx_session_task_day_line         ON session_task(day_line_id)         WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_schedule_day_booking_day_line ON schedule_day_booking(day_line_id) WHERE day_line_id IS NOT NULL;
CREATE INDEX idx_deviation_day_line            ON deviation(day_line_id)            WHERE day_line_id IS NOT NULL;

CREATE INDEX idx_session_task_scheduled_pending
  ON session_task (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'pending';

-- 4. session_hook UNIQUE — enforce template invariant per L-0311.
ALTER TABLE session_hook
  ADD CONSTRAINT uq_session_hook_template UNIQUE (workspace_id, department_id, hook_type);

COMMENT ON CONSTRAINT uq_session_hook_template ON session_hook IS
  'ADR-0367 Rule 1b + L-0311. Template invariant: at most one hook per (workspace, dept, type).';
