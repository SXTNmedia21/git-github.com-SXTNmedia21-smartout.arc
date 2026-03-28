# Module Zero Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Module Zero roadmap — an end-to-end operational loop where a season activates, shifts publish, sessions auto-create, hooks fire, training tracks itself, and the day closes with reconciliation.

**Architecture:** Three independent workstreams that can run in parallel worktrees. WS-1 builds the operational backbone (season → session → close). WS-2 builds the training pipeline (auto-assign → readiness → Botsson). WS-3 adds gamification foundation. Each workstream produces working, testable software independently.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Supabase (PostgreSQL 17), TanStack Query v5, shadcn/ui, Tailwind v4 CSS vars, Zod, packages/ai capabilities, packages/telemetry emit()

---

## Verified Codebase State (2026-03-28)

Before building, understand what exists. This was verified against actual code, not docs.

| System                        | Status      | Key Files                                                                           |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Season UI (4 tabs)            | WORKING     | `apps/web/src/app/dashboard/season/`                                                |
| Season PLAY (draft→active)    | **MISSING** | No mutation in `use-seasons.ts`                                                     |
| Shift→Session                 | WORKING     | `supabase/functions/engine-dispatch/index.ts` (upsert_session)                      |
| Session hooks table           | EXISTS      | `session_hook`, `session_task`, `session_note` tables                               |
| Session hook execution        | **MISSING** | Process defined but no time-based trigger polling                                   |
| Daily close                   | WORKING     | CloseOutFlow, OCR, 8-state machine                                                  |
| Training flow                 | WORKING     | `my-training/`: ProtocolList, ProcedureStepper, KnowledgeTestView, ConfirmationSign |
| CompetenceMatrix              | EXISTS      | `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`                   |
| Auto-assignment               | **STUB**    | `onboarding_journey` process seeded but `training_protocol` sub-process missing     |
| Notifications                 | WORKING     | `process-notifications` EF: outbox → channels (push/email/sms/in-app)               |
| Botsson (6 caps)              | PARTIAL     | profile, ui, guardian, schedule, operations, communication                          |
| Botsson training cap          | **MISSING** | Type exists in `CapabilityName`, no implementation                                  |
| Botsson knowledge cap         | **MISSING** | Type exists in `CapabilityName`, no implementation                                  |
| Readiness warnings (schedule) | PARTIAL     | Task-level readiness in day panel, NOT on shift DnD                                 |
| Gamification                  | **NONE**    | 0 code, 0 tables                                                                    |
| Process Engine                | WORKING     | 14 action handlers in engine-dispatch                                               |

---

## Workstream Overview

| WS  | Name                            | Branch                         | Worktree | Tasks | Can Start         |
| --- | ------------------------------- | ------------------------------ | -------- | ----- | ----------------- |
| 1   | Season and Operations Loop      | `feat/season-operations-loop`  | wt-1     | 1-7   | Immediately       |
| 2   | Training and Agent Intelligence | `feat/training-agent-pipeline` | wt-2     | 8-14  | Immediately       |
| 3   | Gamification Foundation         | `feat/gamification-foundation` | wt-4     | 15-17 | After WS-1 Task 2 |

---

## WS-1: Season and Operations Loop

_The backbone: season activates, shifts publish, sessions auto-create, hooks fire, day closes, reconciliation._

---

### Task 1: Season PLAY — Activate a Season

**Files:**

- Modify: `apps/web/src/app/dashboard/season/_hooks/use-seasons.ts`
- Modify: `apps/web/src/app/dashboard/season/_components/SeasonOverview.tsx`
- Modify: `packages/telemetry/src/registry.ts` (if `season activated` event missing)

**Context:** The `season` table has `status: draft | active | archived`. Currently `use-seasons.ts` only has `createSeason` which sets status=draft. There is no mutation to transition draft to active. The UI needs a PLAY button that validates readiness (budget set + factors configured) before activating.

