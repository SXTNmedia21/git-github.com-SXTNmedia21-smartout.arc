-- Template: Restaurant (Full Apply)
-- Industry:   restaurant (NACE 56.101)
-- Description: Master file that loads all restaurant template functions
--              and provides a single apply function.
--
-- Usage:
--   1. Run this file to create all template functions:
--      psql -f supabase/templates/restaurant/_apply.sql
--
--   2. Apply to a workspace:
--      SELECT template_restaurant_apply('workspace-uuid');

-- Load all template functions in dependency order
\ir departments.sql
\ir locations.sql
\ir policies.sql
\ir governance.sql
\ir employees.sql
\ir schedule.sql
\ir budget.sql
\ir teams.sql
\ir assignments.sql
\ir contracts.sql
\ir mattilsynet.sql
\ir alcohol-labor.sql

-- Master apply function
CREATE OR REPLACE FUNCTION template_restaurant_apply(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE NOTICE '[template] Applying restaurant template to workspace %', p_workspace_id;

  -- 1. Structure
  RAISE NOTICE '[template] Creating departments and positions...';
  PERFORM template_restaurant_departments(p_workspace_id);

  RAISE NOTICE '[template] Creating locations and zones...';
  PERFORM template_restaurant_locations(p_workspace_id);

  -- 2. Governance
  RAISE NOTICE '[template] Creating policies...';
  PERFORM template_restaurant_policies(p_workspace_id);

  RAISE NOTICE '[template] Creating governance (protocols, procedures, routines, tests)...';
  PERFORM template_restaurant_governance(p_workspace_id);

  -- 3. People
  RAISE NOTICE '[template] Creating 50 employees...';
  PERFORM template_restaurant_employees(p_workspace_id);

  -- 4. Schedule
  RAISE NOTICE '[template] Generating 3 months of shifts...';
  PERFORM template_restaurant_schedule(p_workspace_id);

  -- 5. Budget & Operations
  RAISE NOTICE '[template] Creating season budget, day/hour factors, operating hours...';
  PERFORM template_restaurant_budget(p_workspace_id);

  -- 6. Teams & Positions
  RAISE NOTICE '[template] Assigning team members and linking positions to shifts...';
  PERFORM template_restaurant_teams(p_workspace_id);

  -- 7. Protocol Assignments (Readiness)
  RAISE NOTICE '[template] Assigning protocols to employees...';
  PERFORM template_restaurant_assignments(p_workspace_id);

  -- 8. Employment Contracts
  RAISE NOTICE '[template] Creating employment contracts (Riksavtalen 2024-2026)...';
  PERFORM template_restaurant_contracts(p_workspace_id);

  -- 9. Mattilsynet Food Safety (20 routines, 8 control lists, 4 knowledge tests)
  RAISE NOTICE '[template] Creating Mattilsynet food safety routines...';
  PERFORM template_restaurant_mattilsynet(p_workspace_id);

  -- 10. Alcohol Handling & Labor Law (Alkoholloven, Arbeidsmiljøloven §10-6/§10-11)
  RAISE NOTICE '[template] Creating alcohol handling and labor law routines...';
  PERFORM template_restaurant_alcohol_labor(p_workspace_id);

  RAISE NOTICE '[template] Restaurant template applied successfully.';
END;
$$;
