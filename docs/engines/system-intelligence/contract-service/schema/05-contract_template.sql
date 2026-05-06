-- =============================================================================
-- 05 — contract_template (utvidelse)
-- =============================================================================
-- Eksisterende tabell. Utvides med default obligations, default pay rules,
-- og versjonering for snapshot-pattern.
--
-- Antagelse: tabellen har allerede minst:
--   id, workspace_id, name, role_capability_id (eller tilsvarende),
--   defaults_json (eller per-felt defaults), created_at, updated_at

ALTER TABLE contract_template
  ADD COLUMN IF NOT EXISTS obligations_template jsonb
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_pay_rules jsonb
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_tip_rule jsonb,
  ADD COLUMN IF NOT EXISTS version integer
    NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by_template_id uuid
    REFERENCES contract_template(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean
    NOT NULL DEFAULT true;

-- =============================================================================
-- JSON-schema-validering (light — full validering i app-lag)
-- =============================================================================

ALTER TABLE contract_template
  ADD CONSTRAINT contract_template_obligations_is_array
    CHECK (jsonb_typeof(obligations_template) = 'array');

ALTER TABLE contract_template
  ADD CONSTRAINT contract_template_pay_rules_is_array
    CHECK (jsonb_typeof(default_pay_rules) = 'array');

-- =============================================================================
-- Indekser
-- =============================================================================

CREATE INDEX IF NOT EXISTS contract_template_active
  ON contract_template (workspace_id, is_active);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN contract_template.obligations_template IS
  'Array av obligation-definitions (uten contract_id). Eksempel: '
  '[{"obligation_type":"training_required","policy_id":"...","due_within_days":14,"is_blocker":true}]. '
  'Kopieres til contract_obligation ved compose, ikke live-link.';

COMMENT ON COLUMN contract_template.default_pay_rules IS
  'Array av pay-rule-templates. Kopieres til contract_pay_rule ved compose.';

COMMENT ON COLUMN contract_template.default_tip_rule IS
  'Default tip-rule-template (object). Kopieres til contract_tip_rule ved compose.';

COMMENT ON COLUMN contract_template.version IS
  'Mal-versjon. Ved endring: ny rad opprettes (ikke UPDATE), gammel markeres '
  'superseded. Eksisterende kontrakter er snapshot, ikke live-bound.';
