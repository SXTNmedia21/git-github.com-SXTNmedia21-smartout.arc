SET search_path TO public, extensions;

-- ============================================
-- 20260301600000_department_manager.sql
-- Adds manager_profile_id to department table.
-- Allows assigning a workspace profile as the
-- department manager.
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'department' AND column_name = 'manager_profile_id') THEN
    ALTER TABLE public.department ADD COLUMN IF NOT EXISTS manager_profile_id uuid REFERENCES public.profile(profile_id);
  END IF;
END $$;

COMMENT ON COLUMN public.department.manager_profile_id
  IS 'Profile assigned as department manager. NULL means no manager assigned.';
