-- =============================================================================
-- 09 — contract_amendment (ny)
-- =============================================================================
-- Sporing av materielle endringer i kontrakt.
-- Drives av amendment-handler basert på field_classification_metadata.
-- 5 års lagring per Bokføringsloven §13.

CREATE TABLE contract_amendment (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                 uuid NOT NULL
                                REFERENCES employment_contract(id) ON DELETE RESTRICT,

  -- Endrings-metadata
  amendment_date              date NOT NULL DEFAULT CURRENT_DATE,
  change_summary              text NOT NULL,                  -- menneskelesbar oppsummering
  field_changes               jsonb NOT NULL,                 -- strukturert diff
  requires_resigning          boolean NOT NULL,               -- kalkulert fra felt-klassifisering

  -- Status og signering
  status                      amendment_status NOT NULL DEFAULT 'pending',
  signed_by_employee_at       timestamptz,
  signed_by_employer_at       timestamptz,
  rejected_at                 timestamptz,
  rejection_reason            text,
  expires_at                  timestamptz,                    -- f.eks. 30d frist for ansatt-svar
  pdf_url                     text,                           -- ny PDF generert ved godkjenning

  -- Audit
  created_by_user_id          uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Field-changes må være array av diff-objekter
  CONSTRAINT contract_amendment_field_changes_is_array
    CHECK (jsonb_typeof(field_changes) = 'array'),

  -- Accepted krever begge signaturer
  CONSTRAINT contract_amendment_accepted_requires_signatures
    CHECK (
      status != 'accepted'
      OR (signed_by_employee_at IS NOT NULL AND signed_by_employer_at IS NOT NULL)
    ),

  -- Rejected krever begrunnelse
  CONSTRAINT contract_amendment_rejected_requires_reason
    CHECK (
      status != 'rejected'
      OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
    )
);

-- =============================================================================
-- Indekser
-- =============================================================================

-- Pending amendments per kontrakt
CREATE INDEX contract_amendment_contract_status
  ON contract_amendment (contract_id, status);

-- Pending amendments som venter på ansatt
CREATE INDEX contract_amendment_pending_employee
  ON contract_amendment (status, expires_at)
  WHERE status = 'pending_employee_signature';

-- Audit: alle endringer over tid
CREATE INDEX contract_amendment_date
  ON contract_amendment (amendment_date DESC);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE contract_amendment IS
  'Endringssporing for kontrakter. MATERIAL-endringer krever ansatt-signering, '
  'ADMIN-endringer logges som audit-trail med requires_resigning=false. '
  'Bokføringsloven §13: 5 års lagring.';

COMMENT ON COLUMN contract_amendment.field_changes IS
  'Array av diff-objekter. Eksempel: '
  '[{"field":"monthly_salary","from":32000,"to":34000,"classification":"material"},'
  '{"field":"job_title","from":"Bartender","to":"Senior Bartender","classification":"material"}]';

COMMENT ON COLUMN contract_amendment.requires_resigning IS
  'TRUE hvis minst ett field_changes har classification=material. '
  'Kalkuleres av amendment-handler ved opprettelse, ikke endrebar etterpå.';

COMMENT ON COLUMN contract_amendment.expires_at IS
  'Frist for ansatt-aksept. Default 30d. Hvis ikke akseptert: status = expired, '
  'endring trer ikke i kraft.';
