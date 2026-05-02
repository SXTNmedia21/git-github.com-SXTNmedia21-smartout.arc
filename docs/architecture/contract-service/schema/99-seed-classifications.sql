-- =============================================================================
-- 99 — Seed: field_classification_metadata
-- =============================================================================
-- Seeder klassifikasjoner fra ADR-0001.
-- Drives av amendment-handler. Endringer her trer i kraft umiddelbart for
-- nye amendments (gamle amendments lagrer klassifikasjon-snapshot).

-- =============================================================================
-- employment_contract
-- =============================================================================

INSERT INTO field_classification_metadata (table_name, column_name, classification, conditional_rule, notes) VALUES
  ('employment_contract', 'id',                          'system',   NULL, NULL),
  ('employment_contract', 'profile_id',                  'system',   NULL, 'Bytte ansatt = ny kontrakt'),
  ('employment_contract', 'created_at',                  'system',   NULL, NULL),
  ('employment_contract', 'updated_at',                  'system',   NULL, NULL),
  ('employment_contract', 'signed_at',                   'system',   NULL, NULL),
  ('employment_contract', 'signed_by_employee_at',       'system',   NULL, NULL),
  ('employment_contract', 'signed_by_employer_at',       'system',   NULL, NULL),
  ('employment_contract', 'pdf_url',                     'system',   NULL, NULL),
  ('employment_contract', 'contract_status',             'system',   NULL, 'Drives av flow, ikke admin-input'),
  ('employment_contract', 'superseded_by_contract_id',   'system',   NULL, NULL),

  ('employment_contract', 'job_title',                   'material', NULL, 'Stillingsendring krever consent'),
  ('employment_contract', 'employment_form',             'material', NULL, 'permanent ↔ temporary = stort skille'),
  ('employment_contract', 'employment_role',             'material', NULL, 'main vs secondary'),
  ('employment_contract', 'start_date',                  'material', 'after_signing_only', 'Endring før signering = admin'),
  ('employment_contract', 'end_date',                    'material', 'when_temporary',     'Kun for temporary'),
  ('employment_contract', 'working_hours_scheme',        'material', NULL, 'Skift vs ikke-skift'),
  ('employment_contract', 'agreed_weekly_hours',         'material', NULL, NULL),
  ('employment_contract', 'monthly_salary',              'material', NULL, NULL),
  ('employment_contract', 'hourly_rate',                 'material', NULL, NULL),
  ('employment_contract', 'remuneration_type',           'material', NULL, NULL),
  ('employment_contract', 'tariff_id',                   'material', NULL, 'Tariff-bytte = consent'),
  ('employment_contract', 'trial_period_months',         'material', NULL, 'Forlengelse kun ved sykefravær iht. lov'),
  ('employment_contract', 'notice_period_months',        'material', NULL, NULL),

  ('employment_contract', 'employment_percentage',       'derived',  NULL, 'Beregnes fra weekly_hours / workspace_baseline'),

  ('employment_contract', 'end_date_reason',             'admin',    NULL, 'Settes av admin ved opphør'),
  ('employment_contract', 'break_minutes_per_day',       'admin',    'workspace_default_unless_deviation', 'MATERIAL hvis avvik fra workspace-standard'),
  ('employment_contract', 'training_rights',             'admin',    NULL, 'Informasjonsplikt'),
  ('employment_contract', 'occupation_code',             'admin',    NULL, 'Statistisk reklassifisering'),
  ('employment_contract', 'variable_hours_arrangement',  'material', NULL, 'Endring i variable-hours-ordning'),
  ('employment_contract', 'overtime_cap_policy_id',      'material', NULL, 'Endring i overtime-grenser');

-- =============================================================================
-- employee_payroll_profile
-- =============================================================================

INSERT INTO field_classification_metadata (table_name, column_name, classification, conditional_rule, notes) VALUES
  ('employee_payroll_profile', 'id',                       'system',   NULL, NULL),
  ('employee_payroll_profile', 'profile_id',               'system',   NULL, NULL),
  ('employee_payroll_profile', 'created_at',               'system',   NULL, NULL),
  ('employee_payroll_profile', 'updated_at',               'system',   NULL, NULL),
  ('employee_payroll_profile', 'tripletex_employee_id',    'system',   NULL, NULL),
  ('employee_payroll_profile', 'sync_status',              'system',   NULL, NULL),
  ('employee_payroll_profile', 'last_synced_at',           'system',   NULL, NULL),

  ('employee_payroll_profile', 'tax_table_number',         'derived',  NULL, 'Hentes fra Skatteetaten'),
  ('employee_payroll_profile', 'tax_card_type',            'derived',  NULL, 'Skatteetaten'),
  ('employee_payroll_profile', 'tax_percentage',           'derived',  NULL, 'Skatteetaten'),
  ('employee_payroll_profile', 'tax_card_fetched_at',      'system',   NULL, NULL),
  ('employee_payroll_profile', 'tax_card_year',            'system',   NULL, NULL),

  ('employee_payroll_profile', 'holiday_allowance_pct',    'admin',    NULL, 'Låst per år; endring må gjelde alle'),
  ('employee_payroll_profile', 'extra_holiday_week',       'admin',    NULL, 'Kan utvides, ikke fjernes ensidig'),
  ('employee_payroll_profile', 'pension_scheme_id',        'admin',    NULL, 'Ansatt skal informeres'),
  ('employee_payroll_profile', 'pension_opt_out',          'admin',    NULL, 'Ansatt-initiert'),
  ('employee_payroll_profile', 'trade_union_member',       'admin',    NULL, 'Ansatt-initiert'),
  ('employee_payroll_profile', 'trade_union_fee_amount',   'admin',    NULL, NULL),
  ('employee_payroll_profile', 'trade_union_name',         'admin',    NULL, NULL),
  ('employee_payroll_profile', 'payday_regular',           'admin',    NULL, 'Workspace-standard'),
  ('employee_payroll_profile', 'employee_number',          'admin',    NULL, NULL),

  ('employee_payroll_profile', 'seniority_start_date',     'material', NULL, 'Påvirker ansiennitet-baserte tillegg'),
  ('employee_payroll_profile', 'has_fagbrev',              'material', NULL, 'Påvirker fagbrev-tillegg'),
  ('employee_payroll_profile', 'tariff_override_id',       'material', NULL, 'Endring i tariff-binding');

