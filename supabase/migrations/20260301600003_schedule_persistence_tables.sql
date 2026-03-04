SET search_path TO public, extensions;

-- ============================================
-- 20260301600000_schedule_persistence_tables.sql
-- Creates all remaining schedule tables for DB persistence:
-- schedule_absence, schedule_template, schedule_template_shift,
-- schedule_open_shift, schedule_day_message, schedule_day_task,
-- schedule_day_booking, schedule_audit_log
-- Plus enums, RLS, indexes, audit trigger, rollback RPC.
-- Connected to: 20260301300000_schedule_shift_table.sql (existing)
-- Connected to: docs/plans/2026-03-01-schedule-db-persistence-design.md
-- ============================================

-- ── New Enums ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'absence_status') THEN
    CREATE TYPE absence_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('confirmed', 'pending', 'cancelled');
  END IF;
END $$;;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_visibility') THEN
    CREATE TYPE message_visibility AS ENUM ('all_day', 'until_16', 'permanent');
  END IF;
END $$;;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_operation') THEN
    CREATE TYPE audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');
  END IF;
END $$;;

-- ── schedule_absence ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_absence (
  schedule_absence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  shift_date          DATE NOT NULL,
  absence_type        TEXT NOT NULL,
  request_type        TEXT,
  reason              TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  is_full_day         BOOLEAN NOT NULL DEFAULT true,
  status              absence_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_absence IS 'Employee absences (sick leave, vacation, etc.) — separate from shifts per MODULE_03 §7.';

ALTER TABLE public.schedule_absence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_absence" ON public.schedule_absence;
CREATE POLICY "jwt_read_schedule_absence" ON public.schedule_absence FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_absence" ON public.schedule_absence;
CREATE POLICY "jwt_insert_schedule_absence" ON public.schedule_absence FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_absence" ON public.schedule_absence;
CREATE POLICY "jwt_update_schedule_absence" ON public.schedule_absence FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_absence" ON public.schedule_absence;
CREATE POLICY "jwt_delete_schedule_absence" ON public.schedule_absence FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_absence" ON public.schedule_absence;
CREATE POLICY "api_key_read_schedule_absence" ON public.schedule_absence FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_insert_schedule_absence" ON public.schedule_absence;
CREATE POLICY "api_key_insert_schedule_absence" ON public.schedule_absence FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_update_schedule_absence" ON public.schedule_absence;
CREATE POLICY "api_key_update_schedule_absence" ON public.schedule_absence FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_delete_schedule_absence" ON public.schedule_absence;
CREATE POLICY "api_key_delete_schedule_absence" ON public.schedule_absence FOR DELETE
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_absence_workspace_date ON public.schedule_absence (workspace_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_schedule_absence_employee_date ON public.schedule_absence (employee_id, shift_date);

DROP TRIGGER IF EXISTS set_schedule_absence_updated_at ON public.schedule_absence;
CREATE TRIGGER set_schedule_absence_updated_at
  BEFORE UPDATE ON public.schedule_absence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_template ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_template (
  schedule_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  department           TEXT NOT NULL,
  include_assignments  BOOLEAN NOT NULL DEFAULT false,
  created_by           UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_template IS 'Reusable shift templates for a day — MODULE_03 §13.1.';

ALTER TABLE public.schedule_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_template" ON public.schedule_template;
CREATE POLICY "jwt_read_schedule_template" ON public.schedule_template FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_template" ON public.schedule_template;
CREATE POLICY "jwt_insert_schedule_template" ON public.schedule_template FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_template" ON public.schedule_template;
CREATE POLICY "jwt_update_schedule_template" ON public.schedule_template FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_template" ON public.schedule_template;
CREATE POLICY "jwt_delete_schedule_template" ON public.schedule_template FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_template" ON public.schedule_template;
CREATE POLICY "api_key_read_schedule_template" ON public.schedule_template FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_insert_schedule_template" ON public.schedule_template;
CREATE POLICY "api_key_insert_schedule_template" ON public.schedule_template FOR INSERT
  WITH CHECK (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_update_schedule_template" ON public.schedule_template;
CREATE POLICY "api_key_update_schedule_template" ON public.schedule_template FOR UPDATE
  USING (workspace_id = get_api_workspace_id())
  WITH CHECK (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_delete_schedule_template" ON public.schedule_template;
CREATE POLICY "api_key_delete_schedule_template" ON public.schedule_template FOR DELETE
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_template_workspace ON public.schedule_template (workspace_id);

DROP TRIGGER IF EXISTS set_schedule_template_updated_at ON public.schedule_template;
CREATE TRIGGER set_schedule_template_updated_at
  BEFORE UPDATE ON public.schedule_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_template_shift ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_template_shift (
  schedule_template_shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id                UUID NOT NULL REFERENCES public.schedule_template(schedule_template_id) ON DELETE CASCADE,
  employee_id                UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  role                       TEXT NOT NULL,
  start_time                 TIME NOT NULL,
  end_time                   TIME NOT NULL,
  work_hours                 NUMERIC(4,2) NOT NULL DEFAULT 0,
  breaks                     INTEGER NOT NULL DEFAULT 0,
  day_category               public.day_category NOT NULL,
  zone                       TEXT,
  indicator                  TEXT NOT NULL DEFAULT 'blue',
  notes                      TEXT
);

COMMENT ON TABLE public.schedule_template_shift IS 'Individual shift entries within a schedule template.';

ALTER TABLE public.schedule_template_shift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "jwt_read_schedule_template_shift" ON public.schedule_template_shift FOR SELECT
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
DROP POLICY IF EXISTS "jwt_insert_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "jwt_insert_schedule_template_shift" ON public.schedule_template_shift FOR INSERT
  WITH CHECK (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));
DROP POLICY IF EXISTS "jwt_update_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "jwt_update_schedule_template_shift" ON public.schedule_template_shift FOR UPDATE
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));
DROP POLICY IF EXISTS "jwt_delete_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "jwt_delete_schedule_template_shift" ON public.schedule_template_shift FOR DELETE
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE is_admin_in_workspace(auth.uid(), workspace_id)
  ));

