-- Auto-create session channel when a department_session is inserted.
-- Mirrors the pattern used by auto_create_department_channel() and
-- auto_create_team_channel() in 20260422300400_channel_auto_create_triggers.sql.

--------------------------------------------------------------------------------
-- Session channel: auto-create on department_session INSERT
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_session_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_dept_name text;
  v_channel_id uuid;
BEGIN
  -- Look up department name for the channel display name
  SELECT name INTO v_dept_name
  FROM public.department
  WHERE department_id = NEW.department_id;

  -- Guarded insert: skip if a non-archived channel already exists for this department.
  -- Uses both session_id check (prevents duplicate per session) and a conflict guard
  -- on the partial unique index idx_channel_one_per_department (department_id).
  INSERT INTO public.channel (workspace_id, channel_type, name, session_id, department_id)
  SELECT
    NEW.workspace_id,
    'session'::public.comm_channel_type,
    '#' || lower(coalesce(v_dept_name, 'session')) || '-' || to_char(NEW.session_date, 'YYYY-MM-DD'),
    NEW.department_session_id,
    NEW.department_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE department_id = NEW.department_id
      AND is_archived = false
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_channel_id;

  -- Auto-add the duty leader as channel member (if set and channel was created)
  IF v_channel_id IS NOT NULL AND NEW.duty_leader_id IS NOT NULL THEN
    INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
    VALUES (v_channel_id, NEW.workspace_id, NEW.duty_leader_id, 'admin')
    ON CONFLICT (channel_id, profile_id) DO UPDATE SET left_at = NULL;
  END IF;

  -- Auto-add the opener as channel member if different from duty leader
  IF v_channel_id IS NOT NULL AND NEW.opened_by IS NOT NULL
     AND (NEW.duty_leader_id IS NULL OR NEW.opened_by IS DISTINCT FROM NEW.duty_leader_id) THEN
    INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
    VALUES (v_channel_id, NEW.workspace_id, NEW.opened_by, 'admin')
    ON CONFLICT (channel_id, profile_id) DO UPDATE SET left_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_channel
  AFTER INSERT ON department_session
  FOR EACH ROW EXECUTE FUNCTION auto_create_session_channel();
