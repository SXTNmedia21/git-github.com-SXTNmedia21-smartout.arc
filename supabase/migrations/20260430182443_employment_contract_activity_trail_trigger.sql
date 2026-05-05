-- ============================================================================
-- supabase/migrations/20260430182443_employment_contract_activity_trail_trigger.sql
--
-- Audit-trail trigger on employment_contract — Bokføringsloven §13 retention basis.
-- Writes INSERT + status-change events to activity_trail for 5-year auditability.
--
-- Per ADR-0241 (schema foundation) + ADR-0243 (trigger semantics)
-- L-0172 / L-0173: SECURITY DEFINER + SET search_path explicit (closes RLS-bypass class)
--
-- Column-name audit (2026-04-30):
--   activity_trail.actor_id        (brief said actor_profile_id — corrected)
--   activity_trail.event           (brief said action — corrected)
--   activity_trail.action_verb     (NOT NULL, not in brief — added)
--   activity_trail.category        (NOT NULL, not in brief — added as 'contract')
--   activity_trail.data            (brief said metadata — corrected)
--   employment_contract.created_by (brief said created_by_profile_id — corrected)
--   employment_contract.status     (confirmed)
--   employment_contract.contract_id (confirmed)
--   SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' (from
--     20260422215500_system_actor_profile_seed.sql) used as fallback when
--     auth.uid() is NULL (service-role / migration-time inserts).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_employment_contract_activity_trail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event      text;
  v_action_verb text;
  v_actor_id   uuid;
BEGIN
  -- Resolve event name and action_verb
  IF TG_OP = 'INSERT' THEN
    v_event       := 'employment_contract.created';
    v_action_verb := 'created';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_event       := 'employment_contract.status_changed.' || NEW.status;
    v_action_verb := 'updated';
  ELSIF TG_OP = 'UPDATE' THEN
    v_event       := 'employment_contract.updated';
    v_action_verb := 'updated';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Actor: authenticated JWT user → created_by fallback → system sentinel
  -- SYSTEM_ACTOR_ID '00000000-0000-0000-0000-000000000001' is the platform
  -- sentinel profile established in 20260422215500_system_actor_profile_seed.sql.
  v_actor_id := COALESCE(
    auth.uid(),
    NEW.created_by::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  INSERT INTO public.activity_trail (
    workspace_id,
    actor_id,
    event,
    action_verb,
    category,
    entity_type,
    entity_id,
    data
  ) VALUES (
    NEW.workspace_id,
    v_actor_id,
    v_event,
    v_action_verb,
    'contract',
    'employment_contract',
    NEW.contract_id,
    jsonb_build_object(
      'contract_status',   NEW.status,
      'profile_id',        NEW.profile_id,
      'employment_role',   NEW.employment_role,
      'employment_form',   NEW.employment_form,
      'old_status',        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employment_contract_activity_trail ON public.employment_contract;
CREATE TRIGGER trg_employment_contract_activity_trail
  AFTER INSERT OR UPDATE ON public.employment_contract
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_employment_contract_activity_trail();

COMMENT ON FUNCTION public.trg_employment_contract_activity_trail() IS
  'Audit trigger writing employment_contract lifecycle events (created, updated, status_changed.*) to activity_trail per Bokføringsloven §13 5-year retention. Per ADR-0241 + ADR-0243 + L-0172. SECURITY DEFINER with explicit search_path to close RLS-bypass class.';
