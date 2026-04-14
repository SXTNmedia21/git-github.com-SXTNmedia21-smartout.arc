-- Must be a separate migration because ALTER TYPE ADD VALUE
-- cannot run inside a transaction block.
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'not_started';
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'waived';
