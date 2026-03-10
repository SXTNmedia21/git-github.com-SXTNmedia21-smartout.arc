-- Add metadata JSONB column to invitation table for storing
-- unmapped CSV import data and other structured metadata.
ALTER TABLE invitation
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN invitation.metadata IS
  'Structured metadata from CSV import or other sources. Unmapped CSV columns stored here.';
