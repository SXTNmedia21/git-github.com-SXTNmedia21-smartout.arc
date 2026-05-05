-- ============================================
-- 20260520110000_engine_state_scheduling.sql
-- Phase 0 (Crown) — heartbeat-dispatcher prerequisites.
-- Strictly additive: 4 nullable columns + extended status CHECK + 1 seed.
-- Existing rows unaffected (scheduled_for IS NULL, mission_id IS NULL).
-- See docs/plans/PLAN-arena-harness-migration.md §Phase 0 Step 0.1
-- and docs/superpowers/plans/2026-04-29-arena-harness-phase-0-crown.md Task 2.
-- ============================================

-- ── Columns ───────────────────────────────────────────────────
ALTER TABLE public.engine_state
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence       interval,
  ADD COLUMN IF NOT EXISTS dispatch_lock_id uuid,
  ADD COLUMN IF NOT EXISTS mission_id       text;

COMMENT ON COLUMN public.engine_state.scheduled_for IS
  'Heartbeat dispatch time. NULL = legacy/run-now. Past timestamp = ready for pickup.';
COMMENT ON COLUMN public.engine_state.recurrence IS
  'Re-schedule interval after terminal status. NULL = one-shot.';
COMMENT ON COLUMN public.engine_state.dispatch_lock_id IS
  'Set by heartbeat under FOR UPDATE SKIP LOCKED to prevent double-dispatch.';
COMMENT ON COLUMN public.engine_state.mission_id IS
  'Mission folder slug under docs/journeys/. Bridges engine_state and engine_sessions ontologies (B1 gap, ADR-0245).';

-- ── Extend status CHECK to include 'scheduled' ────────────────
-- NOTE: live constraint (confirmed 2026-04-29) includes 'blocked' which is
-- not in the original migration spec. We preserve 'blocked' here so existing
-- rows and code that sets status='blocked' continue to work.
ALTER TABLE public.engine_state
  DROP CONSTRAINT IF EXISTS engine_state_status_check;

ALTER TABLE public.engine_state
  ADD CONSTRAINT engine_state_status_check
  CHECK (status IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated', 'blocked', 'scheduled'));

-- ── Dispatch index: only scheduled rows past their scheduled_for ──
CREATE INDEX IF NOT EXISTS idx_engine_state_dispatch
  ON public.engine_state (scheduled_for)
  WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

-- ── Mission index: lookup by mission slug ─────────────────────
CREATE INDEX IF NOT EXISTS idx_engine_state_mission
  ON public.engine_state (mission_id)
  WHERE mission_id IS NOT NULL;

-- ── Seed the engine_process row for dev-arena-bootstrap ───────
-- engine_state.process_id is FK → engine_process.id (TEXT PK).
-- The dummy mission needs a process row to satisfy the FK. Seeded
-- here (vs Task 5 mission folder) so the schema migration is
-- self-sufficient and harness-candidate-0 can run progressing past
-- insert into the terminal-timeout failure mode (no dispatcher yet).
-- Steps live in docs/journeys/dev-arena-bootstrap/ir/journey.yaml
-- per parent plan §architectural premise.
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active, max_steps)
VALUES (
  'dev-arena-bootstrap',
  'Dev Arena Bootstrap',
  'Phase 0 (Crown) dummy mission. Heartbeat-dispatcher smoke test. No side effects. Steps live in docs/journeys/dev-arena-bootstrap/ir/journey.yaml.',
  NULL,
  true,
  10
)
ON CONFLICT (id) DO NOTHING;
