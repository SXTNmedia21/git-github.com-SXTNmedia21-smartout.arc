SET search_path TO public, extensions;

-- ============================================
-- 20260412100100_engine_state_step.sql
-- Per-step completion tracking on engine_state instances.
-- Mirrors engine_step schema but tracks runtime execution.
-- Source: Module Zero to Production — Week 2
-- ============================================

CREATE TABLE IF NOT EXISTS public.engine_state_step (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id        UUID NOT NULL REFERENCES engine_state(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'failed')),
  action_type     TEXT NOT NULL,
  action_payload  JSONB NOT NULL DEFAULT '{}',
  condition       JSONB,
  assignee_rule   TEXT,
  completed_by    UUID REFERENCES profile(profile_id),
  completed_at    TIMESTAMPTZ,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_state_step_order UNIQUE (state_id, step_order)
);

ALTER TABLE engine_state_step ENABLE ROW LEVEL SECURITY;

-- SELECT: cascading RLS via subquery.
-- The subquery `SELECT id FROM engine_state` is filtered by engine_state's OWN RLS policies,
-- which enforce workspace_id scoping. This means a user can only see steps for states they
-- can already access. This avoids duplicating workspace_id on this table while maintaining
-- full row-level isolation. The pattern is safe because PostgreSQL applies RLS to the
-- subquery target (engine_state) before returning results.
DROP POLICY IF EXISTS "read_engine_state_step" ON engine_state_step;
CREATE POLICY "read_engine_state_step" ON engine_state_step
FOR SELECT USING (
  state_id IN (SELECT id FROM engine_state)
);

-- Service role: full access
DROP POLICY IF EXISTS "manage_engine_state_step" ON engine_state_step;
CREATE POLICY "manage_engine_state_step" ON engine_state_step
FOR ALL USING (auth.role() = 'service_role');

-- Lookup by state + order (primary query path)
CREATE INDEX IF NOT EXISTS idx_engine_state_step_state
  ON engine_state_step (state_id, step_order);

-- Find active/pending steps quickly
CREATE INDEX IF NOT EXISTS idx_engine_state_step_active
  ON engine_state_step (state_id, status)
  WHERE status IN ('pending', 'active');

-- Updated-at trigger
CREATE TRIGGER set_engine_state_step_updated_at
  BEFORE UPDATE ON public.engine_state_step
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE engine_state_step IS 'Per-step runtime tracking for engine_state instances. Mirrors engine_step but captures execution status.';
