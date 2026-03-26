ALTER TABLE schedule_shift
ADD COLUMN template_shift_id uuid REFERENCES schedule_template_shift(schedule_template_shift_id) ON DELETE SET NULL;

CREATE INDEX idx_schedule_shift_template_shift ON schedule_shift (template_shift_id)
WHERE template_shift_id IS NOT NULL;

COMMENT ON COLUMN schedule_shift.template_shift_id
IS 'Links this shift to the template shift that generated it. NULL for manually created shifts.';
