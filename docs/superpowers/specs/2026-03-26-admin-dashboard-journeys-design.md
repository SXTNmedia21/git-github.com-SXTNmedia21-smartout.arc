---
title: "Admin Dashboard Journeys — Top 8 Design Spec"
status: draft
updated: 2026-03-26
created: 2026-03-26
module: dashboard
tags: [journeys, admin, dashboard, council-reviewed, cascade]
---

# Admin Dashboard Journeys — Top 8 Design Spec

> Defines the 8 most important admin user journeys on the Smartout dashboard.
> Ranked by AI Council (7 restaurant personas) across three lenses: first-value, daily-use, retention-critical.
> Reviewed by Internal Council: System Steward, Frontend Designer, System Agent Coordinator, Supervisor, WalkAi Bridge Builder.

---

## Journey Map

```
J6 Setup ──→ J8 Organization ──→ J7 Season/Budget
                                       │
                                       ▼
              J3 Onboarding ──→ J1 Schedule ──→ J2 Reconciliation
                    │                │
                    ▼                ▼
              J5 Governance    J4 Operations
```

**Three journey categories:**

| Category   | Journeys                                      | Frequency                                          |
| ---------- | --------------------------------------------- | -------------------------------------------------- |
| Daily Loop | J1 Schedule, J2 Reconciliation, J4 Operations | Every working day                                  |
| Lifecycle  | J3 Onboarding, J5 Governance, J6 Setup        | Event-driven (new hire, new policy, new workspace) |
| Strategic  | J7 Season/Budget, J8 Organization             | Quarterly / on structural change                   |

---

## Cross-Journey Constraints

These apply to ALL 8 journeys. Raised by council, non-negotiable.

### C1: Telemetry — every mutation emits

Every mutation in every journey MUST call `emit()` from `@smartout/telemetry`. The telemetry registry (`packages/telemetry/src/registry.ts`) is the source of truth for event names. No mutation without emit. Each journey section below lists its key events.

### C2: i18n — no hardcoded Norwegian

All UX copy uses i18n keys from `packages/i18n/`. Norwegian strings in this spec (e.g., "Publiser", "Avstemming") are design intent labels, NOT implementation strings. Implementation MUST use `t('schedule.publish')` etc.

### C3: Protocol assignment is a shared component

J3 (Onboarding) and J5 (Governance) both assign protocols to employees via `protocol_assignment`. There MUST be ONE shared component/hook for this — NOT two separate implementations. Location: shared hook in `packages/` or `apps/web/src/hooks/governance/useProtocolAssignment.ts`.

### C4: Emma (voice/AI) is Phase 2

This spec covers the dashboard UI journeys. Voice-enabling these journeys via WalkAi page tools is a separate work stream. Each journey notes which actions are voice-candidate, but implementation of page tools (`useRegisterTools`) is out of scope for Phase 1.

**Phase 2 scope (declared, not specced):**

| Journey | Voice-candidate actions                                |
| ------- | ------------------------------------------------------ |
| J1      | `publish_schedule`, `create_shift`, `get_today_budget` |
| J2      | `approve_day`, `get_unreconciled_days`                 |
| J3      | `invite_employee`, `get_onboarding_pipeline`           |
| J4      | `get_stress_level`, `log_deviation`                    |
| J5      | `assign_protocol`, `get_readiness_matrix`              |

Authority defaults: mutations at `confirm`, reads at `read_only`.

### C5: Schedule page decomposition

`schedule/page.tsx` is 77KB. Any new logic (conflict detection, cost preview) MUST be extracted into separate hooks, NOT added inline. Mandate: `useShiftConflicts.ts`, `useScheduleBudget.ts` as standalone hooks.

---

## J1: Build & Publish Weekly Schedule

**Role:** Admin/Manager | **Frequency:** Weekly cycle, daily edits | **Page:** `/dashboard/schedule`

### Current State: 70% built

Working: Shift CRUD, drag-drop (dnd-kit), templates (save/load), publish dialog, day control panel (6 tabs), broadcast messaging, realtime sync.

### Gaps to Close

