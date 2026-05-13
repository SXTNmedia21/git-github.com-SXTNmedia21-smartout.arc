-- 20260615100100_contract_status_timestamp_trigger.sql
-- ADR-0312 — BEFORE UPDATE trigger for declined_at + terminated_at timestamps
--
-- Fires BEFORE UPDATE ON employment_contract so NEW can be modified before write.
-- Existing AFTER UPDATE audit trigger (20260430182443_employment_contract_activity_trail_trigger.sql)
-- is NOT modified — BEFORE triggers fire first, AFTER triggers see the already-modified NEW.
-- PostgreSQL fires triggers alphabetically within timing+event: trg_contract_status_timestamps
-- fires before the existing AFTER trigger (different timing, so no ordering concern).
--
-- Only sets timestamps on genuine status transitions (WHEN NEW.status IS DISTINCT FROM OLD.status).
-- No-op on all other UPDATE paths (salary changes, document_url updates, etc.).
--
-- columns populated:
--   declined_at:   set when status → 'declined'
--   terminated_at: set when status → 'terminated'
--
-- expired contracts: do NOT set terminated_at — end_date is the §13 anchor for expired
-- (fixed-term expiry). terminated_at is for admin-initiated terminations only.
-- The anonymize_contract WHERE clause uses terminated_at as a fallback only.
--
-- Depends on: 20260615100000 (adds declined_at + terminated_at columns)

SET search_path TO public, extensions;

-- ─── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_contract_status_timestamps_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act on genuine status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- declined: GDPR Art. 17 clock anchor (3yr — NOT §13)
    IF NEW.status = 'declined' AND NEW.declined_at IS NULL THEN
      NEW.declined_at := now();
    END IF;

    -- terminated: §13 fallback clock anchor (when end_date is absent)
    -- expired contracts use end_date as primary anchor — do NOT overwrite with timestamp
    IF NEW.status = 'terminated' AND NEW.terminated_at IS NULL THEN
      NEW.terminated_at := now();
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_contract_status_timestamps_fn() IS
  'BEFORE UPDATE trigger body for employment_contract. Sets declined_at on → declined '
  'transition; sets terminated_at on → terminated transition. '
  'expired contracts use end_date as §13 anchor — terminated_at NOT set for expired. '
  'Only fires on genuine status transitions (IS DISTINCT FROM guard). '
  'Ref: ADR-0312, Bokf.lov §13, GDPR Art. 17.';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

-- Drop if exists to handle idempotent re-apply (e.g. migration re-run in local dev).
DROP TRIGGER IF EXISTS trg_contract_status_timestamps ON public.employment_contract;

CREATE TRIGGER trg_contract_status_timestamps
  BEFORE UPDATE ON public.employment_contract
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.trg_contract_status_timestamps_fn();

COMMENT ON TRIGGER trg_contract_status_timestamps ON public.employment_contract IS
  'Sets declined_at / terminated_at on status transitions. BEFORE UPDATE so NEW is '
  'modified before disk write. Coexists with existing AFTER UPDATE audit trigger '
  '(20260430182443) — BEFORE fires first, AFTER sees the already-stamped row. '
  'Ref: ADR-0312.';
