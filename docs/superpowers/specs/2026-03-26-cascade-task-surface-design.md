---
title: "Å gjøre" — Cascade Task Surface
status: approved
updated: 2026-03-26
created: 2026-03-26
module: dashboard
tags: [cascade, dashboard, task-surface, guardian-replacement, ux]
---

# "Å gjøre" — Cascade Task Surface

## Summary

Replace the "Vakt" (Guardian) tab in the dashboard admin view switcher with "Å gjøre" (To Do) — a cascade-driven task surface that reflects workspace state. The system scans all cascade dimensions (D1–D6, C1–C4) and surfaces everything that is incomplete, needs attention, or requires a decision. Tasks are grouped by domain with completion bars. Clicking a task explains what's needed and navigates to the right place to fix it.

This is NOT a manual todo app. It is a mirror of cascade state — the system generates tasks, not humans.

## Motivation

Every admin logging into Smartout asks the same question: "What do I need to do?" Today this answer is scattered across:

1. `useWorkspaceSetup` hook — checks 4 modules (policies, profiles, shifts, season) for basic setup completeness
2. Guardian/Vakt view — shows guardian signals, engine sessions, season pulse
3. Individual pages — each page reveals its own gaps (empty shift plan, missing contracts, etc.)

None of these gives a unified, prioritized answer. "Å gjøre" consolidates them into one cascade-aware surface.

## Architecture

### Core Design Decisions

| Decision              | Choice                                 | Rationale                                                                                                                  |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Task persistence      | **None — purely derived**              | Cascade invariant: state is reproducible from persisted inputs. No `cascade_task` table.                                   |
| Data pattern          | **TanStack Query hook + Supabase RPC** | Consistent with all other dashboard hooks. RPC enables stage-engine consumption.                                           |
| Setup mechanism       | **Absorbs `useWorkspaceSetup`**        | One mechanism for "what needs doing." No dual systems.                                                                     |
| Guardian relationship | **UI replaced, tables retained**       | Guardian signals remain in DB (other systems write to them). UI consumer removed. Guardian can feed into task resolver v2. |
| Agent integration     | **Context source in v1, tools in v2**  | Agent can read task state. No autonomous task resolution yet.                                                              |

### System Boundary

```
┌─────────────────────────────────────────────────────────┐
│  Supabase RPC: resolve_cascade_tasks(workspace_id)      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SQL: scan dimensions, return CascadeTask[]     │    │
│  │  Single round-trip, workspace-scoped via RLS    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
    ┌─────────▼──────────┐     ┌──────────▼──────────┐
    │  Web Dashboard      │     │  Stage Engine (v2)   │
    │  useCascadeTasks()  │     │  collectCascadeTasks │
    │  TanStack Query     │     │  agent context       │
    └─────────┬──────────┘     └─────────────────────┘
              │
    ┌─────────▼──────────┐
    │  TodoTaskView       │
    │  (React component)  │
    └────────────────────┘
```

### Task Type Definition

```typescript
// packages/types/src/cascade-tasks.ts

type TaskUrgency = "critical" | "should" | "can_wait";

type TaskGroup =
  | "departments" // D1 Operational Envelope
  | "staff" // D2 Resource Availability
  | "framework" // D3 Rules & Constraints
  | "budget" // D4 Demand Signal
  | "governance" // C4 Policy & Governance
  | "schedule" // D6 Production
  | "contracts" // D2 (sub-domain)
  | "messages"; // C2 Interaction

type CascadeDimension = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "C1" | "C2" | "C3" | "C4";

type CascadeTask = {
  id: string; // Deterministic: "{group}.{check}.{entity_id?}"
  group: TaskGroup;
  dimension: CascadeDimension; // Required — every task has a cascade home
  title_key: string; // i18n key, e.g. "dashboard.todo.dept_missing_hours"
  title_params?: Record<string, string>; // interpolation params, e.g. { name: "Kjøkken" }
  description_key: string; // i18n key for explanation
  description_params?: Record<string, string>;
  urgency: TaskUrgency;
  href: string; // Navigation target
  entity_type?: string; // For deep-linking context
  entity_id?: string;
};

type TaskGroupSummary = {
  group: TaskGroup;
  dimension: CascadeDimension;
  label_key: string; // i18n key for group name
  icon: string; // Lucide icon name
  done: number;
  total: number;
  tasks: CascadeTask[]; // Only incomplete tasks
};

type CascadeTasksResult = {
  groups: TaskGroupSummary[];
  total_tasks: number;
  critical_count: number;
  should_count: number;
};
```