DROP POLICY IF EXISTS "api_key_read_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "api_key_read_schedule_template_shift" ON public.schedule_template_shift FOR SELECT
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id = get_api_workspace_id()
  ));
DROP POLICY IF EXISTS "api_key_write_schedule_template_shift" ON public.schedule_template_shift;
CREATE POLICY "api_key_write_schedule_template_shift" ON public.schedule_template_shift FOR ALL
  USING (template_id IN (
    SELECT schedule_template_id FROM public.schedule_template
    WHERE workspace_id = get_api_workspace_id()
  ));

CREATE INDEX IF NOT EXISTS idx_schedule_template_shift_template ON public.schedule_template_shift (template_id);

-- ── schedule_open_shift ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_open_shift (
  schedule_open_shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  start_time             TIME NOT NULL,
  end_time               TIME NOT NULL,
  department             TEXT,
  role                   TEXT,
  day_category           public.day_category,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_open_shift IS 'Unassigned shifts available for employees to claim.';

ALTER TABLE public.schedule_open_shift ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "jwt_read_schedule_open_shift" ON public.schedule_open_shift FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "jwt_insert_schedule_open_shift" ON public.schedule_open_shift FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "jwt_update_schedule_open_shift" ON public.schedule_open_shift FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "jwt_delete_schedule_open_shift" ON public.schedule_open_shift FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "api_key_read_schedule_open_shift" ON public.schedule_open_shift FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_write_schedule_open_shift" ON public.schedule_open_shift;
CREATE POLICY "api_key_write_schedule_open_shift" ON public.schedule_open_shift FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_open_shift_workspace ON public.schedule_open_shift (workspace_id);

DROP TRIGGER IF EXISTS set_schedule_open_shift_updated_at ON public.schedule_open_shift;
CREATE TRIGGER set_schedule_open_shift_updated_at
  BEFORE UPDATE ON public.schedule_open_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_message ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_day_message (
  schedule_day_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date              DATE NOT NULL,
  title                   TEXT NOT NULL,
  content                 TEXT NOT NULL,
  audience                TEXT NOT NULL DEFAULT 'all',
  visibility              message_visibility NOT NULL DEFAULT 'all_day',
  author_id               UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  is_alert                BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_message IS 'Daily messages visible in schedule day view.';

ALTER TABLE public.schedule_day_message ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "jwt_read_schedule_day_message" ON public.schedule_day_message FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "jwt_insert_schedule_day_message" ON public.schedule_day_message FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "jwt_update_schedule_day_message" ON public.schedule_day_message FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "jwt_delete_schedule_day_message" ON public.schedule_day_message FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "api_key_read_schedule_day_message" ON public.schedule_day_message FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_write_schedule_day_message" ON public.schedule_day_message;
CREATE POLICY "api_key_write_schedule_day_message" ON public.schedule_day_message FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_day_message_workspace_date ON public.schedule_day_message (workspace_id, shift_date);

DROP TRIGGER IF EXISTS set_schedule_day_message_updated_at ON public.schedule_day_message;
CREATE TRIGGER set_schedule_day_message_updated_at
  BEFORE UPDATE ON public.schedule_day_message
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_task ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_day_task (
  schedule_day_task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date           DATE NOT NULL,
  label                TEXT NOT NULL,
  task_status          TEXT NOT NULL DEFAULT 'pending',
  category             TEXT NOT NULL DEFAULT 'all',
  assigned_to          UUID REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  highlight            BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_task IS 'Daily operational tasks shown in schedule day view.';

ALTER TABLE public.schedule_day_task ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "jwt_read_schedule_day_task" ON public.schedule_day_task FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "jwt_insert_schedule_day_task" ON public.schedule_day_task FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "jwt_update_schedule_day_task" ON public.schedule_day_task FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "jwt_delete_schedule_day_task" ON public.schedule_day_task FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "api_key_read_schedule_day_task" ON public.schedule_day_task FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_write_schedule_day_task" ON public.schedule_day_task;
CREATE POLICY "api_key_write_schedule_day_task" ON public.schedule_day_task FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_day_task_workspace_date ON public.schedule_day_task (workspace_id, shift_date);

DROP TRIGGER IF EXISTS set_schedule_day_task_updated_at ON public.schedule_day_task;
CREATE TRIGGER set_schedule_day_task_updated_at
  BEFORE UPDATE ON public.schedule_day_task
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_day_booking ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_day_booking (
  schedule_day_booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  shift_date              DATE NOT NULL,
  title                   TEXT NOT NULL,
  guest_count             INTEGER NOT NULL DEFAULT 0,
  menu                    TEXT,
  booking_time            TIME NOT NULL,
  location                TEXT,
  status                  booking_status NOT NULL DEFAULT 'pending',
  is_vip                  BOOLEAN NOT NULL DEFAULT false,
  notes                   TEXT,
  contact_person          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_day_booking IS 'Reservations and bookings shown in schedule day view.';

ALTER TABLE public.schedule_day_booking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "jwt_read_schedule_day_booking" ON public.schedule_day_booking FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
DROP POLICY IF EXISTS "jwt_insert_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "jwt_insert_schedule_day_booking" ON public.schedule_day_booking FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_update_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "jwt_update_schedule_day_booking" ON public.schedule_day_booking FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "jwt_delete_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "jwt_delete_schedule_day_booking" ON public.schedule_day_booking FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "api_key_read_schedule_day_booking" ON public.schedule_day_booking FOR SELECT
  USING (workspace_id = get_api_workspace_id());
DROP POLICY IF EXISTS "api_key_write_schedule_day_booking" ON public.schedule_day_booking;
CREATE POLICY "api_key_write_schedule_day_booking" ON public.schedule_day_booking FOR ALL
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_day_booking_workspace_date ON public.schedule_day_booking (workspace_id, shift_date);

DROP TRIGGER IF EXISTS set_schedule_day_booking_updated_at ON public.schedule_day_booking;
CREATE TRIGGER set_schedule_day_booking_updated_at
  BEFORE UPDATE ON public.schedule_day_booking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── schedule_audit_log ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_audit_log (
  audit_log_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  table_name      TEXT NOT NULL,
  row_id          UUID NOT NULL,
  operation       audit_operation NOT NULL,
  old_data        JSONB,
  new_data        JSONB,
  changed_fields  TEXT[],
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schedule_audit_log IS 'Row-level audit trail for all schedule tables. Written by trigger, read-only for users.';

ALTER TABLE public.schedule_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_audit_log" ON public.schedule_audit_log;
CREATE POLICY "jwt_read_schedule_audit_log" ON public.schedule_audit_log FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_schedule_audit_log" ON public.schedule_audit_log;
CREATE POLICY "api_key_read_schedule_audit_log" ON public.schedule_audit_log FOR SELECT
  USING (workspace_id = get_api_workspace_id());

CREATE INDEX IF NOT EXISTS idx_schedule_audit_log_row ON public.schedule_audit_log (table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_log_workspace ON public.schedule_audit_log (workspace_id, created_at DESC);

-- ── Audit trigger function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_schedule_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_row_id UUID;
  v_workspace_id UUID;
  v_changed TEXT[];
  v_old_json JSONB;
  v_new_json JSONB;
  v_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_row_id := (v_old_json ->> (TG_TABLE_NAME || '_id'))::UUID;
    v_workspace_id := (v_old_json ->> 'workspace_id')::UUID;
  ELSE
    v_new_json := to_jsonb(NEW);
    v_row_id := (v_new_json ->> (TG_TABLE_NAME || '_id'))::UUID;
    v_workspace_id := (v_new_json ->> 'workspace_id')::UUID;
  END IF;

  IF TG_TABLE_NAME = 'schedule_template_shift' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT st.workspace_id INTO v_workspace_id
      FROM public.schedule_template st
      WHERE st.schedule_template_id = (v_old_json ->> 'template_id')::UUID;
    ELSE
      SELECT st.workspace_id INTO v_workspace_id
      FROM public.schedule_template st
      WHERE st.schedule_template_id = (v_new_json ->> 'template_id')::UUID;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_changed := ARRAY[]::TEXT[];
    FOR v_key IN SELECT jsonb_object_keys(v_new_json) LOOP
      IF v_key NOT IN ('updated_at') AND
         (v_new_json -> v_key) IS DISTINCT FROM (v_old_json -> v_key) THEN
        v_changed := v_changed || v_key;
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  INSERT INTO public.schedule_audit_log (
    workspace_id, table_name, row_id, operation,
    old_data, new_data, changed_fields, user_id
  ) VALUES (
    v_workspace_id,
    TG_TABLE_NAME,
    v_row_id,
    TG_OP::audit_operation,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'UPDATE' THEN v_changed END,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Attach audit triggers to all schedule tables ───────────────

DROP TRIGGER IF EXISTS audit_schedule_shift ON public.schedule_shift;
CREATE TRIGGER audit_schedule_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_absence ON public.schedule_absence;
CREATE TRIGGER audit_schedule_absence
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_absence
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_template ON public.schedule_template;
CREATE TRIGGER audit_schedule_template
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_template
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_template_shift ON public.schedule_template_shift;
CREATE TRIGGER audit_schedule_template_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_template_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_open_shift ON public.schedule_open_shift;
CREATE TRIGGER audit_schedule_open_shift
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_open_shift
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_day_message ON public.schedule_day_message;
CREATE TRIGGER audit_schedule_day_message
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_message
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_day_task ON public.schedule_day_task;
CREATE TRIGGER audit_schedule_day_task
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_task
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

DROP TRIGGER IF EXISTS audit_schedule_day_booking ON public.schedule_day_booking;
CREATE TRIGGER audit_schedule_day_booking
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_day_booking
  FOR EACH ROW EXECUTE FUNCTION public.audit_schedule_changes();

-- ── Rollback RPC function ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollback_audit_entry(p_audit_log_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_pk_col TEXT;
  v_result JSONB;
BEGIN
  SELECT * INTO v_entry FROM public.schedule_audit_log WHERE audit_log_id = p_audit_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit entry not found: %', p_audit_log_id;
  END IF;

  IF NOT is_admin_in_workspace(auth.uid(), v_entry.workspace_id) THEN
    RAISE EXCEPTION 'Permission denied: admin role required for rollback';
  END IF;

  v_pk_col := v_entry.table_name || '_id';

  CASE v_entry.operation
    WHEN 'INSERT' THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I = $1',
        v_entry.table_name, v_pk_col
      ) USING v_entry.row_id;
      v_result := jsonb_build_object('action', 'deleted', 'row_id', v_entry.row_id);

    WHEN 'UPDATE' THEN
      EXECUTE format(
        'UPDATE public.%I SET %s WHERE %I = $1',
        v_entry.table_name,
        (SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
         FROM jsonb_each(v_entry.old_data)
         WHERE key != v_pk_col AND key != 'created_at'),
        v_pk_col
      ) USING v_entry.row_id;
      v_result := jsonb_build_object('action', 'restored', 'row_id', v_entry.row_id);

    WHEN 'DELETE' THEN
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(null::public.%I, $1)',
        v_entry.table_name, v_entry.table_name
      ) USING v_entry.old_data;
      v_result := jsonb_build_object('action', 'restored', 'row_id', v_entry.row_id);
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Enable Supabase Realtime on schedule tables ────────────────

DO $$
BEGIN
  -- Add each table individually to avoid failure if already in publication
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_shift; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_absence; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_open_shift; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_day_message; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_day_task; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_day_booking; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