- [ ] **Step 1: Read the existing season overview component**

Read `apps/web/src/app/dashboard/season/_components/SeasonOverview.tsx` and `use-seasons.ts` to understand current UI structure and data flow. Note where the PLAY button should be placed.

- [ ] **Step 2: Add `activateSeason` mutation to use-seasons.ts**

Add after the existing `createSeason` mutation in `apps/web/src/app/dashboard/season/_hooks/use-seasons.ts`:

```typescript
const activateSeason = useMutation({
  mutationFn: async (seasonId: string): Promise<Season> => {
    // Validate: budget must exist and have required fields
    const { data: budget, error: budgetError } = await supabase
      .from("season_budget")
      .select("budget_id, total_target, labor_cost_percent, avg_hourly_wage")
      .eq("season_id", seasonId)
      .single();

    if (budgetError || !budget) throw new Error("Sesong mangler budsjett");
    if (!budget.total_target || budget.total_target <= 0)
      throw new Error("Budsjett mangler omsetningsmaal");

    // Validate: day factors must exist
    const { count: dayFactorCount } = await supabase
      .from("day_factor")
      .select("*", { count: "exact", head: true })
      .eq("season_id", seasonId);

    if (!dayFactorCount || dayFactorCount === 0) throw new Error("Sesong mangler dagfaktorer");

    // Validate: hour factors must exist
    const { count: hourFactorCount } = await supabase
      .from("hour_factor")
      .select("*", { count: "exact", head: true })
      .eq("season_id", seasonId);

    if (!hourFactorCount || hourFactorCount === 0) throw new Error("Sesong mangler timefaktorer");

    // Deactivate any currently active season in this workspace
    await supabase
      .from("season")
      .update({ status: "archived" })
      .eq("workspace_id", wsId!)
      .eq("status", "active");

    // Activate this season
    const { data, error } = await supabase
      .from("season")
      .update({ status: "active" })
      .eq("season_id", seasonId)
      .select(
        "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
      )
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
  onSuccess: (data) => {
    void emit({
      event: "season activated",
      workspace_id: wsId ?? null,
      actor_id: profileId ?? "",
      properties: {
        entity: {
          entity_type: "season",
          entity_id: data.season_id,
          entity_label: data.name,
        },
        data: { status: "active" },
      },
    });
    queryClient.invalidateQueries({
      queryKey: dashboardKeys.seasons(wsId ?? "none"),
    });
    toast.success(`${data.name} er naa aktiv!`);
  },
  onError: (error: Error) => {
    toast.error(error.message);
  },
});
```

Return `activateSeason` from the hook alongside `createSeason`.

- [ ] **Step 3: Verify `season activated` exists in telemetry registry**

Check `packages/telemetry/src/registry.ts` for the event. If missing, add it with destinations: `[posthog, logger, activity_trail, engine_event]`.

- [ ] **Step 4: Add PLAY button to SeasonOverview**

In the season overview component, add a button for draft seasons:

```tsx
{
  season.status === "draft" && (
    <Button
      onClick={() => activateSeason.mutate(season.season_id)}
      disabled={activateSeason.isPending}
      className="gap-2"
    >
      {activateSeason.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      Aktiver sesong
    </Button>
  );
}
{
  season.status === "active" && (
    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
      Aktiv
    </Badge>
  );
}
```

Import `Play` from `lucide-react`.

- [ ] **Step 5: Add `archiveSeason` mutation**

Same pattern as activate, but transitions `active` to `archived`. Only available when status is `active`. Validates no shifts are in `published` or `active` status within the season date range before allowing archive.

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm --filter web typecheck`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/season/ packages/telemetry/src/registry.ts
git commit -m "feat(season): add PLAY button to activate season with validation"
```

---