### Task ID Convention

Task IDs are deterministic and ephemeral — derived from group + check + entity:

- `departments.missing_hours.{department_id}` — "Kjøkken mangler åpningstider"
- `staff.missing_contract.{profile_id}` — "Maria mangler kontrakt"
- `framework.no_binding` — "Rammeverk ikke koblet"
- `budget.no_active_season` — "Ingen aktiv sesong"

Same input always produces same ID. Not persisted. No dismissal tracking in v1.

## Task Groups & Checkers

### Group: Avdelinger (departments) — D1

| Check               | Urgency  | Condition                                                                           | Title key                     |
| ------------------- | -------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| Department exists   | critical | `count(department) = 0`                                                             | `todo.dept_none_exist`        |
| Has operating hours | critical | `department` without matching `department_operating_hours`                          | `todo.dept_missing_hours`     |
| Locations exist     | should   | Workspace has zero `location` rows (note: `department` has no `location_id` column) | `todo.dept_no_locations`      |
| Has positions       | can_wait | `department` without any `position` rows (FK: `position.department_id`)             | `todo.dept_missing_positions` |

**Completion:** `done` = departments with hours. `total` = all departments. Location check is workspace-level (not per-department).

### Group: Ansatte (staff) — D2

| Check              | Urgency  | Condition                                                                                                                                                                                       | Title key                       |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Has contract       | critical | `profile` without active `employment_contract`                                                                                                                                                  | `todo.staff_missing_contract`   |
| Payroll configured | should   | `profile` without `employee_payroll_profile`                                                                                                                                                    | `todo.staff_missing_payroll`    |
| Profile complete   | can_wait | `profile` missing key fields (`bank_account`, `personal_number`, or `address_line_1`). Note: `emergency_contact_*` is on `user_identity`, not `profile` — join via `profile.user_id` if needed. | `todo.staff_incomplete_profile` |
| Team assigned      | can_wait | `profile` not in any `team_member`                                                                                                                                                              | `todo.staff_no_team`            |

**Completion:** `done` = profiles with contract + payroll. `total` = active profiles.

### Group: Rammeverk (framework) — D3

| Check                  | Urgency  | Condition                                 | Title key                    |
| ---------------------- | -------- | ----------------------------------------- | ---------------------------- |
| Framework bound        | critical | No `workspace_framework_binding` exists   | `todo.framework_no_binding`  |
| Tariff rates seeded    | critical | No `tariff_rate_table` rows for workspace | `todo.framework_no_tariffs`  |
| Public holidays loaded | should   | No `public_holiday` rows for current year | `todo.framework_no_holidays` |

**Completion:** `done` = checks passing. `total` = 3.

### Group: Budsjett & sesong (budget) — D4

| Check                   | Urgency  | Condition                                  | Title key                     |
| ----------------------- | -------- | ------------------------------------------ | ----------------------------- |
| Active season           | critical | No `season` with `status = 'active'`       | `todo.budget_no_season`       |
| Season budget set       | should   | Active season without `season_budget`      | `todo.budget_no_budget`       |
| Day factors configured  | should   | `season_budget` without `day_factor` rows  | `todo.budget_no_day_factors`  |
| Hour factors configured | can_wait | `season_budget` without `hour_factor` rows | `todo.budget_no_hour_factors` |

**Completion:** `done` = checks passing. `total` = 4 (or 1 if no season exists).

### Group: Governance — C4

| Check               | Urgency  | Condition                                                                                                               | Title key                      |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Policies exist      | critical | `count(policy) < 3`                                                                                                     | `todo.gov_few_policies`        |
| Protocols assigned  | should   | Active profiles without any `protocol_assignment`                                                                       | `todo.gov_unassigned_profiles` |
| Training incomplete | should   | `protocol_assignment` without completion (knowledge_test_attempt, confirmation_signature, or procedure_step_completion) | `todo.gov_incomplete_training` |

