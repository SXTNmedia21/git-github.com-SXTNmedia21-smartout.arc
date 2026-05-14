-- 20260615100000_gdpr_§13_retention_fix.sql
-- ADR-0312 — GDPR §13 retention clock fix (regnskapsårets slutt anchor)
--
-- Fixes three simultaneous errors in 20260501120000_anonymize_contract_rpc.sql:17:
--   1. Wrong column: used created_at — should be end-of-life timestamp
--   2. Wrong interval: 3 years — Bokf.lov §13 requires 5 years
--   3. Wrong anchor: rolling-from-event — must anchor to regnskapsårets slutt (Dec-31)
--
-- Council Phase 5 APPROVED WITH CHANGES:
--   Q1a: strict 5yr Dec-31 anchor (buffer_months=0 v1, risk mgmt buffer deferred to future ADR)
--   Q2:  COALESCE(end_date, terminated_at, created_at) — end_date is §13 bilag anchor
--   Q3:  residual breach documented in HANDOFF
--
-- L-0042: timestamp verified. Dev HEAD max = 20260611100000. Both slots strictly greater.
-- Depends on: employment_contract (20260519100100), activity_trail (20260430182443)

SET search_path TO public, extensions;

-- ─── 1. Schema — ADD COLUMN declined_at + terminated_at ──────────────────────
-- L-0202: ADD COLUMN on existing table (no lifecycle independence from parent row).
-- NULL = not yet set. Populated retroactively by backfill below; going-forward by
-- trigger in 20260615100100_contract_status_timestamp_trigger.sql.

ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS declined_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.employment_contract.declined_at IS
  'Timestamp of transition to status=declined. Set by trg_contract_status_timestamps '
  '(20260615100100) on going-forward transitions; backfilled from activity_trail on '
  'historical rows. Used as GDPR Art. 17 clock anchor (3yr) — NOT Bokf.lov §13 '
  '(declined contracts produced no bilag).';

COMMENT ON COLUMN public.employment_contract.terminated_at IS
  'Timestamp of transition to status=terminated. Set by trg_contract_status_timestamps '
  '(20260615100100) on going-forward transitions; backfilled from activity_trail on '
  'historical rows. Fallback §13 anchor when no contractual end_date exists — see '
  'COALESCE order in anonymize_contract (ADR-0312).';

-- ─── 2. Backfill declined_at from activity_trail ─────────────────────────────
-- Primary: first status_changed event (event column) with new_value=declined.
-- MIN() picks earliest (protects against duplicate trail entries).
-- Fallback: updated_at for pre-trail historical rows (Bubble migration imports etc.).
-- Residual risk: updated_at may reflect post-status edits — documented as provisional
-- breach class in HANDOFF per ADR-0312.
--
-- activity_trail column reference: `event` (not event_type), `entity_id` uuid

UPDATE public.employment_contract ec
SET declined_at = (
  SELECT MIN(at.created_at)
  FROM public.activity_trail at
  WHERE at.entity_type = 'employment_contract'
    AND at.entity_id = ec.contract_id
    AND at.event = 'status_changed'
    AND at.data->>'new_value' = 'declined'
)
WHERE ec.status = 'declined'
  AND ec.declined_at IS NULL;

-- Fallback for pre-trail historical rows (Bubble migration imports, pre-2026 contracts).
-- Document any matched rows in HANDOFF as "updated_at-anchored, provisional".
UPDATE public.employment_contract
SET declined_at = updated_at
WHERE status = 'declined'
  AND declined_at IS NULL;

-- ─── 3. Backfill terminated_at from activity_trail ───────────────────────────
-- Same pattern. expired contracts are fixed-term expirations; terminated = admin act.
-- Both share the same §13 clock (end_date is primary anchor; terminated_at is fallback).

UPDATE public.employment_contract ec
SET terminated_at = (
  SELECT MIN(at.created_at)
  FROM public.activity_trail at
  WHERE at.entity_type = 'employment_contract'
    AND at.entity_id = ec.contract_id
    AND at.event = 'status_changed'
    AND at.data->>'new_value' IN ('terminated', 'expired')
)
WHERE ec.status IN ('terminated', 'expired')
  AND ec.terminated_at IS NULL;

-- Fallback for pre-trail historical rows.
UPDATE public.employment_contract
SET terminated_at = updated_at
WHERE status IN ('terminated', 'expired')
  AND terminated_at IS NULL;