### Task 2: Season Activation Triggers Department Session Creation

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_season_activation_trigger.sql`
- Modify: `supabase/functions/engine-dispatch/index.ts` (if trigger event routing needed)

**Context:** When a season activates, the system should start creating `department_session` rows for each operational department for each day within the season range. Currently sessions are only created on shift publish. We need a trigger that fires on `season.status` change to `active` and creates sessions for the upcoming planning window (next 7 days).

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/YYYYMMDDHHMMSS_season_session_creation.sql`:

```sql
-- When a season activates, emit a telemetry event that triggers
-- session creation for operational departments within the planning window.
-- Uses Postgres trigger to insert into engine_event, which engine-dispatch picks up.

CREATE OR REPLACE FUNCTION emit_season_activated_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'season.activated',
      NEW.workspace_id,
      jsonb_build_object(
        'season_id', NEW.season_id,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'name', NEW.name
      ),
      'season_activated_' || NEW.season_id || '_' || now()::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_season_activated ON season;
CREATE TRIGGER trg_season_activated
  AFTER UPDATE OF status ON season
  FOR EACH ROW
  EXECUTE FUNCTION emit_season_activated_event();
```

- [ ] **Step 2: Add engine trigger for `season.activated`**

Seed an engine_trigger that maps `season.activated` to the existing `department_session_lifecycle` process with action `upsert_session`:

```sql
INSERT INTO engine_trigger (
  trigger_id, event_type, process_id, condition, workspace_id
) VALUES (
  'trg_season_activation_sessions',
  'season.activated',
  'department_session_lifecycle',
  '{}',
  NULL
) ON CONFLICT (trigger_id) DO NOTHING;
```

- [ ] **Step 3: Add season activation handler in engine-dispatch**

In `supabase/functions/engine-dispatch/index.ts`, add handling for the `season.activated` event type within the existing upsert_session action. When this event fires, the handler should:

1. Query `department` WHERE `workspace_id = payload.workspace_id` AND `department_type IN ('operational', 'hybrid')`
2. Resolve operating hours from `department_operating_hours` for each department
3. Calculate the planning window: today through min(season.end_date, today + 7 days)
4. Call existing `upsert_session` logic for each department x date combination

This extends the existing upsert_session handler (which already works for shift publish events) with a new trigger source.

- [ ] **Step 4: Run migration against local DB**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_season_session_creation.sql
```

- [ ] **Step 5: Test manually**

1. Create a season with budget + factors via UI
2. Click PLAY (from Task 1)
3. Check `department_session` table: `SELECT * FROM department_session WHERE workspace_id = '<ws_id>' ORDER BY session_date;`
4. Verify sessions created for operational departments within the planning window

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ supabase/functions/engine-dispatch/
git commit -m "feat(season): create department sessions on season activation"
```

---

### Task 3: Daily Session Replenishment (pg_cron)

**Files:**

- Create: `supabase/functions/daily-session-replenish/index.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_daily_session_cron.sql`

**Context:** Season activation creates the first batch of sessions. But we need daily replenishment: each night, fill up the planning window (next 7 days). This is a cron job, not an event-driven trigger.

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/daily-session-replenish/index.ts`. Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern per CLAUDE.md).

The function should:

1. Find all workspaces with active seasons
2. For each workspace, get operational/hybrid departments
3. Get department_operating_hours for each department per weekday
4. Calculate planning window: today through min(season.end_date, today + 7 days)
5. Upsert department_session for each department x date with status='upcoming'
6. Use onConflict on (workspace_id, department_id, session_date) to be idempotent

- [ ] **Step 2: Add to config.toml**

```toml
[functions.daily-session-replenish]
verify_jwt = false
```

- [ ] **Step 3: Create migration for pg_cron schedule (02:00 UTC daily)**

- [ ] **Step 4: Test locally by invoking manually**

```bash
curl -X POST http://localhost:54321/functions/v1/daily-session-replenish \
  -H "Authorization: Bearer <cron_secret>"
```

Verify sessions appear in `department_session` table.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/daily-session-replenish/ supabase/migrations/ supabase/functions/config.toml
git commit -m "feat(operations): add daily session replenishment cron job"
```

