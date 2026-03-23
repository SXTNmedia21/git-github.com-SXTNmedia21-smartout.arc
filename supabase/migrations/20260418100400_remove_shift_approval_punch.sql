-- Remove punch_in/punch_out from shift_approval.
-- Punch data now lives in timesheet.time_entry (migration 20260418100000).
-- shift_approval only tracks hours approval, not raw punch timestamps.

ALTER TABLE public.shift_approval DROP COLUMN IF EXISTS punch_in;
ALTER TABLE public.shift_approval DROP COLUMN IF EXISTS punch_out;