-- ─── 4. compute_anonymize_cutoff ─────────────────────────────────────────────
-- Returns the anonymization eligibility cutoff (TIMESTAMPTZ) for a given end-event
-- date anchored to regnskapsårets slutt (Dec-31) per Bokf.lov §13.
--
-- Logic: cutoff = Dec-31 of the fiscal year containing p_end_event_date + 5 years + buffer
--   = DATE_TRUNC('year', p_end_event_date) + 6 years + buffer - 1 second
--   = Dec-31 23:59:59 UTC of year (year_of_event + 5)
--
-- Example:
--   end_event_date = 2021-06-15
--   → fiscal year 2021 → slutt 2021-12-31
--   → retention until 2026-12-31 23:59:59
--   → anonymize eligible from 2027-01-01 00:00:00
--
-- p_buffer_months DEFAULT 0 = strict 5yr §13 clock per Bokf.lov. The 3-mnd buffer
-- (A-melding January + skatteoppgjør 31. mars + lønnsrevisjoner) is risk management,
-- NOT law. v1 uses strict 0; workspace-configurable buffer is a separate future ADR.
--
-- IMMUTABLE STRICT: no side effects; returns NULL if input is NULL (STRICT).
-- Safe to index-optimize on.
--
-- Fiscal year assumption: calendar year (Jan-Dec) for Norwegian AS per Regnskapsloven §5-1.
-- KS + cooperatives may deviate; MEDIUM confidence for 1% edge case.
-- Workspace-configurable fiscal_year_end_month deferred to future ADR.