---

### Task 4: Session Lifecycle Auto-Transitions

**Files:**

- Create: `supabase/functions/session-lifecycle/index.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_session_lifecycle_cron.sql`

**Context:** Department sessions need to auto-transition based on time:

- `upcoming` to `active` when NOW >= session_date + planned_open
- `active` to `pending_signoff` when NOW >= session_date + planned_close
- `upcoming` to `missed` when NOW > session_date + planned_close + 2h (never opened)

- [ ] **Step 1: Create the session lifecycle Edge Function**

Auth: WATCHDOG_CRON_SECRET bearer token. Runs every 15 minutes via pg_cron.

For each transition:

1. Query sessions in source status for today (or yesterday for missed)
2. Compare current time against session_date + planned_open/close
3. Update status and set actual_open/actual_close timestamps

- [ ] **Step 2: Add to config.toml + create cron migration (every 15 min)**

- [ ] **Step 3: Test locally with sample session data**

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/session-lifecycle/ supabase/migrations/ supabase/functions/config.toml
git commit -m "feat(operations): add session lifecycle auto-transitions (15-min cron)"
```

---

### Task 5: Session Hook Firing (Task Materialization)

**Files:**

- Create: `supabase/functions/session-hook-executor/index.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_session_hook_executor_cron.sql`

**Context:** `session_hook` rows define procedures that should fire at specific anchors (pre_open, open, scheduled, pre_close, close) with `trigger_offset` minutes. When a session transitions, the relevant hooks should fire, creating `session_task` records from the linked procedures.

- [ ] **Step 1: Create the hook executor Edge Function**

Runs every 5 minutes. For each active/upcoming session today:

1. Get session_hook rows for the department
2. Calculate fire time: anchor_time + trigger_offset
3. Check idempotency: skip if session_task rows already exist for this hook + session
4. Get procedure_steps for the hook's procedure
5. Insert session_task for each step

- [ ] **Step 2: Add to config.toml + cron (every 5 minutes)**

- [ ] **Step 3: Test with sample hook data**

1. Create a `session_hook` for a department with `hook_type='open'`, `trigger_offset=-120`, linked to a procedure with 3 steps
2. Create a `department_session` with `status='upcoming'`, `planned_open='10:00'`
3. Invoke the function
4. If current time > 08:00, verify 3 `session_task` rows were created

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/session-hook-executor/ supabase/migrations/ supabase/functions/config.toml
git commit -m "feat(operations): add session hook executor — materializes procedures into tasks"
```

---

