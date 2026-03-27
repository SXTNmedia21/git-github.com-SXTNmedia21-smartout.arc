---
title: "Cascade Operational Layer — Implementation Plan"
status: done
updated: 2026-03-26
created: 2026-03-22
module: cascade
tags: [cascade, rules, tariff, cost, demand, governance, plan]
---

# Cascade Operational Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cascade foundation operational — framework rules fire on shift create/edit/publish, cost snapshots materialize on publish and completion, admins can view and manage rules/tariffs/proposals, and season budgets propagate into daily staffing targets.

**Architecture:** Dual-layer. Client-side pure functions for instant UI feedback in the schedule planner. Server-side engine actions for authoritative cost computation and demand propagation. Admin management integrated into existing settings tabs.

**Tech Stack:** Next.js App Router, TypeScript, TanStack Query, Supabase (PostgreSQL, Edge Functions), Vitest, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-22-cascade-operational-layer-design.md`

---

## Pre-Flight Checks

Before any implementation, verify these exist:

| Dependency                                 | Verify with                                                                                          | Expected                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `evaluateFrameworkRules()` (new signature) | `grep "export function evaluateFrameworkRules" apps/web/src/lib/cascade/evaluate-framework-rules.ts` | Takes `(entityContext, rules, overrides)` returns `EvaluationResult`   |
| `resolveTariffRate()`                      | `grep "export function resolveTariffRate" apps/web/src/lib/cascade/resolve-tariff-rate.ts`           | Takes `(context, timestamp)` returns `TariffResolution`                |
| `getTariffContext()`                       | `grep "export async function getTariffContext" apps/web/src/lib/cascade/get-tariff-context.ts`       | Takes `(supabase, profileId, date)` returns `TariffContext`            |
| `shift_cost_snapshot` table                | `\d shift_cost_snapshot`                                                                             | Has base_hours, base_rate, supplements, total_cost                     |
| `workspace_budget` table                   | `\d workspace_budget`                                                                                | Has revenue_target, labor_cost_target, labor_hours_target, period_date |
| K1a framework seed data                    | `SELECT COUNT(*) FROM framework_rule`                                                                | At least 8 rows                                                        |

**If any are missing:** Fix before proceeding. These were created in the Cascade Foundation phase on this branch.

## Telemetry Registry Gap

`"season_budget updated"` and `"day_factors updated"` currently route to posthog + logger + activity_trail ONLY — NOT to `engine_event`. Phase 3 tasks must add `engine_event` to their destinations in the registry before engine triggers can consume them.

---

## Phase 1: Wire Cascade to Schedule

### Task 1: Schema Migration — snapshot_basis + cost provenance

**Files:**

- Create: `supabase/migrations/20260422400300_cascade_operational_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Cascade Operational Layer — schema additions

CREATE TYPE snapshot_basis AS ENUM ('planned', 'actual');

ALTER TABLE shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS basis snapshot_basis NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS source_event TEXT,
  ADD COLUMN IF NOT EXISTS effective_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_end TIMESTAMPTZ;

COMMENT ON COLUMN shift_cost_snapshot.basis IS 'planned = publish-time estimate, actual = completion-time truth';
COMMENT ON COLUMN shift_cost_snapshot.effective_start IS 'The start timestamp used for this cost calculation';
COMMENT ON COLUMN shift_cost_snapshot.effective_end IS 'The end timestamp used for this cost calculation';
```

- [ ] **Step 2: Apply and verify**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422400300_cascade_operational_schema.sql
```

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422400300_cascade_operational_schema.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add snapshot_basis enum + cost provenance columns

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: buildEntityContext() — Pure Function + Tests

**Files:**

- Create: `apps/web/src/lib/cascade/build-entity-context.ts`
- Create: `apps/web/src/lib/cascade/__tests__/build-entity-context.test.ts`

- [ ] **Step 1: Write tests**

Test cases:

1. Single shift on a day → dailyHoursWorked = shift duration
2. Multiple shifts same day → dailyHoursWorked = sum of durations
3. Shifts across week → weeklyHoursWorked = sum of all
4. Draft shift added to existing → both included in totals
5. lastShiftEnd = closest prior shift end before draft start
6. employeeAge computed from birth date vs shift date
7. No existing shifts → all zeros except draft

