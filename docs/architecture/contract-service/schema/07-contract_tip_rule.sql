-- =============================================================================
-- 07 — contract_tip_rule (ny)
-- =============================================================================
-- Tipsregler per kontrakt. Egen tabell pga distinkt distribusjons-mekanikk
-- som ikke passer inn i contract_pay_rule.
--
-- Per ADR-review: tip_share som numerisk verdi (0.00–1.50), IKKE enum.
-- Reelle pools bruker shares vektet med timer/stilling.

CREATE TABLE contract_tip_rule (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid NOT NULL
                          REFERENCES employment_contract(id) ON DELETE CASCADE,
  distribution_method   tip_distribution_method NOT NULL,
  tip_share             numeric(3,2) NOT NULL DEFAULT 1.00,
  tip_share_modifier    text,                              -- "trial_period_reduced", "trainee", etc.
  tip_pool_id           uuid,                              -- gruppering hvis pool
  taxable               boolean NOT NULL DEFAULT true,     -- skattepliktig fra 2019
  reporting_method      text NOT NULL DEFAULT '911',       -- A-melding-kode
  effective_from        date NOT NULL,
  effective_until       date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- tip_share rimelig (0 = ingen, 1.5 = senior/leder)
  CONSTRAINT contract_tip_rule_share_range
    CHECK (tip_share >= 0 AND tip_share <= 5.00),

  -- pool kun hvis distribution = pool
  CONSTRAINT contract_tip_rule_pool_only_for_pool_method
    CHECK (
      (distribution_method = 'pool' AND tip_pool_id IS NOT NULL)
      OR (distribution_method != 'pool')
    ),

  -- Effective-vindu konsistent
  CONSTRAINT contract_tip_rule_effective_order
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- =============================================================================
-- Indekser
-- =============================================================================

-- Aktiv tip-rule per kontrakt
CREATE INDEX contract_tip_rule_contract_active
  ON contract_tip_rule (contract_id, effective_from, effective_until);

-- Pool-medlemskap lookup
CREATE INDEX contract_tip_rule_pool
  ON contract_tip_rule (tip_pool_id)
  WHERE tip_pool_id IS NOT NULL;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE contract_tip_rule IS
  'Tipsregler per kontrakt. tip_share er numerisk (ikke enum) for å støtte '
  'reelle pool-mekanikker (bartender 1.0, runner 0.6, kjøkken 0.0, trainee 0.5).';

COMMENT ON COLUMN contract_tip_rule.tip_share IS
  'Andel av tip-pool. 1.00 = full share. 0.00 = ingen deltakelse. >1.0 brukes for senior/leder.';

COMMENT ON COLUMN contract_tip_rule.tip_share_modifier IS
  'Sporbar grunn for avvik fra 1.00. Eksempler: "trial_period_reduced", "trainee", '
  '"senior_bonus", "manager_share". Audit-trail for hvorfor share er som den er.';

COMMENT ON COLUMN contract_tip_rule.distribution_method IS
  'per_shift_hours = standard Riksavtalen, vektet med timer. '
  'per_position = fast share per stilling. '
  'fixed_percentage = fast prosent av total. '
  'pool = delt mellom team via tip_pool_id.';

COMMENT ON COLUMN contract_tip_rule.taxable IS
  'Skattepliktig. Default true siden 2019. False kun for spesielle saker.';
