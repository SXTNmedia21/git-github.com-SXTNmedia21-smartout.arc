-- Fix dashboard evolution write policies: use is_admin_in_workspace instead of get_workspace_ids_for_user
-- Also fix indexes to use composite workspace-scoped patterns

-- ============================================================
-- 1. Fix write policies — require admin role for config tables
-- ============================================================

-- workspace_kpi_target
DROP POLICY "jwt_write_workspace_kpi_target" ON public.workspace_kpi_target;
CREATE POLICY "jwt_write_workspace_kpi_target" ON public.workspace_kpi_target
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- operating_hours
DROP POLICY "jwt_write_operating_hours" ON public.operating_hours;
CREATE POLICY "jwt_write_operating_hours" ON public.operating_hours
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- workspace_budget
DROP POLICY "jwt_write_workspace_budget" ON public.workspace_budget;
CREATE POLICY "jwt_write_workspace_budget" ON public.workspace_budget
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- schedule_day_info
DROP POLICY "jwt_write_schedule_day_info" ON public.schedule_day_info;
CREATE POLICY "jwt_write_schedule_day_info" ON public.schedule_day_info
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- ============================================================
-- 2. Fix indexes — replace standalone with composite indexes
-- ============================================================

-- Fix operating_hours index
DROP INDEX IF EXISTS idx_operating_hours_location_id;
CREATE INDEX idx_operating_hours_loc ON public.operating_hours(workspace_id, location_id);

-- Fix schedule_day_info scope index
DROP INDEX IF EXISTS idx_schedule_day_info_scope;
CREATE INDEX idx_schedule_day_info_scope ON public.schedule_day_info(workspace_id, scope_type, scope_id, date);

-- Fix workspace_budget indexes
DROP INDEX IF EXISTS idx_workspace_budget_location_id;
DROP INDEX IF EXISTS idx_workspace_budget_department_id;
CREATE INDEX idx_workspace_budget_dept ON public.workspace_budget(workspace_id, department_id, period_type);