The function takes:

- `existingShifts: Array<{ startTime: string; endTime: string; date: string }>` (employee's shifts for the week)
- `draftShift: { startTime: string; endTime: string; date: string }` (the shift being created/edited)
- `employeeContext: { birthDate: string | null; contractType: string | null }` (from payroll profile)

Returns `EntityContext` (from `./types.ts`).

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter web test -- --run src/lib/cascade/__tests__/build-entity-context.test.ts
```

- [ ] **Step 3: Implement**

Pure function. Key logic:

- Parse times as HH:MM, compute duration in hours (handle overnight: endTime < startTime = crosses midnight)
- Filter existing shifts by date for daily totals
- Sum all shifts in array for weekly totals
- Find max endTime from shifts before draft startTime for lastShiftEnd
- Age = floor((shiftDate - birthDate) / 365.25 days)

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Update barrel export** in `apps/web/src/lib/cascade/index.ts`

- [ ] **Step 6: Commit**

---

### Task 3: useEmployeeRuleContext() Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-employee-rule-context.ts`

- [ ] **Step 1: Implement the hook**

TanStack Query hook that loads `profile.birth_date` + `employee_payroll_profile` (tariff_category, agreed_weekly_hours, employment_contract_id) for a given profileId.

```typescript
export type EmployeeRuleContext = {
  birthDate: string | null;
  contractType: string | null;
  agreedWeeklyHours: number | null;
  tariffCategory: string | null;
};

export function useEmployeeRuleContext(profileId: string | undefined) {
  // Query profile for birth_date
  // Query employee_payroll_profile for contract/tariff fields
  // Return { data: EmployeeRuleContext, isLoading }
}
```

Read `apps/web/src/app/dashboard/schedule/_hooks/use-employees.ts` first to follow existing patterns (supabase client creation, query key structure, workspace context).

- [ ] **Step 2: Commit**

---

### Task 4: useShiftRuleCheck() Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-shift-rule-check.ts`

- [ ] **Step 1: Implement the hook**

Dependencies: `useEmployeeRuleContext()`, `buildEntityContext()`, `evaluateFrameworkRules()`

```typescript
export function useShiftRuleCheck(draftShift: {
  employeeId: string | undefined;
  date: string;
  startTime: string;
  endTime: string;
}) {
  // 1. Load framework rules + workspace overrides (cached 10min)
  // 2. Load employee rule context via useEmployeeRuleContext
  // 3. Load employee's existing shifts for the week (from useShifts or dedicated query)
  // 4. Build EntityContext via buildEntityContext()
  // 5. Call evaluateFrameworkRules()
  // 6. Return { result: EvaluationResult, isLoading }
}
```

Read `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` for the shift query pattern (lines 19-80) to understand how shifts are fetched for a week range.

The rules query:

```typescript
const { data: rules } = useQuery({
  queryKey: ["cascade", "framework-rules", workspaceId],
  queryFn: async () => {
    // Get active binding
    const { data: binding } = await supabase
      .from("workspace_framework_binding")
      .select("framework_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();
    if (!binding) return { rules: [], overrides: [] };
    // Load rules + overrides
    const [rulesRes, overridesRes] = await Promise.all([
      supabase.from("framework_rule").select("*").eq("framework_id", binding.framework_id),
      supabase.from("workspace_rule_override").select("*").eq("workspace_id", workspaceId),
    ]);
    return { rules: rulesRes.data ?? [], overrides: overridesRes.data ?? [] };
  },
  staleTime: 10 * 60 * 1000,
});
```

Map DB row shapes to `FrameworkRuleRow` / `WorkspaceRuleOverrideRow` types from cascade/types.ts.

- [ ] **Step 2: Commit**

---

### Task 5: Integrate Rule Check into shift-modal.tsx

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx`

- [ ] **Step 1: Read shift-modal.tsx fully**

Key integration points:

- Lines 63-66: hardcoded `BASE_HOURLY_RATE`, `EVENING_SUPPLEMENT`, `WEEKEND_SUPPLEMENT` constants
- Lines 392-444: `handleSave` callback
- Lines 491-501: `payBreakdown` useMemo with hardcoded rates
- The form state `ShiftFormState` has `employeeId`, `startTime`, `endTime`

- [ ] **Step 2: Add rule check hook call**

After the existing hooks at the top of the component, add:

```typescript
const ruleCheck = useShiftRuleCheck({
  employeeId: form.employeeId || undefined,
  date: dateId ?? "",
  startTime: form.startTime,
  endTime: form.endTime,
});
```

- [ ] **Step 3: Add warning badge UI**

Below the form tabs or near the save button, render outcome-based badges:

```typescript
{ruleCheck.result && ruleCheck.result.outcome !== "allowed" && (
  <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${
    ruleCheck.result.outcome === "blocked" ? "bg-red-500/10 text-red-400" :
    ruleCheck.result.outcome === "review_required" ? "bg-orange-500/10 text-orange-400" :
    "bg-yellow-500/10 text-yellow-400"
  }`}>
    <AlertTriangle className="h-3.5 w-3.5" />
    {ruleCheck.result.worstHit?.reason}
  </div>
)}
```

Save remains always allowed. Warnings are advisory only.

- [ ] **Step 4: Commit**

---

### Task 6: usePublishValidation() Hook

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-publish-validation.ts`

- [ ] **Step 1: Implement the hook**

Takes an array of shift IDs being published. Loads all shifts, groups by employee, builds entity context per employee, evaluates rules for each.

```typescript
export type PublishValidationResult = {
  totalShifts: number;
  warnings: number;
  blocked: number;
  hits: Array<{ shiftId: string; employeeName: string; outcome: string; reason: string }>;
};

export function usePublishValidation(shiftIds: string[]) {
  // Returns { result: PublishValidationResult, isLoading, validate: () => void }
}
```

Use a mutation (not query) so it runs on-demand when the publish dialog opens, not continuously.

- [ ] **Step 2: Commit**

---

### Task 7: Integrate Publish Validation into Publish Dialog

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` (or wherever the publish confirmation lives)

- [ ] **Step 1: Find the publish confirmation UI**

Search for the publish flow in the schedule module. The `usePublishShifts()` mutation is called from somewhere — find the UI that triggers it. It may be in the Day Control Panel or a publish button/dialog.

```bash
grep -r "usePublishShifts\|publishShifts" apps/web/src/app/dashboard/schedule/ --include="*.tsx" -l
```

- [ ] **Step 2: Add validation summary before publish**

Before the existing publish action, call `usePublishValidation()` and show:

- Green summary if no issues
- Yellow/red summary with expandable details if warnings/blocked
- "Publiser likevel" acknowledgment button for proceeding with warnings

- [ ] **Step 3: Commit**

---

### Task 8: Enrich "shift published" Payload with shift_ids

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`

- [ ] **Step 1: Read the publish emit (lines 396-408)**

Current payload:

```typescript
properties: {
  entity: { entity_type: "shift", entity_id: shiftIds[0] ?? "" },
  data: { dates, department_ids: [], shift_count: shiftIds.length },
}
```

- [ ] **Step 2: Add shift_ids to data**

```typescript
properties: {
  entity: { entity_type: "shift", entity_id: shiftIds[0] ?? "" },
  data: { dates, department_ids: departmentIds, shift_ids: shiftIds, shift_count: shiftIds.length },
}
```

Also populate `department_ids` from the actual shifts being published (currently hardcoded `[]`). Read the shifts from the query cache or pass department IDs from the caller.

- [ ] **Step 3: Commit**

---

### Task 9: Add "shift completed" Emit to Completion Path

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` (or wherever actual_end is written)

- [ ] **Step 1: Find the completion mutation**

```bash
grep -r "actual_end\|actual_start\|completed" apps/web/src/app/dashboard/schedule/ --include="*.ts" --include="*.tsx" -l
```

If no completion mutation exists in the schedule hooks, check `apps/web/src/app/dashboard/operations/` or the day control panel components.

- [ ] **Step 2: Add emit call**

Add to the mutation's `onSuccess`:

```typescript
void emit({
  event: "shift completed",
  workspace_id: workspace.workspace_id,
  actor_id: profileId ?? "",
  properties: {
    entity: { entity_type: "shift", entity_id: shiftId },
    data: { shift_ids: [shiftId], department_id: shift.departmentId },
  },
});
```

- [ ] **Step 3: Register "shift completed" in telemetry registry**

Add to `packages/telemetry/src/registry.ts`:

```typescript
"shift completed": {
  category: "scheduling",
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  // ... interface
}
```

Follow the exact pattern of `"shift published"` in the registry.

- [ ] **Step 4: Commit**

---

### Task 10: cascade_cost_snapshot Engine Action Handler

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

- [ ] **Step 1: Read the upsert_session handler (lines 723-768) as the model**

- [ ] **Step 2: Add cascade_cost_snapshot handler**

Add after the `upsert_session` case in the `executeStep` switch:

```typescript
case "cascade_cost_snapshot": {
  const ctx = state.context as Record<string, unknown>;
  const ctxData = (ctx.data as Record<string, unknown>) ?? {};
  const shiftIds = (ctxData.shift_ids as string[]) ?? [];
  const basisRaw = (ctxData.basis as string) ?? "planned";
  const basis = basisRaw === "actual" ? "actual" : "planned";
  const sourceEvent = (ctxData.source_event as string) ?? null;

  if (shiftIds.length === 0) {
    await advanceToNextStep(supabase, state, step);
    break;
  }

  // Load shifts from DB (authoritative data, not from payload)
  const { data: shifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, profile_id, department_id, shift_date, start_time, end_time, actual_start, actual_end")
    .in("schedule_shift_id", shiftIds);

  for (const shift of (shifts ?? [])) {
    if (!shift.profile_id) continue;

    // Load tariff context
    const { data: payroll } = await supabase
      .from("employee_payroll_profile")
      .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev")
      .eq("profile_id", shift.profile_id)
      .order("valid_from", { ascending: false })
      .limit(1)
      .single();

    // Load tariff rates (workspace + platform)
    const { data: wsRates } = await supabase
      .from("tariff_rate_table")
      .select("id, rate_type, amount, unit, effective_from, effective_until")
      .eq("workspace_id", state.workspace_id);

    const { data: platformRates } = await supabase
      .from("tariff_rate_table")
      .select("id, rate_type, amount, unit, effective_from, effective_until")
      .is("workspace_id", null);

    // Determine effective times
    const effectiveStart = basis === "actual" && shift.actual_start
      ? shift.actual_start
      : `${shift.shift_date}T${shift.start_time}:00Z`;
    const effectiveEnd = basis === "actual" && shift.actual_end
      ? shift.actual_end
      : `${shift.shift_date}T${shift.end_time}:00Z`;

    // Compute hours
    const startMs = new Date(effectiveStart).getTime();
    const endMs = new Date(effectiveEnd).getTime();
    let baseHours = (endMs - startMs) / (1000 * 60 * 60);
    if (baseHours < 0) baseHours += 24; // overnight shift

    // Simple tariff resolution: find applicable supplements
    const supplements: Array<{ type: string; amount: number; unit: string }> = [];
    // ... (apply kveldstillegg/helgetillegg/helligdagstillegg logic inline
    //      or import from a shared helper if accessible in Deno context)

    const baseRate = 0; // From employment_contract.hourly_rate — load if available
    const totalCost = baseHours * baseRate; // + supplements

    await supabase.from("shift_cost_snapshot").insert({
      workspace_id: state.workspace_id,
      schedule_shift_id: shift.schedule_shift_id,
      profile_id: shift.profile_id,
      base_hours: baseHours,
      base_rate: baseRate,
      base_cost: baseHours * baseRate,
      supplements: supplements,
      total_cost: totalCost,
      basis,
      source_event: sourceEvent,
      effective_start: effectiveStart,
      effective_end: effectiveEnd,
    });
  }

  await advanceToNextStep(supabase, state, step);
  break;
}
```

- [ ] **Step 3: Commit**

---

### Task 11: Seed Engine Process + Triggers for Cost Snapshots

**Files:**

- Create: `supabase/migrations/20260422400400_cascade_cost_engine_process.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- Engine process for cascade cost snapshot generation
INSERT INTO engine_process (process_id, name, description, is_active)
VALUES (
  'cascade_cost_snapshot',
  'Cascade Cost Snapshot',
  'Generates shift cost snapshots on publish (planned) and completion (actual)',
  true
)
ON CONFLICT (process_id) DO NOTHING;

-- Single step: execute the cost snapshot action
INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'cascade_cost_snapshot', 1, 'cascade_cost_snapshot',
  '{"description": "Compute and store cost snapshot for published/completed shifts"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Trigger: shift.published → cascade_cost_snapshot
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
VALUES (
  'shift.published',
  'cascade_cost_snapshot',
  true,
  '{"pass_context": {"basis": "planned", "source_event": "shift.published"}}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Trigger: shift.completed → cascade_cost_snapshot
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
VALUES (
  'shift.completed',
  'cascade_cost_snapshot',
  true,
  '{"pass_context": {"basis": "actual", "source_event": "shift.completed"}}'::jsonb
)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply and verify**

- [ ] **Step 3: Commit**

---

## Phase 2: Admin Visibility (Settings Integration)

### Task 12: useFrameworkRules() Hook

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-framework-rules.ts`

- [ ] **Step 1: Implement the hook**

Loads framework rules for the workspace's active binding + workspace overrides. Follow the pattern in `use-operating-hours.ts` for query structure.

```typescript
export type FrameworkRuleDisplay = {
  ruleId: string;
  code: string;
  ruleType: string;
  category: string;
  description: string;
  descriptionNo: string;
  defaultOutcome: string;
  severity: string;
  outcomeOverridable: boolean;
  sourceReference: string | null;
  // Override state
  overrideId: string | null;
  overrideOutcome: string | null;
  overrideValidFrom: string | null;
  overrideValidUntil: string | null;
};

export function useFrameworkRules() {
  // 1. Get active binding
  // 2. Load rules for that framework
  // 3. Load workspace_rule_override
  // 4. Merge into FrameworkRuleDisplay[]
  // 5. Return { rules, isLoading, toggleOverride mutation }
}
```

The `toggleOverride` mutation upserts `workspace_rule_override` rows.

- [ ] **Step 2: Commit**

---

### Task 13: FrameworkRulesPanel.tsx

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/FrameworkRulesPanel.tsx`

- [ ] **Step 1: Read an existing settings panel for patterns**

Read `apps/web/src/app/dashboard/settings/_components/WorkingTimeRulesSettings.tsx` or `SupplementRulesSettings.tsx` to understand the component structure, dark mode handling, and form patterns used in settings.

- [ ] **Step 2: Implement the panel**

Table/list of rules with:

- Norwegian description (`description_no`), category badge, source reference
- Current outcome badge (colored by severity)
- For overridable rules: a select/toggle to change the outcome + date pickers for validity
- For non-overridable: locked state

Follow the existing settings panel styling (isDark context, input/select classes).

- [ ] **Step 3: Commit**

---

### Task 14: useWorkspaceTariffs() Hook

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-workspace-tariffs.ts`

- [ ] **Step 1: Implement the hook**

```typescript
export type TariffRateDisplay = {
  id: string;
  rateType: string;
  amount: number;
  unit: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isWorkspaceOverride: boolean;
  platformAmount: number | null;
};

export function useWorkspaceTariffs() {
  // 1. Load workspace tariff_rate_table rows
  // 2. Load platform baseline rows (NULL workspace_id)
  // 3. Merge: show workspace rate with platform comparison
  // 4. Return { rates, isLoading, adjustRate mutation }
}
```

The `adjustRate` mutation inserts a new effective-dated row (append-only — never mutate existing rows).

- [ ] **Step 2: Commit**

---

### Task 15: TariffRatesPanel.tsx

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/TariffRatesPanel.tsx`

- [ ] **Step 1: Implement the panel**

Table showing:

- Rate type (Norwegian label), amount, unit, effective period
- Platform baseline in muted text ("Riksavtalen: X kr/t")
- "Juster" button opens inline form for new effective date + amount
- Rate history (most recent first)

- [ ] **Step 2: Commit**

---

### Task 16: ChangeProposalsPanel.tsx

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_components/ChangeProposalsPanel.tsx`

- [ ] **Step 1: Implement the panel**

Uses existing `useChangeProposals()` hook from `apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts`.

List of proposals with:

- Status badge (pending/approved/failed/applied)
- Change type description
- Created date
- Click opens existing `ChangeProposalDialog` (already built)

Applied proposals shown in a separate "Historikk" section.

- [ ] **Step 2: Commit**

---

### Task 17: Wire Regelverk Panels into Settings Page

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

- [ ] **Step 1: Read settings-tabs.tsx**

Current structure: SECTIONS array defines tab groups. TabContent switch renders components. Follow the lazy import pattern.

- [ ] **Step 2: Add Regelverk section**

Add to `SECTIONS` array:

```typescript
{
  title: "Regelverk",
  tabs: [
    { id: "framework-rules", label: "Arbeidsregler", icon: Shield },
    { id: "tariff-rates", label: "Tariffsatser", icon: Calculator },
    { id: "change-proposals", label: "Endringsforslag", icon: GitBranch },
  ],
}
```

Add to `TabContent` switch:

```typescript
case "framework-rules":
  return <FrameworkRulesPanel />;
case "tariff-rates":
  return <TariffRatesPanel />;
case "change-proposals":
  return <ChangeProposalsPanel />;
```

Use lazy imports matching existing pattern.

- [ ] **Step 3: Commit**

---

## Phase 3: Demand Propagation

### Task 18: propagateBudgetTargets() Pure Function + Tests

**Files:**

- Create: `apps/web/src/lib/cascade/propagate-budget-targets.ts`
- Create: `apps/web/src/lib/cascade/__tests__/propagate-budget-targets.test.ts`

- [ ] **Step 1: Write tests**

Test cases:

1. Even distribution (all day factors = 1.0) → equal daily revenue
2. Weighted distribution (Fri/Sat higher) → proportional split
3. Labor cost = revenue × labor percentage
4. Staff hours = labor cost ÷ avg hourly wage
5. Multi-week season → correct weekly normalization
6. Zero avg_hourly_wage → staff hours = 0 (no division by zero)
7. Empty day factors → equal distribution fallback

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement**

```typescript
export type BudgetPropagationInput = {
  totalTargetRevenue: number;
  targetLaborPercentage: number;
  avgHourlyWage: number;
  dayFactors: Array<{ weekday: number; factor: number }>;
  startDate: string;
  endDate: string;
};

export type DailyTarget = {
  date: string;
  targetRevenue: number;
  targetLaborCost: number;
  targetStaffHours: number;
};

export function propagateBudgetTargets(input: BudgetPropagationInput): DailyTarget[];
```

Calculation:

1. Count total days in range
2. Compute total weeks (days / 7, round up for partial)
3. Normalize day factors: sum of all 7 = factorSum
4. For each date: dailyRevenue = (totalTargetRevenue / totalWeeks) × (dayFactor / factorSum)
5. dailyLaborCost = dailyRevenue × targetLaborPercentage
6. dailyStaffHours = avgHourlyWage > 0 ? dailyLaborCost / avgHourlyWage : 0

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Update barrel export**

- [ ] **Step 6: Commit**

---

### Task 19: Add engine_event Destination to Budget/Factor Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Read registry.ts to find the event definitions**

Find `"season_budget updated"` and `"day_factors updated"` entries. They currently route to `["posthog", "logger", "activity_trail"]`.

- [ ] **Step 2: Add engine_event destination**

Change both to include `"engine_event"`:

```typescript
"season_budget updated": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  // ...
}
"day_factors updated": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  // ...
}
```

- [ ] **Step 3: Commit**

---

### Task 20: cascade_budget_propagation Engine Action Handler

**Files:**

- Modify: `supabase/functions/engine-dispatch/index.ts`

- [ ] **Step 1: Add handler after cascade_cost_snapshot**

```typescript
case "cascade_budget_propagation": {
  const ctx = state.context as Record<string, unknown>;
  const ctxData = (ctx.data as Record<string, unknown>) ?? {};
  const seasonId = (ctxData.season_id as string) ?? (ctx.entity_id as string);

  if (!seasonId || !state.workspace_id) {
    await advanceToNextStep(supabase, state, step);
    break;
  }

  // Load season + budget from DB
  const { data: season } = await supabase
    .from("season")
    .select("start_date, end_date")
    .eq("season_id", seasonId)
    .single();

  const { data: budget } = await supabase
    .from("season_budget")
    .select("total_target_revenue, target_labor_percentage, avg_hourly_wage")
    .eq("season_id", seasonId)
    .single();

  const { data: dayFactors } = await supabase
    .from("day_factor")
    .select("weekday, factor")
    .eq("workspace_id", state.workspace_id);

  if (!season || !budget || !dayFactors?.length) {
    await advanceToNextStep(supabase, state, step);
    break;
  }

  // Compute daily targets (inline the pure function logic for Deno context)
  // ... propagation logic ...

  // Upsert into workspace_budget
  for (const target of dailyTargets) {
    await supabase.from("workspace_budget").upsert({
      workspace_id: state.workspace_id,
      period_type: "daily",
      period_date: target.date,
      revenue_target: target.targetRevenue,
      labor_cost_target: target.targetLaborCost,
      labor_hours_target: target.targetStaffHours,
    }, { onConflict: "workspace_id,period_type,period_date" });
  }

  await advanceToNextStep(supabase, state, step);
  break;
}
```

**Note:** Check `workspace_budget` unique constraint before using onConflict. Verify with `\d workspace_budget` indexes.

- [ ] **Step 2: Commit**

---

### Task 21: Seed Engine Process + Triggers for Budget Propagation

**Files:**

- Create: `supabase/migrations/20260422400500_cascade_budget_engine_process.sql`

- [ ] **Step 1: Write the seed migration**

```sql
INSERT INTO engine_process (process_id, name, description, is_active)
VALUES (
  'cascade_budget_propagation',
  'Cascade Budget Propagation',
  'Propagates season budget into daily workspace_budget targets on budget or factor changes',
  true
)
ON CONFLICT (process_id) DO NOTHING;

INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'cascade_budget_propagation', 1, 'cascade_budget_propagation',
  '{"description": "Compute and upsert daily budget targets from season budget + day factors"}'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
VALUES
  ('season_budget.updated', 'cascade_budget_propagation', true, null),
  ('day_factors.updated', 'cascade_budget_propagation', true, null)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply and verify**

- [ ] **Step 3: Commit**

---

### Task 22: Final Validation

- [ ] **Step 1: Run all cascade tests**

```bash
pnpm --filter web test -- --run src/lib/cascade/
```

Expected: All tests pass (existing 69 + new ~15).

- [ ] **Step 2: Run industry tests**

```bash
pnpm --filter web test -- --run src/lib/industry/
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: No new errors from our changes.

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts
```

- [ ] **Step 5: Commit**

---

## Dependency Graph

```
Phase 1: Wire Cascade to Schedule
  Task 1 (schema) → blocks Tasks 10, 11
  Task 2 (buildEntityContext) → blocks Tasks 4, 6
  Task 3 (useEmployeeRuleContext) → blocks Task 4
  Task 4 (useShiftRuleCheck) → blocks Task 5
  Task 5 (shift-modal integration)
  Task 6 (usePublishValidation) → blocks Task 7
  Task 7 (publish dialog integration)
  Task 8 (enrich publish payload) — parallel
  Task 9 (shift completed emit) — parallel
  Task 10 (cost snapshot handler) → depends on Task 1
  Task 11 (engine seed) → depends on Task 10

Phase 2: Admin Visibility (parallel with Phase 1 tasks 6+)
  Task 12 (useFrameworkRules) → blocks Task 13
  Task 13 (FrameworkRulesPanel)
  Task 14 (useWorkspaceTariffs) → blocks Task 15
  Task 15 (TariffRatesPanel)
  Task 16 (ChangeProposalsPanel)
  Task 17 (wire into settings) → depends on Tasks 13, 15, 16

Phase 3: Demand Propagation (after Phase 1 Task 1)
  Task 18 (propagateBudgetTargets) — parallel with Phase 1
  Task 19 (registry update) → blocks Task 21
  Task 20 (engine handler) → blocks Task 21
  Task 21 (engine seed) → depends on Tasks 19, 20

Task 22: Final validation (after all phases)
```