-- =============================================================================
-- contract_pay_rule
-- =============================================================================

INSERT INTO field_classification_metadata (table_name, column_name, classification, conditional_rule, notes) VALUES
  ('contract_pay_rule', 'id',                  'system',   NULL, NULL),
  ('contract_pay_rule', 'contract_id',         'system',   NULL, NULL),
  ('contract_pay_rule', 'framework_rule_id',   'system',   NULL, 'Snapshot-peker'),
  ('contract_pay_rule', 'created_at',          'system',   NULL, NULL),
  ('contract_pay_rule', 'updated_at',          'system',   NULL, NULL),

  ('contract_pay_rule', 'rule_type',           'material', NULL, NULL),
  ('contract_pay_rule', 'salary_type_code',    'material', NULL, NULL),
  ('contract_pay_rule', 'trigger_condition',   'material', NULL, NULL),
  ('contract_pay_rule', 'rate_type',           'material', NULL, NULL),
  ('contract_pay_rule', 'rate_value',          'material', 'unless_tariff_linked', 'ADMIN hvis framework_rule_id satt og endring kommer fra tariff-revisjon'),
  ('contract_pay_rule', 'effective_from',      'material', 'retroactive_only', 'ADMIN hvis fram i tid'),
  ('contract_pay_rule', 'effective_until',     'material', NULL, NULL),
  ('contract_pay_rule', 'source_text',         'admin',    NULL, 'Tekstlig kilde-referanse');

-- =============================================================================
-- contract_tip_rule (alle MATERIAL — påvirker forventet inntekt)
-- =============================================================================

INSERT INTO field_classification_metadata (table_name, column_name, classification, conditional_rule, notes) VALUES
  ('contract_tip_rule', 'id',                    'system',   NULL, NULL),
  ('contract_tip_rule', 'contract_id',           'system',   NULL, NULL),
  ('contract_tip_rule', 'tip_pool_id',           'system',   NULL, NULL),
  ('contract_tip_rule', 'created_at',            'system',   NULL, NULL),
  ('contract_tip_rule', 'updated_at',            'system',   NULL, NULL),

  ('contract_tip_rule', 'distribution_method',   'material', NULL, NULL),
  ('contract_tip_rule', 'tip_share',             'material', NULL, NULL),
  ('contract_tip_rule', 'tip_share_modifier',    'material', NULL, NULL),
  ('contract_tip_rule', 'effective_from',        'material', NULL, NULL),
  ('contract_tip_rule', 'effective_until',       'material', NULL, NULL),

  ('contract_tip_rule', 'taxable',               'admin',    NULL, 'Drevet av lov, ikke avtale'),
  ('contract_tip_rule', 'reporting_method',      'admin',    NULL, 'A-melding-kode'),
  ('contract_tip_rule', 'notes',                 'admin',    NULL, NULL);

-- =============================================================================
-- contract_obligation (admin — kan endres uten re-signering)
-- =============================================================================
-- Merknad: status-overganger drives av ansatt/system, ikke amendment.
-- Endring i selve obligation-definisjonen (type, frist) er amendment hvis fra mal-endring.

INSERT INTO field_classification_metadata (table_name, column_name, classification, conditional_rule, notes) VALUES
  ('contract_obligation', 'id',                'system',   NULL, NULL),
  ('contract_obligation', 'contract_id',       'system',   NULL, NULL),
  ('contract_obligation', 'created_at',        'system',   NULL, NULL),
  ('contract_obligation', 'updated_at',        'system',   NULL, NULL),
  ('contract_obligation', 'started_at',        'system',   NULL, NULL),
  ('contract_obligation', 'completed_at',      'system',   NULL, NULL),
  ('contract_obligation', 'waived_at',         'system',   NULL, NULL),
  ('contract_obligation', 'waived_by_user_id', 'system',   NULL, NULL),
  ('contract_obligation', 'status',            'system',   NULL, 'Drives av flow'),

  ('contract_obligation', 'due_at',            'derived',  NULL, 'Beregnes fra start_date + due_within_days'),

  ('contract_obligation', 'obligation_type',   'admin',    NULL, NULL),
  ('contract_obligation', 'policy_id',         'admin',    NULL, NULL),
  ('contract_obligation', 'protocol_id',       'admin',    NULL, NULL),
  ('contract_obligation', 'due_within_days',   'admin',    NULL, NULL),
  ('contract_obligation', 'is_blocker',        'admin',    NULL, NULL),
  ('contract_obligation', 'reference_text',    'admin',    NULL, NULL),
  ('contract_obligation', 'waived_reason',     'admin',    NULL, NULL);
