-- Cascade task resolver RPC
-- Scans all cascade dimensions and returns grouped tasks as JSONB.
-- Pure read, no side effects. SECURITY INVOKER so RLS applies.

CREATE OR REPLACE FUNCTION resolve_cascade_tasks(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
  -- D1: Departments
  dept_all AS (
    SELECT department_id, name
    FROM department
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  workspace_hours_check AS (
    SELECT count(*) AS cnt
    FROM workspace_operating_hours
    WHERE workspace_id = p_workspace_id
  ),
  dept_with_hours AS (
    SELECT DISTINCT d.department_id
    FROM dept_all d
    WHERE EXISTS (
      SELECT 1 FROM department_operating_hours doh
      WHERE doh.department_id = d.department_id
    )
    OR (SELECT cnt FROM workspace_hours_check) > 0
  ),
  dept_tasks AS (
    SELECT jsonb_build_object(
      'id', 'departments.missing_hours.' || d.department_id,
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_missing_hours',
      'title_params', jsonb_build_object('name', d.name),
      'description_key', 'dashboard.todo.desc.dept_missing_hours',
      'description_params', jsonb_build_object('name', d.name),
      'urgency', 'critical',
      'href', '/dashboard/settings',
      'entity_type', 'department',
      'entity_id', d.department_id::text
    ) AS task
    FROM dept_all d
    LEFT JOIN dept_with_hours dh ON dh.department_id = d.department_id
    WHERE dh.department_id IS NULL
  ),
  dept_no_positions AS (
    SELECT jsonb_build_object(
      'id', 'departments.missing_positions.' || d.department_id,
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_missing_positions',
      'title_params', jsonb_build_object('name', d.name),
      'description_key', 'dashboard.todo.desc.dept_missing_positions',
      'description_params', jsonb_build_object('name', d.name),
      'urgency', 'can_wait',
      'href', '/dashboard/organization/departments/' || d.department_id,
      'entity_type', 'department',
      'entity_id', d.department_id::text
    ) AS task
    FROM dept_all d
    LEFT JOIN position p ON p.department_id = d.department_id
    WHERE p.position_id IS NULL
  ),
  location_check AS (
    SELECT count(*) AS loc_count
    FROM location
    WHERE workspace_id = p_workspace_id
  ),
  dept_no_location_task AS (
    SELECT jsonb_build_object(
      'id', 'departments.no_locations',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_no_locations',
      'description_key', 'dashboard.todo.desc.dept_no_locations',
      'urgency', 'should',
      'href', '/dashboard/organization'
    ) AS task
    FROM location_check
    WHERE loc_count = 0
  ),
  dept_none_task AS (
    SELECT jsonb_build_object(
      'id', 'departments.none_exist',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_none_exist',
      'description_key', 'dashboard.todo.desc.dept_none_exist',
      'urgency', 'critical',
      'href', '/dashboard/organization'
    ) AS task
    WHERE (SELECT count(*) FROM dept_all) = 0
  ),
  workspace_hours_task AS (
    SELECT jsonb_build_object(
      'id', 'workspace.missing_base_hours',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.workspace_missing_hours',
      'description_key', 'dashboard.todo.desc.workspace_missing_hours',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task
    WHERE (SELECT cnt FROM workspace_hours_check) = 0
  ),
  all_dept_tasks AS (
    SELECT task FROM dept_tasks
    UNION ALL SELECT task FROM dept_no_positions
    UNION ALL SELECT task FROM dept_no_location_task
    UNION ALL SELECT task FROM dept_none_task
    UNION ALL SELECT task FROM workspace_hours_task
  ),
  dept_summary AS (
    SELECT jsonb_build_object(
      'group', 'departments',
      'dimension', 'D1',
      'label_key', 'dashboard.todo.group.departments',
      'icon', 'Building2',
      'done', (SELECT count(*) FROM dept_with_hours),
      'total', (SELECT count(*) FROM dept_all),
      'tasks', COALESCE((SELECT jsonb_agg(task) FROM all_dept_tasks), '[]'::jsonb)
    ) AS summary
  ),

  -- D2: Staff
  active_profiles AS (
    SELECT profile_id, display_name, user_id,
           bank_account, personal_number, address_line_1
    FROM profile
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  profiles_without_contract AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN employment_contract ec
      ON ec.profile_id = p.profile_id
      AND ec.status = 'signed'
    WHERE ec.contract_id IS NULL
  ),
  profiles_without_payroll AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN employee_payroll_profile epp
      ON epp.profile_id = p.profile_id
    WHERE epp.id IS NULL
  ),
  profiles_incomplete AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    WHERE p.bank_account IS NULL
       OR p.personal_number IS NULL
       OR p.address_line_1 IS NULL
  ),
  profiles_no_team AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN team_member tm ON tm.profile_id = p.profile_id
    WHERE tm.team_member_id IS NULL
  ),
  staff_tasks AS (
    SELECT jsonb_build_object(
      'id', 'staff.missing_contract.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_missing_contract',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_missing_contract',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'critical',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_without_contract
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.missing_payroll.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_missing_payroll',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_missing_payroll',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'should',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_without_payroll
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.incomplete_profile.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_incomplete_profile',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_incomplete_profile',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'can_wait',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_incomplete
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.no_team.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_no_team',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_no_team',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'can_wait',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_no_team
  ),
  staff_done AS (
    SELECT count(*) AS cnt FROM active_profiles p
    WHERE EXISTS (
      SELECT 1 FROM employment_contract ec
      WHERE ec.profile_id = p.profile_id AND ec.status = 'signed'
    )
    AND EXISTS (
      SELECT 1 FROM employee_payroll_profile epp
      WHERE epp.profile_id = p.profile_id
    )
  ),
  staff_summary AS (
    SELECT jsonb_build_object(
      'group', 'staff', 'dimension', 'D2',
      'label_key', 'dashboard.todo.group.staff',
      'icon', 'Users',
      'done', (SELECT cnt FROM staff_done),
      'total', (SELECT count(*) FROM active_profiles),
      'tasks', COALESCE((SELECT jsonb_agg(task) FROM staff_tasks), '[]'::jsonb)
    ) AS summary
  ),

  -- D3: Framework
  fw_binding AS (
    SELECT count(*) AS cnt
    FROM workspace_framework_binding
    WHERE workspace_id = p_workspace_id
  ),
  fw_tariffs AS (
    SELECT count(*) AS cnt
    FROM tariff_rate_table
    WHERE workspace_id = p_workspace_id OR workspace_id IS NULL
  ),
  fw_holidays AS (
    SELECT count(*) AS cnt
    FROM public_holiday
    WHERE extract(year FROM holiday_date) = extract(year FROM current_date)
  ),
  framework_tasks AS (
    SELECT jsonb_build_object(
      'id', 'framework.no_binding', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_binding',
      'description_key', 'dashboard.todo.desc.framework_no_binding',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_binding) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'framework.no_tariffs', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_tariffs',
      'description_key', 'dashboard.todo.desc.framework_no_tariffs',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_tariffs) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'framework.no_holidays', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_holidays',
      'title_params', jsonb_build_object(
        'year', extract(year FROM current_date)::text
      ),
      'description_key', 'dashboard.todo.desc.framework_no_holidays',
      'description_params', jsonb_build_object(
        'year', extract(year FROM current_date)::text
      ),
      'urgency', 'should',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_holidays) = 0
  ),
  framework_summary AS (
    SELECT jsonb_build_object(
      'group', 'framework', 'dimension', 'D3',
      'label_key', 'dashboard.todo.group.framework',
      'icon', 'Scale',
      'done', (
        CASE WHEN (SELECT cnt FROM fw_binding) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM fw_tariffs) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM fw_holidays) > 0 THEN 1 ELSE 0 END
      ),
      'total', 3,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM framework_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D4: Budget & Season
  active_season AS (
    SELECT season_id FROM season
    WHERE workspace_id = p_workspace_id AND status = 'active'
    LIMIT 1
  ),
  season_budget_check AS (
    SELECT count(*) AS cnt FROM season_budget
    WHERE season_id = (SELECT season_id FROM active_season)
  ),
  day_factor_check AS (
    SELECT count(*) AS cnt FROM day_factor
    WHERE season_budget_id IN (
      SELECT season_budget_id FROM season_budget
      WHERE season_id = (SELECT season_id FROM active_season)
    )
  ),
  hour_factor_check AS (
    SELECT count(*) AS cnt FROM hour_factor
    WHERE season_budget_id IN (
      SELECT season_budget_id FROM season_budget
      WHERE season_id = (SELECT season_id FROM active_season)
    )
  ),
  budget_tasks AS (
    SELECT jsonb_build_object(
      'id', 'budget.no_season', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_season',
      'description_key', 'dashboard.todo.desc.budget_no_season',
      'urgency', 'critical',
      'href', '/dashboard/season'
    ) AS task WHERE (SELECT season_id FROM active_season) IS NULL
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'budget.no_budget', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_budget',
      'description_key', 'dashboard.todo.desc.budget_no_budget',
      'urgency', 'should',
      'href', '/dashboard/season'
    ) AS task
    WHERE (SELECT season_id FROM active_season) IS NOT NULL
      AND (SELECT cnt FROM season_budget_check) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'budget.no_day_factors', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_day_factors',
      'description_key', 'dashboard.todo.desc.budget_no_day_factors',
      'urgency', 'should',
      'href', '/dashboard/season'
    ) AS task
    WHERE (SELECT cnt FROM season_budget_check) > 0
      AND (SELECT cnt FROM day_factor_check) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'budget.no_hour_factors', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_hour_factors',
      'description_key', 'dashboard.todo.desc.budget_no_hour_factors',
      'urgency', 'can_wait',
      'href', '/dashboard/season'
    ) AS task
    WHERE (SELECT cnt FROM season_budget_check) > 0
      AND (SELECT cnt FROM hour_factor_check) = 0
  ),
  budget_summary AS (
    SELECT jsonb_build_object(
      'group', 'budget', 'dimension', 'D4',
      'label_key', 'dashboard.todo.group.budget',
      'icon', 'TrendingUp',
      'done', (
        CASE WHEN (SELECT season_id FROM active_season) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM season_budget_check) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM day_factor_check) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM hour_factor_check) > 0 THEN 1 ELSE 0 END
      ),
      'total', 4,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM budget_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- C4: Governance
  policy_count AS (
    SELECT count(*) AS cnt FROM policy
    WHERE workspace_id = p_workspace_id
  ),
  profiles_without_assignment AS (
    SELECT count(*) AS cnt FROM active_profiles p
    LEFT JOIN protocol_assignment pa ON pa.profile_id = p.profile_id
    WHERE pa.assignment_id IS NULL
  ),
  incomplete_training AS (
    SELECT count(DISTINCT pa.profile_id) AS cnt
    FROM protocol_assignment pa
    JOIN profile pr ON pr.profile_id = pa.profile_id
      AND pr.workspace_id = p_workspace_id AND pr.is_active = true
    LEFT JOIN knowledge_test_attempt kta
      ON kta.protocol_assignment_id = pa.assignment_id
    LEFT JOIN confirmation_signature cs
      ON cs.protocol_assignment_id = pa.assignment_id
    LEFT JOIN procedure_step_completion psc
      ON psc.protocol_assignment_id = pa.assignment_id
    WHERE kta.id IS NULL
      AND cs.id IS NULL
      AND psc.id IS NULL
  ),
  governance_tasks AS (
    SELECT jsonb_build_object(
      'id', 'governance.few_policies', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_few_policies',
      'description_key', 'dashboard.todo.desc.gov_few_policies',
      'urgency', 'critical',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM policy_count) < 3
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'governance.unassigned', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_unassigned_profiles',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM profiles_without_assignment)::text
      ),
      'description_key', 'dashboard.todo.desc.gov_unassigned_profiles',
      'urgency', 'should',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM profiles_without_assignment) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'governance.incomplete_training', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_incomplete_training',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM incomplete_training)::text
      ),
      'description_key', 'dashboard.todo.desc.gov_incomplete_training',
      'urgency', 'should',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM incomplete_training) > 0
  ),
  governance_summary AS (
    SELECT jsonb_build_object(
      'group', 'governance', 'dimension', 'C4',
      'label_key', 'dashboard.todo.group.governance',
      'icon', 'ShieldCheck',
      'done', CASE WHEN (SELECT cnt FROM policy_count) >= 3 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT cnt FROM profiles_without_assignment) = 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT cnt FROM incomplete_training) = 0 THEN 1 ELSE 0 END,
      'total', 3,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM governance_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D6: Schedule
  shift_count AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
  ),
  unmanned_shifts AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND employee_id IS NULL
      AND shift_date >= current_date
      AND shift_date < current_date + 7
  ),
  template_count AS (
    SELECT count(*) AS cnt FROM schedule_template
    WHERE workspace_id = p_workspace_id
  ),
  upcoming_shifts AS (
    SELECT count(*) AS total_cnt,
      count(*) FILTER (WHERE employee_id IS NOT NULL) AS assigned_cnt
    FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND shift_date >= current_date
      AND shift_date < current_date + 7
  ),
  schedule_tasks AS (
    SELECT jsonb_build_object(
      'id', 'schedule.no_shifts', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_no_shifts',
      'description_key', 'dashboard.todo.desc.schedule_no_shifts',
      'urgency', 'critical',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM shift_count) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'schedule.unmanned', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_unmanned',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM unmanned_shifts)::text
      ),
      'description_key', 'dashboard.todo.desc.schedule_unmanned',
      'urgency', 'should',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM unmanned_shifts) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'schedule.no_templates', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_no_templates',
      'description_key', 'dashboard.todo.desc.schedule_no_templates',
      'urgency', 'can_wait',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM template_count) = 0
  ),
  schedule_summary AS (
    SELECT jsonb_build_object(
      'group', 'schedule', 'dimension', 'D6',
      'label_key', 'dashboard.todo.group.schedule',
      'icon', 'CalendarDays',
      'done', (SELECT assigned_cnt FROM upcoming_shifts),
      'total', (SELECT total_cnt FROM upcoming_shifts),
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM schedule_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D2 sub: Contracts
  unsigned_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'sent'
  ),
  expiring_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'signed'
      AND end_date IS NOT NULL
      AND end_date < now() + interval '30 days'
  ),
  total_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
  ),
  active_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'signed'
  ),
  contract_tasks AS (
    SELECT jsonb_build_object(
      'id', 'contracts.unsigned', 'group', 'contracts',
      'dimension', 'D2',
      'title_key', 'dashboard.todo.contracts_unsigned',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM unsigned_contracts)::text
      ),
      'description_key', 'dashboard.todo.desc.contracts_unsigned',
      'urgency', 'should',
      'href', '/dashboard/people'
    ) AS task WHERE (SELECT cnt FROM unsigned_contracts) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'contracts.expiring', 'group', 'contracts',
      'dimension', 'D2',
      'title_key', 'dashboard.todo.contracts_expiring',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM expiring_contracts)::text
      ),
      'description_key', 'dashboard.todo.desc.contracts_expiring',
      'urgency', 'should',
      'href', '/dashboard/people'
    ) AS task WHERE (SELECT cnt FROM expiring_contracts) > 0
  ),
  contracts_summary AS (
    SELECT jsonb_build_object(
      'group', 'contracts', 'dimension', 'D2',
      'label_key', 'dashboard.todo.group.contracts',
      'icon', 'FileText',
      'done', (SELECT cnt FROM active_contracts),
      'total', (SELECT cnt FROM total_contracts),
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM contract_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- C2: Messages
  pending_proposals AS (
    SELECT count(*) AS cnt FROM change_proposal
    WHERE workspace_id = p_workspace_id
      AND status = 'pending'
  ),
  messages_tasks AS (
    SELECT jsonb_build_object(
      'id', 'messages.pending_decisions', 'group', 'messages',
      'dimension', 'C2',
      'title_key', 'dashboard.todo.messages_pending_decisions',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM pending_proposals)::text
      ),
      'description_key', 'dashboard.todo.desc.messages_pending_decisions',
      'urgency', 'should',
      'href', '/dashboard/notifications'
    ) AS task WHERE (SELECT cnt FROM pending_proposals) > 0
  ),
  messages_summary AS (
    SELECT jsonb_build_object(
      'group', 'messages', 'dimension', 'C2',
      'label_key', 'dashboard.todo.group.messages',
      'icon', 'MessageSquare',
      'done', CASE WHEN (SELECT cnt FROM pending_proposals) = 0 THEN 1 ELSE 0 END,
      'total', 1,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM messages_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- Assemble
  all_groups AS (
    SELECT summary FROM dept_summary
    UNION ALL SELECT summary FROM staff_summary
    UNION ALL SELECT summary FROM framework_summary
    UNION ALL SELECT summary FROM budget_summary
    UNION ALL SELECT summary FROM governance_summary
    UNION ALL SELECT summary FROM schedule_summary
    UNION ALL SELECT summary FROM contracts_summary
    UNION ALL SELECT summary FROM messages_summary
  ),
  all_tasks AS (
    SELECT task FROM all_dept_tasks
    UNION ALL SELECT task FROM staff_tasks
    UNION ALL SELECT task FROM framework_tasks
    UNION ALL SELECT task FROM budget_tasks
    UNION ALL SELECT task FROM governance_tasks
    UNION ALL SELECT task FROM schedule_tasks
    UNION ALL SELECT task FROM contract_tasks
    UNION ALL SELECT task FROM messages_tasks
  )
  SELECT jsonb_build_object(
    'groups', COALESCE((SELECT jsonb_agg(summary) FROM all_groups), '[]'::jsonb),
    'total_tasks', (SELECT count(*) FROM all_tasks),
    'critical_count', (
      SELECT count(*) FROM all_tasks WHERE task->>'urgency' = 'critical'
    ),
    'should_count', (
      SELECT count(*) FROM all_tasks WHERE task->>'urgency' = 'should'
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_cascade_tasks(uuid) TO authenticated;

COMMENT ON FUNCTION resolve_cascade_tasks IS
  'Cascade task resolver — scans all dimensions and returns grouped tasks as JSONB. Pure read, no side effects.

Schema facts for implementing agent:
- employment_contract.status uses contract_status enum: draft, sent, viewed, signed, expired, terminated
  (no "active" or "pending_signature" — use "signed" for active, "sent" for pending)
- public_holiday uses holiday_date (not date)
- profile has both is_active boolean AND status profile_status enum
- department has is_active boolean';
