-- Cascade Operational Layer — schema additions
-- Adds snapshot_basis enum and cost provenance columns to shift_cost_snapshot

CREATE TYPE snapshot_basis AS ENUM ('planned', 'actual');

ALTER TABLE shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS basis snapshot_basis NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS source_event TEXT,
  ADD COLUMN IF NOT EXISTS effective_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_end TIMESTAMPTZ;

COMMENT ON COLUMN shift_cost_snapshot.basis IS 'planned = publish-time estimate, actual = completion-time truth';
COMMENT ON COLUMN shift_cost_snapshot.effective_start IS 'The start timestamp used for this cost calculation';
COMMENT ON COLUMN shift_cost_snapshot.effective_end IS 'The end timestamp used for this cost calculation';
