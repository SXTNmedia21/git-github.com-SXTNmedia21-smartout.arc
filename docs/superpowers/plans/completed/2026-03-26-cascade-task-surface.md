---
title: "Å gjøre" Cascade Task Surface — Implementation Plan
status: ready
updated: 2026-03-26
created: 2026-03-26
module: dashboard
tags: [cascade, dashboard, task-surface, implementation]
---

# "Å gjøre" Cascade Task Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Guardian/Vakt dashboard tab with a cascade-driven task surface ("Å gjøre") that shows admins what needs doing, grouped by domain, with completion tracking.

**Architecture:** Supabase RPC function (`resolve_cascade_tasks`) scans all cascade dimensions in a single round-trip and returns grouped tasks as JSONB. A TanStack Query hook (`useCascadeTasks`) consumes the RPC. React components render groups with progress bars and urgency-sorted task cards. Guardian UI is retired (tables retained).

**Tech Stack:** PostgreSQL RPC, TanStack Query v5, React 19, Framer Motion, Lucide React, Tailwind v4 (OKLCH tokens), shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-26-cascade-task-surface-design.md`

---

## File Map

### New Files

| File                                                               | Responsibility                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/types/src/cascade-tasks.ts`                              | Shared type definitions (CascadeTask, TaskGroupSummary, CascadeTasksResult) |
| `supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql` | RPC function with 25 checkers as CTEs                                       |
| `apps/web/src/app/dashboard/_hooks/use-cascade-tasks.ts`           | TanStack Query hook wrapping RPC                                            |
| `apps/web/src/app/dashboard/_hooks/use-cascade-task-count.ts`      | Badge count hook (same queryFn, different select)                           |
| `apps/web/src/app/dashboard/_components/todo/TodoTaskView.tsx`     | Main view container                                                         |
| `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx` | Group header + progress bar + task list                                     |
| `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`     | Individual task card                                                        |
| `apps/web/src/app/dashboard/_components/todo/TodoEmptyState.tsx`   | Empty state                                                                 |
| `apps/web/src/app/dashboard/_components/todo/todo-icons.ts`        | Group → Lucide icon mapping                                                 |

### Modified Files

| File                                                                 | What changes                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/types/src/index.ts`                                        | Add `export * from "./cascade-tasks.js"`                      |
| `packages/telemetry/src/registry.ts`                                 | Add `"task_surface"` to EntityType union                      |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`                | Add `cascadeTasks` key, remove guardian keys                  |
| `apps/web/src/app/dashboard/_hooks/index.ts`                         | Add cascade exports, remove guardian exports                  |
| `apps/web/src/app/dashboard/_hooks/use-onboarding-guide.ts`          | Replace `useWorkspaceSetup` with `useCascadeTasks`            |
| `apps/web/src/components/dashboard/DashboardShell.tsx`               | AdminViewType, tab, sidebar, voice context, default view      |
| `apps/web/src/components/dashboard/AdminDashboard.tsx`               | Replace GuardianView + WorkspaceSetupWizard with TodoTaskView |
| `apps/web/src/app/dashboard/reports/_components/OverviewSection.tsx` | Update comment referencing GuardianView                       |
| `apps/web/src/app/dashboard/reports/_components/TrainingSection.tsx` | Update comment referencing GuardianView                       |

### Deleted Files

| File                                                        | Reason                        |
| ----------------------------------------------------------- | ----------------------------- |
| `apps/web/src/components/dashboard/GuardianView.tsx`        | Replaced by TodoTaskView      |
| `apps/web/src/components/dashboard/MissionControlPanel.tsx` | Was Guardian sub-panel        |
| `apps/web/src/app/dashboard/_hooks/useGuardianData.ts`      | Replaced by useCascadeTasks   |
| `apps/web/src/app/dashboard/_hooks/useGuardianActions.ts`   | No longer needed              |
| `apps/web/src/app/dashboard/_hooks/useGuardianSocket.ts`    | No longer needed              |
| `apps/web/src/app/dashboard/_hooks/use-workspace-setup.ts`  | Absorbed into useCascadeTasks |

