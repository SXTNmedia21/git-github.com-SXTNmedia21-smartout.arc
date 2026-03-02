-- ============================================
-- 20260301600000_department_manager.sql
-- Adds manager_profile_id to department table.
-- Allows assigning a workspace profile as the
-- department manager.
-- ============================================

ALTER TABLE public.department
  ADD COLUMN manager_profile_id uuid REFERENCES public.profile(profile_id);

COMMENT ON COLUMN public.department.manager_profile_id
  IS 'Profile assigned as department manager. NULL means no manager assigned.';
