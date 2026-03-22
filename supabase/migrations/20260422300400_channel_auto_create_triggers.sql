-- Channel Communications — Auto-Create Triggers
-- Auto-create channels when departments/teams are created.
-- Sync channel membership when profile.department_id changes.

--------------------------------------------------------------------------------
-- Department channel: auto-create on department INSERT
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_department_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  -- Guarded insert: partial unique indexes cannot use ON CONFLICT ON CONSTRAINT
  INSERT INTO public.channel (workspace_id, channel_type, name, department_id)
  SELECT NEW.workspace_id, 'department'::public.comm_channel_type,
         '#' || lower(NEW.name), NEW.department_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE department_id = NEW.department_id
      AND is_archived = false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_department_channel
  AFTER INSERT ON department
  FOR EACH ROW EXECUTE FUNCTION auto_create_department_channel();

--------------------------------------------------------------------------------
-- Team channel: auto-create on team INSERT
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_team_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  INSERT INTO public.channel (workspace_id, channel_type, name, team_id)
  SELECT NEW.workspace_id, 'team'::public.comm_channel_type,
         '#' || lower(NEW.name), NEW.team_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE team_id = NEW.team_id
      AND is_archived = false
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_team_channel
  AFTER INSERT ON team
  FOR EACH ROW EXECUTE FUNCTION auto_create_team_channel();

--------------------------------------------------------------------------------
-- Profile department-sync: update channel membership on department change
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_profile_department_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_old_channel_id uuid;
  v_new_channel_id uuid;
BEGIN
  -- Soft-leave old department channel
  IF OLD.department_id IS NOT NULL AND OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    SELECT id INTO v_old_channel_id FROM public.channel
      WHERE department_id = OLD.department_id AND is_archived = false LIMIT 1;
    IF v_old_channel_id IS NOT NULL THEN
      UPDATE public.channel_member SET left_at = now()
        WHERE channel_id = v_old_channel_id AND profile_id = NEW.profile_id AND left_at IS NULL;
    END IF;
  END IF;

  -- Join new department channel (or reactivate if previously left)
  IF NEW.department_id IS NOT NULL THEN
    SELECT id INTO v_new_channel_id FROM public.channel
      WHERE department_id = NEW.department_id AND is_archived = false LIMIT 1;
    IF v_new_channel_id IS NOT NULL THEN
      INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
      VALUES (v_new_channel_id, NEW.workspace_id, NEW.profile_id, 'member')
      ON CONFLICT (channel_id, profile_id) DO UPDATE SET left_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_profile_department
  AFTER UPDATE OF department_id ON profile
  FOR EACH ROW EXECUTE FUNCTION sync_profile_department_channel();