### Untouched (explicit)

| File                                                         | Why untouched                                        |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| `apps/web/src/app/platform-admin/guardian/*`                 | Separate system — platform-level guardian            |
| `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx` | Still used by `/dashboard/setup` route               |
| `packages/ai/src/capabilities/guardian/*`                    | Agent capability retained in v1                      |
| `guardian_signal`, `guardian_log` tables                     | Written to by Edge Functions, read by platform-admin |

---

## Task 0: Shared Types + Telemetry Registration

**Files:**

- Create: `packages/types/src/cascade-tasks.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Create cascade task types**

```typescript
// packages/types/src/cascade-tasks.ts

export type TaskUrgency = "critical" | "should" | "can_wait";

export type TaskGroup =
  | "departments"
  | "staff"
  | "framework"
  | "budget"
  | "governance"
  | "schedule"
  | "contracts"
  | "messages";

export type CascadeDimension = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "C1" | "C2" | "C3" | "C4";

export type CascadeTask = {
  id: string;
  group: TaskGroup;
  dimension: CascadeDimension;
  title_key: string;
  title_params?: Record<string, string>;
  description_key: string;
  description_params?: Record<string, string>;
  urgency: TaskUrgency;
  href: string;
  entity_type?: string;
  entity_id?: string;
};

export type TaskGroupSummary = {
  group: TaskGroup;
  dimension: CascadeDimension;
  label_key: string;
  icon: string;
  done: number;
  total: number;
  tasks: CascadeTask[];
};

export type CascadeTasksResult = {
  groups: TaskGroupSummary[];
  total_tasks: number;
  critical_count: number;
  should_count: number;
};
```

- [ ] **Step 2: Export from index**

Add to `packages/types/src/index.ts`:

```typescript
export * from "./cascade-tasks.js";
```

- [ ] **Step 3: Register telemetry entity type**

In `packages/telemetry/src/registry.ts`, add `"task_surface"` to the `EntityType` union (after `"deviation"` on line 99):

```typescript
  | "deviation"
  | "task_surface";
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm --filter types build`
Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/cascade-tasks.ts \
  packages/types/src/index.ts \
  packages/telemetry/src/registry.ts
git commit -m "feat(types): add cascade task types and telemetry entity"
```

---

## Task 1: Supabase RPC Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql`

**Context:** This is the core data layer. The RPC function scans 8 domain groups across cascade dimensions using CTEs. It returns JSONB matching `CascadeTasksResult`. Runs as SECURITY INVOKER so RLS applies for web clients and service-role bypasses for stage-engine.

- [ ] **Step 1: Create migration file**

Generate timestamp: `date +%Y%m%d%H%M%S` and create the file. The full SQL is large — below is the structure with all 25 checkers. Each CTE filters by `p_workspace_id`.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql

