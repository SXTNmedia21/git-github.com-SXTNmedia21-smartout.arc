-- Support ad-hoc shifts created at punch-in time
-- Ad-hoc shifts bypass pre-scheduling and require leader approval

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adhoc_approved_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS adhoc_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN schedule_shift.is_adhoc IS 'True if shift was created ad-hoc at punch-in (not scheduled)';
COMMENT ON COLUMN schedule_shift.adhoc_approved_by IS 'Profile who approved the ad-hoc shift; NULL if pending or not ad-hoc';
COMMENT ON COLUMN schedule_shift.adhoc_approved_at IS 'When the ad-hoc shift was approved';