| Gap                                                | Priority | Resolution                                                                                                                                                                                                                    |
| -------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cost preview uses mock data (`laborTarget: 12600`) | HIGH     | New hook `useScheduleBudget.ts` reads `workspace_budget` for target date range. Connects to `tariff_rate_table` for rate lookups via `resolveTariffRate()`. Shows live labor cost vs. budget in day control panel budget tab. |
| No shift conflict detection                        | HIGH     | New hook `useShiftConflicts.ts` validates on create/drag: same employee, overlapping times = conflict. Returns `ConflictWarning[]`. Schedule page renders inline warnings. Does NOT block — warns only.                       |
| No publish delivery tracking                       | MEDIUM   | After publish, track notification delivery status. Use existing `notification_queue` table. Show "Levert til 8/10 ansatte" in publish confirmation.                                                                           |

### End-to-End Flow

1. Admin opens `/dashboard/schedule` → sees current week
2. Navigates to target week → loads template or starts from scratch
3. Creates/drags shifts → **`useShiftConflicts` validates in real-time**, shows warnings on conflicting cells
4. Opens budget tab → **`useScheduleBudget` shows live labor cost vs. budget target** (from `workspace_budget` + `tariff_rate_table`)
5. Clicks "Publiser" → PublishOverviewDialog groups by day → admin confirms
6. System fires notifications (push + SMS via `notification_queue`) → tracks delivery status
7. Admin sees "Published" badge + delivery count

### Data Dependencies

- `workspace_budget` (D4) — per-date targets. Created by `propagateBudgetTargets()` from season budget.
- `tariff_rate_table` (D3/K1a) — rate lookups for cost calculation.
- `department_operating_hours` (D1) — validates shifts are within operating hours.
- `notification_queue` — delivery tracking.

### Key Telemetry Events

- `schedule.shift_created`, `schedule.shift_updated`, `schedule.shift_deleted`
- `schedule.shifts_published` (batch)
- `schedule.template_saved`, `schedule.template_loaded`

### Key Files

- `apps/web/src/app/dashboard/schedule/page.tsx` (existing, 77KB — DO NOT ADD logic here)
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts` (existing mutations)
- `apps/web/src/app/dashboard/schedule/_hooks/useShiftConflicts.ts` (NEW)
- `apps/web/src/app/dashboard/schedule/_hooks/useScheduleBudget.ts` (NEW)
- `apps/web/src/app/dashboard/schedule/_components/day-control/` (existing budget tab — wire to real data)

---

## J2: Reconcile & Approve Yesterday's Shifts

**Role:** Admin/Manager | **Frequency:** Daily | **Page:** `/dashboard/reconciliation`

### Current State: 65% built

Working: Shift-level approval/rejection with notes, deviation blocking (unresolved safety deviations block approval), revenue section with settlement images.

### Gaps to Close

| Gap                            | Priority | Resolution                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No daily reconciliation prompt | HIGH     | **Guardian signal.** New signal type: `reconciliation_pending`. Fires daily at 09:00 (via `fire-delayed-triggers` Edge Function) if yesterday's `daily_reconciliation.status = 'open'`. Surfaces as warning card on admin dashboard home + notification bell. Uses existing Guardian infrastructure — NOT a custom notification.                |
| No day lock enforcement        | HIGH     | **Schema change.** Add `locked_at TIMESTAMPTZ` and `locked_by UUID REFERENCES profile(profile_id)` to `daily_reconciliation`. RLS policy: `UPDATE` blocked when `locked_at IS NOT NULL`. "Godkjenn dag" sets `locked_at = now()`, `locked_by = current_profile`. Downstream: schedule shifts for that day become immutable. Migration required. |
| No reconciliation audit trail  | MEDIUM   | Use `activity_trail` via `emit()`. Events: `reconciliation.shift_approved`, `reconciliation.shift_disputed`, `reconciliation.day_locked`. Actor + timestamp + notes recorded automatically. No new tables needed.                                                                                                                               |
| No variance analysis           | MEDIUM   | Add variance column to shift approval view: `planned_hours - actual_hours = variance`. Color-code: green (within 15min), orange (15-60min), red (>60min). Data: `schedule_shift.start_time/end_time` vs shift clock actual times.                                                                                                               |

### End-to-End Flow

1. Admin opens dashboard → **Guardian signal card: "1 dag venter avstemming"** (severity: warning)
2. Clicks card → navigates to `/dashboard/reconciliation` for yesterday
3. Reviews each shift: planned hours vs. actual hours (from shift clock) with **variance indicator**
4. Approves or disputes each shift (with notes)
5. Reviews deviations — unresolved safety deviations block day approval
6. Writes handoff message (optional notes field)
7. Clicks "Godkjenn dag" → **`locked_at` set, RLS prevents further edits**, feeds payroll export
8. `emit('reconciliation.day_locked')` fires → activity_trail records audit

### Schema Changes Required

```sql
-- Migration: add lock columns to daily_reconciliation
ALTER TABLE daily_reconciliation
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by UUID REFERENCES profile(profile_id);

