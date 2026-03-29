---
title: "User Journeys — Admin Daily Loop"
status: done
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [journey, admin, schedule, reconciliation, operations, daily-loop]
---

# User Journeys — Admin Daily Loop

## Journey 1: Admin checks daily schedule budget

**Precondition:** Admin has an active season with propagated budget targets in `workspace_budget`.

1. Admin opens `/dashboard/schedule` → System loads current week shifts
2. Admin clicks a day cell → System opens Day Control Panel
3. Admin clicks "Budget" tab → System fetches `workspace_budget` for that date via `useScheduleBudget`
4. System shows: target revenue, target labor cost, target staff hours → Admin sees real budget vs. current shift costs
5. If no budget exists → System shows "Set up season budget" message with link to `/dashboard/season`

**Postcondition:** Admin sees labor cost target for each day, informing staffing decisions.

**Error paths:**

- No active season / no budget data → BudgetTab shows empty state with CTA
- Network error on budget fetch → TanStack Query retry, error toast on failure

---

## Journey 2: Admin sees shift conflict warning

**Precondition:** Admin is building a schedule with multiple shifts.

1. Admin opens `/dashboard/schedule` → System loads shifts for the week
2. Admin assigns Employee A to a shift 16:00-23:00 on Monday
3. Admin assigns Employee A to another shift 18:00-02:00 on Monday → System runs `useShiftConflicts` client-side
4. System detects overlap (16:00-23:00 and 18:00-02:00 share 18:00-23:00) → Both shift cards show red ring (`ring-destructive/60 bg-destructive/5`) + AlertTriangle icon
5. Admin hovers conflict indicator → Tooltip shows "Overlapping shifts for same employee"
6. Admin decides: remove one shift, or keep both (system warns but does not block)

**Postcondition:** Admin is aware of the conflict and can act on it.

**Error paths:**

- No conflicts → No indicators shown (default state)
- Single employee with back-to-back shifts (no overlap) → No warning (correct behavior)

---

## Journey 3: Admin reconciles and locks yesterday

**Precondition:** Yesterday's shifts are completed. `daily_reconciliation` record exists with `status = 'open'`.

1. Admin opens `/dashboard` → DailyStatusBar shows reconciliation segment: "1 dag(er) venter" (warning color)
2. Admin clicks reconciliation segment → Navigates to `/dashboard/reconciliation`
3. System loads yesterday's reconciliation → Shows shift list with planned vs. actual hours
4. Admin reviews each shift → Approves or disputes with notes
5. Admin checks for open deviations → If unresolved safety deviations exist, system blocks approval
6. Admin clicks "Godkjenn og las dag" → `lockDayMutation` fires:
   - Sets `locked_at = now()`, `locked_by = profileId`, `status = 'locked'`
   - Emits `"reconciliation locked"` telemetry event
   - Invalidates `["reconciliation"]` and `["unreconciled-days"]` queries
7. System shows lock icon + timestamp → All edit controls disabled
8. DailyStatusBar updates → Reconciliation segment shows "Avstemt" (success color)

**Postcondition:** Day is locked. RLS policy prevents further edits. Telemetry logged for audit trail.

**Error paths:**

- RLS blocks update on already-locked day → Error toast "Kunne ikke lase dagen"
- Network failure → Mutation error handler shows toast, day remains unlocked
- Admin tries to edit after lock → RLS blocks, UI shows lock icon (no edit controls visible)

---

## Journey 4: Admin logs a deviation from operations

**Precondition:** Admin is monitoring live operations.

1. Admin opens `/dashboard/operations` → System shows live metrics (60s refresh)
2. Admin notices a problem (e.g., food safety issue) → Clicks "Registrer avvik" button
3. System opens DeviationDialog → Admin fills in:
   - Title (required): "Kjoleskap temperatur for hoy"
   - Domain: Safety
   - Severity: High
   - Department: Kjokken
   - Description: "Kjoleskap 2 maler 12 grader, skal vaere under 4"
4. Admin clicks "Lagre avvik" → `createDeviationMutation` fires:
   - Inserts to `deviation` table with `reported_by = profileId`
   - Emits `"deviation reported"` telemetry event
   - Invalidates `["operations"]` query
5. System shows success toast → Dialog closes → Operations page refreshes

**Postcondition:** Deviation logged in database. Visible in reconciliation view (blocks day approval if safety domain).

**Error paths:**

- Missing required field (title, domain, severity, description) → Submit button disabled
- Insert fails (RLS, network) → Error toast, dialog stays open with data preserved
- Duplicate submission → Supabase generates unique `deviation_id`, no conflict

---

## Journey 5: Admin drills into department stress

**Precondition:** Admin is monitoring operations with multiple departments active.

1. Admin opens `/dashboard/operations` → Stress card shows aggregate: "Middels" (orange)
2. Admin clicks stress card → System expands `DepartmentBreakdown` with spring animation
3. System shows per-department rows (sorted by capacity %, lowest first):
   - Kjokken: 2/4 staff (50%) — red, AlertTriangle icon
   - Bar: 3/3 staff (100%) — green
   - Service: 4/5 staff (80%) — orange
4. Admin sees Kjokken is understaffed → Takes action (calls backup, reassigns from Service)
5. Admin clicks stress card again → Breakdown collapses with exit animation

**Postcondition:** Admin knows which department is understaffed and can act.

**Error paths:**

- No department sessions today → Breakdown shows empty (component returns null)
- Data not yet loaded → Breakdown waits for operations data (no loading skeleton needed, parent handles)

---

## Journey 6: Admin checks daily status at a glance

**Precondition:** Admin is logged in and on the dashboard home page.

1. Admin opens `/dashboard` → DailyStatusBar renders above view content with spring entrance + 60ms stagger per segment
2. Three segments visible:
   - Schedule: "Vaktplan i utkast" (muted) — Phase 1 placeholder
   - Operations: "Ingen data" (muted) — Phase 1 placeholder
   - Reconciliation: "2 dag(er) venter" (warning) or "Avstemt" (success)
3. Admin clicks any segment → Navigates to corresponding page
4. Status bar stays visible across all admin views (Tactical, Strategic, Reconciliation, Activity, Guardian)

**Postcondition:** Admin has instant awareness of the daily loop state without navigating to three pages.

**Error paths:**

- No workspace context → Status bar hidden (workspaceId undefined)
- Unreconciled days query fails → Reconciliation segment shows "Ingen data" (muted)