**Completion:** `done` = profiles with all assigned protocols completed. `total` = profiles with assignments.

### Group: Vaktplan (schedule) — D6

| Check           | Urgency  | Condition                                            | Title key                    |
| --------------- | -------- | ---------------------------------------------------- | ---------------------------- |
| Shifts exist    | critical | No `schedule_shift` rows                             | `todo.schedule_no_shifts`    |
| Unmanned shifts | should   | `schedule_shift` in next 7 days without `profile_id` | `todo.schedule_unmanned`     |
| Templates exist | can_wait | No `schedule_template` rows                          | `todo.schedule_no_templates` |

**Completion:** `done` = shifts in next 7 days with assigned profile. `total` = shifts in next 7 days.

### Group: Kontrakter (contracts) — D2

| Check              | Urgency | Condition                                           | Title key                 |
| ------------------ | ------- | --------------------------------------------------- | ------------------------- |
| Unsigned contracts | should  | `employment_contract` with pending signature status | `todo.contracts_unsigned` |
| Expiring contracts | should  | `employment_contract` expiring within 30 days       | `todo.contracts_expiring` |

**Completion:** `done` = active signed contracts. `total` = all contracts.

### Group: Meldinger (messages) — C2

| Check               | Urgency | Condition                                                                                                                                                                | Title key                         |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Unanswered messages | should  | `channel_message` with `read_at IS NULL`, joined via `channel` → `channel_member` where member is admin. Conditional: only active when `channel_message` table has rows. | `todo.messages_unanswered`        |
| Pending decisions   | should  | `change_proposal` with `status = 'pending'`                                                                                                                              | `todo.messages_pending_decisions` |

**Completion:** `done` = read messages + resolved proposals. `total` = total requiring response. Note: the RPC must handle this group defensively — if `channel_message` has no rows or the messaging feature is not yet active, this group returns 0/0 and is hidden from the UI.

## Supabase RPC Function

A single SQL function handles all checks in one round-trip:

```sql
-- resolve_cascade_tasks(p_workspace_id uuid)
-- Returns: jsonb (CascadeTasksResult shape)
--
-- Single function, single round-trip. Each checker is a CTE.
-- Results are assembled into TaskGroupSummary[] and returned as JSONB.
--
-- RLS: workspace_id filter on every CTE. Function runs as INVOKER (not DEFINER).
-- Callable by: web dashboard (via supabase client), stage-engine (via supabase service).
```

Migration file: `supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql`

Performance target: < 200ms for a workspace with 50 profiles, 7 departments, 500 shifts.

## Data Fetching Layer

### Hook: `useCascadeTasks`

Location: `apps/web/src/app/dashboard/_hooks/use-cascade-tasks.ts`

```typescript
// TanStack Query hook wrapping the RPC
// queryKey: dashboardKeys.cascadeTasks(workspaceId)
// staleTime: 30_000 (30s — same as useWorkspaceSetup)
// refetchInterval: 5 * 60_000 (5min background refresh)
// select: transform JSONB response to typed CascadeTasksResult
```

### Hook: `useCascadeTaskCount`

Location: `apps/web/src/app/dashboard/_hooks/use-cascade-task-count.ts`

Lightweight hook for badge count only. Uses the **same queryKey and queryFn** as `useCascadeTasks` but with a different `select` transform that extracts only `{ critical: number; should: number }`. TanStack Query deduplicates the underlying fetch — no double RPC calls. When the full hook's cache is warm, the count hook reads from cache instantly.

### Query Key Addition

In `dashboard-keys.ts`:

```typescript
cascadeTasks: (workspaceId: string) =>
  ["dashboard", "cascade-tasks", workspaceId] as const,
```

## DashboardShell Changes

### AdminViewType

```typescript
// Before:
export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "guardian";

// After:
export type AdminViewType = "tactical" | "strategic" | "reconciliation" | "activity" | "todo";
```

### Tab Switcher

