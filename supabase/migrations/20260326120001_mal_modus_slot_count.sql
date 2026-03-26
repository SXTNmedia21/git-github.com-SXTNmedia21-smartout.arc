ALTER TABLE schedule_template_shift
ADD COLUMN slot_count integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN schedule_template_shift.slot_count
IS 'Number of employees needed for this shift type per day';
