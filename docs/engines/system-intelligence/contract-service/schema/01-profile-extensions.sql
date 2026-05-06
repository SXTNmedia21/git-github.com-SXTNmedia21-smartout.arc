-- =============================================================================
-- 01 — profile (utvidelse)
-- =============================================================================
-- Eksisterende tabell. Legger til Tripletex-mapping per ADR-0001 D1.
-- profile er master, Tripletex er integrasjonsmål.

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS tripletex_employee_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS tripletex_sync_status sync_status_enum NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS tripletex_last_synced_at timestamptz;

COMMENT ON COLUMN profile.tripletex_employee_id IS
  'Ekstern ID i Tripletex. Smartout master, push-sync. Unique for å forhindre dobbel-mapping.';

COMMENT ON COLUMN profile.tripletex_sync_status IS
  'Status for Tripletex-sync. divergent = oppdaget drift ved reconciliation-pull.';