| Before        | After                                         |
| ------------- | --------------------------------------------- |
| `Shield` icon | `ListChecks` icon                             |
| Label: "Vakt" | Label: i18n `dashboard.tabs.todo` ("Å gjøre") |
| No badge      | Badge pill showing `critical + should` count  |

### Sidebar Nav

Two sidebar references to update:

1. **Admin mode** (line ~1268): "Event Center" → i18n `dashboard.nav.todo` ("Å gjøre"), icon `ListChecks`, onClick → `setAdminView("todo")`
2. **Collapsed/condensed mode** (line ~1418): "Vakt" → i18n `dashboard.nav.todo` ("Å gjøre"), icon `ListChecks`

### Voice Session Context

```typescript
// In buildVoiceSessionContext():
if (adminView === "todo") {
  return {
    page: "dashboard.todo",
    summary: "Cascade task surface — shows workspace completeness and pending actions",
    context_tags: ["task-surface", "cascade-status", "admin-todo"],
  };
}
```

### Default View

Change `useState<AdminViewType>("strategic")` to `useState<AdminViewType>("todo")` — "Å gjøre" is the landing view.

## Component Structure

All new components in `apps/web/src/app/dashboard/_components/todo/`:

```
todo/
├── TodoTaskView.tsx          — Main view (rendered when adminView === "todo")
├── TodoGroupSection.tsx      — Group header + progress bar + task list
├── TodoTaskCard.tsx           — Individual task card with urgency + navigation
├── TodoEmptyState.tsx         — "Alt er i orden" empty state
└── todo-icons.ts              — Group → Lucide icon mapping
```

### TodoTaskView

- Renders `TaskGroupSummary[]` from `useCascadeTasks()`
- Groups sorted: incomplete first (by highest urgency task), completed last
- Completed groups auto-collapsed to single line (expandable on click via `aria-expanded`)
- Loading state: skeleton cards pulsing with warm `bg-muted` background — 3 skeleton groups with 2 skeleton cards each
- Error state: centered message with `AlertCircle` icon + "Kunne ikke laste oppgaver" + retry button (`Button` variant="outline")
- Scroll: uses page scroll (no internal overflow). Groups render in natural document flow.

### TodoGroupSection

```
┌─────────────────────────────────────────────────────────┐
│  [Building2]  Avdelinger                 3 av 5  [████░░]  │
│                                                          │
│  ┌─ 4px left border ──────────────────────────────────┐  │
│  │  [AlertCircle]  Kjøkken mangler åpningstider       │  │
│  │                 Uten åpningstider kan ikke cascade  │  │
│  │                 beregne vakter.      [ChevronRight] │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ 4px left border ──────────────────────────────────┐  │
│  │  [Clock]  Bar — ingen lokaler tilknyttet            │  │
│  │           Avdelingen trenger en fysisk ...           │  │
│  │                                     [ChevronRight]  │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Group header: domain icon + label (i18n) + fraction (Geist Mono) + progress bar
- Progress bar: 64–80px wide, 6px tall, `rounded-full`
  - Track: `bg-muted`
  - Fill: `bg-brand-orange` when in progress, `bg-success` when 100%
  - Fill animation: `scaleX` with `transform-origin: left`, transition via `swapSpring` (stiffness 45, damping 22, mass 2)
- Completed state: single line with `CheckCircle2` in `text-success`, group collapsable via `aria-expanded`
- Group collapse/expand: `expandSpring` (stiffness 30, damping 24, mass 2.5) for height transition, `AnimatePresence` for children entering/exiting
- Stagger entrance: 60ms per group, `expandSpring` (stiffness 30, damping 24, mass 2.5)

### TodoTaskCard

- Surface: `bg-card/70 backdrop-blur border border-border rounded-lg` + noise overlay (`::after` pseudo, fractal noise texture at 2.5% opacity, `mix-blend-mode: overlay`)
- Left border: 4px solid, colored by urgency (OKLCH via CSS variables, NOT `hsl()` wrapper):
  - `critical` → `style={{ borderLeftColor: 'var(--destructive)' }}` or `border-l-destructive`
  - `should` → `border-l-warning` (token: status.warning)
  - `can_wait` → `border-l-border` (uses border token, not text token)
- Icon (16px, colored by urgency):
  - `critical` → `AlertCircle` in `text-destructive`
  - `should` → `Clock` in `text-warning`
  - `can_wait` → `Info` in `text-muted-foreground`
- Title: `text-foreground font-medium text-sm` (Geist Sans)
- Description: `text-muted-foreground text-xs` (Geist Sans)
- Navigation: `ChevronRight` in `text-brand-orange`, hover opacity 200ms
- Padding: `p-4 gap-3`
- Hover state: `bg-card/80` (slightly more opaque) + subtle border glow transition, 200ms
- Interactive: `cursor-pointer`, focus ring `focus-visible:ring-2 ring-ring ring-offset-2` (brand-orange), `tabIndex={0}`
- Click: `router.push(task.href)` + `emit("task_surface task clicked", { task_id, group, dimension })`
- Keyboard: Enter/Space triggers click
- Entrance animation (per-card stagger within group): 40ms delay per card, `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, duration 500ms, ease `[0.25, 0.1, 0.25, 1]`
- Exit animation: slide left + fade, 250ms minimum, `layout` prop for smooth reflow