### Task 6: Wire Daily Close to Session Lifecycle

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_session_pending_signoff_trigger.sql`

**Context:** When a session transitions to `pending_signoff`, the daily close process should auto-start. The `daily_close` process already exists as a seeded engine_process. We need a database trigger that emits an `engine_event` when session status changes to `pending_signoff`.

- [ ] **Step 1: Create the trigger migration**

```sql
CREATE OR REPLACE FUNCTION emit_session_pending_signoff_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending_signoff' AND OLD.status = 'active' THEN
    INSERT INTO engine_event (
      event_type,
      workspace_id,
      payload,
      idempotency_key
    ) VALUES (
      'session.pending_signoff',
      NEW.workspace_id,
      jsonb_build_object(
        'department_session_id', NEW.department_session_id,
        'department_id', NEW.department_id,
        'session_date', NEW.session_date
      ),
      'session_signoff_' || NEW.department_session_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_session_pending_signoff ON department_session;
CREATE TRIGGER trg_session_pending_signoff
  AFTER UPDATE OF status ON department_session
  FOR EACH ROW
  EXECUTE FUNCTION emit_session_pending_signoff_event();

-- Engine trigger: session.pending_signoff -> daily_close process
INSERT INTO engine_trigger (
  trigger_id, event_type, process_id, condition, workspace_id
) VALUES (
  'trg_session_pending_signoff_daily_close',
  'session.pending_signoff',
  'daily_close',
  '{}',
  NULL
) ON CONFLICT (trigger_id) DO NOTHING;
```

- [ ] **Step 2: Run migration and test**

Manually update a session to `pending_signoff` and verify an `engine_event` row is created and the `daily_close` process starts.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(operations): wire daily close process to session pending_signoff"
```

---

### Task 7: Operations Dashboard — Verify Real Data

**Files:**

- Modify: `apps/web/src/app/dashboard/operations/` (if fixes needed)

**Context:** The operations dashboard was reported as WORKING with live data (stress metrics, 4 cards, auto-refresh 60s). This task verifies it works end-to-end with the new session lifecycle from Tasks 2-6.

- [ ] **Step 1: Verify operations dashboard queries real data**

Read `apps/web/src/app/dashboard/operations/` components and hooks. Confirm they query `department_session`, `session_task`, `schedule_shift`, `deviation` and not mock data.

- [ ] **Step 2: Test end-to-end flow**

1. Activate a season (Task 1)
2. Verify sessions appear in operations dashboard
3. Wait for hook execution (or invoke manually)
4. Verify tasks appear in the task list
5. Mark a task complete, verify status updates

- [ ] **Step 3: Fix any issues found during integration testing**

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix(operations): align dashboard queries with session lifecycle data"
```

---

## WS-2: Training and Agent Intelligence

_The development path: new employees auto-receive protocols, Botsson guides training, managers see the matrix._

---

### Task 8: Auto-Assignment Engine (Protocol Assignment on Profile Creation)

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_auto_assign_protocols.sql`

**Context:** When a new employee profile is created (via invitation accept), they should automatically receive `protocol_assignment` records for all active protocols in their workspace (filtered by department scope if applicable).

- [ ] **Step 1: Read the policy table schema**

Check if `policy` has `scope` and `department_id` columns. These determine whether to assign workspace-wide or department-scoped protocols.

- [ ] **Step 2: Create the auto-assignment trigger**

```sql
CREATE OR REPLACE FUNCTION auto_assign_protocols_to_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.profile_status NOT IN ('trainee', 'active') THEN
    RETURN NEW;
  END IF;

  INSERT INTO protocol_assignment (
    workspace_id,
    protocol_id,
    profile_id,
    status,
    assigned_at
  )
  SELECT
    NEW.workspace_id,
    p.protocol_id,
    NEW.profile_id,
    'pending',
    now()
  FROM protocol p
  JOIN policy pol ON p.policy_id = pol.policy_id
  WHERE p.workspace_id = NEW.workspace_id
    AND p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM protocol_assignment pa
      WHERE pa.protocol_id = p.protocol_id
        AND pa.profile_id = NEW.profile_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_assign_protocols ON profile;
CREATE TRIGGER trg_auto_assign_protocols
  AFTER INSERT ON profile
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_protocols_to_new_employee();
```

Note: If `policy.scope` exists, add department filtering. If not, assign all workspace protocols.

- [ ] **Step 3: Run migration and test**

1. Create a test protocol via HMS CRUD
2. Insert a new profile (simulate invitation accept)
3. Check `protocol_assignment` table and verify assignment was auto-created

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(training): auto-assign active protocols to new employee profiles"
```

---

### Task 9: Readiness-Aware Shift Assignment Warnings

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-shift-readiness-check.ts`
- Modify: shift assignment component (find DnD drop handler)

**Context:** Readiness warnings exist at the task level in the day session panel (`day-session-model.ts`). But the schedule DnD grid does NOT warn when dragging an under-trained employee onto a shift. We need a lightweight check.

- [ ] **Step 1: Create the readiness check hook**

Create `apps/web/src/app/dashboard/schedule/_hooks/use-shift-readiness-check.ts`:

A hook that pre-fetches readiness data for all active/trainee profiles in the workspace. Returns a `Map<profileId, { readinessPercent, pendingProtocols }>` for O(1) lookup during DnD.

Query: `protocol_assignment` with join on `protocol(name)`, grouped by profile_id, calculating completed vs total.

- [ ] **Step 2: Integrate warning into shift assignment**

Find the component that handles shift DnD drops. After the drop handler resolves the employee, check readiness and show a `toast.warning` if < 100%. This is a warning, not a blocker.

- [ ] **Step 3: Add visual indicator to shift cards**

On shift cards showing an assigned employee with < 100% readiness, add a small amber percentage badge.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/schedule/
git commit -m "feat(schedule): show readiness warnings on shift assignment"
```

---

### Task 10: Botsson Training Capability

**Files:**

- Create: `packages/ai/src/capabilities/training/index.ts`
- Create: `packages/ai/src/capabilities/training/tools.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

**Context:** The `CapabilityName` type already includes `"training"` but no implementation exists. We need 4 tools: `getReadinessScore`, `getAssignedProtocols`, `getProtocolProgress`, `suggestNextProtocol`.

- [ ] **Step 1: Create training tools**

Create `packages/ai/src/capabilities/training/tools.ts` with 4 tools:

1. `getReadinessScore` — get readiness % for a profile (own or specified). Queries protocol_assignment, calculates completed/total.
2. `getAssignedProtocols` — list all assignments with protocol name/description. Returns array with status per assignment.
3. `getProtocolProgress` — detailed progress for one assignment: steps completed, test result, confirmation status. Queries procedure_step_completion, knowledge_test_attempt, confirmation_signature.
4. `suggestNextProtocol` — find the next pending assignment ordered by assigned_at. Return protocol name and description.

Use `defineTool` from `../../define-tool.js` and `z` from zod for schemas. Follow the pattern in `packages/ai/src/capabilities/schedule/tools.ts`.

- [ ] **Step 2: Create the capability index**

Create `packages/ai/src/capabilities/training/index.ts` following the exact pattern in `schedule/index.ts`. All tools are read-only in v1.0.

- [ ] **Step 3: Register in capability registry**

Add `import { trainingCapability } from "./training/index.js"` and add to the `capabilities` record in `packages/ai/src/capabilities/registry.ts`.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter ai typecheck
git add packages/ai/src/capabilities/training/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add training capability with 4 tools"
```

---

### Task 11: Botsson Knowledge Capability

**Files:**

- Create: `packages/ai/src/capabilities/knowledge/index.ts`
- Create: `packages/ai/src/capabilities/knowledge/tools.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

**Context:** `CapabilityName` includes `"knowledge"` but no implementation exists. Employees should be able to ask Botsson about policies, procedures, and the handbook.

- [ ] **Step 1: Create knowledge tools**

Create `packages/ai/src/capabilities/knowledge/tools.ts` with 3 tools:

1. `searchPolicies` — search workspace policies by keyword or type. Queries policy with protocol join. Optional policyType filter and ilike name search.
2. `getProcedureSteps` — get step-by-step instructions for a procedure including training_content. Queries procedure + procedure_step ordered by step_order.
3. `searchHandbook` — semantic search using `match_workspace_docs` RPC. Takes natural language query, returns top N matches from workspace_doc_chunk via pgvector.

- [ ] **Step 2: Create capability index and register**

Follow the exact same pattern as training capability. All tools read-only.

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter ai typecheck
git add packages/ai/src/capabilities/knowledge/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add knowledge capability — policy search, procedure steps, handbook RAG"
```

---

### Task 12: Trainee First-Login Redirect

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx` (or the appropriate routing component)

**Context:** When a trainee first logs in after accepting an invitation, they should be redirected to `/dashboard/my-training` instead of the default dashboard.

- [ ] **Step 1: Read the dashboard page and routing logic**

Understand how the dashboard decides what to show. Check `DashboardShell.tsx` for role-based rendering and the main dashboard page.

- [ ] **Step 2: Add redirect logic for trainees**

After profile loads, if `profile.profile_status === "trainee"` and no protocol assignments are in_progress or completed, redirect to `/dashboard/my-training`. This should be a one-time redirect, not on every visit.

- [ ] **Step 3: Test the flow**

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/
git commit -m "feat(training): redirect trainee employees to my-training on first login"
```

---

### Task 13: Trainee to Active Promotion Trigger

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_trainee_promotion.sql`

**Context:** When a trainee completes ALL protocol assignments (readiness = 100%), their `profile_status` should automatically transition from `trainee` to `active`.

- [ ] **Step 1: Create the promotion trigger**

```sql
CREATE OR REPLACE FUNCTION check_trainee_promotion()
RETURNS TRIGGER AS $$
DECLARE
  v_pending_count integer;
  v_profile_status text;
BEGIN
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;

  SELECT profile_status INTO v_profile_status
  FROM profile WHERE profile_id = NEW.profile_id;

  IF v_profile_status != 'trainee' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_pending_count
  FROM protocol_assignment
  WHERE profile_id = NEW.profile_id AND status != 'completed';

  IF v_pending_count = 0 THEN
    UPDATE profile
    SET profile_status = 'active',
        trainee_completed = now(),
        updated_at = now()
    WHERE profile_id = NEW.profile_id;

    INSERT INTO engine_event (
      event_type, workspace_id, payload, idempotency_key
    ) VALUES (
      'profile.trainee_promoted',
      NEW.workspace_id,
      jsonb_build_object('profile_id', NEW.profile_id, 'promoted_at', now()),
      'trainee_promoted_' || NEW.profile_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_trainee_promotion ON protocol_assignment;
CREATE TRIGGER trg_check_trainee_promotion
  AFTER UPDATE OF status ON protocol_assignment
  FOR EACH ROW
  EXECUTE FUNCTION check_trainee_promotion();
```

- [ ] **Step 2: Run migration and test**

1. Create a trainee profile with 2 protocol assignments
2. Update first to `completed` — profile stays `trainee`
3. Update second to `completed` — profile becomes `active`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(training): auto-promote trainee to active when all protocols completed"
```

---

### Task 14: Employee My-Schedule Realtime

**Files:**

- Modify: `apps/web/src/app/dashboard/my-schedule/`

**Context:** The employee schedule view shows published shifts but has no Realtime subscription. When shifts are published or swapped, the employee should see updates without refreshing.

- [ ] **Step 1: Read the my-schedule page**

Understand current data fetching pattern.

- [ ] **Step 2: Add Realtime subscription**

Subscribe to `schedule_shift` changes filtered by `profile_id`. On change, invalidate the TanStack Query.

- [ ] **Step 3: Typecheck and commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/my-schedule/
git commit -m "feat(schedule): add Realtime subscription to employee shift view"
```

---

## WS-3: Gamification Foundation

_Points, leaderboards, and season engagement. Depends on WS-1 Task 2 (season activation)._

---

### Task 15: Gamification Schema

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_gamification_foundation.sql`

**Context:** Gamification requires: point rules (what actions earn points), point ledger (per-profile transactions), and a leaderboard view. Scoped to seasons.

- [ ] **Step 1: Create the migration**

Tables:

- `point_rule`: workspace_id, season_id, action_type (protocol_completed, test_passed, shift_on_time, task_completed, deviation_reported), points, description, is_active. UNIQUE(season_id, action_type).
- `point_transaction`: workspace_id, season_id, profile_id, point_rule_id, points, reason, source_type, source_id, created_at. Append-only ledger.
- `season_leaderboard`: MATERIALIZED VIEW aggregating point_transaction by season_id + profile_id with RANK().

RLS on point_rule and point_transaction using `get_workspace_ids_for_user(auth.uid())`.

Function `seed_default_point_rules(workspace_id, season_id)` inserts 5 default rules.

Function `refresh_season_leaderboard()` calls `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

- [ ] **Step 2: Run migration**

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts
git commit -m "feat(gamification): add point_rule, point_transaction tables and season_leaderboard view"
```

---

### Task 16: Point Awarding Triggers

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_gamification_triggers.sql`

**Context:** Points should be awarded automatically when qualifying actions occur. Each trigger inserts into `point_transaction` by looking up the relevant `point_rule` for the active season.

- [ ] **Step 1: Create triggers for 3 action types**

1. `protocol_assignment.status` changes to `completed` -> award protocol_completed points
2. `knowledge_test_attempt` inserted with `passed = true` -> award test_passed points
3. `session_task.status` changes to `completed` -> award task_completed points

Each trigger: find active season for workspace, find matching point_rule, insert point_transaction.

- [ ] **Step 2: Auto-seed point rules on season activation**

Add trigger on `season.status` change to `active` that calls `seed_default_point_rules()`.

- [ ] **Step 3: Run migration, test with manual data**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(gamification): add point-awarding triggers for protocol, test, and task completion"
```

---

### Task 17: Leaderboard UI Component

**Files:**

- Create: `apps/web/src/app/dashboard/season/_components/SeasonLeaderboard.tsx`
- Create: `apps/web/src/app/dashboard/season/_hooks/use-leaderboard.ts`
- Modify: `apps/web/src/app/dashboard/season/page.tsx` (add leaderboard tab)

**Context:** The leaderboard shows employee rankings by points within the active season. Uses the `season_leaderboard` materialized view.

- [ ] **Step 1: Create the leaderboard hook**

Query `season_leaderboard` view filtered by season_id, ordered by rank. Before querying, call `refresh_season_leaderboard()` RPC. Stale time: 2 minutes.

- [ ] **Step 2: Create the leaderboard component**

Card with rank icons (Trophy/Medal/Award for top 3), avatar with initials, display_name, department, total_points, action_count. Follow Nordic Split design system (warm colors, CSS variables, no hardcoded colors).

- [ ] **Step 3: Add leaderboard tab to season page**

Add a 5th tab: "Ledertavle" showing `<SeasonLeaderboard seasonId={activeSeasonId} />`.

- [ ] **Step 4: Typecheck and commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/season/ supabase/migrations/
git commit -m "feat(gamification): add season leaderboard UI with point rankings"
```

---

## Post-Implementation Verification

After all tasks are complete, run this checklist:

- [ ] `pnpm turbo typecheck` — 0 errors across all packages
- [ ] Season PLAY flow: create season with budget + factors, click PLAY, verify sessions created
- [ ] Session lifecycle: upcoming to active to pending_signoff to closed (verify auto-transitions)
- [ ] Hook firing: create session_hook for a department, verify session_task rows created at anchor time
- [ ] Auto-assignment: create protocol, invite employee, verify protocol_assignment auto-created
- [ ] Trainee promotion: complete all assignments, verify profile_status changes to active
- [ ] Readiness warning: assign under-trained employee to shift, verify toast warning
- [ ] Botsson training: ask "Hva er min status?" and verify readiness score returned
- [ ] Botsson knowledge: ask "Hva sier allergiprosedyren?" and verify procedure steps returned
- [ ] Leaderboard: complete a protocol, verify points appear, verify leaderboard updates
- [ ] Operations dashboard: verify live session + task data (no mock data)

---

## What This Plan Does NOT Cover (Phase 4)

These items depend on the above and are deferred to a future plan:

- Season review/evaluation (Week 13) — requires a full season of data
- AI suggestions engine (Week 14) — requires season review
- Auto-generated seasons (Week 15) — requires suggestion engine
- Mid-season adjustments (Week 16) — requires calibration loop (C1)
- Employee self-service shift swaps — requires notification pipeline + approval workflow
- Guardian multi-session monitoring — guardian already works, expansion is incremental
- Proactive Botsson messages — requires revenue deviation monitor
