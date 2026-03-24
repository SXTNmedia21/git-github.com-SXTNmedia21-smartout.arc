-- Add GPS tracking for punch-out and break start/end locations
-- Stored as JSONB to accommodate varying GPS accuracy fields without schema changes

ALTER TABLE timesheet.time_entry
  ADD COLUMN IF NOT EXISTS punch_out_location JSONB,
  ADD COLUMN IF NOT EXISTS break_locations JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN timesheet.time_entry.punch_out_location IS 'GPS at punch-out: {lat, lng, accuracy, timestamp}';
COMMENT ON COLUMN timesheet.time_entry.break_locations IS 'GPS at break start/end: [{start: {lat,lng}, end: {lat,lng}}]';
COMMENT ON COLUMN timesheet.time_entry.notes IS 'Optional employee notes during shift';