### TodoEmptyState

```
         [CircleCheck icon, 48px, --success, 20% opacity bg circle]
         [subtle ambient orb glow behind icon]

                      Alt er i orden
              Ingen oppgaver krever oppmerksomhet
```

- Heading: Instrument Serif, `text-lg`, `text-foreground`
- Subtext: Geist Sans, `text-sm`, `text-muted-foreground`
- Orb: `--success` glow, blur 80px, opacity 0.08

### Tab Badge

- Pill: `min-w-[18px] h-[18px] rounded-full bg-brand-orange text-[10px] text-white font-medium`
- Inline after label, vertically centered
- Hidden when count is 0
- AnimatePresence: scale 0→1, `swapSpring` (stiffness 45, damping 22, mass 2)
- Only shows `critical + should` count

## Guardian Migration Plan

### Files to REMOVE (workspace-level guardian UI)

| File                                                        | Reason                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/GuardianView.tsx`        | Replaced by TodoTaskView                                                               |
| `apps/web/src/components/dashboard/MissionControlPanel.tsx` | Was sub-panel of Guardian. Mission monitoring moves to operations page or is deferred. |
| `apps/web/src/app/dashboard/_hooks/useGuardianData.ts`      | Replaced by useCascadeTasks                                                            |
| `apps/web/src/app/dashboard/_hooks/useGuardianActions.ts`   | No longer needed without Guardian UI                                                   |
| `apps/web/src/app/dashboard/_hooks/useGuardianSocket.ts`    | Realtime guardian signals no longer displayed                                          |

### Files to UPDATE

| File                 | Change                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardShell.tsx` | Replace `"guardian"` → `"todo"` in AdminViewType, tab, sidebar, voice context                                                                                     |
| `AdminDashboard.tsx` | Replace GuardianView render with TodoTaskView. Remove `useWorkspaceSetup` import and `WorkspaceSetupWizard` conditional.                                          |
| `dashboard-keys.ts`  | Remove `guardianSignals`, `guardianSessions`, `guardianSeasonPulse`. Add `cascadeTasks`. Keep `workspaceSetupStatus` key (for backward compat during transition). |
| `_hooks/index.ts`    | Update exports                                                                                                                                                    |

### Files to KEEP (platform-admin guardian — separate system)

All files under `apps/web/src/app/platform-admin/guardian/` are UNAFFECTED. Platform-admin guardian is for godmode monitoring of all workspaces and engine sessions. Different purpose, different scope.

### Other Guardian References (outside dashboard-core)

