-- 20260515100700_engine_process_trigger_filters.sql
-- M8: source-discriminator filters on the 5 triggers that produce side-effects
-- forbidden by ADR-0107 when strike-mcp imports historical data.
--
-- Enumeration authoritative in ADR-0108 Clause B. Whitelist semantics per
-- Clause C: WHEN (NEW.source IS DISTINCT FROM 'bubble_migration') fires for
-- 'operational', 'v3_engine', and any future discriminator.
--
-- DELETE event handling: PG does not expose NEW in DELETE triggers, so the
-- audit_schedule_shift trigger is split — INSERT/UPDATE gets the filter,
-- DELETE fires unconditionally (strike-mcp is INSERT-only per ADR-0107
-- Clause C, so DELETE is admin-only and should always audit).

-- ── 1. trg_auto_assign_protocols on profile (ADR-0108 Clause B row 1) ──
-- Source: supabase/migrations/20260428100000_auto_assign_protocols.sql:53-57

DROP TRIGGER IF EXISTS trg_auto_assign_protocols ON public.profile;
CREATE TRIGGER trg_auto_assign_protocols
  AFTER INSERT ON public.profile
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')
  EXECUTE FUNCTION public.auto_assign_protocols_to_new_employee();

-- ── 2. trg_department_channel on department (ADR-0108 Clause B row 2) ──
-- Source: supabase/migrations/20260422300400_channel_auto_create_triggers.sql:26-28

DROP TRIGGER IF EXISTS trg_department_channel ON public.department;
CREATE TRIGGER trg_department_channel
  AFTER INSERT ON public.department
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')
  EXECUTE FUNCTION public.auto_create_department_channel();

-- ── 3. trg_team_channel on team (ADR-0108 Clause B row 3) ──
-- Source: supabase/migrations/20260422300400_channel_auto_create_triggers.sql:50-52

DROP TRIGGER IF EXISTS trg_team_channel ON public.team;
CREATE TRIGGER trg_team_channel
  AFTER INSERT ON public.team
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')
  EXECUTE FUNCTION public.auto_create_team_channel();

-- ── 4. trg_push_shift_published on schedule_shift (ADR-0108 Clause B row 4) ──
-- Source: supabase/migrations/20260418120000_push_dispatch_triggers.sql:92-96
-- (body later refactored in 20260507100300_migrate_push_to_engine_notify.sql)
-- Existing WHEN clause preserved + source filter appended.

DROP TRIGGER IF EXISTS trg_push_shift_published ON public.schedule_shift;
CREATE TRIGGER trg_push_shift_published
  AFTER INSERT ON public.schedule_shift
  FOR EACH ROW
  WHEN (
    NEW.is_published = TRUE
    AND NEW.employee_id IS NOT NULL
    AND NEW.source IS DISTINCT FROM 'bubble_migration'
  )
  EXECUTE FUNCTION public.trigger_push_shift_published();

-- ── 5. audit_schedule_shift on schedule_shift (ADR-0108 Clause B row 5) ──
-- Source: supabase/migrations/20260301600003_schedule_persistence_tables.sql:501-503
-- Split INSERT/UPDATE (filtered) from DELETE (unfiltered — strike-mcp is
-- INSERT-only, so any DELETE is admin action that must audit).

DROP TRIGGER IF EXISTS audit_schedule_shift ON public.schedule_shift;

CREATE TRIGGER audit_schedule_shift_mutate
  AFTER INSERT OR UPDATE ON public.schedule_shift
  FOR EACH ROW
  WHEN (NEW.source IS DISTINCT FROM 'bubble_migration')
  EXECUTE FUNCTION public.audit_schedule_changes();

CREATE TRIGGER audit_schedule_shift_delete
  AFTER DELETE ON public.schedule_shift
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_schedule_changes();

-- ── Trigger state comments ──────────────────────────────────────

COMMENT ON TRIGGER trg_auto_assign_protocols   ON public.profile         IS 'ADR-0108 Clause B row 1 — filtered on source (M8)';
COMMENT ON TRIGGER trg_department_channel      ON public.department      IS 'ADR-0108 Clause B row 2 — filtered on source (M8)';
COMMENT ON TRIGGER trg_team_channel            ON public.team            IS 'ADR-0108 Clause B row 3 — filtered on source (M8)';
COMMENT ON TRIGGER trg_push_shift_published    ON public.schedule_shift  IS 'ADR-0108 Clause B row 4 — filtered on source + existing is_published/employee_id (M8)';
COMMENT ON TRIGGER audit_schedule_shift_mutate ON public.schedule_shift  IS 'ADR-0108 Clause B row 5a — INSERT/UPDATE, filtered on source (M8). Split from DELETE because PG does not expose NEW in DELETE triggers.';
COMMENT ON TRIGGER audit_schedule_shift_delete ON public.schedule_shift  IS 'ADR-0108 Clause B row 5b — DELETE, always fires. Strike-mcp is INSERT-only (ADR-0107 Clause C) so any DELETE is admin action and must audit.';