-- RLS: prevent updates after lock
CREATE POLICY "block_updates_after_lock" ON daily_reconciliation
  FOR UPDATE USING (locked_at IS NULL);
```

### Key Telemetry Events

- `reconciliation.shift_approved`, `reconciliation.shift_disputed`
- `reconciliation.day_locked`
- `reconciliation.handoff_sent`

### Key Files

- `apps/web/src/app/dashboard/reconciliation/` (existing)
- `supabase/migrations/YYYYMMDDHHMMSS_reconciliation_lock.sql` (NEW)
- Guardian signal definition (NEW — wire into existing guardian infrastructure)

---

## J3: Onboard a New Employee

**Role:** Admin/Manager | **Frequency:** Recurring (high-turnover industry) | **Page:** `/dashboard/people`

### Current State: 50% built

Working: Invitation dialog (email/SMS/link), department + role assignment, invitation tracking (pending/expired/resend/cancel), profile card UI.

### Gaps to Close

| Gap                                 | Priority | Resolution                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No guided post-invite workflow      | HIGH     | After invite sent, show **onboarding pipeline view** on people page. Stacked card list (NOT kanban — per Frontend Designer). Stages: Invited → Signed Up → Training → Ready. Each card: name, readiness %, days since invite. Spring-animated transitions between stages.                                                                                                                    |
| No auto-protocol assignment by role | HIGH     | **Event Engine action handler.** New action type: `assign_protocols`. Fires when employee accepts invite (profile created with `status = 'trainee'`). Rules table: `protocol_auto_assignment` — maps `(department_id, role)` → `protocol_id[]`. Engine-dispatch handler creates `protocol_assignment` rows. Schema decision: new table in `public` schema (small, cross-cutting, 3 columns). |
| No readiness gate before scheduling | MEDIUM   | Soft warning in J1 schedule: when assigning a shift to a trainee (`profile.status = 'trainee'`), show warning: "This employee has not completed required protocols (readiness: 40%)." Does NOT block — admin decides.                                                                                                                                                                        |
| No "employee is ready" notification | MEDIUM   | Guardian signal: `employee_ready`. Fires when trainee's `protocol_assignment` completion reaches 100%. Admin sees notification.                                                                                                                                                                                                                                                              |

### Schema Changes Required

```sql
-- New table: protocol auto-assignment rules
CREATE TABLE protocol_auto_assignment (
  protocol_auto_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  department_id UUID REFERENCES department(department_id),
  role TEXT, -- employee/manager/admin (nullable = all roles)
  protocol_id UUID NOT NULL REFERENCES protocol(protocol_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: workspace-scoped
ALTER TABLE protocol_auto_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jwt_read" ON protocol_auto_assignment FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "jwt_write" ON protocol_auto_assignment FOR ALL
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
```

### End-to-End Flow

1. Admin opens `/dashboard/people` → clicks "Inviter"
2. Fills in name, email, role, department → sends invite
3. **Pipeline view** shows new card in "Invited" stage
4. Employee accepts invite → signs up → card moves to "Signed Up"
5. **Event Engine fires `assign_protocols`** → auto-creates protocol assignments based on department + role rules
6. Employee works through protocols → card shows live readiness %
7. At 100%: `profile.status` flips `trainee → active`
8. **Guardian signal `employee_ready`** → admin gets notification
9. Admin can now schedule their first shift (J1) without readiness warning

### Design: Pipeline View (Frontend Designer guidance)

- **Stacked card list**, NOT kanban. Vertical flow with gravity.
- Cards grouped by stage with count badges.
- Each card: avatar, name, role badge, readiness progress bar, days since invite.
- Spring animation on stage transition (expandSpring: stiffness 30, damping 24, mass 2.5).
- Stagger entrance: 60ms per card.
- Colors: stage headers use status tokens (warning for invited, brand-orange for training, success for ready).

### Key Telemetry Events

- `onboarding.employee_invited`
- `onboarding.employee_signed_up`
- `onboarding.protocols_auto_assigned`
- `onboarding.employee_ready`

### Key Files

- `apps/web/src/app/dashboard/people/page.tsx` (existing — add pipeline view)
- `apps/web/src/app/dashboard/people/_components/onboarding-pipeline.tsx` (NEW)
- `apps/web/src/hooks/governance/useProtocolAssignment.ts` (NEW — shared with J5)
- `supabase/functions/engine-dispatch/index.ts` (add `assign_protocols` handler)
- `supabase/migrations/YYYYMMDDHHMMSS_protocol_auto_assignment.sql` (NEW)

---

## J4: Daily Operations Monitoring

**Role:** Admin/Manager | **Frequency:** Continuous during shift | **Page:** `/dashboard/operations`

### Current State: 80% built

Working: Real-time refresh (60s), stress level (Lav/Middels/Hoy), task completion %, staff present vs. expected, overdue tasks, revenue vs. labor cost chart with tooltips.

### Gaps to Close

| Gap                                | Priority | Resolution                                                                                                                                                                                                                                               |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No incident creation from ops page | MEDIUM   | Add "Registrer avvik" button on operations page. Opens deviation creation dialog (reuse `DeviationForm` if exists, else create). Fields: domain (safety/customer/procedure/system/material), severity, description, department. Creates `deviation` row. |
| No department drill-down           | MEDIUM   | Stress card becomes clickable. Click → expands to show per-department breakdown: department name, staff present/expected, task completion %. Uses existing data from `useOperationsData` but grouped by department.                                      |

### End-to-End Flow

1. Admin opens `/dashboard/operations` → sees live metrics (auto-refresh 60s)
2. Stress indicator: green/orange/red based on capacity %
3. Task completion: done/total with overdue count
4. Staff present vs. expected: gap highlighted
5. Revenue vs. cost chart: hourly bars with NOK tooltips
6. **If stress is high:** admin clicks stress card → expands to department breakdown → identifies which dept is understaffed → takes action
7. **If incident occurs:** admin clicks "Registrer avvik" → logs deviation with domain + severity → deviation appears in reconciliation view (J2)

### Key Telemetry Events

- `operations.deviation_created`
- `operations.stress_acknowledged` (if we add acknowledgment)

### Key Files

- `apps/web/src/app/dashboard/operations/page.tsx` (existing — add deviation button + dept drill-down)
- `apps/web/src/app/dashboard/operations/_components/department-breakdown.tsx` (NEW)

---

## J5: Governance — Create & Assign Protocols

**Role:** Admin | **Frequency:** Setup + periodic updates | **Page:** `/dashboard/governance`

### Current State: 40% built — PAGE IS NON-FUNCTIONAL

**BLOCKING ISSUE:** The governance page (`/dashboard/governance`) currently redirects to `/dashboard/hms`. The components exist (ProtocolForm, ProcedureBuilder, CompetenceMatrix) in `governance/_components/` but are orphaned with no active page rendering them. This journey requires **building the governance page from scratch**, reusing orphaned components.

**Scope acknowledgment (per Supervisor):** This is a full feature implementation, not a gap fix. Estimated 2-3 days of focused work.

### What Must Be Built

| Component                  | Status  | Action                                                                                                                        |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Governance page layout     | MISSING | Build page with 3 tabs: Policies, Protocols, Competence Matrix                                                                |
| Policy CRUD                | PARTIAL | PolicyForm exists — wire to page, add list view                                                                               |
| Protocol CRUD              | PARTIAL | ProtocolForm exists — wire to page, add list view                                                                             |
| Procedure builder          | EXISTS  | ProcedureBuilder works — integrate into protocol creation flow                                                                |
| Knowledge test builder     | EXISTS  | KnowledgeTestBuilder exists — integrate into protocol flow                                                                    |
| Protocol assignment UI     | MISSING | Add to CompetenceMatrix: select protocol → select employees → "Tildel" button. Uses shared `useProtocolAssignment` hook (C3). |
| Completion tracking detail | MISSING | Click matrix cell → slide-over panel shows step-by-step progress for that employee × protocol                                 |
| Confirmation signatures    | PARTIAL | Component exists — wire to completion flow                                                                                    |

### Design: CompetenceMatrix as Hero (Frontend Designer guidance)

- Governance page opens DIRECTLY to CompetenceMatrix (employees × protocols grid).
- Cell colors: emerald (completed), warning/orange (in progress), destructive/red (overdue), muted (not assigned).
- Protocol creation: **slide-over panel** from the right, NOT a separate page. Admin sees matrix context while building.
- Click cell → **slide-over detail panel** shows step-by-step progress with status per step.
- Top bar: filter by department, search by employee name, "Ny protokoll" button.

### End-to-End Flow

1. Admin opens `/dashboard/governance` → sees CompetenceMatrix immediately
2. Matrix: rows = employees, columns = protocols, cells = status (color-coded)
3. **Create:** Admin clicks "Ny protokoll" → slide-over panel opens → fills Protocol form → adds Procedure steps → optionally adds Knowledge Test → saves
4. **Assign:** Admin selects protocol column header → "Tildel til..." → employee picker → creates `protocol_assignment` rows (shared hook with J3)
5. **Track:** Matrix cells update in real-time as employees complete steps
6. **Drill-down:** Admin clicks a cell → slide-over shows step list with checkmarks, test scores, time spent
7. When all steps + test passed → cell turns emerald → readiness score updates

### Key Telemetry Events

- `governance.policy_created`, `governance.policy_updated`
- `governance.protocol_created`, `governance.protocol_updated`
- `governance.protocol_assigned`
- `governance.step_completed`, `governance.test_passed`

### Key Files

- `apps/web/src/app/dashboard/governance/page.tsx` (REWRITE — remove redirect, build real page)
- `apps/web/src/app/dashboard/governance/_components/` (existing — reuse ProtocolForm, ProcedureBuilder, CompetenceMatrix)
- `apps/web/src/app/dashboard/governance/_components/protocol-slide-over.tsx` (NEW)
- `apps/web/src/app/dashboard/governance/_components/completion-detail-panel.tsx` (NEW)
- `apps/web/src/hooks/governance/useProtocolAssignment.ts` (NEW — shared with J3)

---

## J6: Workspace Setup (First-Time)

**Role:** New admin/owner | **Frequency:** Once per workspace | **Page:** `/dashboard/setup`

### Current State: 60% built

Working: Setup wizard with 8 steps (Welcome → Team → Employment → Payroll → Governance → Handbook → Season → Documents). Industry detection via website scraping.

### BLOCKING ISSUE: I1 Bootstrap Not Wired

**STATE.md says:** "13 SQL files in `supabase/templates/restaurant/` — EXISTS but NOT integrated into workspace creation."

This means the setup wizard creates an empty workspace. The spec for J6 includes wiring I1 bootstrap as a prerequisite — without it, the admin gets no industry-seeded data (no default protocols, no tariff baselines, no handbook chapters).

### Gaps to Close

| Gap                                          | Priority            | Resolution                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 bootstrap not wired to workspace creation | HIGH (PREREQUISITE) | Wire `supabase/templates/restaurant/_apply.sql` into the `finalize-workspace` / `finalize_onboarding_workspace` Edge Function. On workspace finalization, detect industry type → apply matching SQL templates → seed `regulatory_framework`, `tariff_rate_table`, default protocols, handbook chapters. This is the I1 → D3/K1a bootstrap path. |
| No setup completion checklist                | MEDIUM              | After wizard, show persistent "Setup health" card on dashboard home. Tracks: departments created, hours set, protocols exist, first employee invited. Card disappears when all items green.                                                                                                                                                     |
| No "what's next" after setup                 | MEDIUM              | Post-setup landing: three **frosted glass cards** with ambient orb treatment (per Frontend Designer). Cards: "Inviter ditt forste teammedlem" → J3, "Lag din forste vaktplan" → J1, "Tilpass dine rutiner" → J5. Spring entrance, staggered 60ms. i18n keys for all text.                                                                       |
| No skip/resume                               | LOW                 | `onboarding_session` table already persists wizard state. Verify it works on browser close + reopen.                                                                                                                                                                                                                                            |

### End-to-End Flow

1. Customer completes `/join` → `/onboarding` → arrives at `/dashboard/setup`
2. Welcome step detects industry → **I1 bootstrap seeds baseline data**: regulatory framework, tariff rates, default protocols, handbook template
3. Steps: Team structure → Employment settings → Payroll config → Governance review (shows seeded protocols, admin can customize) → Handbook customization → Season setup → Document upload
4. Each step shows **pre-filled industry defaults** from I1 bootstrap
5. Wizard completion → system marks `workspace.onboarding_completed = true`
6. Admin lands on dashboard → sees **"Kom i gang" cards** (frosted glass + orb treatment):
   - "Inviter ditt forste teammedlem" → `/dashboard/people`
   - "Lag din forste vaktplan" → `/dashboard/schedule`
   - "Tilpass dine rutiner" → `/dashboard/governance`

### Key Telemetry Events

- `setup.wizard_started`, `setup.step_completed`
- `setup.wizard_completed`
- `setup.i1_bootstrap_applied`

### Key Files

- `apps/web/src/app/dashboard/setup/page.tsx` (existing)
- `apps/web/src/app/dashboard/setup/_adapters/` (existing 8 step adapters)
- `supabase/templates/restaurant/_apply.sql` (existing — needs integration)
- `supabase/functions/finalize-workspace/` or `finalize_onboarding_workspace` (existing — add I1 call)
- `apps/web/src/components/dashboard/PostSetupCards.tsx` (NEW)

---

## J7: Season & Budget Planning

**Role:** Admin/Owner | **Frequency:** Quarterly/seasonal | **Page:** `/dashboard/season`

### Current State: 65% built

Working: Season CRUD, budget form with revenue target/labor%/hourly wage/base price, day/hour factor editors with template presets (restaurant/hotel/event/flat), status management (draft/active/locked).

### Gaps to Close

| Gap                               | Priority | Resolution                                                                                                                                                                                                                                                                             |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget propagation caller unknown | HIGH     | `propagateBudgetTargets()` exists as pure function but is not called anywhere in UI. Wire to season activation: when admin clicks "Aktiver" on a season, call `propagateBudgetTargets()` to generate `workspace_budget` rows (per-date NOK targets). This is the D4 → J1/J2 data path. |
| No budget vs. actual view         | HIGH     | New component on season overview tab: weekly summary showing planned budget vs. actual labor cost (from `shift_cost_snapshot`). Table: week, planned NOK, actual NOK, variance %, status indicator (green/orange/red). This is the retention hook — proving ROI.                       |
| No department-level budgets       | MEDIUM   | Defer to Phase 2. Current: workspace-level only. Note in UI: "Avdelingsbudsjetter kommer snart."                                                                                                                                                                                       |

### End-to-End Flow

1. Admin opens `/dashboard/season` → selects or creates season
2. **Budget tab:** Sets total revenue target, labor %, avg hourly wage, base price per guest
3. **Day factors tab:** Adjusts weekday weights — loads template preset or custom
4. **Hour factors tab:** Adjusts hourly weights for peak/off-peak
5. Admin clicks "Aktiver" → season becomes active → **`propagateBudgetTargets()` runs** → generates `workspace_budget` rows
6. Budget targets flow into:
   - J1 Schedule budget tab: "Today's labor budget: 8 400 kr"
   - J2 Reconciliation variance: "Yesterday: 9 100 kr vs. 8 400 kr budget"
   - J4 Operations: revenue vs. cost chart
7. **Overview tab** shows **budget vs. actual** weekly summary

### Cascade Role

Season budget is the **D4 Demand Signal**. It parameterizes downstream dimensions:

- D6 (Production): shift cost targets
- C1 (Calibration): variance analysis
- C3 (Commercial): cost snapshots

### Key Telemetry Events

- `season.created`, `season.activated`, `season.locked`
- `season.budget_set`, `season.factors_updated`
- `season.budget_propagated`

### Key Files

- `apps/web/src/app/dashboard/season/page.tsx` (existing)
- `apps/web/src/app/dashboard/season/_components/BudgetSetupTab.tsx` (existing)
- `apps/web/src/app/dashboard/season/_components/BudgetActualView.tsx` (NEW)
- `apps/web/src/lib/season-calculations.ts` (existing pure functions)
- `apps/web/src/lib/cascade/propagate-budget-targets.ts` (existing — needs UI caller)

---

## J8: Organization Structure

**Role:** Admin/Owner | **Frequency:** On structural change | **Page:** `/dashboard/organization`

### Current State: 85% built

Working: Full CRUD for departments, locations, zones, assets, positions, teams. 4-tab interface. Count maps (positions per dept, zones/assets per location).

### Gaps to Close

| Gap                                          | Priority | Resolution                                                                                                                                                                                             |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Department operating hours editor incomplete | MEDIUM   | Verify `EditDepartmentDialog` has hours form. If read-only: build weekday × open/close time editor. This is D1 truth — schedule validation (J1) depends on it. Writes to `department_operating_hours`. |
| Team member add/remove inline                | MEDIUM   | Add "Legg til" / "Fjern" buttons in TeamMembersSheet. Currently shows list but no mutation UI. Wire to `team` membership mutations.                                                                    |
| No position → skill mapping                  | LOW      | Defer. Note: needed for future schedule auto-matching but not blocking any current journey.                                                                                                            |

### End-to-End Flow

1. Admin opens `/dashboard/organization`
2. **Departments tab:** Creates departments → sets operating hours per weekday → creates positions under each
3. **Locations tab:** Creates locations → adds zones → registers assets
4. **Teams tab:** Creates teams → adds/removes members inline → sets team leader
5. Changes propagate to:
   - J1 Schedule: department/position dropdowns, operating hours validation
   - J3 Onboarding: department assignment on invite
   - J4 Operations: per-department stress metrics
   - J5 Governance: policy-to-department attachment

### Key Telemetry Events

- `organization.department_created`, `organization.department_updated`
- `organization.location_created`, `organization.zone_created`
- `organization.team_created`, `organization.team_member_added`, `organization.team_member_removed`
- `organization.position_created`

### Key Files

- `apps/web/src/app/dashboard/organization/page.tsx` (existing)
- `apps/web/src/app/dashboard/organization/_components/` (existing — departments, locations, teams tabs)

---

## Daily Status Bar (Cross-Journey UX — Frontend Designer recommendation)

A glanceable cockpit at the top of the admin dashboard home page. Shows the state of the daily loop without navigating to three separate pages.

```
┌─────────────────────────────────────────────────────────────────┐
│ Vaktplan: ✓ Publisert  │  Drift: 🟢 Lav stress  │  Avstemming: ⚠️ 1 dag venter │
└─────────────────────────────────────────────────────────────────┘
```

- Each segment is clickable → navigates to the relevant page
- Status colors: success (emerald), warning (orange), destructive (red)
- Updates via the same data hooks as J1/J2/J4
- Spring entrance animation on dashboard load
- i18n keys for all labels

### Key File

- `apps/web/src/components/dashboard/DailyStatusBar.tsx` (NEW)

---

## Council Issue Resolution Log

All 19 issues from the Internal Council session, resolved:

| #   | Issue                                    | Resolution                                                                         | Where in spec            |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| 1   | I1 bootstrap not wired                   | Included as J6 prerequisite, spec says "wire `_apply.sql` into finalize-workspace" | J6                       |
| 2   | Governance redirects to HMS              | Acknowledged as full feature build, scoped at 2-3 days                             | J5                       |
| 3   | Day lock has no schema                   | Added `locked_at` + `locked_by` columns + RLS policy                               | J2                       |
| 4   | Budget propagation caller unknown        | Wire to season activation button                                                   | J7                       |
| 5   | Auto-protocol assignment needs schema    | New table `protocol_auto_assignment` + Event Engine handler                        | J3                       |
| 6   | Telemetry events not specified           | Each journey lists key events, cross-constraint C1                                 | All                      |
| 7   | Daily status bar                         | Added as cross-journey UX component                                                | Daily Status Bar section |
| 8   | Pipeline: stacked cards not kanban       | Specified in J3 design guidance                                                    | J3                       |
| 9   | CompetenceMatrix as hero                 | Specified in J5 design guidance                                                    | J5                       |
| 10  | Post-setup frosted glass cards           | Specified in J6 design guidance                                                    | J6                       |
| 11  | Emma's role undefined                    | Declared as Phase 2 in constraint C4                                               | C4                       |
| 12  | Auto-assign via Event Engine             | Specified as `assign_protocols` action handler                                     | J3                       |
| 13  | Reconciliation prompt as Guardian signal | Specified as `reconciliation_pending` Guardian signal                              | J2                       |
| 14  | Conflict detection as separate hook      | Specified as `useShiftConflicts.ts` in constraint C5                               | C5 + J1                  |
| 15  | J5 is full feature, scope honestly       | Acknowledged with effort estimate                                                  | J5                       |
| 16  | i18n constraint                          | Cross-constraint C2                                                                | C2                       |
| 17  | Protocol assignment shared component     | Cross-constraint C3                                                                | C3                       |
| 18  | Voice tools Phase 2                      | Cross-constraint C4 with action list                                               | C4                       |
| 19  | Authority defaults                       | Declared in C4 table                                                               | C4                       |

---

## Implementation Priority

Based on three-lens scoring (first-value + daily-use + retention) and dependency order:

| Phase                       | Journey                                        | Reason                                      |
| --------------------------- | ---------------------------------------------- | ------------------------------------------- |
| **Phase 0** (prerequisites) | J6 I1 bootstrap wiring                         | Everything depends on workspace having data |
| **Phase 1a**                | J8 Organization (hours editor + team members)  | Foundation for schedule                     |
| **Phase 1b**                | J1 Schedule (budget + conflicts)               | Highest-rated journey                       |
| **Phase 1c**                | J2 Reconciliation (Guardian prompt + day lock) | Closes the daily loop                       |
| **Phase 2a**                | J5 Governance (full page build)                | The moat — differentiator                   |
| **Phase 2b**                | J3 Onboarding (pipeline + auto-assign)         | Depends on J5 governance                    |
| **Phase 3a**                | J4 Operations (deviation + drill-down)         | Enhancement, not new                        |
| **Phase 3b**                | J7 Season (propagation + budget vs. actual)    | Strategic, lower frequency                  |
| **Phase 4**                 | Voice tools (all journeys)                     | Declared, not specced                       |

---

## Schema Changes Summary

| Table                      | Change                                                                               | Journey |
| -------------------------- | ------------------------------------------------------------------------------------ | ------- |
| `daily_reconciliation`     | `locked_at`, `locked_by` ALREADY EXIST. Need RLS policy to block updates after lock. | J2      |
| `protocol_auto_assignment` | NEW table (workspace_id, department_id, role, protocol_id)                           | J3      |

No other new tables. All other journeys use existing tables.

**Schema placement decision:** `protocol_auto_assignment` goes in `public` schema. Rationale: it's a small cross-cutting config table (3 FK columns + timestamps), references tables in `public` (protocol, department), and doesn't warrant a dedicated schema. Same pattern as `protocol_assignment`.