CREATE OR REPLACE FUNCTION public.compute_anonymize_cutoff(
  p_end_event_date DATE,
  p_buffer_months  INT DEFAULT 0
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  -- cutoff = (Dec-31 of year(end_event)) + 5 years + buffer
  --        = start-of-year + 6 years + buffer - 1 second
  SELECT (
    DATE_TRUNC('year', p_end_event_date)
    + INTERVAL '6 years'
    + (p_buffer_months || ' months')::INTERVAL
    - INTERVAL '1 second'
  )::TIMESTAMPTZ;
$$;

COMMENT ON FUNCTION public.compute_anonymize_cutoff(DATE, INT) IS
  'Returns anonymization eligibility cutoff anchored to regnskapsårets slutt (Dec-31) '
  'per Bokføringsloven §13. Strict 5-year clock, v1 buffer_months=0. '
  'Example: end_event_date=2021-06-15 → cutoff=2026-12-31 23:59:59 UTC. '
  'Workspace-configurable buffer deferred to future ADR (ADR-0312). '
  'IMMUTABLE STRICT — safe for index expressions.';

GRANT EXECUTE ON FUNCTION public.compute_anonymize_cutoff(DATE, INT) TO service_role;

-- ─── 5. anonymize_contract — supersedes 20260501120000 ───────────────────────
-- This CREATE OR REPLACE supersedes the 3-error version in 20260501120000.
-- Original errors fixed:
--   1. Column: was created_at → now COALESCE(end_date, terminated_at::date, created_at::date)
--   2. Interval: was 3 years → now 5 years anchored to Dec-31 (compute_anonymize_cutoff)
--   3. Anchor: was rolling-from-event → now regnskapsårets slutt
--
-- New signature: anonymize_contract(workspace_id UUID DEFAULT NULL, dry_run BOOLEAN DEFAULT TRUE)
--   workspace_id NULL = all workspaces (platform-wide cron run)
--   dry_run TRUE  (default) = returns count + sample, no writes. Safe for manual operator calls.
--   dry_run FALSE = executes anonymization. Must be passed explicitly — no accidental mass-wipe.
--
-- Two anonymization branches:
--   A. terminated/expired contracts: §13 clock via compute_anonymize_cutoff(end_event_date, 0)
--      COALESCE order: end_date (contractual bilag anchor) > terminated_at::date (admin act fallback)
--      > created_at::date (last resort — pre-trail historical; documented as residual risk).
--      Constructive dismissal example: end_date=2024-06-30, terminated_at=2024-12-15 →
--        §13 anchor = end_date (last lønnsbilag in regnskapsår 2024, not admin act in 2024-12-15).
--   B. declined contracts: GDPR Art. 17 clock (3yr from declined_at, NOT §13).
--      Declined contracts produced no salary, no A-melding, no bilag → §13 does not apply.
--      Personalmeldingsforskriften §6 reference UNVERIFIED — provisional, requires advokat.
--      ADR-0312 marks this as provisional until legal confirmation.
--
-- Anonymization target fields: framework_snapshot, compliance_overrides, decline_reason_text.
-- (Same fields as the superseded version — scope intentionally conservative v1.)
--
-- Inline activity_trail INSERT (SECURITY DEFINER pattern, mirrors 20260430182443 audit trigger).
-- activity_trail columns: id(auto), workspace_id, actor_id(uuid), actor_kind, event, action_verb,
--   category, entity_type, entity_id(uuid), data, created_at.
-- Do NOT route through @smartout/telemetry from SQL.
--
-- Returns: TABLE(contract_id UUID, workspace_id UUID, status TEXT, end_event_date DATE,
--               cutoff TIMESTAMPTZ, dry_run BOOLEAN)
-- When dry_run=TRUE: returns matching rows without executing UPDATE.
-- When dry_run=FALSE: executes UPDATE and returns affected rows.

CREATE OR REPLACE FUNCTION public.anonymize_contract(
  p_workspace_id UUID    DEFAULT NULL,
  p_dry_run      BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  contract_id     UUID,
  workspace_id    UUID,
  status          TEXT,
  end_event_date  DATE,
  cutoff          TIMESTAMPTZ,
  dry_run         BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_cutoff TIMESTAMPTZ;
  v_end_event_date DATE;
BEGIN
  -- ── Branch A: terminated + expired (§13 clock) ──────────────────────────
  FOR v_row IN
    SELECT
      ec.contract_id,
      ec.workspace_id,
      ec.status::TEXT,
      COALESCE(ec.end_date, ec.terminated_at::DATE, ec.created_at::DATE) AS end_event_date
    FROM employment_contract ec
    WHERE ec.status IN ('terminated', 'expired')
      AND (p_workspace_id IS NULL OR ec.workspace_id = p_workspace_id)
      AND ec.framework_snapshot IS NOT NULL  -- skip already-anonymized rows
  LOOP
    v_end_event_date := v_row.end_event_date;
    v_cutoff := compute_anonymize_cutoff(v_end_event_date, 0);

    -- Only eligible if cutoff is in the past
    IF now() > v_cutoff THEN
      IF NOT p_dry_run THEN
        -- Execute anonymization
        UPDATE employment_contract ec2
        SET
          framework_snapshot   = NULL,
          compliance_overrides = '[]'::jsonb,
          decline_reason_text  = '[anonymized]',
          updated_at           = now()
        WHERE ec2.contract_id = v_row.contract_id;

        -- Emit inline activity_trail event (SECURITY DEFINER — auth.uid() is NULL in cron)
        -- activity_trail schema: event (text), action_verb (text), category (text),
        --   entity_type (text), entity_id (uuid), actor_id (uuid nullable for platform),
        --   actor_kind ('user'|'platform'), workspace_id (uuid).
        INSERT INTO activity_trail (
          workspace_id,
          actor_id,
          actor_kind,
          event,
          action_verb,
          category,
          entity_type,
          entity_id,
          data,
          created_at
        ) VALUES (
          v_row.workspace_id,
          NULL,                              -- platform actor (cron has no profile_id)
          'platform',
          'contract.retention_anonymized_§13',
          'anonymized',
          'contracts',
          'employment_contract',
          v_row.contract_id,
          jsonb_build_object(
            'contract_id',               v_row.contract_id,
            'workspace_id',              v_row.workspace_id,
            'terminated_at_or_end_date', v_end_event_date,
            'cutoff_applied',            v_cutoff,
            'status_at_anonymization',   v_row.status,
            'paragraph_ref',             'Bokf.lov §13',
            'dry_run',                   false
          ),
          now()
        );
      END IF;

      RETURN QUERY SELECT
        v_row.contract_id,
        v_row.workspace_id,
        v_row.status,
        v_end_event_date,
        v_cutoff,
        p_dry_run;

    ELSE
      -- Not yet eligible. Emit skipped event only in non-dry-run mode AND
      -- only when there is genuinely no end-event date (all COALESCE arms NULL before fallback).
      -- In practice created_at always exists, so this branch is defensive-only.
      IF NOT p_dry_run AND v_end_event_date IS NULL THEN
        INSERT INTO activity_trail (
          workspace_id,
          actor_id,
          actor_kind,
          event,
          action_verb,
          category,
          entity_type,
          entity_id,
          data,
          created_at
        ) VALUES (
          v_row.workspace_id,
          NULL,
          'platform',
          'contract.retention_skipped_no_clock',
          'skipped',
          'contracts',
          'employment_contract',
          v_row.contract_id,
          jsonb_build_object(
            'contract_id',  v_row.contract_id,
            'workspace_id', v_row.workspace_id,
            'status',       v_row.status,
            'reason',       'no_end_event_date'
          ),
          now()
        );
      END IF;
    END IF;
  END LOOP;

  -- ── Branch B: declined (GDPR Art. 17 clock — 3yr from declined_at) ──────
  -- §13 does NOT apply: declined contracts produced no salary, no A-melding, no bilag.
  -- Clock: 3 years from declined_at (GDPR erasure, Art. 17).
  -- Personalmeldingsforskriften §6 reference UNVERIFIED — provisional until advokat confirms.
  -- ADR-0312 marks this provisional.
  FOR v_row IN
    SELECT
      ec.contract_id,
      ec.workspace_id,
      ec.status::TEXT,
      ec.declined_at::DATE AS end_event_date
    FROM employment_contract ec
    WHERE ec.status = 'declined'
      AND (p_workspace_id IS NULL OR ec.workspace_id = p_workspace_id)
      AND ec.declined_at IS NOT NULL
      AND ec.declined_at < now() - INTERVAL '3 years'
      AND ec.decline_reason_text IS DISTINCT FROM '[anonymized]'  -- skip already-anonymized
  LOOP
    v_end_event_date := v_row.end_event_date;
    -- For declined: cutoff = declined_at + 3yr (GDPR Art. 17, not §13 compute_anonymize_cutoff)
    v_cutoff := (v_row.end_event_date + INTERVAL '3 years')::TIMESTAMPTZ;

    IF NOT p_dry_run THEN
      UPDATE employment_contract ec2
      SET
        framework_snapshot   = NULL,
        compliance_overrides = '[]'::jsonb,
        decline_reason_text  = '[anonymized]',
        updated_at           = now()
      WHERE ec2.contract_id = v_row.contract_id;

      INSERT INTO activity_trail (
        workspace_id,
        actor_id,
        actor_kind,
        event,
        action_verb,
        category,
        entity_type,
        entity_id,
        data,
        created_at
      ) VALUES (
        v_row.workspace_id,
        NULL,
        'platform',
        'contract.retention_anonymized_§13',  -- shared event name; paragraph_ref distinguishes
        'anonymized',
        'contracts',
        'employment_contract',
        v_row.contract_id,
        jsonb_build_object(
          'contract_id',               v_row.contract_id,
          'workspace_id',              v_row.workspace_id,
          'terminated_at_or_end_date', v_end_event_date,
          'cutoff_applied',            v_cutoff,
          'status_at_anonymization',   'declined',
          'paragraph_ref',             'GDPR Art. 17',  -- NOT §13
          'dry_run',                   false
        ),
        now()
      );
    END IF;

    RETURN QUERY SELECT
      v_row.contract_id,
      v_row.workspace_id,
      v_row.status,
      v_end_event_date,
      v_cutoff,
      p_dry_run;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.anonymize_contract(UUID, BOOLEAN) IS
  'Anonymize contracts past their retention clock. Supersedes 20260501120000 (3-error version). '
  'Branch A (terminated/expired): Bokf.lov §13 — 5yr from regnskapsårets slutt (Dec-31). '
  'COALESCE(end_date, terminated_at::date, created_at::date) picks §13 bilag anchor. '
  'Constructive dismissal: end_date is primary (last lønnsbilag period), terminated_at is fallback. '
  'Branch B (declined): GDPR Art. 17 — 3yr from declined_at. §13 does NOT apply '
  '(declined contracts produced no salary, no A-melding, no bilag). '
  'Personalmeldingsforskriften §6 unverified — provisional, requires advokat confirmation. '
  'dry_run=TRUE (default): returns eligible rows without executing UPDATE. '
  'dry_run=FALSE: executes anonymization. Must be passed explicitly to prevent accidents. '
  'Ref: ADR-0312, Bokføringsloven §13, GDPR Art. 17, Regnskapsloven §5-1.';

-- Revoke old single-arg signature if it still exists (superseded by new signature)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'anonymize_contract'
      AND array_length(p.proargtypes, 1) = 1
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.anonymize_contract(UUID) FROM service_role';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- already revoked or function replaced
END $$;

GRANT EXECUTE ON FUNCTION public.anonymize_contract(UUID, BOOLEAN) TO service_role;

-- ─── 6. pg_cron job — contract retention anonymization ───────────────────────
-- Schedule: 1st of month, 02:00 UTC. Aligns with Bokf.lov §13 calendar-year semantics.
-- "First Sunday of month" is NOT a valid pg_cron primitive (5-field UTC cron only).
-- Precedent: payroll cron pattern + recorder_retention_cron (20260515120500).
-- Cron call passes dry_run := false explicitly — no accidental dry-run in production.
-- Extension guard: environments without pg_cron (e.g. local dev default) skip silently.
-- ADR-0312.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'contract-retention-anonymize',
      '0 2 1 * *',
      $cmd$SELECT anonymize_contract(NULL, false);$cmd$
    );
  END IF;
END $$;
