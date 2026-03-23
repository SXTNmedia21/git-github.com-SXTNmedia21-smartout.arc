-- Per-contract file attachments (PDF, images)
-- Platform-admin only — accessed via service_role (createAdminClient)

CREATE TABLE contract_attachment (
  attachment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES contract(contract_id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      INTEGER,
  display_order  SMALLINT DEFAULT 0,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_attachment ENABLE ROW LEVEL SECURITY;

-- No RLS policies — all access is service_role via createAdminClient()

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contract_attachment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