CREATE OR REPLACE FUNCTION resolve_cascade_tasks(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
  -- ═══ D1: Departments ═══
  dept_all AS (
    SELECT department_id, name
    FROM department
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  dept_with_hours AS (
    SELECT DISTINCT d.department_id
    FROM dept_all d
    JOIN department_operating_hours doh ON doh.department_id = d.department_id
  ),
  dept_tasks AS (
    SELECT jsonb_build_object(
      'id', 'departments.missing_hours.' || d.department_id,
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_missing_hours',
      'title_params', jsonb_build_object('name', d.name),
      'description_key', 'dashboard.todo.desc.dept_missing_hours',
      'urgency', 'critical',
      'href', '/dashboard/organization',
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
      'urgency', 'can_wait',
      'href', '/dashboard/organization',
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
  all_dept_tasks AS (
    SELECT task FROM dept_tasks
    UNION ALL SELECT task FROM dept_no_positions
    UNION ALL SELECT task FROM dept_no_location_task
    UNION ALL SELECT task FROM dept_none_task
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

  -- ═══ D2: Staff ═══
  active_profiles AS (
    SELECT profile_id, first_name, last_name, user_id
    FROM profile
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  profiles_without_contract AS (
    SELECT p.profile_id, p.first_name || ' ' || p.last_name AS name
    FROM active_profiles p
    LEFT JOIN employment_contract ec
      ON ec.profile_id = p.profile_id
      AND ec.contract_status = 'active'
    WHERE ec.contract_id IS NULL
  ),
  profiles_without_payroll AS (
    SELECT p.profile_id, p.first_name || ' ' || p.last_name AS name
    FROM active_profiles p
    LEFT JOIN employee_payroll_profile epp
      ON epp.profile_id = p.profile_id
    WHERE epp.payroll_profile_id IS NULL
  ),
  profiles_incomplete AS (
    SELECT p.profile_id, p.first_name || ' ' || p.last_name AS name
    FROM active_profiles p
    WHERE p.bank_account IS NULL
       OR p.personal_number IS NULL
       OR p.address_line_1 IS NULL
  ),
  profiles_no_team AS (
    SELECT p.profile_id, p.first_name || ' ' || p.last_name AS name
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
      'urgency', 'can_wait',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_no_team
  ),
  staff_done AS (
    SELECT count(*) AS cnt FROM active_profiles p
    WHERE EXISTS (
      SELECT 1 FROM employment_contract ec
      WHERE ec.profile_id = p.profile_id AND ec.contract_status = 'active'
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

  -- ═══ D3: Framework ═══
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

  -- ═══ D4: Budget & Season ═══
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

  -- ═══ C4: Governance ═══
  policy_count AS (
    SELECT count(*) AS cnt FROM policy
    WHERE workspace_id = p_workspace_id
  ),
  profiles_without_assignment AS (
    SELECT count(*) AS cnt FROM active_profiles p
    LEFT JOIN protocol_assignment pa ON pa.profile_id = p.profile_id
    WHERE pa.protocol_assignment_id IS NULL
  ),
  incomplete_training AS (
    SELECT count(DISTINCT pa.profile_id) AS cnt
    FROM protocol_assignment pa
    JOIN profile pr ON pr.profile_id = pa.profile_id
      AND pr.workspace_id = p_workspace_id AND pr.is_active = true
    LEFT JOIN knowledge_test_attempt kta
      ON kta.protocol_assignment_id = pa.protocol_assignment_id
    LEFT JOIN confirmation_signature cs
      ON cs.protocol_assignment_id = pa.protocol_assignment_id
    LEFT JOIN procedure_step_completion psc
      ON psc.protocol_assignment_id = pa.protocol_assignment_id
    WHERE kta.attempt_id IS NULL
      AND cs.signature_id IS NULL
      AND psc.completion_id IS NULL
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

  -- ═══ D6: Schedule ═══
  shift_count AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
  ),
  unmanned_shifts AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND profile_id IS NULL
      AND start_time >= now()
      AND start_time < now() + interval '7 days'
  ),
  template_count AS (
    SELECT count(*) AS cnt FROM schedule_template
    WHERE workspace_id = p_workspace_id
  ),
  upcoming_shifts AS (
    SELECT count(*) AS total_cnt,
      count(*) FILTER (WHERE profile_id IS NOT NULL) AS assigned_cnt
    FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND start_time >= now()
      AND start_time < now() + interval '7 days'
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

  -- ═══ D2 sub: Contracts ═══
  unsigned_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND contract_status = 'pending_signature'
  ),
  expiring_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND contract_status = 'active'
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
      AND contract_status = 'active'
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

  -- ═══ C2: Messages ═══
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

  -- ═══ Assemble ═══
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

COMMENT ON FUNCTION resolve_cascade_tasks IS
  'Cascade task resolver — scans all dimensions and returns grouped tasks as JSONB. Pure read, no side effects.';
```

- [ ] **Step 2: Run migration against local Supabase**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) \
  psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql
```

Expected: `CREATE FUNCTION`

- [ ] **Step 3: Test the RPC with a workspace ID**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c \
  "SELECT resolve_cascade_tasks('00000000-0000-0000-0000-000000000000'::uuid);"
```

Expected: Returns JSONB with 8 groups, mostly empty tasks arrays (no data for dummy ID). Validates structure.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*resolve_cascade_tasks*
git commit -m "feat(db): add resolve_cascade_tasks RPC function"
```

---

## Task 2: Data Hooks + Query Keys

**Files:**

- Modify: `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-cascade-tasks.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-cascade-task-count.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

- [ ] **Step 1: Update query keys**

In `dashboard-keys.ts`, replace the guardian keys section (lines 59-66) with:

```typescript
  // Cascade Tasks (replaces Guardian Protocol)
  cascadeTasks: (workspaceId: string) =>
    ["dashboard", "cascade-tasks", workspaceId] as const,
```

Keep `workspaceSetupStatus` key for now (backward compat during transition).

- [ ] **Step 2: Create useCascadeTasks hook**

```typescript
// apps/web/src/app/dashboard/_hooks/use-cascade-tasks.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { CascadeTasksResult } from "@smartout/types";

const EMPTY_RESULT: CascadeTasksResult = {
  groups: [],
  total_tasks: 0,
  critical_count: 0,
  should_count: 0,
};

export function useCascadeTasks() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.cascadeTasks(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<CascadeTasksResult> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("resolve_cascade_tasks", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data as CascadeTasksResult) ?? EMPTY_RESULT;
    },
  });
}
```

- [ ] **Step 3: Create useCascadeTaskCount hook**

```typescript
// apps/web/src/app/dashboard/_hooks/use-cascade-task-count.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { CascadeTasksResult } from "@smartout/types";

export function useCascadeTaskCount() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.cascadeTasks(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<CascadeTasksResult> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("resolve_cascade_tasks", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (
        (data as CascadeTasksResult) ?? {
          groups: [],
          total_tasks: 0,
          critical_count: 0,
          should_count: 0,
        }
      );
    },
    select: (data) => ({
      critical: data.critical_count,
      should: data.should_count,
    }),
  });
}
```

- [ ] **Step 4: Update hook exports**

In `apps/web/src/app/dashboard/_hooks/index.ts`, replace guardian exports (lines 33-44) with:

```typescript
export { useCascadeTasks } from "./use-cascade-tasks";
export { useCascadeTaskCount } from "./use-cascade-task-count";
```

Remove line 51: `export { useWorkspaceSetup } from "./use-workspace-setup";`
Remove line 52: `export type { WorkspaceSetupStatus, SetupModule } from "./use-workspace-setup";`

- [ ] **Step 5: Verify types compile**

Run: `pnpm --filter web typecheck`
Expected: May have errors from files still importing guardian hooks — that is expected and fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/
git commit -m "feat(hooks): add cascade task hooks, remove guardian exports"
```

---

## Task 3: UI Components — TodoTaskCard, TodoGroupSection, TodoEmptyState, TodoTaskView

**Files:**

- Create: `apps/web/src/app/dashboard/_components/todo/todo-icons.ts`
- Create: `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`
- Create: `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx`
- Create: `apps/web/src/app/dashboard/_components/todo/TodoEmptyState.tsx`
- Create: `apps/web/src/app/dashboard/_components/todo/TodoTaskView.tsx`

This task creates all 5 component files. Each is self-contained. The spec has exact design tokens, springs, and accessibility requirements — follow them precisely.

**Key design rules (from spec + council):**

- OKLCH colors via CSS variables — never `hsl()` wrapper
- `backdrop-blur` (8px), not `backdrop-blur-sm`
- Noise overlay on frosted glass cards
- `swapSpring` (stiffness 45, damping 22, mass 2) for badge/progress
- `expandSpring` (stiffness 30, damping 24, mass 2.5) for group collapse
- Per-card stagger: 40ms, fadeInUp, 500ms, ease [0.25, 0.1, 0.25, 1]
- Lucide icons only — no emojis
- `prefers-reduced-motion`: instant transitions, no stagger
- All text via i18n keys (hardcode Norwegian as fallback for now since i18n package may not have the keys yet — wrap in a `t()` call or use the key as the display string)

- [ ] **Step 1: Create todo-icons.ts**

```typescript
// apps/web/src/app/dashboard/_components/todo/todo-icons.ts
import {
  Building2,
  Users,
  Scale,
  TrendingUp,
  ShieldCheck,
  CalendarDays,
  FileText,
  MessageSquare,
} from "lucide-react";
import type { TaskGroup } from "@smartout/types";
import type { LucideIcon } from "lucide-react";

export const groupIcons: Record<TaskGroup, LucideIcon> = {
  departments: Building2,
  staff: Users,
  framework: Scale,
  budget: TrendingUp,
  governance: ShieldCheck,
  schedule: CalendarDays,
  contracts: FileText,
  messages: MessageSquare,
};
```

- [ ] **Step 2: Create TodoTaskCard.tsx**

Build per spec: frosted glass card with 4px left urgency border, Lucide urgency icon, title, description, ChevronRight navigation. Keyboard accessible, focus ring, hover state, entrance/exit animation. `emit()` on click.

See spec section "TodoTaskCard" for exact tokens.

- [ ] **Step 3: Create TodoGroupSection.tsx**

Build per spec: group header with domain icon, label, Geist Mono fraction, animated progress bar. Auto-collapse completed groups. `expandSpring` for collapse, `AnimatePresence` for children.

See spec section "TodoGroupSection" for exact tokens.

- [ ] **Step 4: Create TodoEmptyState.tsx**

Build per spec: CircleCheck icon (48px) with success orb glow, Instrument Serif heading, Geist Sans subtext.

See spec section "TodoEmptyState" for exact tokens.

- [ ] **Step 5: Create TodoTaskView.tsx**

Main orchestrator: calls `useCascadeTasks()`, renders loading skeleton / error state / group list / empty state. `emit()` on mount. Groups sorted: incomplete first (by highest urgency), completed last.

See spec section "TodoTaskView" for behavior.

- [ ] **Step 6: Verify components compile**

Run: `pnpm --filter web typecheck`
Expected: Clean (components may reference hooks from Task 2).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/_components/todo/
git commit -m "feat(todo): add cascade task surface UI components"
```

---

## Task 4: DashboardShell + AdminDashboard Integration

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

- [ ] **Step 1: Update AdminViewType**

In `DashboardShell.tsx` line 64, replace `"guardian"` with `"todo"`:

```typescript
export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "todo";
```

- [ ] **Step 2: Update default view**

In `DashboardShell.tsx` line 343, change default:

```typescript
const [adminView, setAdminView] = useState<AdminViewType>("todo");
```

- [ ] **Step 3: Update tab switcher**

Replace the "Vakt" button (around line 1847-1859) — change `Shield` to `ListChecks`, label to "Å gjøre", add badge from `useCascadeTaskCount()`.

Replace `import { useWorkspaceSetup }` (line 8) with `import { useCascadeTaskCount } from "@/app/dashboard/_hooks/use-cascade-task-count"`.

- [ ] **Step 4: Update sidebar nav**

Two locations: admin mode (~line 1268-1276) "Event Center" and collapsed mode (~line 1418-1420) "Vakt". Both become "Å gjøre" with `ListChecks` icon and `setAdminView("todo")`.

- [ ] **Step 5: Update voice session context**

In `buildVoiceSessionContext()` (around line 85), replace the `guardian` case with `todo`:

```typescript
if (adminView === "todo") {
  return {
    page: "dashboard.todo",
    summary: "Cascade task surface — workspace completeness and pending actions",
    context_tags: ["task-surface", "cascade-status", "admin-todo"],
  };
}
```

- [ ] **Step 6: Update AdminDashboard.tsx**

Replace the GuardianView conditional render with TodoTaskView. Remove `WorkspaceSetupWizard` dynamic import and the `isSetupMode` conditional (around lines 25-46).

```typescript
// Remove these:
// const WorkspaceSetupWizard = dynamic(() => ...)
// if (isSetupMode) return <WorkspaceSetupWizard ... />

// Add:
import { TodoTaskView } from "@/app/dashboard/_components/todo/TodoTaskView";

// In the render, when adminView === "todo":
// <TodoTaskView />
```

- [ ] **Step 7: Verify app compiles**

Run: `pnpm --filter web typecheck`
Expected: May still have errors from deleted hooks not yet removed — fix in Task 5.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx \
  apps/web/src/components/dashboard/AdminDashboard.tsx
git commit -m "feat(dashboard): replace Guardian/Vakt with Å gjøre task surface"
```

---

## Task 5: Guardian Cleanup + Dependency Migration

**Files:**

- Delete: `apps/web/src/components/dashboard/GuardianView.tsx`
- Delete: `apps/web/src/components/dashboard/MissionControlPanel.tsx`
- Delete: `apps/web/src/app/dashboard/_hooks/useGuardianData.ts`
- Delete: `apps/web/src/app/dashboard/_hooks/useGuardianActions.ts`
- Delete: `apps/web/src/app/dashboard/_hooks/useGuardianSocket.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/use-onboarding-guide.ts`
- Delete: `apps/web/src/app/dashboard/_hooks/use-workspace-setup.ts`
- Modify: `apps/web/src/app/dashboard/reports/_components/OverviewSection.tsx`
- Modify: `apps/web/src/app/dashboard/reports/_components/TrainingSection.tsx`

- [ ] **Step 1: Migrate use-onboarding-guide.ts**

Replace `useWorkspaceSetup` import with `useCascadeTasks`. The hook uses `setupStatus.needsSetup` — derive this from cascade tasks:

```typescript
// Replace line 11:
// import { useWorkspaceSetup } from "./use-workspace-setup";
import { useCascadeTasks } from "./use-cascade-tasks";

// Replace line 31:
// const { data: setupStatus, isLoading: isSetupLoading } = useWorkspaceSetup();
const { data: cascadeData, isLoading: isSetupLoading } = useCascadeTasks();
const needsSetup = (cascadeData?.critical_count ?? 0) > 0;

// Replace line 40:
// if (!setupStatus?.needsSetup) {
if (!needsSetup) {
```

- [ ] **Step 2: Delete guardian hook files**

```bash
rm apps/web/src/app/dashboard/_hooks/useGuardianData.ts
rm apps/web/src/app/dashboard/_hooks/useGuardianActions.ts
rm apps/web/src/app/dashboard/_hooks/useGuardianSocket.ts
rm apps/web/src/app/dashboard/_hooks/use-workspace-setup.ts
```

- [ ] **Step 3: Delete guardian view components**

```bash
rm apps/web/src/components/dashboard/GuardianView.tsx
rm apps/web/src/components/dashboard/MissionControlPanel.tsx
```

- [ ] **Step 4: Update report comments**

In `OverviewSection.tsx`, find comment referencing "GuardianView" and update to "TodoTaskView".

In `TrainingSection.tsx`, find comment referencing "GuardianView" and update to "TodoGroupSection".

- [ ] **Step 5: Full typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors. If any remain, fix broken imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(dashboard): remove guardian UI, migrate setup hook"
```

---

## Task 6: Typecheck + Visual Verification

**Files:** None new — verification only.

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Start local dev server**

Run: `pnpm --filter web dev`
Navigate to `http://localhost:3060/dashboard`

- [ ] **Step 3: Visual verification checklist**

Verify:

- [ ] "Å gjøre" tab is visible and is the default landing view
- [ ] Tab has `ListChecks` icon (not Shield)
- [ ] Badge shows count (or is hidden if 0)
- [ ] Groups render with icons and progress bars
- [ ] Task cards have left urgency border
- [ ] Clicking a task card navigates to the correct page
- [ ] Completed groups show collapsed with checkmark
- [ ] Sidebar shows "Å gjøre" (not "Event Center" or "Vakt")
- [ ] Other tabs (Taktisk, Strategisk, etc.) still work

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(todo): visual verification fixes"
```

---

## Summary

| Task | What                    | Files    | Depends on                   |
| ---- | ----------------------- | -------- | ---------------------------- |
| 0    | Types + telemetry       | 3 files  | —                            |
| 1    | RPC migration           | 1 file   | Task 0 (types for reference) |
| 2    | Data hooks + query keys | 4 files  | Task 0, Task 1               |
| 3    | UI components           | 5 files  | Task 0, Task 2               |
| 4    | Dashboard integration   | 2 files  | Task 2, Task 3               |
| 5    | Guardian cleanup        | 7+ files | Task 4                       |
| 6    | Verification            | 0 files  | Task 5                       |

---

## Council Verdict — 2026-03-26

**Verdict: APPROVED_WITH_CONDITIONS**

**Reviewer:** Claude (council reviewer)
**Date:** 2026-03-26
**Branch:** wt-2 (7 commits ahead of development + 4 uncommitted files)

---

### Progress Assessment

| Task                                | Status     | Evidence                                                                                     |
| ----------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| 0 — Types + telemetry               | ✅ Done    | `cascade-tasks.ts`, telemetry entity registered                                              |
| 1 — RPC migration                   | ✅ Done    | `20260426100000_resolve_cascade_tasks_rpc.sql`, schema bugs corrected in fix commit          |
| 2 — Data hooks                      | ✅ Done    | `use-cascade-tasks.ts`, `use-cascade-task-count.ts`, keys registered                         |
| 3 — UI components                   | ✅ Done    | `todo/` directory with all 5 components                                                      |
| 4 — Dashboard integration           | ✅ Done    | DashboardShell uses `"todo"` AdminViewType as default, voice context updated                 |
| 5 — Guardian cleanup                | ✅ Done    | GuardianView, MissionControlPanel, 4 guardian hooks deleted; `use-onboarding-guide` migrated |
| 6 — Typecheck + visual verification | ⏳ Pending | Not yet run — checkboxes unchecked                                                           |
| 7 — i18n translations               | ⏳ Pending | Added to plan (uncommitted), keys written in Norwegian — not yet committed                   |
| 8 — ADR                             | ⏳ Pending | Decision log updated in uncommitted changes — not yet committed                              |

---

### Architecture Review

**Strengths:**

- `SECURITY INVOKER` on RPC is correct — RLS applies for web clients, service role bypasses for stage-engine
- `STABLE` + `SET search_path = 'public'` are good security hygiene (prevents function search-path injection)
- `GRANT EXECUTE TO authenticated` properly scoped
- Single-RPC JSONB pattern eliminates N+1 round-trips — good for dashboard load
- TanStack Query key deduplication between `useCascadeTasks` and `useCascadeTaskCount` is efficient
- Guardian DB tables (`guardian_signal`, `guardian_log`) retained — correct, written by Edge Functions
- Platform-admin guardian and AI capability guardian untouched — clean scope
- `(supabase.rpc as any)` cast is documented with comment explaining it's temporary (types regenerate post-migration)

**Schema bug caught and fixed:** The fix commit corrects `contract_status` enum column name (`status` not `contract_status`), enum values (`sent`/`signed` not `pending_signature`/`active`). This is critical correctness — the checker would have silently returned zero rows otherwise.

**Cascade dimension mapping is correct:**

- D1 (departments/hours), D2 (staff/contracts/payroll), D3 (framework/tariffs), D4 (budget/season), D6 (schedule), C4 (governance/training) — all correct per canonical spec

---

### Conditions (must complete before merge)

1. **Task 6 — typecheck must pass.** Run `pnpm typecheck` and confirm 0 errors. If errors exist, fix before closing.
2. **Task 7 — i18n translations must be committed.** The Norwegian keys are written in the plan diff but not yet applied to `packages/i18n/locales/nb/dashboard.json` + `en/dashboard.json`. Without these, the task surface renders raw keys like `dashboard.todo.dept_missing_hours` instead of text.
3. **Uncommitted changes must be committed.** The two hook files (ESLint suppression comments) and the decision log entry are uncommitted — commit them before running close-feature.

---

### No Blockers

No architectural violations found. No security issues. No cascade dimension boundary violations. No hardcoded secrets or colors. Commit message convention is followed across all 7 commits.

Tasks 0 and 1 can run in parallel. Tasks 2-6 are sequential.