| File                                                       | Nature of reference                                                    | Disposition                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `onboarding/showcase/_components/EnginePlaypark.tsx`       | GuardianPanel render + guardian capability references in showcase demo | **Leave as-is** — showcase is internal demo, not user-facing. Update in separate cleanup PR.                 |
| `dashboard/reports/_components/OverviewSection.tsx`        | Comment: "Follows GuardianView card + glow pattern"                    | **Update comment** — change to "Follows TodoTaskView card + glow pattern"                                    |
| `dashboard/reports/_components/TrainingSection.tsx`        | Comment: "replicates GuardianView pattern"                             | **Update comment** — change to "replicates TodoGroupSection pattern"                                         |
| `platform-admin/services/_components/service-contracts.ts` | References guardian WebSocket path                                     | **Leave as-is** — platform-admin scope, refers to guardian service contract                                  |
| `platform-admin/sidebar-nav.tsx`                           | Platform-admin sidebar link to guardian                                | **Leave as-is** — platform-admin guardian is retained                                                        |
| `api/wizard/start/route.ts`                                | References guardian in setup context                                   | **Verify** — check if it references workspace-level guardian or platform-level. Update if broken by removal. |

### Database Tables: RETAINED

`guardian_signal` and `guardian_log` tables remain. They are written to by Edge Functions and engine dispatch. No migration needed. The workspace-level UI consumer is removed, but:

- Platform-admin still reads them
- They may become a task source in v2 (guardian signal → cascade task)
- No breaking change to any backend system

### Hook to ABSORB

`useWorkspaceSetup` (`apps/web/src/app/dashboard/_hooks/use-workspace-setup.ts`) is absorbed into `useCascadeTasks`. The 4 checks it performs (policies >= 3, profiles > 1, shifts > 0, active season) are a subset of the cascade task checkers.

**Dependency chain — all consumers must be migrated:**

