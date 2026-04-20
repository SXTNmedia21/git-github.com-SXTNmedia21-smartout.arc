SET search_path TO public, extensions;

-- ============================================
-- 20260501110000_seed_contract_engine_processes.sql
-- Seeds engine processes for the contract composition flow:
--   contract_data_intake  — collects missing employee PII (chat-only, ADR-0078)
--   contract_signing      — employee reviews and signs via DocuSeal (chat-only)
-- ============================================

-- ── contract_data_intake process (chat-only per ADR-0078) ──────────────

INSERT INTO engine_process (id, name, description, allowed_channels)
VALUES (
  'contract_data_intake',
  'Contract Data Intake',
  'Collects missing employee PII for employment contract. Chat-only per ADR-0078.',
  ARRAY['chat']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_channels = EXCLUDED.allowed_channels,
  description = EXCLUDED.description;

-- Steps: bundled groups (spec decision 3.1)
INSERT INTO engine_step (process_id, step_order, action_type, action_payload) VALUES
  ('contract_data_intake', 1, 'assign_task', '{
    "group": "identity",
    "fields": ["personal_number", "address_line1", "postal_code", "city"],
    "empathy_copy": "Vi trenger noen opplysninger for arbeidsavtalen din."
  }'::jsonb),
  ('contract_data_intake', 2, 'assign_task', '{
    "group": "banking",
    "fields": ["bank_account"],
    "empathy_copy": "Hvor skal loennen din utbetales?"
  }'::jsonb)
ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── contract_signing process (chat-only per ADR-0078) ──────────────────

INSERT INTO engine_process (id, name, description, allowed_channels)
VALUES (
  'contract_signing',
  'Contract Signing',
  'Employee reviews, acknowledges rights, and signs via DocuSeal. Chat-only per ADR-0078.',
  ARRAY['chat']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_channels = EXCLUDED.allowed_channels,
  description = EXCLUDED.description;

INSERT INTO engine_step (process_id, step_order, action_type, action_payload) VALUES
  ('contract_signing', 1, 'assign_task', '{
    "task_type": "review",
    "description": "Les gjennom arbeidsavtalen"
  }'::jsonb),
  ('contract_signing', 2, 'assign_task', '{
    "task_type": "acknowledge",
    "description": "Bekreft at du forstaar dine rettigheter"
  }'::jsonb),
  ('contract_signing', 3, 'assign_task', '{
    "task_type": "collect_signature",
    "description": "Signer arbeidsavtalen via DocuSeal",
    "external": true
  }'::jsonb)
ON CONFLICT (process_id, step_order) DO NOTHING;
