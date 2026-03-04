SET search_path TO public, extensions;

-- Add locale column to platform_communication_recipient for multilingual sending
ALTER TABLE platform_communication_recipient
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'no';

COMMENT ON COLUMN platform_communication_recipient.locale IS 'Recipient preferred language at time of send (from user_identity.preferred_language)';