| Consumer                    | Current usage                                         | Migration                                                                                                                                   |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminDashboard.tsx`        | `WorkspaceSetupWizard` conditional                    | Remove conditional. "Å gjøre" IS the setup guide.                                                                                           |
| `DashboardShell.tsx`        | Imports `useWorkspaceSetup`                           | Remove import, use `useCascadeTaskCount` for badge instead.                                                                                 |
| `use-onboarding-guide.ts`   | Uses `setupStatus` from `useWorkspaceSetup` (line 31) | Refactor to derive setup status from `useCascadeTasks` — check if any `critical` tasks exist in `departments`/`governance`/`budget` groups. |
| `/dashboard/setup/page.tsx` | Renders `WorkspaceSetupWizard` directly               | Keep route alive but refactor to render TodoTaskView filtered to setup-relevant groups. Or redirect to `/dashboard` with `adminView=todo`.  |

`WorkspaceSetupWizard.tsx` component is NOT deleted in this PR — it remains at `/dashboard/setup` as a standalone page until the route is deprecated. The `useWorkspaceSetup` hook file IS deleted after all consumers are migrated.

### Agent Capability: Guardian

The `guardian` capability in `packages/ai/src/capabilities/guardian/` is **RETAINED** in v1. It has 3 registered tools (`get_signals`, `acknowledge_signal`, `get_workspace_health`) in the capability registry. These tools continue to query `guardian_signal`/`guardian_log` tables which remain populated by Edge Functions and engine dispatch. The `Situation` type in `packages/ai/src/capabilities/types.ts` retains `"guardian"` as a valid value.

In v2, evaluate whether to add a `tasks` capability wrapping the cascade RPC and deprecate `get_workspace_health` in favor of cascade task summaries.

## Telemetry

### New Events (register in `packages/telemetry/src/registry.ts`)

| Event               | Verb      | Entity         | Category     | Destinations            |
| ------------------- | --------- | -------------- | ------------ | ----------------------- |
| Task surface viewed | `viewed`  | `task_surface` | `navigation` | posthog, activity_trail |
| Task clicked        | `clicked` | `task_surface` | `navigation` | posthog, activity_trail |

Add `"task_surface"` to the `EntityType` union in registry.ts.

### Emit Calls

- `TodoTaskView` mount: `emit("task_surface viewed", { total_tasks, critical_count })`
- `TodoTaskCard` click: `emit("task_surface clicked", { task_id, group, dimension, urgency })`

## i18n

Namespace: `dashboard` (existing).

### Keys to add

```json
{
  "dashboard.tabs.todo": "Å gjøre",
  "dashboard.nav.todo": "Å gjøre",
  "dashboard.todo.empty_title": "Alt er i orden",
  "dashboard.todo.empty_description": "Ingen oppgaver krever oppmerksomhet",
  "dashboard.todo.group.departments": "Avdelinger",
  "dashboard.todo.group.staff": "Ansatte",
  "dashboard.todo.group.framework": "Rammeverk",
  "dashboard.todo.group.budget": "Budsjett & sesong",
  "dashboard.todo.group.governance": "Governance",
  "dashboard.todo.group.schedule": "Vaktplan",
  "dashboard.todo.group.contracts": "Kontrakter",
  "dashboard.todo.group.messages": "Meldinger",
  "dashboard.todo.completion": "{{done}} av {{total}}",
  "dashboard.todo.dept_none_exist": "Ingen avdelinger opprettet",
  "dashboard.todo.dept_missing_hours": "{{name}} mangler åpningstider",
  "dashboard.todo.dept_no_locations": "Workspace har ingen lokasjoner",
  "dashboard.todo.dept_missing_positions": "{{name}} mangler stillinger",
  "dashboard.todo.staff_missing_contract": "{{name}} mangler kontrakt",
  "dashboard.todo.staff_missing_payroll": "{{name}} mangler lønnsoppsett",
  "dashboard.todo.staff_incomplete_profile": "{{name}} har ufullstendig profil",
  "dashboard.todo.staff_no_team": "{{name}} er ikke tilknyttet et team",
  "dashboard.todo.framework_no_binding": "Rammeverk ikke koblet til workspace",
  "dashboard.todo.framework_no_tariffs": "Tariff-satser ikke satt opp",
  "dashboard.todo.framework_no_holidays": "Helligdagskalender mangler for {{year}}",
  "dashboard.todo.budget_no_season": "Ingen aktiv sesong",
  "dashboard.todo.budget_no_budget": "Aktiv sesong mangler budsjett",
  "dashboard.todo.budget_no_day_factors": "Budsjett mangler dagfaktorer",
  "dashboard.todo.budget_no_hour_factors": "Budsjett mangler timefaktorer",
  "dashboard.todo.gov_few_policies": "Færre enn 3 retningslinjer opprettet",
  "dashboard.todo.gov_unassigned_profiles": "{{count}} ansatte mangler opplæringstilordning",
  "dashboard.todo.gov_incomplete_training": "{{count}} ansatte har ufullstendig opplæring",
  "dashboard.todo.schedule_no_shifts": "Ingen vakter opprettet",
  "dashboard.todo.schedule_unmanned": "{{count}} ubemannede vakter neste 7 dager",
  "dashboard.todo.schedule_no_templates": "Ingen vaktmaler opprettet",
  "dashboard.todo.contracts_unsigned": "{{count}} kontrakter venter signatur",
  "dashboard.todo.contracts_expiring": "{{count}} kontrakter utløper innen 30 dager",
  "dashboard.todo.messages_unanswered": "{{count}} ubesvarte meldinger",
  "dashboard.todo.messages_pending_decisions": "{{count}} beslutninger venter"
}
```

English translations follow the same structure with `en` locale. The implementing agent writes English translations for all keys above (straightforward 1:1 mapping).

## Accessibility

| Element      | Requirement                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| Progress bar | `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax` |
| Task card    | `role="link"`, `tabIndex={0}`, Enter/Space triggers navigation              |
| Urgency      | Icon shape + color + sr-only text label (not color alone)                   |
| Group header | `aria-expanded` on completed groups (expandable)                            |
| Focus ring   | `focus-visible:ring-2 ring-ring ring-offset-2` (brand-orange)               |
| Badge        | `aria-label="{{count}} oppgaver"` on tab                                    |

### Reduced Motion (WCAG 2.1, 2.3.3)

When `prefers-reduced-motion: reduce` is active:

- All spring animations resolve instantly (duration 0)
- Stagger delays are removed (all items appear simultaneously)
- Exit slide-left is replaced with simple opacity fade at 150ms
- Progress bar fill transitions are instant
- Badge scale animation is disabled (appears/disappears without scale)
- Empty state orb glow is static (no pulse or tracking)

## Mobile Parity

- `CascadeTask` and `CascadeTasksResult` types: `packages/types/src/cascade-tasks.ts` (shared)
- Supabase RPC: callable from both web and React Native Supabase clients
- Mobile UI: deferred to v2. The data layer and type definitions support both surfaces from day one.

## Agent Integration (v2)

For v2 (not this implementation):

- Add `collectCascadeTasks()` to `packages/ai/src/context/collector.ts`
- Budget: top 5 tasks by urgency in system prompt, plus summary counts
- Agent can reference tasks in conversation: "Jeg ser at workspace mangler 3 kontrakter"
- NO autonomous task resolution — agent reports, human acts

## Performance

| Concern          | Mitigation                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Query count      | Single RPC = single round-trip. All checks are CTEs in one function.                                                 |
| Badge polling    | `useCascadeTaskCount` shares query key with `useCascadeTasks` (TanStack dedup). `staleTime: 30s`.                    |
| Large workspaces | RPC uses indexed columns (workspace_id, status, profile_id). Target < 200ms.                                         |
| Dashboard load   | RPC runs on mount. Other views unaffected. No additional queries when not on "Å gjøre" tab (badge uses cached data). |

## What This Does NOT Do

- Does not persist tasks or track task lifecycle (no new tables)
- Does not allow manual task creation (this is not a todo app)
- Does not replace platform-admin guardian (different system, untouched)
- Does not add agent tools for task resolution (v2)
- Does not add task dismissal/snooze (v2, requires own ADR if needed)
- Does not change the employee view (employee "Å gjøre" is a separate feature)

## ADR Required

Write ADR documenting:

1. Guardian UI retirement (workspace-level only; platform-admin retained)
2. `useWorkspaceSetup` absorption into cascade task resolver
3. Task derivation contract (pure derived, no persistence)
4. RPC + TanStack Query pattern for cross-dimension queries

## Files Changed (Summary)

### New Files

| File                                                               | Purpose                 |
| ------------------------------------------------------------------ | ----------------------- |
| `packages/types/src/cascade-tasks.ts`                              | Shared type definitions |
| `supabase/migrations/YYYYMMDDHHMMSS_resolve_cascade_tasks_rpc.sql` | RPC function            |
| `apps/web/src/app/dashboard/_hooks/use-cascade-tasks.ts`           | TanStack Query hook     |
| `apps/web/src/app/dashboard/_hooks/use-cascade-task-count.ts`      | Badge count hook        |
| `apps/web/src/app/dashboard/_components/todo/TodoTaskView.tsx`     | Main view               |
| `apps/web/src/app/dashboard/_components/todo/TodoGroupSection.tsx` | Group with progress     |
| `apps/web/src/app/dashboard/_components/todo/TodoTaskCard.tsx`     | Task card               |
| `apps/web/src/app/dashboard/_components/todo/TodoEmptyState.tsx`   | Empty state             |
| `apps/web/src/app/dashboard/_components/todo/todo-icons.ts`        | Group → icon mapping    |

### Modified Files

| File                                 | Change                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| `DashboardShell.tsx`                 | AdminViewType, tab, sidebar, voice context, default view |
| `AdminDashboard.tsx`                 | Render TodoTaskView, remove WorkspaceSetupWizard         |
| `dashboard-keys.ts`                  | Add cascadeTasks key, remove guardian keys               |
| `_hooks/index.ts`                    | Update exports                                           |
| `packages/telemetry/src/registry.ts` | Add `task_surface` entity type + events                  |
| `packages/i18n/`                     | Add todo translation keys (nb + en)                      |

### Deleted Files

| File                      | Reason                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `GuardianView.tsx`        | Replaced by TodoTaskView                                                                  |
| `MissionControlPanel.tsx` | Was Guardian sub-panel                                                                    |
| `useGuardianData.ts`      | Replaced by useCascadeTasks                                                               |
| `useGuardianActions.ts`   | No longer needed                                                                          |
| `useGuardianSocket.ts`    | No longer needed                                                                          |
| `use-workspace-setup.ts`  | Absorbed into useCascadeTasks (after all consumers migrated — see dependency chain above) |
