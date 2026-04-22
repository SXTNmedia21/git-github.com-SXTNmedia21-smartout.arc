-- ============================================
-- 20260515170300_contract_template_is_system_immutability.sql
--
-- Council 2026-04-22, Gate G3: enforce is_system immutability.
--
-- Problem
--   `is_system` separates K1a platform catalog templates from K1b workspace
--   forks. Flipping this boolean on a live row would let a workspace
--   silently promote its fork into the platform catalog (privilege leak) or
--   demote a platform template into a workspace row (data-ownership leak).
--   RLS alone cannot prevent this — the canonical admin policy permits full
--   updates on its scope and cannot distinguish a column-level mutation.
--
-- Solution
--   BEFORE UPDATE trigger that raises if OLD.is_system IS DISTINCT FROM
--   NEW.is_system. Paired with the new RLS split (Migration C) the result
--   is: workspace admins can only UPDATE rows where is_system=false;
--   platform godmode can only UPDATE rows where is_system=true; neither
--   can flip the flag itself.
--
-- Error code P0001 (raise_exception) is intentional — easy to catch in
-- application code and does not collide with Postgres system codes.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.contract_template_is_system_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system IS DISTINCT FROM NEW.is_system THEN
    RAISE EXCEPTION
      'is_system is immutable on contract_template (OLD=%, NEW=%)',
      OLD.is_system, NEW.is_system
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contract_template_is_system_immutable
  ON public.contract_template;

CREATE TRIGGER contract_template_is_system_immutable
  BEFORE UPDATE ON public.contract_template
  FOR EACH ROW
  EXECUTE FUNCTION public.contract_template_is_system_immutable();

COMMIT;
